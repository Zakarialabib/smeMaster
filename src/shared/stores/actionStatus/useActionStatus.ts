import { useCallback } from "react";
import { useActionStatusStore } from "./actionStatusStore";
import type { ActionStatusValue } from "./types";

export interface UseActionStatusReturn {
  /** Current lifecycle status of the action */
  status: ActionStatusValue;
  /** Error message when status === "error" */
  error: string | undefined;
  /** Progress 0-100 when available */
  progress: number | undefined;
  /** Convenience boolean — true when status === "loading" */
  isLoading: boolean;
  /** Convenience boolean — true when status === "success" */
  isSuccess: boolean;
  /** Convenience boolean — true when status === "error" */
  isError: boolean;
  /** Convenience boolean — true when status is falsy or "idle" */
  isIdle: boolean;
  /** Quick-set status to "loading" */
  setLoading: () => void;
  /** Quick-set status to "success" */
  setSuccess: () => void;
  /** Quick-set status to "error" with a message */
  setError: (error: string) => void;
  /** Update progress value (keeps current status) */
  setProgress: (progress: number) => void;
  /** Reset the action status back to idle */
  reset: () => void;
}

/**
 * Subscribe to the ActionStatus of a single actionId.
 *
 * @param actionId - The unique identifier of the action to track.
 * @returns Reactive status object with convenience booleans and setter methods.
 *
 * @example
 * ```tsx
 * const { isLoading, isError, error, setLoading, setSuccess, setError } =
 *   useActionStatus("send-email-abc");
 * ```
 */
export function useActionStatus(actionId: string): UseActionStatusReturn {
  const entry = useActionStatusStore((s) => s.statuses[actionId]);
  const setStatus = useActionStatusStore((s) => s.setStatus);
  const clearStatus = useActionStatusStore((s) => s.clearStatus);

  const status: ActionStatusValue = entry?.status ?? "idle";

  const setLoading = useCallback(
    () => setStatus(actionId, "loading"),
    [actionId, setStatus],
  );

  const setSuccess = useCallback(
    () => setStatus(actionId, "success"),
    [actionId, setStatus],
  );

  const setError = useCallback(
    (error: string) => setStatus(actionId, "error", { error }),
    [actionId, setStatus],
  );

  const setProgress = useCallback(
    (progress: number) => {
      const current = useActionStatusStore.getState().statuses[actionId];
      setStatus(actionId, current?.status ?? "loading", { progress });
    },
    [actionId, setStatus],
  );

  const reset = useCallback(
    () => clearStatus(actionId),
    [actionId, clearStatus],
  );

  return {
    status,
    error: entry?.error,
    progress: entry?.progress,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    isIdle: !entry || status === "idle",
    setLoading,
    setSuccess,
    setError,
    setProgress,
    reset,
  };
}
