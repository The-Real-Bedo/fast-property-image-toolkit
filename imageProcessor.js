/**
 * @module imageProcessor
 * @description Core image processing engine for fast-property-image-toolkit.
 *
 * This module is the heart of the toolkit. It uses the `sharp` library to:
 *   1. Read a raw uploaded image buffer (from multer memoryStorage)
 *   2. Extract source metadata (dimensions, format, colour space)
 *   3. Auto-rotate based on EXIF orientation data (fixes camera photos)
 *   4. Generate an ultra-lightweight Base64 WebP blur placeholder (≈300–600 chars)
 *   5. Produce three optimised WebP size variants — in parallel — for:
 *        - thumbnail  → property cards, search grids
 *        - mobile     → full-screen detail view on phones/tablets
 *        - desktop    → full-screen detail view on large screens
 *   6. Return a structured JSON payload ready to persist in a database
 *      and to be returned directly to the API caller.
 *
 * @example
 * const { processPropertyImage } = require('./imageProcessor');
 *
 * // Inside an Express async route handler:
 * const result = await processPropertyImage(req.file.buffer, {
 *   outputDir: '/var/www/static/property-images',
 *   baseUrl:   'https://cdn.example.com/property-images',
 * });
 * // result → { id, blurDataUrl, sizes: { thumbnail, mobile, desktop }, original, createdAt }
 * await db.images.insert(result); // Persist before returning to client
 * res.status(201).json({ success: true, data: result });
 */

'use strict';

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// ─── Size Configuration ───────────────────────────────────────────────────────
/**
 * Defines every output size variant.
 *
 * `fit: 'cover'`  → crops to fill the exact box (thumbnail, good for uniform grids)
 * `fit: 'inside'` → scales down preserving the full frame, no crop (detail views)
 * `position: 'attention'` → Sharp's entropy/saliency detection for intelligent crop
 * `withoutEnlargement: true` → never upscale a small input; just save it as-is
 *
 * You can extend this object to add more variants (e.g., 'og_image' for social sharing).
 */
const SIZE_CONFIGS = {
  thumbnail: {
    width:    400,
    height:   267,          // 3∶2 landscape — universal property card ratio
    fit:      'cover',      // Smart crop — fills the box exactly
    position: 'attention',  // AI focal-point detection to keep the subject centred
    quality:  75,           // WebP quality 0–100 (75 = excellent balance for thumbnails)
  },
  mobile: {
    width:    800,
    height:   null,         // null = auto height, preserves full composition
    fit:      'inside',     // No crop — agents want the whole property in frame
    position: 'centre',
    quality:  80,
  },
  desktop: {
    width:    1920,
    height:   null,
    fit:      'inside',
    position: 'centre',
    quality:  85,           // Slightly higher quality for large-screen hero images
  },
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Ensures a directory exists, creating the full path recursively if needed.
 * Idempotent — safe to call even if the directory already exists.
 *
 * @param {string} dirPath - Absolute path to create.
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Generates an ultra-lightweight Base64-encoded WebP blur placeholder.
 *
 * Strategy:
 *   ① Resize the input to just 20px wide (keeping aspect ratio via 'inside')
 *   ② Apply a Gaussian blur (σ=4) to smooth out block artifacts
 *   ③ Re-encode as WebP at quality=20 — maximum compression for a colour blob
 *   ④ Convert the tiny buffer to a Base64 data URI
 *
 * The resulting string is typically 300–600 characters — small enough to be:
 *   - Returned inline in the JSON API response
 *   - Stored as a DB column
 *   - Embedded in the initial HTML payload (no extra network request)
 *
 * On the frontend this 20px blob is CSS-scaled to full size with a
 * `filter: blur(16px)` overlay, which makes it look like a smooth
 * gaussian-blurred thumbnail — the classic progressive-loading effect.
 *
 * @param {Buffer} inputBuffer - Raw bytes of the full-resolution source image.
 * @returns {Promise<string>}  A `data:image/webp;base64,…` URI string.
 */
async function generateBlurPlaceholder(inputBuffer) {
  const blurBuffer = await sharp(inputBuffer)
    .rotate()                                    // Honour EXIF orientation
    .resize(20, null, { fit: 'inside' })         // 20px wide, height auto
    .blur(4)                                     // Gaussian blur to mask pixelation
    .webp({ quality: 20 })                       // Aggressive compression — it's a blob
    .toBuffer();

  return `data:image/webp;base64,${blurBuffer.toString('base64')}`;
}

/**
 * Processes a single size variant and writes the result to disk.
 *
 * @param {Buffer} inputBuffer - Raw bytes of the original image.
 * @param {object} config      - Entry from SIZE_CONFIGS.
 * @param {string} outputPath  - Absolute path to write the WebP file.
 * @returns {Promise<sharp.OutputInfo>} Sharp's output metadata (width, height, size in bytes).
 */
async function processSizeVariant(inputBuffer, config, outputPath) {
  // Build resize options — only include height when explicitly set
  const resizeOptions = {
    width:              config.width,
    fit:                config.fit,
    position:           config.position || 'centre',
    withoutEnlargement: true,  // Protect small images from upscaling artefacts
    ...(config.height && { height: config.height }),
  };

  return sharp(inputBuffer)
    .rotate()                    // Auto-rotate before resize (avoids rotating the large image twice)
    .resize(resizeOptions)
    .webp({
      quality: config.quality,
      effort:  4,                // effort 0–6; 4 = good speed/compression trade-off
      smartSubsample: true,      // Improves colour accuracy at lower quality settings
    })
    .toFile(outputPath);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * The primary image processing pipeline.
 *
 * Accepts a raw image buffer (from `multer`'s `memoryStorage`), processes it
 * into multiple WebP size variants, generates a blur placeholder, and returns
 * a fully structured JSON result.
 *
 * All size variants are processed in parallel via Promise.all() for maximum
 * throughput — on a modern server this typically completes in 200–800 ms
 * depending on the source image size.
 *
 * @param {Buffer} inputBuffer          - Raw bytes of the uploaded image.
 * @param {object} options
 * @param {string} options.outputDir    - Absolute filesystem path to save WebP files.
 * @param {string} options.baseUrl      - Public base URL for the saved files.
 *                                        e.g. 'https://cdn.example.com/property-images'
 * @param {string} [options.id]         - Optional custom ID; a UUID v4 is auto-generated if omitted.
 *
 * @returns {Promise<ProcessedImageResult>}
 *
 * @throws {Error} If outputDir or baseUrl is missing.
 * @throws {Error} If sharp fails to decode the input (corrupt / unsupported format).
 *
 * ─── Return Type ──────────────────────────────────────────────────────────────
 * @typedef {object} ImageSizeResult
 * @property {string} url    - Fully qualified public URL for this variant.
 * @property {number} width  - Actual output width in pixels (may differ if input was smaller).
 * @property {number} height - Actual output height in pixels.
 * @property {number} bytes  - File size on disk in bytes — useful for logging/auditing.
 *
 * @typedef {object} ProcessedImageResult
 * @property {string}       id          - UUID for this image set. Use as a DB primary key.
 * @property {string}       blurDataUrl - Tiny Base64 WebP for use as the blur placeholder.
 * @property {object}       sizes       - { thumbnail: ImageSizeResult, mobile: ImageSizeResult, desktop: ImageSizeResult }
 * @property {object}       original    - { width, height, format, space } of the source image.
 * @property {string}       createdAt   - ISO-8601 timestamp of when processing completed.
 */
async function processPropertyImage(inputBuffer, options = {}) {
  const { outputDir, baseUrl, id = uuidv4() } = options;

  // ── Guard: required options ───────────────────────────────────────────────
  if (!outputDir) throw new Error('[imageProcessor] options.outputDir is required.');
  if (!baseUrl)   throw new Error('[imageProcessor] options.baseUrl is required.');

  // ── Ensure the output directory exists ───────────────────────────────────
  await ensureDir(outputDir);

  // ── Step 1: Extract source metadata (non-destructive, very fast) ─────────
  // We read metadata before any transforms to preserve original dimensions.
  const meta = await sharp(inputBuffer).metadata();

  // ── Step 2: Generate blur placeholder ────────────────────────────────────
  // This is fast because it operates on a 20px wide thumbnail.
  const blurDataUrl = await generateBlurPlaceholder(inputBuffer);

  // ── Step 3: Process all size variants in parallel ────────────────────────
  // Promise.all() fires all three sharp pipelines concurrently.
  // On a 4-core server this cuts total processing time roughly in half
  // compared to sequential processing.
  const sizeEntries = await Promise.all(
    Object.entries(SIZE_CONFIGS).map(async ([sizeName, config]) => {
      // Content-addressed filename: {uuid}-{sizeName}.webp
      // UUID ensures no collisions; size name allows easy identification.
      const filename   = `${id}-${sizeName}.webp`;
      const outputPath = path.join(outputDir, filename);

      const info = await processSizeVariant(inputBuffer, config, outputPath);

      return [sizeName, {
        url:    `${baseUrl}/${filename}`,
        width:  info.width,
        height: info.height,
        bytes:  info.size,   // sharp calls it .size, we rename to .bytes for clarity
      }];
    })
  );

  // ── Step 4: Assemble and return the structured result ────────────────────
  return {
    id,
    blurDataUrl,
    sizes: Object.fromEntries(sizeEntries),  // { thumbnail: {...}, mobile: {...}, desktop: {...} }
    original: {
      width:  meta.width,
      height: meta.height,
      format: meta.format,   // 'jpeg', 'png', 'heif', etc.
      space:  meta.space,    // 'srgb', 'cmyk', etc.
    },
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  processPropertyImage,
  SIZE_CONFIGS,  // Exported so users can read/override via their own config layer
};
