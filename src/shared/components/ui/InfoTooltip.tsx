import { useState, useRef, type ReactNode } from "react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { TOOLTIP_BASE, FOCUS_RING } from "@shared/styles/ui-tokens";

/**
 * @deprecated Use InlineTooltip from "@features/settings/components/HelpCard" instead.
 * This component is kept for backward compatibility in code that still references it.
 * It uses the same visual tokens as InlineTooltip but with a different API.
 */

type TooltipSide = "top" | "bottom" | "left" | "right";

interface InfoTooltipProps {
  content: string;
  side?: TooltipSide;
  icon?: boolean;
  children?: ReactNode;
  delay?: number;
}

const SIDE_STYLES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "end-full top-1/2 -translate-y-1/2 me-2",
  right: "start-full top-1/2 -translate-y-1/2 ms-2",
};

const ARROW_STYLES: Record<TooltipSide, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-border-primary",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-border-primary",
  left: "end-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-transparent border-l-border-primary",
  right: "start-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-transparent border-r-border-primary",
};

export function InfoTooltip({
  content,
  side = "top",
  icon = false,
  children,
  delay = 300,
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  
  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const toggle = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible((v) => !v);
  };

  const triggerProps = isMobileDevice
    ? {
        onClick: toggle,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        },
        "aria-expanded": visible,
      }
    : {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      };

  return (
    <span className="relative inline-flex items-center group" role="tooltip">
      {children ? (
        <span
          tabIndex={0}
          className={`cursor-pointer ${FOCUS_RING}`}
          role="button"
          aria-label="More information"
          {...triggerProps}
        >
          {children}
        </span>
      ) : icon ? (
        <span
          tabIndex={0}
          className="info-tooltip-trigger"
          role="button"
          aria-label="More information"
          {...triggerProps}
        >
          ?
        </span>
      ) : null}

      {visible && (
        <>
          <div className={`${TOOLTIP_BASE} ${SIDE_STYLES[side]}`}>
            {content}
            <span className={`absolute ${ARROW_STYLES[side]}`} />
          </div>
          {isMobileDevice && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setVisible(false)}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </span>
  );
}
