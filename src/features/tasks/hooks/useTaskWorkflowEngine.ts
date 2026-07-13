import { useEffect, useRef } from "react";
import { checkTaskWorkflows, checkTaskReminders } from "../services/taskWorkflowEngine";
import { useTaskStore } from "../stores/taskStore";

const POLL_INTERVAL_MS = 60_000;

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

/**
 * Polls the task workflow and reminder engines every 60s while the app
 * tab/window is visible. Pauses when hidden via the Page Visibility API.
 * Respects the `remindersEnabled` flag in the task store — when disabled,
 * the polling interval is cleared and no reminders fire.
 * No-ops in browser dev mode (non-Tauri) to avoid IPC error spam.
 *
 * Wire this into App.tsx alongside other use* lifecycle hooks.
 */
export function useTaskWorkflowEngine() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remindersEnabled = useTaskStore((s) => s.remindersEnabled);

  useEffect(() => {
    if (!isTauri()) return;

    const run = async () => {
      // Skip if reminders are globally disabled
      if (!useTaskStore.getState().remindersEnabled) return;

      try {
        await Promise.all([checkTaskWorkflows(), checkTaskReminders()]);
      } catch (err) {
        console.error("[useTaskWorkflowEngine] check failed:", err);
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      if (!useTaskStore.getState().remindersEnabled) return;
      run();
      intervalRef.current = setInterval(run, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Start or stop based on current remindersEnabled value
    if (remindersEnabled) {
      startPolling();
    } else {
      stopPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopPolling();
    };
  }, [remindersEnabled]);
}
