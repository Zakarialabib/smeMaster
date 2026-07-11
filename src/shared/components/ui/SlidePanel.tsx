import { useEffect, useRef, type ReactNode } from "react";
import { CSSTransition } from "react-transition-group";
import { X } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";

/**
 * SlidePanel — right sidebar (desktop) or bottom sheet (mobile).
 *
 * Animations use CSS classes defined in globals.css:
 *   .slide-in-right-enter / .slide-in-right-enter-active
 *   .slide-up-enter / .slide-up-enter-active
 *   .backdrop-fade-enter / .backdrop-fade-enter-active
 * See globals.css @keyframes section for the keyframe definitions.
 */

type SlideSide = "right" | "bottom";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 'right' (desktop sidebar) or 'bottom' (mobile sheet) */
  side?: SlideSide;
  /** Optional learn more link target */
  learnMoreHref?: string;
  /** Optional icon rendered before the title in the header */
  headerIcon?: ReactNode;
  /** Optional extra elements in the header (e.g. badge, counter) */
  headerChildren?: ReactNode;
  /** Custom footer content (replaces the default learn-more link) */
  footerChildren?: ReactNode;
  /** Override the default max-width class on desktop (e.g. "max-w-[520px]") */
  widthClass?: string;
}

export function SlidePanel({
  isOpen,
  onClose,
  title,
  children,
  learnMoreHref,
  headerIcon,
  headerChildren,
  footerChildren,
  widthClass,
}: SlidePanelProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const effectiveSide = isMobileDevice ? "bottom" : "right";

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (isOpen && isMobileDevice) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen, isMobileDevice]);

  const panelClasses =
    effectiveSide === "right"
      ? `fixed right-0 top-0 h-full w-full ${widthClass ?? "max-w-md"} bg-bg-primary border-l border-border-primary shadow-xl z-50 flex flex-col`
      : "fixed bottom-0 left-0 right-0 max-h-[85vh] bg-bg-primary border-t border-border-primary rounded-t-2xl shadow-xl z-50 flex flex-col bottom-sheet";

  const transitionName = effectiveSide === "right" ? "slide-in-right" : "slide-up";

  return (
    <>
      {/* Backdrop */}
      <CSSTransition
        in={isOpen}
        timeout={250}
        classNames="backdrop-fade"
        unmountOnExit
        nodeRef={backdropRef}
      >
        <div
          ref={backdropRef}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      </CSSTransition>

      {/* Panel */}
      <CSSTransition
        in={isOpen}
        timeout={250}
        classNames={transitionName}
        unmountOnExit
        nodeRef={nodeRef}
      >
        <div ref={nodeRef} className={panelClasses} role="dialog" aria-modal="true" aria-label={title}>
          {/* Drag handle (mobile bottom sheet) */}
          {effectiveSide === "bottom" && (
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-border-primary/60" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-primary shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {headerIcon && <span className="shrink-0">{headerIcon}</span>}
              <h2 className="text-sm font-semibold text-text-primary truncate">{title}</h2>
              {headerChildren}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 text-sm text-text-secondary leading-relaxed space-y-3">
            {children}
          </div>

          {/* Footer with optional learn more link or custom content */}
          {footerChildren && (
            <div className="shrink-0 border-t border-border-primary">
              {footerChildren}
            </div>
          )}
          {!footerChildren && learnMoreHref && (
            <div className="px-5 py-3.5 border-t border-border-primary shrink-0">
              <a
                href={learnMoreHref}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more &rarr;
              </a>
            </div>
          )}
        </div>
      </CSSTransition>
    </>
  );
}
