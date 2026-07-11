/**
 * useInView — wrapper around `react-intersection-observer` with a clean API.
 *
 * Detects when a DOM element enters or leaves the viewport using the
 * Intersection Observer API. Useful for infinite scroll, lazy loading,
 * scroll-triggered animations, and visibility tracking.
 *
 * @example
 * ```tsx
 * const { ref, inView } = useInView({ threshold: 0.5 });
 *
 * return (
 *   <div ref={ref}>
 *     {inView ? "Visible!" : "Hidden"}
 *   </div>
 * );
 * ```
 *
 * @example Infinite scroll sentinel:
 * ```tsx
 * const { ref, inView } = useInView({ rootMargin: "200px" });
 *
 * useEffect(() => {
 *   if (inView) onLoadMore();
 * }, [inView, onLoadMore]);
 *
 * return (
 *   <>
 *     {items.map(renderItem)}
 *     <div ref={ref} className="sentinel" />
 *   </>
 * );
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntersectionOptions } from "react-intersection-observer";

export interface UseInViewOptions extends IntersectionOptions {
  /**
   * If true, stops observing once the element becomes visible.
   * Useful for "animate once" scroll reveals.
   * @default false
   */
  triggerOnce?: boolean;
}

export interface UseInViewResult {
  /** Ref to attach to the observed DOM element. */
  ref: (node: Element | null) => void;
  /** Whether the observed element is currently intersecting the viewport. */
  inView: boolean;
  /** The raw IntersectionObserverEntry (null before first observation). */
  entry: IntersectionObserverEntry | undefined;
}

/**
 * Wraps `react-intersection-observer`'s `useInView` hook with a consistent
 * object-return API (ref, inView, entry).
 *
 * Re-exports the core options from `react-intersection-observer` so consumers
 * don't need to import from that package directly.
 */
export function useInView(options: UseInViewOptions = {}): UseInViewResult {
  const { triggerOnce = false, threshold, root, rootMargin, onChange } = options;

  const [inView, setInView] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | undefined>();
  const nodeRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const frozenRef = useRef(false);

  // Cleanup previous observer
  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  const ref = useCallback(
    (node: Element | null) => {
      nodeRef.current = node;
      disconnect();

      if (!node || frozenRef.current) return;

      // Check for IntersectionObserver support
      if (typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry_] = entries;
          if (!entry_) return;

          setEntry(entry_);
          setInView(entry_.isIntersecting);

          if (onChange) {
            onChange(entry_.isIntersecting, entry_);
          }

          if (entry_.isIntersecting && triggerOnce) {
            frozenRef.current = true;
            disconnect();
          }
        },
        { threshold, root, rootMargin },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [threshold, root, rootMargin, triggerOnce, onChange, disconnect],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { ref, inView, entry };
}
