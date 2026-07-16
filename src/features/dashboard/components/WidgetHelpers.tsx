import type { ReactNode } from "react";
import { isTauriEnvironment, TauriUnavailableError } from "@shared/services/ipc";

/** Title bar for dashboard widgets. */
export function WidgetHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-accent shrink-0">{icon}</span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  );
}

/** Skeleton placeholder while a widget is loading. */
export function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-bg-tertiary rounded w-24" />
      <div className="h-8 bg-bg-tertiary rounded w-full" />
    </div>
  );
}

/**
 * Inline error display for widgets.
 *
 * Outside a Tauri shell (browser dev server) the backend is unreachable, so
 * every data widget fails with a `TauriUnavailableError`. Rather than surfacing
 * a scary raw error string, we show a calm "available in the desktop app"
 * message. Real backend errors still render their message.
 */
export function WidgetError({ message }: { message: string }) {
  const devMode = !isTauriEnvironment();
  const isBackendMissing = message.includes("Tauri backend is not available");

  if (devMode || isBackendMissing) {
    return (
      <div className="text-xs text-text-tertiary bg-bg-tertiary/40 rounded-lg p-3">
        Data is available in the desktop app.
      </div>
    );
  }

  return (
    <div className="text-xs text-danger bg-danger/5 rounded-lg p-3">{message}</div>
  );
}

/** Type guard helper re-exported for callers that want to branch on the error. */
export function isTauriUnavailableError(err: unknown): err is TauriUnavailableError {
  return err instanceof TauriUnavailableError;
}
