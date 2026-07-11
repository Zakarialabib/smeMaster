import { useSwipeActions } from "@shared/hooks/useSwipeGesture";
import type { SwipeActions } from "@shared/hooks/useSwipeGesture";
import {
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Star,
  BellOff,
  VolumeX,
  Pin,
  ExternalLink,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  archive: Archive,
  "trash-2": Trash2,
  mail: Mail,
  "mail-open": MailOpen,
  star: Star,
  "bell-off": BellOff,
  "volume-x": VolumeX,
  pin: Pin,
  "external-link": ExternalLink,
  clock: Clock,
  "check-circle-2": CheckCircle2,
};

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: SwipeActions;
  threshold?: number;
  maxSwipe?: number;
  className?: string;
  enableMouse?: boolean;
  onReset?: () => void;
}

export function SwipeableRow({
  children,
  actions,
  threshold = 80,
  maxSwipe = 128,
  className,
  enableMouse = false,
  onReset,
}: SwipeableRowProps) {
  const swipe = useSwipeActions({ actions, threshold, maxSwipe });

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    action();
    swipe.reset();
    onReset?.();
  };

  const renderActions = (
    sideActions: { primary?: { label: string; icon: string; color: string; onAction: () => void; destructive?: boolean }; secondary?: { label: string; icon: string; color: string; onAction: () => void; destructive?: boolean } } | undefined,
    side: "left" | "right",
  ) => {
    if (!sideActions) return null;

    const allActions: Array<{
      label: string;
      icon: string;
      color: string;
      onAction: () => void;
      destructive?: boolean;
    }> = [];
    if (sideActions.primary) allActions.push(sideActions.primary);
    if (sideActions.secondary) allActions.push(sideActions.secondary);

    // Left actions (revealed when swiping right): primary closest to content, secondary further left
    // Right actions (revealed when swiping left): primary closest to content (rightmost), secondary further right
    const displayActions =
      side === "right" ? [...allActions].reverse() : allActions;
    const positionClass =
      side === "left" ? "inset-y-0 left-0" : "inset-y-0 right-0";
    const flexDir = side === "left" ? "flex-row" : "flex-row-reverse";

    return (
      <div className={`absolute ${positionClass} flex ${flexDir}`}>
        {displayActions.map((action, i) => {
          const Icon = ICON_MAP[action.icon] ?? Archive;
          // Visual feedback: fade in based on swipe progress
          const progress = Math.min(1, Math.abs(swipe.offset) / threshold);
          const opacity = 0.3 + progress * 0.7;
          return (
            <button
              key={`${side}-${i}`}
              className={`flex min-w-16 items-center justify-center gap-1 px-3 text-xs font-semibold text-white ${action.color} transition-opacity active:opacity-80 min-h-[44px]`}
              style={{ opacity }}
              onClick={(e) => handleActionClick(e, action.onAction)}
              aria-label={action.label}
              type="button"
            >
              <Icon size={17} />
              <span className="hidden whitespace-nowrap sm:inline">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const gestureHandlers = enableMouse
    ? swipe.bind
    : {
        onTouchStart: swipe.bind.onTouchStart,
        onTouchMove: swipe.bind.onTouchMove,
        onTouchEnd: swipe.bind.onTouchEnd,
      };

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {/* Left background actions (revealed when swiping right) */}
      {renderActions(actions.right, "left")}

      {/* Right background actions (revealed when swiping left) */}
      {renderActions(actions.left, "right")}

      {/* Foreground content */}
      <div
        {...gestureHandlers}
        style={swipe.style}
        className="relative bg-inherit"
      >
        {children}
      </div>
    </div>
  );
}
