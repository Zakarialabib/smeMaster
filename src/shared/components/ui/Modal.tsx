import { type ReactNode, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CSSTransition } from "react-transition-group";
import { X } from "lucide-react";
import {
  MODAL_BACKDROP,
  MODAL_PANEL,
  MODAL_PANEL_LIQUID,
  MODAL_HEADER,
  MODAL_CLOSE_BTN,
} from "@shared/styles/ui-tokens";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Preferred way: use `size` for responsive presets. Overrides `width`. */
  size?: ModalSize;
  /** Legacy prop – still works if `size` is not provided. */
  width?: string;
  zIndex?: string;
  panelClassName?: string;
  renderHeader?: ReactNode;
  /** Hide the default close button (e.g. for wizards, onboarding) */
  hideCloseButton?: boolean;
  /** Close when clicking the backdrop overlay (default: true) */
  closeOnOverlay?: boolean;
  /** Close on Escape key press (default: true) */
  closeOnEscape?: boolean;
  /** Use liquid glass panel styling instead of default */
  liquidGlass?: boolean;
}

/** Responsive width classes – always full‑width with a safe mobile margin. */
const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "w-[calc(100%-2rem)] sm:w-full sm:max-w-sm",
  md: "w-[calc(100%-2rem)] sm:w-full sm:max-w-md",
  lg: "w-[calc(100%-2rem)] sm:w-full sm:max-w-lg",
  xl: "w-[calc(100%-2rem)] sm:w-full sm:max-w-xl",
  "2xl": "w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl",
};

/**
 * Returns all focusable elements within the given container.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size,
  width = "w-96",
  zIndex = "z-50",
  panelClassName,
  renderHeader,
  hideCloseButton = false,
  closeOnOverlay = true,
  closeOnEscape = true,
  liquidGlass = false,
}: ModalProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the element that had focus before the modal opened
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Focus the first focusable element when the modal opens
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const timer = setTimeout(() => {
      if (!panelRef.current) return;
      // Try to focus the close button, or the first focusable element
      const focusable = getFocusableElements(panelRef.current);
      const closeBtn = panelRef.current.querySelector(
        "[data-modal-close]",
      ) as HTMLElement | null;
      (closeBtn ?? focusable[0])?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Focus trap: intercept Tab/Shift+Tab to cycle within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeOnEscape && onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, closeOnEscape],
  );

  // Attach keydown listener when modal is open
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const resolvedWidth = size ? SIZE_CLASSES[size] : width;

  return createPortal(
    <CSSTransition
      in={isOpen}
      timeout={150}
      classNames="modal"
      unmountOnExit
      nodeRef={nodeRef}
    >
      <div
        ref={nodeRef}
        className={`fixed inset-0 ${zIndex} flex items-center justify-center`}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <div className={MODAL_BACKDROP} onClick={closeOnOverlay ? onClose : undefined} aria-hidden="true" />
        <div
          ref={panelRef}
          className={`modal-panel ${liquidGlass ? MODAL_PANEL_LIQUID : MODAL_PANEL} ${resolvedWidth}${panelClassName ? ` ${panelClassName}` : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className={MODAL_CLOSE_BTN}
              aria-label="Close modal"
              data-modal-close
            >
              <X size={14} />
            </button>
          )}

          {renderHeader !== undefined ? (
            renderHeader
          ) : (
            <div className={MODAL_HEADER}>
              <h3 id="modal-title" className="text-sm font-semibold text-text-primary pr-7">
                {title}
              </h3>
            </div>
          )}

          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[80vh]">{children}</div>
        </div>
      </div>
    </CSSTransition>,
    document.body,
  );
}
