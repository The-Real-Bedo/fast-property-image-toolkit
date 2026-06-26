/**
 * @file src/types/index.ts
 * @description Shared TypeScript type definitions for fast-property-image-toolkit/frontend.
 *
 * These types mirror the JSON structure returned by the backend's
 * `processPropertyImage()` function. Keep them in sync with the backend
 * JSDoc typedef if you change the API response shape.
 *
 * @example
 * // In your data-fetching layer:
 * const response = await fetch('/api/images/process', { method: 'POST', body: formData });
 * const json: ApiResponse = await response.json();
 * // json.data is now fully typed as ProcessedImageData
 */

// ─── Core Image Types ─────────────────────────────────────────────────────────

/**
 * Metadata and public URL for a single size variant of a processed property image.
 */
export interface ImageSizeResult {
  /** Fully qualified public URL. e.g. "https://cdn.example.com/images/abc-desktop.webp" */
  url: string;

  /** Actual output width in pixels (may be less than requested if input was smaller). */
  width: number;

  /** Actual output height in pixels. */
  height: number;

  /** File size on disk in bytes. Useful for analytics and bandwidth monitoring. */
  bytes: number;
}

/**
 * The three size variants produced for every uploaded property image.
 * Maps directly to the SIZE_CONFIGS object in the backend imageProcessor.
 */
export interface ImageSizes {
  /** 400 × 267 px (3∶2, cover crop). For property cards, search grids, maps. */
  thumbnail: ImageSizeResult;

  /** 800 px wide (auto height). For mobile full-screen detail views. */
  mobile: ImageSizeResult;

  /** 1920 px wide (auto height). For desktop hero / lightbox views. */
  desktop: ImageSizeResult;
}

/**
 * Metadata about the original uploaded image before any processing.
 */
export interface OriginalImageMeta {
  /** Original width in pixels. */
  width: number;

  /** Original height in pixels. */
  height: number;

  /**
   * Source format as detected by sharp.
   * e.g. "jpeg", "png", "heif", "webp", "tiff", "avif"
   */
  format: string;

  /**
   * Colour space of the source image.
   * e.g. "srgb", "cmyk", "b-w"
   */
  space: string;
}

/**
 * The complete processed image data object returned by the backend API.
 * Store this in your database and pass it directly to the <PropertyImage> component.
 *
 * @example
 * // API call
 * const { data }: { data: ProcessedImageData } = await apiClient.post('/images/process', formData);
 *
 * // React usage
 * <PropertyImage data={data} alt="Luxury apartment — Downtown Cairo" />
 */
export interface ProcessedImageData {
  /**
   * UUID v4 uniquely identifying this image set.
   * Use as a primary key in your database.
   */
  id: string;

  /**
   * Ultra-lightweight Base64-encoded WebP image (≈300–600 characters).
   * Used as the initial blur placeholder before the full image loads.
   * Safe to store in the database and embed inline in the initial HTML payload.
   *
   * @example "data:image/webp;base64,UklGRh4AAABXRUJQVlA4IBIAAAAw..."
   */
  blurDataUrl: string;

  /** The three size variants — thumbnail, mobile, desktop. */
  sizes: ImageSizes;

  /** Metadata from the original source image. */
  original: OriginalImageMeta;

  /** ISO-8601 timestamp of when processing completed on the server. */
  createdAt: string;
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

/**
 * Shape of the JSON body returned by POST /api/images/process on success.
 */
export interface ApiSuccessResponse {
  success: true;
  data: ProcessedImageData;
}

/**
 * Shape of the JSON body returned by the API on failure.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  hint?: string;
  stack?: string; // Only present in development mode
}

/** Union type for any API response from the image processing endpoint. */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ─── Component Prop Types ─────────────────────────────────────────────────────

/**
 * Props accepted by the <PropertyImage> component.
 * See PropertyImage.tsx for full documentation of each prop.
 */
export interface PropertyImageProps {
  /** The structured data object returned by the backend API. Required. */
  data: ProcessedImageData;

  /** Accessible text description of the image. Required for a11y. */
  alt: string;

  /** Optional CSS class applied to the outer wrapper div. */
  className?: string;

  /**
   * CSS aspect-ratio for the image container.
   * @default "3/2"
   * @example "16/9" | "4/3" | "1/1" | "3/2"
   */
  aspectRatio?: string;

  /**
   * IntersectionObserver rootMargin — distance from the viewport edge at which
   * the image starts loading. A positive value preloads the image before it
   * scrolls into view, eliminating any visible delay.
   * @default "200px"
   */
  rootMargin?: string;

  /** Callback fired once the full-resolution image has finished loading. */
  onLoad?: () => void;

  /** Callback fired if the image fails to load (network error, 404, etc.). */
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

// ─── Hook Types ───────────────────────────────────────────────────────────────

/** Options accepted by the useIntersectionObserver hook. */
export interface IntersectionObserverOptions {
  /**
   * Margin around the viewport. Positive values cause the observer to fire
   * before the element enters the viewport ("preload zone").
   * @default "200px"
   */
  rootMargin?: string;

  /**
   * Fraction of the target element that must be visible before the observer fires.
   * @default 0
   */
  threshold?: number;

  /**
   * If true, the observer disconnects after the first intersection,
   * preventing repeated load triggers on scroll-up.
   * @default true
   */
  triggerOnce?: boolean;

  /**
   * The IntersectionObserver root element.
   * @default null (uses the viewport)
   */
  root?: Element | null;
}

/** Return value of the useIntersectionObserver hook. */
export interface UseIntersectionObserverReturn<T extends Element = Element> {
  /** Attach this ref to the DOM element you want to observe. */
  ref: React.RefObject<T>;

  /** True while the element intersects the observer root. */
  isIntersecting: boolean;

  /**
   * The raw IntersectionObserverEntry from the last observation.
   * Provides access to intersectionRatio, boundingClientRect, etc.
   * Null before the first observation fires.
   */
  entry: IntersectionObserverEntry | null;
}
