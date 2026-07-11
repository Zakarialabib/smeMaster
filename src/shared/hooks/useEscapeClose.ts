import { useEffect } from "react";

/**
 * Calls `onClose` when the user presses Escape while `isOpen` is true.
 *
 * Attaches a `keydown` listener on `window` only while open, and cleans up
 * on close / unmount. Re-uses the stable `useEffect` deps shape.
 *
 * @example
 *   useEscapeClose(isModalOpen, () => setOpen(false));
 */
export function useEscapeClose(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);
}

