/**
 * @file src/index.ts
 * @description Root public API for @fast-property-image-toolkit/frontend.
 *
 * Import components, hooks, and types from this entry point:
 *
 * @example
 * import { PropertyImage, useIntersectionObserver } from '@fast-property-image-toolkit/frontend';
 * import type { ProcessedImageData, PropertyImageProps } from '@fast-property-image-toolkit/frontend';
 */

// ─── Components ───────────────────────────────────────────────────────────────
export { PropertyImage } from './components/PropertyImage';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useIntersectionObserver } from './hooks/useIntersectionObserver';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  // Core data shapes (mirrors backend JSON)
  ProcessedImageData,
  ImageSizes,
  ImageSizeResult,
  OriginalImageMeta,

  // API response wrappers
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,

  // Component props
  PropertyImageProps,

  // Hook types
  IntersectionObserverOptions,
  UseIntersectionObserverReturn,
} from './types';
