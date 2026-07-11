import { useRef, useCallback, useState, type ReactNode, type TouchEvent } from "react";
import { Trash2 } from "lucide-react";
import { useHaptics } from "@shared/hooks/useHaptics";

interface SwipeToDeleteProps {
  /** Called when the user finishes a swipe that exceeds the threshold */
  onDelete: () => void;
  children: ReactNode;
  /** Minimum px of left-swipe to trigger delete. Default 80 */
  threshold?: number;
  /** Max px the element can translate. Default 120 */
  maxSwipe?: number;
}

/**
 * SwipeToDelete – wraps any list item and allows swiping left to reveal
 * a red "Delete" button on mobile.
 *
 * Uses raw touch events (`touchstart`, `touchmove`, `touchend`) to
 * translate the element horizontally.
 */
export function SwipeToDelete({
  onDelete,
  children,
  threshold = 80,
  maxSwipe = 120,
}: SwipeToDeleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hapticTriggeredRef = useRef(false);
  const haptics = useHaptics();

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startXRef.current = e.touches[0]!.clientX;
    currentXRef.current = startXRef.current;
    isDraggingRef.current = true;
    hapticTriggeredRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const clientX = e.touches[0]!.clientX;
      currentXRef.current = clientX;
      const delta = startXRef.current - clientX;

      // Only allow left swipe (positive delta). Clamp to maxSwipe.
      if (delta < 0) {
        setTranslateX(0);
        return;
      }
      setTranslateX(Math.min(delta, maxSwipe));

      // Fire light haptic once when threshold is first crossed
      if (delta >= threshold && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        haptics.light();
      }
    },
    [maxSwipe, threshold, haptics],
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    const delta = startXRef.current - currentXRef.current;

    if (delta >= threshold) {
      haptics.heavy();
      onDelete();
      setTranslateX(0);
    } else {
      // Snap back
      setTranslateX(0);
    }
  }, [onDelete, threshold, haptics]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      haptics.heavy();
      onDelete();
    },
    [onDelete, haptics],
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Delete button revealed behind the content */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          onClick={handleDeleteClick}
          className="flex items-center justify-center gap-1.5 bg-danger text-white px-5 text-sm font-medium min-w-[72px] active:opacity-80"
          aria-label="Delete"
          style={{
            width: `${maxSwipe}px`,
          }}
        >
          <Trash2 size={18} />
          <span className="whitespace-nowrap">Delete</span>
        </button>
      </div>

      {/* Foreground content – moves with touch */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDraggingRef.current
            ? "none"
            : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="relative bg-inherit"
      >
        {children}
      </div>
    </div>
  );
}
