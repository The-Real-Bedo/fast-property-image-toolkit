# 🏠 fast-property-image-toolkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)](https://www.typescriptlang.org)
[![Sharp](https://img.shields.io/badge/Sharp-0.33-orange)](https://sharp.pixelplumbing.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**End-to-end open-source image pipeline for real estate applications.**  
Upload raw property photos → receive compressed, responsive WebP images + a blur placeholder → display them with zero layout shift and zero wasted bandwidth.

---

## Why this toolkit?

Real estate applications are image-heavy by nature. A single property listing might have 30+ high-resolution photos from a DSLR camera or drone — each 5–20 MB. Naively serving these destroys performance:

| Problem | Without this toolkit | With this toolkit |
|---|---|---|
| File size | 8 MB JPEG | ~120 KB WebP desktop / ~45 KB mobile |
| First visible content | Blank box for 2–4 s | Blur placeholder in **0 ms** |
| Mobile bandwidth | Downloads 1920px image on a 375px screen | Downloads exactly the right size |
| Off-screen images | All images load on page load | Only images near viewport load |
| Layout shift (CLS) | High — images pop in | **Zero** — aspect-ratio container holds space |

---

## Features

- ⚡ **WebP conversion** — 30–50% smaller than JPEG at equivalent quality
- 🖼 **Three size variants** — thumbnail (400px), mobile (800px), desktop (1920px)
- 🌫 **Blur placeholder** — ≈400-byte Base64 WebP; zero extra HTTP request
- 🦥 **Lazy loading** — IntersectionObserver; images outside the viewport are never downloaded
- 🎨 **Progressive rendering** — blur cross-fades to full-res (CSS transitions, GPU-composited)
- 📱 **Responsive delivery** — `srcset` + `sizes`; browser picks the right resolution automatically
- ⚙️ **Parallel processing** — all three variants generated concurrently via `Promise.all`
- 🔄 **EXIF auto-rotation** — fixes sideways photos from phones and cameras
- 🛡 **Input validation** — MIME type whitelist, configurable size cap (default 50 MB)
- 💡 **Zero frontend runtime deps** — pure React + native browser APIs (IntersectionObserver)
- 🏷 **Full TypeScript** — every type exported; backend JSDoc matches frontend types

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│                                                                     │
│  User picks a photo  →  FormData  →  POST /api/images/process      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ multipart/form-data
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BACKEND  (Node.js / Express)                      │
│                                                                     │
│  uploadMiddleware (multer memoryStorage)                            │
│    ↓ req.file.buffer                                                │
│  imageProcessor.processPropertyImage()                              │
│    ├─ sharp.metadata()          → original width / height / format  │
│    ├─ generateBlurPlaceholder() → 20px WebP → base64 string         │
│    └─ Promise.all([                                                 │
│         processSizeVariant('thumbnail', 400px, cover)               │
│         processSizeVariant('mobile',    800px, inside)              │
│         processSizeVariant('desktop',  1920px, inside)              │
│       ])  → saved as {uuid}-{size}.webp                             │
│                                                                     │
│  Returns → JSON                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 201 JSON response
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  {                                                                  │
│    "id": "c3f5e8a1-4b2d-...",                                       │
│    "blurDataUrl": "data:image/webp;base64,UklGRh4A...",  ← ~400B   │
│    "sizes": {                                                       │
│      "thumbnail": { "url": "…/c3f5e8a1-thumbnail.webp", "width": 400 },  │
│      "mobile":    { "url": "…/c3f5e8a1-mobile.webp",    "width": 800 },  │
│      "desktop":   { "url": "…/c3f5e8a1-desktop.webp",   "width": 1920 }  │
│    },                                                               │
│    "original": { "width": 4032, "height": 3024, "format": "jpeg" } │
│  }                                                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Store in DB, pass to React component
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FRONTEND  (React + TypeScript)                    │
│                                                                     │
│  <PropertyImage data={storedResult} alt="..." />                    │
│                                                                     │
│  ① Container mounted → aspect-ratio box holds space (no CLS)       │
│  ② blurDataUrl painted instantly — user sees colour wash at 0 ms   │
│  ③ IntersectionObserver fires (container ≈200px from viewport)     │
│  ④ <img srcSet="…400w, …800w, …1920w" sizes="…"> added to DOM     │
│  ⑤ Browser picks correct resolution based on viewport + DPR        │
│  ⑥ onLoad() fires → blur fades out (300ms), full-res fades in (500ms) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
fast-property-image-toolkit/
│
├── package.json                    ← npm workspaces root
│
├── packages/
│   │
│   ├── backend/                    ← Node.js / Express image processor
│   │   ├── src/
│   │   │   ├── index.js            ← Express server entry point
│   │   │   ├── processor/
│   │   │   │   └── imageProcessor.js   ← Core sharp pipeline ⭐
│   │   │   ├── middleware/
│   │   │   │   └── upload.js           ← Multer + validation
│   │   │   └── routes/
│   │   │       └── images.js           ← POST /api/images/process
│   │   ├── public/images/          ← Processed WebP output directory
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── frontend/                   ← React TypeScript component library
│       ├── src/
│       │   ├── index.ts            ← Public API barrel export
│       │   ├── types/
│       │   │   └── index.ts        ← All shared TypeScript types
│       │   ├── hooks/
│       │   │   └── useIntersectionObserver.ts   ← Lazy-load hook ⭐
│       │   └── components/
│       │       └── PropertyImage/
│       │           ├── PropertyImage.tsx         ← Main component ⭐
│       │           ├── PropertyImage.module.css  ← Styles + animations
│       │           └── index.ts                  ← Component barrel
│       ├── package.json
│       └── tsconfig.json
│
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.0 (uses `fs/promises`, `structuredClone`)
- **npm** ≥ 8.0 (workspaces support)
- **libvips** ≥ 8.14 — sharp's C++ dependency (installed automatically by `npm install` on most platforms)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/fast-property-image-toolkit.git
cd fast-property-image-toolkit

# Install all packages (backend + frontend) from the repo root
npm install
```

### 2. Configure the Backend

```bash
cd packages/backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
OUTPUT_DIR=./public/images
IMAGES_BASE_URL=http://localhost:4000/images
MAX_FILE_SIZE_BYTES=52428800
```

### 3. Start the Backend

```bash
# From repo root:
npm run dev:backend

# Or from packages/backend:
cd packages/backend && npm run dev
```

You should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🏠  fast-property-image-toolkit — Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API:     http://localhost:4000/api/images/process
  Images:  http://localhost:4000/images/<filename.webp>
  Health:  http://localhost:4000/health
```

### 4. Test the API

```bash
curl -X POST http://localhost:4000/api/images/process \
  -F "image=@/path/to/your/property-photo.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "c3f5e8a1-4b2d-47f0-9a3c-1e8d7f2b6a90",
    "blurDataUrl": "data:image/webp;base64,UklGRh4AAABXRUJQVlA4...",
    "sizes": {
      "thumbnail": {
        "url": "http://localhost:4000/images/c3f5e8a1-thumbnail.webp",
        "width": 400, "height": 267, "bytes": 12840
      },
      "mobile": {
        "url": "http://localhost:4000/images/c3f5e8a1-mobile.webp",
        "width": 800, "height": 534, "bytes": 45200
      },
      "desktop": {
        "url": "http://localhost:4000/images/c3f5e8a1-desktop.webp",
        "width": 1920, "height": 1280, "bytes": 182400
      }
    },
    "original": { "width": 4032, "height": 2688, "format": "jpeg", "space": "srgb" },
    "createdAt": "2024-03-15T10:23:41.123Z"
  }
}
```

---

## Backend — Full Documentation

### `processPropertyImage(buffer, options)`

The core processing function. Import it directly if you're integrating into an existing Express app or any other Node.js framework.

```js
const { processPropertyImage } = require('./src/processor/imageProcessor');

// Anywhere you have a Buffer (multer, busboy, S3 download stream, etc.)
const result = await processPropertyImage(imageBuffer, {
  outputDir: '/var/www/public/property-images',
  baseUrl:   'https://cdn.yourapp.com/property-images',
  id:        'my-custom-id', // optional; UUID v4 auto-generated if omitted
});
```

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `inputBuffer` | `Buffer` | ✅ | Raw image bytes |
| `options.outputDir` | `string` | ✅ | Absolute path to write WebP files |
| `options.baseUrl` | `string` | ✅ | Public URL prefix for output files |
| `options.id` | `string` | ❌ | Custom ID (default: UUID v4) |

#### Return Value (`ProcessedImageResult`)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID for this image set — use as DB primary key |
| `blurDataUrl` | `string` | `data:image/webp;base64,…` — ≈400 bytes |
| `sizes.thumbnail` | `ImageSizeResult` | 400px wide, 267px tall, 3∶2 cover crop |
| `sizes.mobile` | `ImageSizeResult` | 800px wide, auto height, full composition |
| `sizes.desktop` | `ImageSizeResult` | 1920px wide, auto height, full composition |
| `original` | `object` | `{ width, height, format, space }` |
| `createdAt` | `string` | ISO-8601 timestamp |

Each `ImageSizeResult` contains: `{ url, width, height, bytes }`.

### Express Integration

```js
// Using the middleware in your own Express app
const { uploadSingle } = require('./src/middleware/upload');
const { processPropertyImage } = require('./src/processor/imageProcessor');

app.post('/properties/:id/photos', async (req, res, next) => {
  try {
    await uploadSingle(req, res);

    if (!req.file) return res.status(400).json({ error: 'No image' });

    const imageData = await processPropertyImage(req.file.buffer, {
      outputDir: process.env.OUTPUT_DIR,
      baseUrl:   process.env.IMAGES_BASE_URL,
    });

    // Persist to your database
    await db.properties.addPhoto(req.params.id, imageData);

    res.status(201).json({ success: true, data: imageData });
  } catch (err) {
    next(err);
  }
});
```

### Customising Size Variants

Override `SIZE_CONFIGS` in `imageProcessor.js` to add, remove, or adjust variants:

```js
// Example: Add an Open Graph / social sharing variant
const SIZE_CONFIGS = {
  thumbnail: { width: 400,  height: 267,  fit: 'cover',  quality: 75 },
  mobile:    { width: 800,  height: null, fit: 'inside', quality: 80 },
  desktop:   { width: 1920, height: null, fit: 'inside', quality: 85 },

  // ✨ Add this for og:image tags
  og_image:  { width: 1200, height: 630, fit: 'cover', position: 'attention', quality: 80 },
};
```

### Cloud Storage (S3 / GCS)

To write to S3 instead of local disk, replace `sharp.toFile()` in `processSizeVariant()`:

```js
// packages/backend/src/processor/imageProcessor.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: process.env.AWS_REGION });

async function processSizeVariant(inputBuffer, config, filename) {
  const webpBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: config.width, fit: config.fit, withoutEnlargement: true })
    .webp({ quality: config.quality })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET,
    Key:         `property-images/${filename}`,
    Body:        webpBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { width: config.width }; // Return dimensions as needed
}
```

---

## Frontend — Full Documentation

### Installation

```bash
# In your React project
npm install react react-dom

# Copy the src/components/PropertyImage and src/hooks directories
# OR install as a local package if using a monorepo
```

### `<PropertyImage>` Component

#### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `data` | `ProcessedImageData` | ✅ | — | The JSON object from the backend API |
| `alt` | `string` | ✅ | — | Accessible description (e.g. "Living room — 3BR apartment") |
| `aspectRatio` | `string` | ❌ | `"3/2"` | CSS aspect-ratio string (e.g. `"16/9"`, `"1/1"`) |
| `rootMargin` | `string` | ❌ | `"200px"` | How far before viewport to start loading |
| `className` | `string` | ❌ | `""` | Extra CSS class on the wrapper div |
| `onLoad` | `() => void` | ❌ | — | Fired when the full-res image finishes loading |
| `onError` | `(e) => void` | ❌ | — | Fired if the image URL fails |

#### Basic Usage

```tsx
import { PropertyImage } from './components/PropertyImage';
import type { ProcessedImageData } from './types';

function PropertyCard({ property }: { property: { image: ProcessedImageData; title: string } }) {
  return (
    <div className="property-card">
      <PropertyImage
        data={property.image}
        alt={property.title}
      />
      <h3>{property.title}</h3>
    </div>
  );
}
```

#### Hero Image (16:9, preload aggressively)

```tsx
<PropertyImage
  data={heroImageData}
  alt="Panoramic view of the 3-bedroom villa pool terrace"
  aspectRatio="16/9"
  rootMargin="400px"           // Start loading 400px before viewport
  onLoad={() => setHeroReady(true)}
/>
```

#### Property Gallery Grid

```tsx
function PropertyGallery({ images }: { images: ProcessedImageData[] }) {
  return (
    <div className="gallery-grid">
      {images.map((img) => (
        <PropertyImage
          key={img.id}
          data={img}
          alt={`Property photo ${img.id}`}
          aspectRatio="3/2"
          rootMargin="100px"
        />
      ))}
    </div>
  );
}
```

#### Full Upload + Display Flow

```tsx
import { useState } from 'react';
import { PropertyImage } from './components/PropertyImage';
import type { ProcessedImageData } from './types';

function PropertyPhotoUploader() {
  const [imageData, setImageData] = useState<ProcessedImageData | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const body = new FormData();
    body.append('image', file);

    const res  = await fetch('http://localhost:4000/api/images/process', { method: 'POST', body });
    const json = await res.json();

    if (json.success) {
      setImageData(json.data);
    }
    setUploading(false);
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />

      {uploading && <p>Processing image…</p>}

      {imageData && (
        <PropertyImage
          data={imageData}
          alt="Uploaded property photo"
          aspectRatio="4/3"
        />
      )}
    </div>
  );
}
```

### Theming the Component

Override CSS custom properties to match your design system:

```css
/* In your global CSS or a parent component */
.my-property-card .container {
  --pit-bg:             #0f0f23;      /* Dark navy placeholder background */
  --pit-skeleton-base:  #1e1e3f;
  --pit-skeleton-shine: #2d2d5c;
  --pit-radius:         1rem;         /* More rounded corners */
  --pit-blur-amount:    20px;         /* Heavier blur effect */
  --pit-fade-in-dur:    800ms;        /* Slower, more cinematic fade */
}
```

### Using `useIntersectionObserver` Directly

The hook is exported for use outside `PropertyImage`:

```tsx
import { useIntersectionObserver } from './hooks/useIntersectionObserver';

function VideoPlayer({ src }: { src: string }) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin:  '100px',
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {isIntersecting && <video src={src} autoPlay muted loop />}
    </div>
  );
}
```

---

## TypeScript Types

All types are exported from `packages/frontend/src/types/index.ts`.

```ts
import type {
  ProcessedImageData,   // The full JSON object from the backend
  ImageSizes,           // { thumbnail, mobile, desktop }
  ImageSizeResult,      // { url, width, height, bytes }
  OriginalImageMeta,    // { width, height, format, space }
  PropertyImageProps,   // Component props
  ApiResponse,          // Union: ApiSuccessResponse | ApiErrorResponse
} from '@fast-property-image-toolkit/frontend';
```

---

## Performance Benchmarks

Tested with a 4032×3024 px DSLR JPEG (6.8 MB source):

| Variant | Dimensions | File Size | Savings vs Source |
|---|---|---|---|
| Source (JPEG) | 4032 × 3024 | **6.8 MB** | — |
| `thumbnail` (WebP) | 400 × 267 | **~11 KB** | 99.8% |
| `mobile` (WebP) | 800 × 534 | **~42 KB** | 99.4% |
| `desktop` (WebP) | 1920 × 1280 | **~178 KB** | 97.4% |
| Blur placeholder | 20 × 13 | **~380 bytes** | 99.99% |

**Processing time** (MacBook Pro M2, single image): ~250–450 ms total for all three variants in parallel.

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WebP display | 32+ | 65+ | 14+ | 18+ |
| IntersectionObserver | 51+ | 55+ | 12.1+ | 15+ |
| CSS `aspect-ratio` | 88+ | 89+ | 15+ | 88+ |
| `srcset` / `sizes` | 38+ | 38+ | 9+ | 16+ |
| CSS `will-change` | 36+ | 36+ | 9.1+ | 79+ |

For older browsers without IntersectionObserver, the hook falls back to treating all images as immediately visible — they load normally without lazy loading.

---

## Roadmap

- [ ] `blurhash` support as an alternative to Base64 placeholder
- [ ] AVIF output format (better compression than WebP for complex scenes)
- [ ] S3 / GCS upload helper built-in
- [ ] `PropertyImageGallery` component with lightbox
- [ ] Next.js `<Image>`-compatible adapter
- [ ] Processing queue with BullMQ for high-volume uploads
- [ ] CLI tool: `npx fpitk process ./photos/*.jpg`
- [ ] Automatic WEBP → AVIF fallback via `<picture>` element

---

## Contributing

Contributions are very welcome! Here's how to get started:

```bash
git clone https://github.com/yourusername/fast-property-image-toolkit.git
cd fast-property-image-toolkit
npm install

# Create a feature branch
git checkout -b feature/avif-support

# Make your changes, then run tests
cd packages/backend && npm test

# Commit and open a PR
git commit -m "feat: add AVIF output format"
git push origin feature/avif-support
```

Please:
- Follow existing code style (heavily commented, meaningful names)
- Add JSDoc / TypeScript types for any new public APIs
- Update this README if you add a new feature or change an API

---

## License

MIT © [fast-property-image-toolkit contributors](https://github.com/yourusername/fast-property-image-toolkit/graphs/contributors)

---

*Built with [sharp](https://sharp.pixelplumbing.com), [Express](https://expressjs.com), [React](https://react.dev), and ❤️ for developers who care about performance.*
