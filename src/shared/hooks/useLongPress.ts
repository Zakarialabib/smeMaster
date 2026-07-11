import { useRef, useCallback } from "react";

interface LongPressConfig {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: () => void;
  duration?: number;
}

export function useLongPress({ onLongPress, onClick, duration = 500 }: LongPressConfig) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(e);
    }, duration);
  }, [onLongPress, duration]);

  const move = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPress.current && onClick) {
      onClick();
    }
  }, [onClick]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: move,
  };
}
