/**
 * @module upload
 * @description Multer upload middleware for property image uploads.
 *
 * Uses `memoryStorage` so the uploaded bytes land in `req.file.buffer`
 * without ever touching the filesystem — ideal for:
 *   - Docker / serverless environments (ephemeral disks)
 *   - Piping directly into `sharp` without a temp-file round-trip
 *   - Cloud deployments where local disk I/O is expensive
 *
 * Applies three layers of validation:
 *   1. MIME type whitelist   — rejects non-image files at the multer level
 *   2. File size hard cap    — configurable via MAX_FILE_SIZE_BYTES env var
 *   3. Single-file enforcer  — only one image per POST request
 */

'use strict';

const multer = require('multer');

// ─── Allowed MIME Types ───────────────────────────────────────────────────────
/**
 * Whitelist of image MIME types accepted for upload.
 *
 * Includes both web-native formats and high-quality camera/scanner formats.
 * Note: `sharp` can decode all of these natively on supported platforms.
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',       // Some browsers send this non-standard variant
  'image/png',
  'image/webp',      // Accept WebP as input too (will still be processed/resized)
  'image/tiff',      // Professional cameras and flatbed scanners
  'image/heic',      // iPhone (HEIF container) — requires libheif on the server
  'image/heif',      // HEIF standard
  'image/avif',      // Modern high-efficiency format
]);

// ─── Size Limit ───────────────────────────────────────────────────────────────
/**
 * Maximum accepted file size.
 * Default: 50 MB — covers full-resolution DSLR JPEGs and drone photography.
 * Override via the MAX_FILE_SIZE_BYTES environment variable.
 */
const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) || 50 * 1024 * 1024; // 50 MB

// ─── File Filter ──────────────────────────────────────────────────────────────
/**
 * Multer file filter function.
 *
 * Called for every file in the request before it's written to storage.
 * Rejects files whose MIME type isn't in the whitelist with a descriptive
 * 400 error — before any bytes are read, saving bandwidth.
 *
 * @param {Express.Request}   req
 * @param {Express.Multer.File} file
 * @param {multer.FileFilterCallback} callback
 */
function fileFilter(req, file, callback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(null, true); // ✅ Accept
  } else {
    const allowed = [...ALLOWED_MIME_TYPES].join(', ');
    const error = Object.assign(
      new Error(`Unsupported file type "${file.mimetype}". Accepted: ${allowed}`),
      { statusCode: 400 }
    );
    callback(error, false); // ❌ Reject
  }
}

// ─── Multer Instance ──────────────────────────────────────────────────────────
/**
 * Configured multer middleware instance.
 *
 * `memoryStorage` keeps the file in RAM (`req.file.buffer`) rather than
 * writing it to disk. The buffer is passed directly to `sharp` in the route.
 */
const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// ─── Promise Wrapper ──────────────────────────────────────────────────────────
/**
 * Wraps `multer.single('image')` in a Promise so it integrates cleanly
 * with async/await Express route handlers (no callback pyramid).
 *
 * After this resolves, `req.file` contains:
 *   - `buffer`       → raw image bytes (pass to sharp)
 *   - `originalname` → uploaded filename
 *   - `mimetype`     → detected MIME type
 *   - `size`         → bytes received
 *
 * @param {Express.Request}  req
 * @param {Express.Response} res
 * @returns {Promise<void>} Resolves when multer has finished parsing the request.
 * @throws {Error} On file-too-large, wrong type, or unexpected multer errors.
 */
function uploadSingle(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (err) => {
      if (!err) {
        resolve();
        return;
      }

      // ── Translate multer error codes into HTTP-friendly status codes ──────
      if (err.code === 'LIMIT_FILE_SIZE') {
        const limitMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
        err.statusCode = 413; // HTTP 413 Payload Too Large
        err.message    = `Image exceeds the ${limitMB} MB size limit.`;
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        err.statusCode = 400;
        err.message    = 'Unexpected field. Use the "image" field name for the file.';
      }

      reject(err);
    });
  });
}

module.exports = {
  uploadSingle,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
