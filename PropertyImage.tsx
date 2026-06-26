/**
 * @file src/components/PropertyImage/PropertyImage.tsx
 * @description High-performance React component for displaying real estate property images.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * RENDERING PIPELINE (what the user sees, in order):
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *  ① PLACEHOLDER (instant, 0 ms)
 *     The Base64 blur image from `data.blurDataUrl` is painted immediately.
 *     It's ≈ 300–600 chars — already in the JSON payload, no extra HTTP request.
 *     A CSS `filter: blur(16px)` + `scale(1.05)` makes it look like a smooth
 *     gaussian-blurred thumbnail. The user sees content right away.
 *
 *  ② LAZY TRIGGER (on scroll approach, 0 extra bytes)
 *     An IntersectionObserver watches the container. When it enters the viewport
 *     (or comes within rootMargin, default 200px), the high-res <img> is
 *     rendered into the DOM and the browser begins downloading it.
 *     Images that are never scrolled to are never downloaded — zero wasted bytes.
 *
 *  ③ PROGRESSIVE LOAD (during network download, blur stays visible)
 *     While the full-res image downloads, the blur placeholder stays at full
 *     opacity. The high-res img sits on top at opacity: 0, invisible.
 *     The skeleton shimmer animation appears subtly over the blur.
 *
 *  ④ FADE-IN (onLoad fires, ≈100–800 ms depending on connection)
 *     When the browser fires the img's `onLoad` event:
 *       - The high-res image transitions to opacity: 1 (500 ms ease-in-out)
 *       - The blur placeholder transitions to opacity: 0 (300 ms ease-in-out)
 *     The two transitions overlap, creating a smooth cross-fade effect.
 *
 *  ⑤ SETTLED (loaded state, blur hidden, full image visible)
 *     Both images remain in the DOM; the blur is invisible (opacity: 0)
 *     but `will-change: opacity` keeps the GPU layer active for zero-cost
 *     re-transitions if the component re-renders.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * RESPONSIVE IMAGE DELIVERY (srcset + sizes):
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *  The browser uses the `srcset` + `sizes` attributes to automatically select
 *  the appropriate resolution WITHOUT JavaScript. This means:
 *    - A 375px phone never downloads the 1920px desktop image
 *    - A 4K monitor gets the full-resolution image
 *    - The browser's preloader can start fetching the right image
 *      before JavaScript even runs
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY:
 * ──────────────────────────────────────────────────────────────────────────────
 *    - The container has role="img" + aria-label as a composite image landmark
 *    - The blur placeholder has aria-hidden="true" and alt="" (decorative)
 *    - The high-res image has a meaningful alt prop from the parent
 *    - The error state has role="alert" for screen reader announcement
 *    - Both images use native loading="lazy" + decoding="async" as belt-and-suspenders
 *
 * @example
 * // Basic usage
 * <PropertyImage
 *   data={apiResponse.data}
 *   alt="Modern 3-bedroom apartment — Downtown Cairo, Egypt"
 * />
 *
 * @example
 * // Full options
 * <PropertyImage
 *   data={propertyData.heroImage}
 *   alt="Penthouse terrace with Nile view"
 *   aspectRatio="16/9"
 *   rootMargin="400px"
 *   className={styles.heroImage}
 *   onLoad={() => analytics.track('image_loaded', { id: propertyData.heroImage.id })}
 *   onError={() => console.error('Hero image failed to load')}
 * />
 */

import React, { useCallback, useRef, useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import type { PropertyImageProps } from '../../types';
import styles from './PropertyImage.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PropertyImage
 *
 * Renders a property image with:
 *   - Instant blur placeholder (no layout shift, no blank box)
 *   - Lazy loading (IntersectionObserver — zero wasted bytes)
 *   - Responsive delivery (srcset + sizes — right resolution per device)
 *   - Smooth cross-fade transition (blur → full-res, CSS transitions)
 *   - Graceful error fallback
 *   - Full ARIA accessibility
 */
const PropertyImage: React.FC<PropertyImageProps> = ({
  data,
  alt,
  className = '',
  aspectRatio = '3/2',
  rootMargin = '200px',
  onLoad,
  onError,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [isLoaded, setIsLoaded]   = useState<boolean>(false);
  const [hasError, setHasError]   = useState<boolean>(false);

  // Ref for the high-res img element (used for imperative checks if needed)
  const imgRef = useRef<HTMLImageElement>(null);

  // ── Intersection Observer ──────────────────────────────────────────────────
  // The container div is observed. When it enters the viewport (or comes within
  // rootMargin px of it), `isIntersecting` flips to true and we render the
  // high-res <img>, triggering the browser to start downloading it.
  const { ref: containerRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
      rootMargin,
      triggerOnce: true, // Once loaded, stop observing — saves resources
      threshold:   0,    // Fire as soon as any pixel of the container is in range
    });

  // ── Event Handlers ─────────────────────────────────────────────────────────

  /**
   * Called when the high-res image has fully loaded into the browser.
   * Triggers the cross-fade: blur fades out, high-res fades in.
   */
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  /**
   * Called if the image URL is unreachable (404, network error, CORS, etc.).
   * Shows a user-friendly error state instead of a broken image icon.
   */
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setHasError(true);
      onError?.(e);
    },
    [onError]
  );

  // ── Responsive Image Attributes ────────────────────────────────────────────

  /**
   * `srcset` tells the browser all available image widths.
   * The browser picks the most appropriate one based on the `sizes` attribute
   * and the device's screen width and DPR (device pixel ratio).
   *
   * Example output:
   *   "https://cdn.example.com/abc-thumbnail.webp 400w,
   *    https://cdn.example.com/abc-mobile.webp 800w,
   *    https://cdn.example.com/abc-desktop.webp 1920w"
   */
  const srcSet = [
    `${data.sizes.thumbnail.url} ${data.sizes.thumbnail.width}w`,
    `${data.sizes.mobile.url}    ${data.sizes.mobile.width}w`,
    `${data.sizes.desktop.url}   ${data.sizes.desktop.width}w`,
  ].join(', ');

  /**
   * `sizes` tells the browser how wide the image will be rendered at each
   * viewport breakpoint — BEFORE it downloads anything (the browser preloader
   * runs before CSS or JS). This is what makes responsive images actually work.
   *
   * Read as: "at viewport ≤ 640px, the image fills the viewport (100vw);
   *           at viewport ≤ 1280px, it fills 50% (e.g. a two-column grid);
   *           otherwise it fills 33% (e.g. a three-column grid)"
   *
   * Adjust these breakpoints to match your actual layout. For a full-screen
   * hero image use a single "100vw" value.
   */
  const sizes = [
    '(max-width: 640px)  100vw',  // Single-column mobile layout
    '(max-width: 1280px) 50vw',   // Two-column tablet/small desktop layout
    '33vw',                        // Three-column large desktop grid
  ].join(', ');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`}
      style={{ aspectRatio }}
      /**
       * Composite image landmark for screen readers.
       * The outer div acts as the semantic image container;
       * the inner <img> carries the alt text for sighted users.
       */
      role="img"
      aria-label={alt}
    >
      {/* ── ① Blur Placeholder ──────────────────────────────────────────────
          Always rendered — provides instant visual feedback with zero latency.
          The 20px source is CSS-blurred to 16px, creating a smooth colour wash.
          `scale(1.05)` prevents the blurred edges from showing as dark bands.

          Transitions to opacity: 0 after the high-res image loads.
          Uses `will-change: opacity` to keep this on its own GPU compositor layer,
          ensuring the cross-fade doesn't trigger a layout recalculation.
      ────────────────────────────────────────────────────────────────────── */}
      <img
        className={styles.blur}
        src={data.blurDataUrl}
        aria-hidden="true" // Decorative — the real alt text is on the high-res img
        alt=""
        style={{ opacity: isLoaded ? 0 : 1 }}
      />

      {/* ── ② Skeleton Shimmer ──────────────────────────────────────────────
          Shown over the blur while the high-res image is downloading.
          Gives users feedback that something is loading.
          Hidden once the image loads or errors.
      ────────────────────────────────────────────────────────────────────── */}
      {isIntersecting && !isLoaded && !hasError && (
        <div
          className={styles.skeleton}
          aria-hidden="true"
          role="presentation"
        />
      )}

      {/* ── ③ High-Resolution Image ─────────────────────────────────────────
          Only rendered when the container is within `rootMargin` of the viewport.
          Before that, this entire subtree doesn't exist in the DOM — the browser
          won't attempt to download it at all.

          Key attributes:
          - `srcSet`         → all available resolutions (400w / 800w / 1920w)
          - `sizes`          → layout-aware breakpoints so the browser picks correctly
          - `src`            → mobile variant as the fallback for browsers without srcset
          - `loading="lazy"` → belt-and-suspenders: native lazy loading as backup
          - `decoding="async"` → decode off the main thread; avoids frame drops
          - `opacity: 0 → 1`  → CSS cross-fade triggered by onLoad
      ────────────────────────────────────────────────────────────────────── */}
      {isIntersecting && !hasError && (
        <img
          ref={imgRef}
          className={styles.image}
          src={data.sizes.mobile.url}   // Fallback src (browsers that ignore srcset)
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading="lazy"                // Native lazy loading (belt-and-suspenders)
          decoding="async"              // Off-thread JPEG/WebP decoding
          onLoad={handleLoad}
          onError={handleError}
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      )}

      {/* ── ④ Error State ───────────────────────────────────────────────────
          Shown if the image URL is unreachable.
          Replaces the broken image icon with a friendly UI.
          `role="alert"` announces the failure to screen reader users.
      ────────────────────────────────────────────────────────────────────── */}
      {hasError && (
        <div className={styles.error} role="alert" aria-live="assertive">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className={styles.errorIcon}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5M3 9.75h.008v.008H3V9.75Zm0 6.75h.008v.008H3v-.008Zm4.5-6.75h.008v.008H7.5V9.75Zm9 0h.008v.008H16.5V9.75Zm-4.5 0h.008v.008H12V9.75Z"
            />
          </svg>
          <span className={styles.errorText}>Image unavailable</span>
        </div>
      )}
    </div>
  );
};

export default PropertyImage;
