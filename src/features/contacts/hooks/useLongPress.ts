import { useCallback, useEffect, useRef } from "react";

interface UseLongPressOptions {
  /** Time in ms before long-press fires. Default 500ms. */
  threshold?: number;
  /** Prevent default on touch start to avoid the synthesized click. */
  preventDefault?: boolean;
}

interface LongPressHandlers {
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  onPressStart?: (event: React.TouchEvent | React.MouseEvent) => void;
  onPressEnd?: () => void;
}

/**
 * useLongPress — invokes `onLongPress` after the user holds the target
 * for `threshold` ms. Works for both touch and mouse.
 *
 * Use for grid-card selection on touch devices: holding a card for ~500ms
 * enters selection mode.
 */
export function useLongPress(
  handlers: LongPressHandlers,
  options: UseLongPressOptions = {},
) {
  const { threshold = 500, preventDefault = true } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      triggeredRef.current = false;
      if (preventDefault && "preventDefault" in event) {
        // Only prevent default for touch to avoid blocking mouse clicks entirely
        if ("touches" in event) event.preventDefault();
      }
      handlers.onPressStart?.(event);
      timeoutRef.current = setTimeout(() => {
        triggeredRef.current = true;
        handlers.onLongPress(event);
      }, threshold);
    },
    [handlers, threshold, preventDefault],
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    handlers.onPressEnd?.();
  }, [handlers]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: clear,
    onTouchCancel: clear,
    /** True if the most recent press was a long press (consume click to avoid double-fire). */
    wasLongPress: () => triggeredRef.current,
  };
}
