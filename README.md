<div align="center">

# 🏠 fast-property-image-toolkit

**End-to-end image pipeline for real estate apps**

WebP conversion · Multi-size generation · Blur placeholder · React lazy loading

[![CI](https://github.com/The-Real-Bedo/fast-property-image-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/The-Real-Bedo/fast-property-image-toolkit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

[Demo](https://the-real-bedo.github.io/fast-property-image-toolkit/) · [Report a bug](https://github.com/The-Real-Bedo/fast-property-image-toolkit/issues) · [Request a feature](https://github.com/The-Real-Bedo/fast-property-image-toolkit/issues)

</div>

---

## What it solves

Property photos are heavy — a single listing photo can be **5–10 MB**. Loading 20 of them tanks your page speed score and frustrates users on mobile.

This toolkit handles the full pipeline:

```
Raw upload (8 MB JPEG)
       │
       ▼  Node.js + sharp
┌──────────────────────────────────┐
│  Generate 3 WebP variants        │
│  • thumbnail  →   11 KB          │
│  • mobile     →   42 KB          │
│  • desktop    →  178 KB          │
│                                  │
│  Generate blur placeholder       │
│  • Base64 data URL  → < 0.5 KB   │
└──────────────────────────────────┘
       │
       ▼  React component
 blur placeholder shown instantly
       ↓
 full image fades in when ready ✨
```

---

## Packages

| Package | Description |
|---------|-------------|
| `packages/backend` | Node.js / Express processor using [sharp](https://sharp.pixelplumbing.com/) |
| `packages/frontend` | React + TypeScript component with lazy loading |

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/The-Real-Bedo/fast-property-image-toolkit.git
cd fast-property-image-toolkit
npm install --workspace=packages/backend
```

### 2. Configure the backend

```bash
cd packages/backend
cp .env.example .env
# Edit .env — set ALLOWED_ORIGINS and IMAGES_BASE_URL
```

### 3. Start the server

```bash
# From the repo root:
npm run dev:backend
# → http://localhost:4000
```

### 4. Process your first image

```bash
curl -X POST http://localhost:4000/api/images/process \
  -F "image=@/path/to/property.jpg"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "original": { "name": "property.jpg", "width": 4000, "height": 3000, "format": "jpeg" },
    "sizes": {
      "thumbnail": { "url": "http://localhost:4000/images/property-1234-thumbnail.webp", "width": 200, "height": 150, "sizeKb": 11 },
      "mobile":    { "url": "http://localhost:4000/images/property-1234-mobile.webp",    "width": 640, "height": 480, "sizeKb": 42 },
      "desktop":   { "url": "http://localhost:4000/images/property-1234-desktop.webp",   "width": 1280, "height": 960, "sizeKb": 178 }
    },
    "blurDataUrl": "data:image/webp;base64,UklGRl...",
    "processedAt": "2025-06-01T10:00:00.000Z"
  }
}
```

### 5. Use the React component

Copy the `packages/frontend/src` folder into your React project, then:

```tsx
import { PropertyImage } from './components/PropertyImage';

// data = the response you got from POST /api/images/process
<PropertyImage
  data={apiResponse.data}
  alt="Luxury villa in New Cairo"
/>
```

That's it — lazy loading, progressive blur, and responsive `srcset` are all handled automatically.

---

## API reference

### `POST /api/images/process`

| Field | Type | Notes |
|-------|------|-------|
| `image` | `File` (form-data) | JPEG, PNG, WebP, AVIF, or TIFF. Max 50 MB |

**Error responses:**

| Code | Reason |
|------|--------|
| `400` | No file attached, or unsupported file type |
| `413` | File exceeds 50 MB limit |
| `500` | Processing failed (corrupt file, etc.) |

### `GET /health`

Returns `{ "status": "ok", "timestamp": "..." }` — useful for load balancer health checks.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `IMAGES_BASE_URL` | `http://localhost:4000` | Base URL for generated image URLs |
| `IMAGES_OUTPUT_DIR` | `packages/backend/public/images` | Where to save processed files |

---

## Going to production

### 1. Point to a CDN

Set `IMAGES_BASE_URL=https://cdn.yourapp.com` and upload files to S3/Cloudflare R2 instead of local disk. Replace `sharp.toFile()` with your storage SDK upload.

### 2. Secure the upload endpoint

Add authentication middleware before the route:

```js
// packages/backend/src/routes/images.js
router.post('/process', authMiddleware, uploadSingle, async (req, res) => { ... });
```

### 3. Set CORS correctly

```
ALLOWED_ORIGINS=https://yourapp.com,https://admin.yourapp.com
```

---

## Running tests

```bash
npm test --workspace=packages/backend
```

10 tests covering the processor, middleware, and API endpoints.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs are welcome!

---

## License

[MIT](LICENSE) © 2025 The-Real-Bedo
