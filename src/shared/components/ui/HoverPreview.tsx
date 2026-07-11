import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export interface HoverContent {
  title: string;     // sender name
  subtitle: string;  // subject line
  body: string;      // first ~100 chars of preview/snippet
  timestamp: string; // formatted date
  onOpen?: () => void;
}

interface HoverPreviewProps {
  children: React.ReactNode;
  content: HoverContent;
  /** Delay before showing in ms (default 500) */
  delay?: number;
  /** Which side to show on (default "right") */
  side?: "right" | "left";
  /** Only enable on desktop (width >= 1024px) */
  desktopOnly?: boolean;
}

export function HoverPreview({
  children,
  content,
  delay = 500,
  side = "right",
  desktopOnly = false,
}: HoverPreviewProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // If desktopOnly, skip on narrow screens or touch devices
  const isEnabled = !desktopOnly ||
    (typeof window !== "undefined" && window.innerWidth >= 1024 && !("ontouchstart" in window));

  const show = useCallback(() => {
    if (!isEnabled) return;
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // Guard against zero rect (virtualized items not yet in DOM)
        if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) return;
        setPosition({
          top: rect.top,
          left: side === "right" ? rect.right + 8 : rect.left - 8 - 320,
        });
        setOpen(true);
      }
    }, delay);
  }, [isEnabled, delay, side]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      className="contents"
    >
      {children}
      {open && createPortal(
        <div
          className="fixed z-[100] w-80 rounded-lg glass-dropdown pointer-events-auto animate-[fadeIn_150ms_ease-out]"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setOpen(true);
          }}
          onMouseLeave={hide}
          role="tooltip"
          aria-label={`Preview: ${content.title} - ${content.subtitle}`}
        >
          {/* Arrow */}
          <div
            className={`absolute top-3 w-2 h-2 glass-dropdown border-l border-t border-border-primary rotate-45 ${
              side === "right" ? "-left-1" : "-right-1"
            }`}
          />
          <div className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {content.title}
                </p>
                <p className="text-xs text-text-secondary truncate mt-0.5">
                  {content.subtitle}
                </p>
              </div>
              <span className="text-[0.625rem] text-text-tertiary whitespace-nowrap shrink-0 mt-0.5">
                {content.timestamp}
              </span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed line-clamp-3">
              {content.body}
            </p>
            {content.onOpen && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={content.onOpen}
                >
                  Open
                </Button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
