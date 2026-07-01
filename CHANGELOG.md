# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2025-06-30

### Added
- Core image processing pipeline (`packages/backend`) — sharp-based WebP conversion, 3 size variants (thumbnail/mobile/desktop), Base64 blur placeholder
- Express API: `POST /api/images/process`, `GET /health`
- React component (`packages/frontend`) — `<PropertyImage>` with IntersectionObserver lazy loading, blur-to-full fade-in, responsive `srcset`
- `useIntersectionObserver` reusable hook
- Full TypeScript type definitions
- 10 Jest tests covering processor logic and API integration
- GitHub Actions CI on Node 18 / 20 / 22
- Interactive GitHub Pages demo with drag comparison, pipeline simulation, multi-image upload, lightbox gallery
- MIT License, CONTRIBUTING.md, comprehensive README

### Fixed
- Corrected monorepo file structure (was previously flat at repo root)
- Resolved missing-icon errors in the demo (migrated to Font Awesome 6)

## [Unreleased]

### Planned
- Cloud storage adapters (S3, Cloudflare R2, Cloudinary)
- AVIF output option alongside WebP
- Authentication middleware example for the upload endpoint
- npm publish workflow
