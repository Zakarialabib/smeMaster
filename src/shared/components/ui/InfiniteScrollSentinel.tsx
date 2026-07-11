/**
 * InfiniteScrollSentinel — a shared sentinel component for infinite scroll.
 *
 * Uses IntersectionObserver via `useInView` to detect when the bottom of a
 * scrollable list is reached, then triggers `onIntersect` to load more items.
 *
 * Extracted from the EmailList pattern where scroll events and manual distance
 * calculations were used. This component provides a consistent, reusable
 * interface for all infinite-scroll list views.
 *
 * @example
 * ```tsx
 * <InfiniteScrollSentinel
 *   onIntersect={loadMore}
 *   enabled={!loading}
 *   loading={loadingMore}
 *   hasMore={hasMore}
 * />
 * ```
 */

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useInView } from "@shared/hooks/useInView";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InfiniteScrollSentinelProps {
  /** Called when the sentinel enters the viewport and conditions are met */
  onIntersect: () => void;
  /** Master switch — only triggers when `enabled` is true */
  enabled: boolean;
  /** Whether a load is currently in progress (shows spinner) */
  loading?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InfiniteScrollSentinel({
  onIntersect,
  enabled,
  loading = false,
  hasMore = true,
  className,
}: InfiniteScrollSentinelProps) {
  const { ref, inView } = useInView({
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && enabled && hasMore && !loading) {
      onIntersect();
    }
  }, [inView, enabled, hasMore, loading, onIntersect]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex justify-center py-4 text-text-tertiary text-xs",
        className,
      )}
      aria-live="polite"
      aria-busy={loading}
    >
      {loading && (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Loading more...</span>
        </div>
      )}
      {!hasMore && !loading && (
        <span className="text-text-tertiary">No more items</span>
      )}
    </div>
  );
}
