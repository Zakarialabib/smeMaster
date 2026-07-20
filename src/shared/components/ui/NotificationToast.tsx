import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { X, Mail, Undo2 } from "lucide-react";
import { uiBus } from "@shared/services/events/uiBus";

interface PushNotification {
  title: string;
  body: string;
  thread_id?: string;
}

export interface UndoableToast {
  id: number;
  notification: PushNotification;
  dismissed: boolean;
  /** Label for the undo button (e.g., "Undo", "Restore") */
  undoLabel?: string;
  /** Callback when undo is clicked */
  onUndo?: () => void;
}

let toastId = 0;

export function NotificationToast() {
  const [toasts, setToasts] = useState<UndoableToast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUndo = useCallback((toast: UndoableToast) => {
    toast.onUndo?.();
    removeToast(toast.id);
  }, [removeToast]);

  useEffect(() => {
    const unlisten = listen<PushNotification & { undoLabel?: string }>("notification:received", (event) => {
      const payload = event.payload;
      const newToast: UndoableToast = {
        id: ++toastId,
        notification: payload,
        dismissed: false,
        undoLabel: payload.undoLabel,
      };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      setTimeout(() => {
        removeToast(newToast.id);
      }, 5000);
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-9999 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid="notification"
          className="pointer-events-auto bg-bg-primary border border-border-primary rounded-xl shadow-lg p-3 flex items-start gap-3 animate-slide-down"
        >
          <Mail size={16} className="text-accent mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{toast.notification.title}</p>
            <p className="text-xs text-text-tertiary line-clamp-2">{toast.notification.body}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {toast.undoLabel && (
              <button
                onClick={() => handleUndo(toast)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-md transition-colors"
              >
                <Undo2 size={12} />
                {toast.undoLabel}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Helper to emit an undoable toast via the Tauri event system.
 * Falls back to window event dispatch when Tauri is unavailable.
 */
export function emitUndoableToast(
  title: string,
  body: string,
  undoLabel: string,
  onUndo: () => void,
): void {
  try {
    const { emit } = require("@tauri-apps/api/event");
    emit("notification:received", { title, body, thread_id: undefined, undoLabel, onUndo });
  } catch {
    uiBus.emit("toast:show", { message: title });
  }
}
