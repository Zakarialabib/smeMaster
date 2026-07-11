/**
 * useShortcutTooltip — 500ms-delay hover tooltip for keyboard shortcuts.
 *
 * On hover/focus, waits 500ms before showing the tooltip.  If the user moves
 * away or blurs before the timer fires, the tooltip is cancelled.
 *
 * Usage:
 * ```tsx
 * const { tooltipProps, showTooltip } = useShortcutTooltip("N");
 *
 * <button {...tooltipProps} onClick={handleCompose}>
 *   {showTooltip && <TooltipPopup shortcut="N" label="New email" />}
 *   <Plus size={20} />
 * </button>
 * ```
 *
 * Design tokens used (from globals.css + Tailwind theme):
 * - bg-bg-primary / border-border-primary  — tooltip surface
 * - text-text-secondary / text-text-tertiary  — text colour
 * - bg-bg-tertiary  — kbd chip background
 * - border-t-border-primary  — arrow colour (inherits border token)
 * - shadow-lg  — elevation
 * - animate-[fadeIn_150ms_ease-out]  — entrance, respects reduced-motion
 */

import { useState, useRef } from "react";
import { cn } from "@shared/utils/cn";

// ── Constants ───────────────────────────────────────────────────────────

const SHORTCUT_TOOLTIP_DELAY = 500;

// ── Hook ────────────────────────────────────────────────────────────────

export interface UseShortcutTooltipResult {
  /** Props to spread onto the trigger element */
  tooltipProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    "aria-label": string;
  };
  /** Whether the tooltip should be rendered */
  showTooltip: boolean;
}

/**
 * Hook that manages a delayed tooltip for keyboard shortcuts.
 *
 * @param shortcut - The keyboard shortcut(s) to display (e.g. "N", "Cmd+K", "E").
 */
export function useShortcutTooltip(shortcut: string): UseShortcutTooltipResult {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, SHORTCUT_TOOLTIP_DELAY);
  };

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  };

  return {
    tooltipProps: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      "aria-label": `Press ${shortcut}`,
    },
    showTooltip,
  };
}

// ── TooltipPopup Component ──────────────────────────────────────────────

export interface TooltipPopupProps {
  /** Keyboard shortcut to display inside a <kbd> element */
  shortcut: string;
  /** Optional human-readable label shown before the shortcut */
  label?: string;
  /** Additional classes forwarded to the tooltip container */
  className?: string;
}

/**
 * A positioned tooltip popup that displays a shortcut key (and optional label).
 *
 * Renders **above** the trigger by default, centered horizontally, with a
 * small downward-pointing arrow.  Uses `role="tooltip"` for accessibility.
 *
 * The popup is intentionally `pointer-events-none` so it never interferes
 * with clicks on the trigger element.
 */
export function TooltipPopup({ shortcut, label, className }: TooltipPopupProps) {
  return (
    <div
      className={cn(
        // Positioning — above the trigger, centred
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
        // Surface
        "px-2.5 py-1.5 rounded-lg",
        "bg-bg-primary border border-border-primary",
        "text-text-secondary text-[0.6875rem] leading-relaxed",
        // Elevation / interaction
        "shadow-lg pointer-events-none",
        "whitespace-nowrap",
        // Entrance animation (respects reduced motion)
        "animate-[fadeIn_150ms_ease-out]",
        "motion-reduce:animate-none",
        className,
      )}
      role="tooltip"
      aria-hidden={true}
    >
      {label && <span className="mr-1">{label}</span>}

      <kbd
        className={cn(
          "inline-flex items-center px-1 py-0.5 rounded",
          "bg-bg-tertiary text-text-tertiary",
          "font-mono text-[0.625rem] leading-none",
        )}
      >
        {shortcut}
      </kbd>

      {/* Downward-pointing arrow */}
      <span
        className={cn(
          "absolute top-full left-1/2 -translate-x-1/2",
          "border-l-4 border-r-4 border-t-4",
          "border-transparent border-t-border-primary",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
