import { useRef, useCallback, useState, useEffect } from "react";
import { triggerHaptic } from "@shared/hooks/useHaptics";

export type SwipeDirection = "left" | "right" | "";

export interface SwipeAction {
  label: string;
  icon: string; // lucide icon name, e.g. "archive", "trash-2"
  color: string; // tailwind bg color class, e.g. "bg-green-500"
  onAction: () => void;
  destructive?: boolean;
}

export interface SwipeActions {
  left?: {
    primary?: SwipeAction;
    secondary?: SwipeAction;
  };
  right?: {
    primary?: SwipeAction;
    secondary?: SwipeAction;
  };
}

export interface SwipeConfig {
  threshold?: number; // px before action triggers (default: 80)
  maxSwipe?: number; // max drag px (default: 160)
  velocityThreshold?: number; // px/ms for fast swipe (default: 0.5)
  actions: SwipeActions;
}

export interface SwipeState {
  offset: number;
  direction: SwipeDirection;
  isDragging: boolean;
  revealedActions: SwipeAction[];
}

function applyRubberBand(offset: number, maxSwipe: number): number {
  const sign = offset < 0 ? -1 : 1;
  const abs = Math.abs(offset);
  if (abs <= maxSwipe) return offset;
  const excess = abs - maxSwipe;
  return sign * (maxSwipe + excess * 0.25);
}

function getRevealedActions(
  offset: number,
  threshold: number,
  actions: SwipeActions,
): SwipeAction[] {
  const abs = Math.abs(offset);
  if (abs <= threshold) return [];

  if (offset < 0 && actions.left) {
    const result: SwipeAction[] = [];
    if (actions.left.primary) result.push(actions.left.primary);
    if (actions.left.secondary) result.push(actions.left.secondary);
    return result;
  }
  if (offset > 0 && actions.right) {
    const result: SwipeAction[] = [];
    if (actions.right.primary) result.push(actions.right.primary);
    if (actions.right.secondary) result.push(actions.right.secondary);
    return result;
  }
  return [];
}

export function useSwipeActions(config: SwipeConfig) {
  const { threshold = 80, maxSwipe = 160, velocityThreshold = 0.5, actions } = config;
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentOffset = useRef(0);
  const isDraggingRef = useRef(false);
  const isTouchDeviceRef = useRef(false);
  const snapDirectionRef = useRef<SwipeDirection>("");
  const [state, setState] = useState<SwipeState>({
    offset: 0,
    direction: "",
    isDragging: false,
    revealedActions: [],
  });

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      // If already snapped, start from snapped position
      if (snapDirectionRef.current) {
        const snappedOffset =
          snapDirectionRef.current === "left" ? -maxSwipe : maxSwipe;
        startX.current = clientX - snappedOffset;
      } else {
        startX.current = clientX;
      }
      startY.current = clientY;
      startTime.current = Date.now();
      currentOffset.current = snapDirectionRef.current
        ? snapDirectionRef.current === "left"
          ? -maxSwipe
          : maxSwipe
        : 0;
      isDraggingRef.current = true;
      setState((prev) => ({
        ...prev,
        isDragging: true,
      }));
    },
    [maxSwipe],
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - startX.current;
      const withRubberBand = applyRubberBand(dx, maxSwipe);
      currentOffset.current = withRubberBand;
      const direction: SwipeDirection =
        withRubberBand < -5 ? "left" : withRubberBand > 5 ? "right" : "";
      const revealed = getRevealedActions(withRubberBand, threshold, actions);
      setState({
        offset: withRubberBand,
        direction,
        isDragging: true,
        revealedActions: revealed,
      });
    },
    [maxSwipe, threshold, actions],
  );

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
    const offset = currentOffset.current;
    const absOffset = Math.abs(offset);

    // Velocity detection: fast swipe triggers action regardless of distance
    const elapsed = Date.now() - startTime.current;
    const velocity = elapsed > 0 ? absOffset / elapsed : 0;
    const isFastSwipe = velocity >= velocityThreshold;

    if (absOffset > threshold || isFastSwipe) {
      // Snap to show actions
      const snapOffset = offset < 0 ? -maxSwipe : maxSwipe;
      currentOffset.current = snapOffset;
      snapDirectionRef.current = offset < 0 ? "left" : "right";
      const direction: SwipeDirection = offset < 0 ? "left" : "right";
      const revealed = getRevealedActions(snapOffset, threshold, actions);
      setState({
        offset: snapOffset,
        direction,
        isDragging: false,
        revealedActions: revealed,
      });
      // Haptic feedback on action reveal
      triggerHaptic("medium");
    } else {
      // Snap back
      currentOffset.current = 0;
      snapDirectionRef.current = "";
      setState({
        offset: 0,
        direction: "",
        isDragging: false,
        revealedActions: [],
      });
    }
  }, [threshold, maxSwipe, velocityThreshold, actions]);

  const reset = useCallback(() => {
    currentOffset.current = 0;
    isDraggingRef.current = false;
    snapDirectionRef.current = "";
    setState({
      offset: 0,
      direction: "",
      isDragging: false,
      revealedActions: [],
    });
  }, []);

  // Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Guard against multi-touch — ignore if more than 1 touch point
      if (e.touches.length > 1) return;
      isTouchDeviceRef.current = true;
      const touch = e.touches[0];
      if (!touch) return;
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      handleMove(touch.clientX);
    },
    [handleMove],
  );

  const onTouchEnd = useCallback(() => {
    handleEnd();
    // Reset touch device flag after a short delay to allow native click events
    setTimeout(() => {
      isTouchDeviceRef.current = false;
    }, 300);
  }, [handleEnd]);

  // Mouse handlers (for desktop testing)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchDeviceRef.current) return;
      handleStart(e.clientX, e.clientY);
    },
    [handleStart],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchDeviceRef.current) return;
      handleMove(e.clientX);
    },
    [handleMove],
  );

  const onMouseUp = useCallback(() => {
    if (isTouchDeviceRef.current) return;
    handleEnd();
  }, [handleEnd]);

  // Global mouseup to catch releases outside the element
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && !isTouchDeviceRef.current) {
        handleEnd();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [handleEnd]);

  const style: React.CSSProperties = {
    transform: `translateX(${state.offset}px)`,
    transition: state.isDragging
      ? "none"
      : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
    touchAction: "pan-y",
    userSelect: "none",
  };

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
    style,
    state,
    reset,
    isDragging: state.isDragging,
    direction: state.direction,
    offset: state.offset,
  };
}
