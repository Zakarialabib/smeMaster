import { useEffect, useRef, type RefObject } from "react";

export interface UseFocusTrapOptions {
  /** Whether the trap is active */
  enabled?: boolean;
  /** Auto-focus the first focusable element on mount */
  autoFocus?: boolean;
  /** Restore focus to the previously focused element on unmount */
  restoreFocus?: boolean;
  /** Close on Escape (provide a callback) */
  onEscape?: () => void;
}

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/**
 * Traps keyboard focus within a container element.
 * Returns a ref to attach to the container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: UseFocusTrapOptions = {},
): RefObject<T> {
  const {
    enabled = true,
    autoFocus = true,
    restoreFocus = true,
    onEscape,
  } = options;

  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Remember the element that had focus before we opened
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    };

    // Focus the first focusable element
    if (autoFocus) {
      const focusable = getFocusable();
      const first = focusable[0];
      if (first) {
        first.focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    // Set ARIA attributes
    if (!container.getAttribute("role")) container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");

    function handleKeyDown(e: KeyboardEvent) {
      const current = containerRef.current;
      if (!current) return;
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!first || !last) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        if (active === first || !current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [enabled, autoFocus, restoreFocus, onEscape]);

  return containerRef as RefObject<T>;
}
