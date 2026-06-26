/**
 * @file src/hooks/useIntersectionObserver.ts
 * @description A reusable, generic React hook wrapping the native IntersectionObserver API.
 *
 * Used by <PropertyImage> to defer image fetching until the container
 * approaches the viewport — eliminating wasted bandwidth on images the user
 * never scrolls to.
 *
 * Design decisions:
 *   - Generic `<T extends Element>` so the ref is fully typed at the call site
 *     (e.g. `useIntersectionObserver<HTMLDivElement>()` gives you a `RefObject<HTMLDivElement>`)
 *   - `triggerOnce: true` by default — once the image enters the viewport we
 *     disconnect the observer immediately; re-observing on scroll-up would
 *     cause unnecessary state updates for an already-loaded image
 *   - `rootMargin: '200px'` default — starts loading 200px before the image
 *     enters the viewport, so users see the full image with no loading flash
 *   - The effect dependency array intentionally excludes mutable state
 *     (`isIntersecting`) to prevent tearing the observer down and rebuilding
 *     it on every state update
 *
 * @example
 * // Basic usage
 * const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>();
 * return (
 *   <div ref={ref}>
 *     {isIntersecting && <HeavyComponent />}
 *   </div>
 * );
 *
 * @example
 * // With all options
 * const { ref, isIntersecting, entry } = useIntersectionObserver<HTMLImageElement>({
 *   rootMargin:  '400px',   // Start loading 400px before viewport
 *   threshold:   0.1,       // Fire when 10% of element is visible
 *   triggerOnce: true,      // Disconnect after first intersection
 * });
 */

import { useEffect, useRef, useState } from 'react';
import type {
  IntersectionObserverOptions,
  UseIntersectionObserverReturn,
} from '../types';

/**
 * useIntersectionObserver
 *
 * Attaches a native IntersectionObserver to a DOM element via a React ref.
 * Returns the current intersection state and the raw entry object.
 *
 * @template T - The DOM element type (e.g. HTMLDivElement, HTMLImageElement).
 * @param options - Configuration for the IntersectionObserver behaviour.
 * @returns `{ ref, isIntersecting, entry }` — attach `ref` to your element.
 */
export function useIntersectionObserver<T extends Element = Element>(
  options: IntersectionObserverOptions = {}
): UseIntersectionObserverReturn<T> {
  const {
    rootMargin  = '200px',
    threshold   = 0,
    triggerOnce = true,
    root        = null,
  } = options;

  // ── Refs & State ────────────────────────────────────────────────────────────
  const ref = useRef<T>(null);

  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  // ── Observer Lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const element = ref.current;

    // Can't observe a non-existent element
    if (!element) return;

    // Guard: if we already intersected and only need to fire once,
    // don't re-attach the observer (handles StrictMode double-invocation)
    if (triggerOnce && isIntersecting) return;

    // ── Feature detection ──────────────────────────────────────────────────
    // IntersectionObserver is supported in all modern browsers, but this
    // guard keeps SSR environments (Next.js, Remix) from crashing.
    if (typeof IntersectionObserver === 'undefined') {
      // In environments without IntersectionObserver (old browsers, SSR),
      // treat everything as visible so images still load.
      setIsIntersecting(true);
      return;
    }

    // ── Create the observer ────────────────────────────────────────────────
    const observer = new IntersectionObserver(
      ([intersectionEntry]) => {
        // Update state with the latest intersection information
        setIsIntersecting(intersectionEntry.isIntersecting);
        setEntry(intersectionEntry);

        // If the element has entered the viewport and we only need to fire once,
        // disconnect immediately to free the observer resource.
        if (intersectionEntry.isIntersecting && triggerOnce) {
          observer.disconnect();
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    // React calls this when the component unmounts or the effect dependencies change.
    // Disconnecting prevents memory leaks and stale callbacks.
    return () => {
      observer.disconnect();
    };

    // ── Dependency note ───────────────────────────────────────────────────
    // `isIntersecting` is intentionally absent from deps.
    // Including it would cause the observer to be torn down and rebuilt
    // every time an intersection fires — creating a feedback loop.
    // The observer closure captures the disconnect logic correctly without it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, rootMargin, threshold, triggerOnce]);

  return { ref, isIntersecting, entry };
}

export default useIntersectionObserver;
