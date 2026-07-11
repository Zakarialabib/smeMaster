import { useRef, useCallback, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { triggerHaptic } from "@shared/hooks/useHaptics";

// Spring-like cubic bezier for smooth pull and snap-back
const SPRING_RETURN = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";

interface PullToRefreshProps {
  /** Called when the user releases past the threshold */
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Pull distance in px before release triggers refresh. Default 60 */
  threshold?: number;
  /** Maximum pull distance in px. Default 120 */
  maxPull?: number;
  /** Loading state — shows spinner while refreshing */
  refreshing?: boolean;
  className?: string;
}

/**
 * PullToRefresh — wraps any scrollable container and adds a pull-down-to-refresh
 * gesture with spring animation and haptic feedback.
 *
 * - Pull threshold: 60px (configurable)
 * - Light haptic when threshold is crossed
 * - Medium haptic when released and refresh triggers
 * - Spring-animated snap-back on release
 *
 * @example
 * ```tsx
 * <PullToRefresh onRefresh={loadThreads}>
 *   <div ref={parentRef} ...>
 *     {virtualItems}
 *   </div>
 * </PullToRefresh>
 * ```
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 60,
  maxPull = 120,
  refreshing = false,
  className = "",
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hapticTriggeredRef = useRef(false);
  const scrollTopRef = useRef(0);

  const applyRubberBand = useCallback(
    (dy: number): number => {
      const abs = Math.abs(dy);
      if (abs <= maxPull) return dy;
      const excess = abs - maxPull;
      return dy > 0 ? maxPull + excess * 0.25 : -(maxPull + excess * 0.25);
    },
    [maxPull],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      // Only enable pull-to-refresh when scrolled to top
      const scrollEl = containerRef.current?.firstElementChild;
      if (!scrollEl) return;
      scrollTopRef.current =
        "scrollTop" in scrollEl ? (scrollEl as HTMLElement).scrollTop : 0;
      if (scrollTopRef.current > 5) return;

      startYRef.current = e.touches[0]!.clientY;
      currentYRef.current = startYRef.current;
      isDraggingRef.current = true;
      hapticTriggeredRef.current = false;
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const clientY = e.touches[0]!.clientY;
      currentYRef.current = clientY;
      const dy = clientY - startYRef.current;

      // Only allow pull down
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }

      const pulled = applyRubberBand(dy);
      setPullDistance(pulled);

      // Light haptic when threshold is first crossed
      if (pulled >= threshold && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        triggerHaptic("light");
      }
    },
    [applyRubberBand, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const dy = currentYRef.current - startYRef.current;
    const pulled = applyRubberBand(dy);

    if (pulled >= threshold && !isRefreshing && !refreshing) {
      // Trigger refresh with medium haptic
      triggerHaptic("medium");
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold position while refreshing

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back with spring
      if (isRefreshing) {
        setIsRefreshing(false);
      }
      setPullDistance(0);
    }
  }, [applyRubberBand, threshold, isRefreshing, refreshing, onRefresh]);

  const showIndicator = pullDistance > 0 || isRefreshing || refreshing;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10"
        style={{
          top: showIndicator ? 0 : `-${threshold}px`,
          height: `${threshold}px`,
          transition: isDraggingRef.current
            ? "none"
            : "top 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
          <RefreshCw
            size={16}
            className={`${isRefreshing || refreshing ? "animate-spin" : ""}`}
            style={{
              transform: `rotate(${Math.min(pullDistance / threshold, 1) * 360}deg)`,
              transition: isDraggingRef.current ? "none" : "transform 0.3s ease",
            }}
          />
          <span>
            {isRefreshing || refreshing
              ? "Refreshing…"
              : pullDistance >= threshold
                ? "Release to refresh"
                : "Pull to refresh"}
          </span>
        </div>
      </div>

      {/* Foreground content — translates down with pull */}
      <div
        style={{
          transform: `translateY(${showIndicator ? pullDistance : 0}px)`,
          transition: isDraggingRef.current
            ? "none"
            : SPRING_RETURN,
        }}
      >
        {children}
      </div>
    </div>
  );
}
