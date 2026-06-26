/**
 * @module routes/images
 * @description Express router for the image processing API.
 *
 * Endpoints:
 *   POST /api/images/process   → Upload + process a property image
 *   GET  /api/images/info/:id  → Retrieve metadata for a processed image set (stub)
 *
 * In a production application you would:
 *   1. Add authentication middleware (JWT, API key, session) before these routes
 *   2. Persist the result of processPropertyImage() to a database
 *   3. Back the GET /info/:id route with a real DB lookup
 *   4. Stream uploads directly to cloud storage (S3, GCS) instead of local disk
 */

'use strict';

const express = require('express');
const path    = require('path');

const { uploadSingle }         = require('../middleware/upload');
const { processPropertyImage } = require('../processor/imageProcessor');

const router = express.Router();

// ─── Config ───────────────────────────────────────────────────────────────────
/**
 * Absolute path where processed WebP images will be saved.
 * Falls back to `packages/backend/public/images` in development.
 * In production, set OUTPUT_DIR to an absolute path on persistent storage
 * or replace the write logic with an S3 upload stream.
 */
const OUTPUT_DIR = path.resolve(
  process.env.OUTPUT_DIR ||
  path.join(__dirname, '../../public/images')
);

/**
 * Public base URL for processed images.
 * In production, set IMAGES_BASE_URL to your CDN origin:
 *   e.g. https://d1abc123.cloudfront.net
 *   e.g. https://my-bucket.s3.eu-west-1.amazonaws.com
 */
const BASE_URL = process.env.IMAGES_BASE_URL || 'http://localhost:4000/images';

// ─── POST /api/images/process ─────────────────────────────────────────────────
/**
 * @route  POST /api/images/process
 * @desc   Upload a property image and receive optimised WebP variants + blur placeholder.
 * @body   multipart/form-data — field name must be "image"
 *
 * @example Request (curl):
 *   curl -X POST http://localhost:4000/api/images/process \
 *     -F "image=@/path/to/property-photo.jpg"
 *
 * @example Response (201 Created):
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "c3f5e8a1-...",
 *       "blurDataUrl": "data:image/webp;base64,UklGRh4A...",
 *       "sizes": {
 *         "thumbnail": { "url": "http://localhost:4000/images/c3f5e8a1-thumbnail.webp", "width": 400, "height": 267, "bytes": 12840 },
 *         "mobile":    { "url": "http://localhost:4000/images/c3f5e8a1-mobile.webp",    "width": 800, "height": 533, "bytes": 45200 },
 *         "desktop":   { "url": "http://localhost:4000/images/c3f5e8a1-desktop.webp",   "width": 1920, "height": 1280, "bytes": 182400 }
 *       },
 *       "original": { "width": 4032, "height": 3024, "format": "jpeg", "space": "srgb" },
 *       "createdAt": "2024-03-15T10:23:41.000Z"
 *     }
 *   }
 */
router.post('/process', async (req, res, next) => {
  try {
    // ── Step 1: Parse the multipart upload ───────────────────────────────────
    // uploadSingle validates MIME type and size, then populates req.file.buffer
    await uploadSingle(req, res);

    // Guard: multer won't throw if no file was sent; we handle it explicitly
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:   'No image provided. Include a file in the "image" multipart field.',
        hint:    'Content-Type must be multipart/form-data',
      });
    }

    // ── Step 2: Log incoming file (development-friendly, remove in production) ──
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[images/process] Received: ${req.file.originalname} ` +
        `(${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)} KB)`
      );
    }

    // ── Step 3: Run the image processing pipeline ────────────────────────────
    // All three WebP variants + blur placeholder are produced here.
    const result = await processPropertyImage(req.file.buffer, {
      outputDir: OUTPUT_DIR,
      baseUrl:   BASE_URL,
    });

    // ── Step 4 (Production): Persist the result to your database ─────────────
    // Example (MongoDB):  await ImageModel.create(result);
    // Example (Postgres):  await db.query('INSERT INTO images ...', [result.id, ...]);
    // Example (Redis):     await redis.set(`image:${result.id}`, JSON.stringify(result));

    // ── Step 5: Return the structured result ─────────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
      const savings = Object.entries(result.sizes)
        .map(([k, v]) => `${k}: ${(v.bytes / 1024).toFixed(1)} KB`)
        .join(' | ');
      console.log(`[images/process] Done (${result.id}) → ${savings}`);
    }

    return res.status(201).json({
      success: true,
      data:    result,
    });
  } catch (err) {
    // Forward to the global error handler in src/index.js
    next(err);
  }
});

// ─── GET /api/images/info/:id ─────────────────────────────────────────────────
/**
 * @route  GET /api/images/info/:id
 * @desc   Retrieve the stored metadata for a previously processed image set.
 *         Replace this stub with a real DB lookup in production.
 *
 * @example Request: GET /api/images/info/c3f5e8a1-...
 */
router.get('/info/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with your database lookup, e.g.:
    //   const image = await ImageModel.findById(id);
    //   if (!image) return res.status(404).json({ error: 'Image not found' });
    //   return res.json({ success: true, data: image });

    return res.status(501).json({
      success: false,
      message: 'Database lookup not implemented.',
      hint:    `Store the result of processPropertyImage() and query by id: "${id}"`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
