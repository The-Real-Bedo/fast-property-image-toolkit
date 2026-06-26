/**
 * @file src/index.js
 * @description Express server entry point for fast-property-image-toolkit backend.
 *
 * Responsibilities:
 *   - Boot the Express application
 *   - Configure CORS for cross-origin requests from the React frontend
 *   - Serve processed WebP images as static files (with aggressive caching)
 *   - Mount the /api/images route module
 *   - Provide a /health endpoint for load-balancer and uptime checks
 *   - Global error handling with environment-aware responses
 *
 * Usage:
 *   node src/index.js          (production)
 *   nodemon src/index.js       (development — auto-restarts on changes)
 */

'use strict';

require('dotenv').config(); // Load .env before anything else

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const imageRoutes = require('./routes/images');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;

// ─── Middleware: CORS ─────────────────────────────────────────────────────────
/**
 * Restrict cross-origin access.
 * In production, set ALLOWED_ORIGINS to a comma-separated list of client domains:
 *   ALLOWED_ORIGINS=https://yourapp.com,https://admin.yourapp.com
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : '*'; // Open in development; always restrict in production

app.use(cors({
  origin:  allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Middleware: Body Parsers ─────────────────────────────────────────────────
// Only parse JSON for non-upload endpoints.
// Multer handles multipart/form-data internally in the route.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Static File Serving: Processed Images ───────────────────────────────────
/**
 * Serve processed WebP images from the output directory under /images/*.
 *
 * Cache strategy: images are content-addressed (UUID in filename) so they
 * never change once written. We set a 1-year max-age + `immutable` directive
 * so clients and CDN edge nodes cache them aggressively.
 *
 * In production you'd typically skip this and serve directly from S3 / CloudFront.
 */
const OUTPUT_DIR = path.resolve(
  process.env.OUTPUT_DIR ||
  path.join(__dirname, '../public/images')
);

app.use('/images', express.static(OUTPUT_DIR, {
  maxAge:    '1y',
  immutable: true,
  setHeaders(res) {
    // Allow images to be embedded in any origin (for <img> tags on the frontend)
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Hint to CDNs that this is cacheable public content
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/images', imageRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
/**
 * @route GET /health
 * @desc  Simple liveness probe. Returns 200 if the server is up.
 *        Wire this into your load balancer, Kubernetes liveness probe,
 *        or uptime monitoring service.
 */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'fast-property-image-toolkit/backend',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path:  req.path,
    hint:  'Available endpoints: POST /api/images/process, GET /health',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
/**
 * Catches any error forwarded via next(err) from route handlers.
 *
 * In development: includes the full stack trace in the response.
 * In production:  only the human-readable message is returned.
 *
 * Always logs to stderr so the error appears in server logs / Sentry / CloudWatch.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.statusCode || err.status || 500;
  const message = err.message    || 'Internal Server Error';

  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
  if (status === 500) console.error(err.stack);

  res.status(status).json({
    success: false,
    error:   message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' 🏠  fast-property-image-toolkit — Backend');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  API:     http://localhost:${PORT}/api/images/process`);
  console.log(`  Images:  http://localhost:${PORT}/images/<filename.webp>`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Output:  ${OUTPUT_DIR}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Export for integration testing (supertest)
module.exports = app;
