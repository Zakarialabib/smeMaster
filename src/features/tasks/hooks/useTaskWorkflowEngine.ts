import { useEffect, useRef } from "react";
import { checkTaskWorkflows, checkTaskReminders } from "../services/taskWorkflowEngine";

const POLL_INTERVAL_MS = 60_000;

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

/**
 * Polls the task workflow and reminder engines every 60s while the app
 * tab/window is visible. Pauses when hidden via the Page Visibility API.
 * No-ops in browser dev mode (non-Tauri) to avoid IPC error spam.
 *
 * Wire this into App.tsx alongside other use* lifecycle hooks.
 */
export function useTaskWorkflowEngine() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    const run = async () => {
      try {
        await Promise.all([checkTaskWorkflows(), checkTaskReminders()]);
      } catch (err) {
        console.error("[useTaskWorkflowEngine] check failed:", err);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!intervalRef.current) {
          run();
          intervalRef.current = setInterval(run, POLL_INTERVAL_MS);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}
