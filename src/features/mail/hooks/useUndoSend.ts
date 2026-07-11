import { useCallback, useEffect, useRef } from "react";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { getSetting } from "@features/settings/db/settings";

/** Default undo-send delay if the setting is missing or unparseable. */
const DEFAULT_UNDO_SEND_SECONDS = 5;

export interface UseUndoSendOptions {
  /** Called after the delay elapses (i.e. the email was actually sent). */
  onSend: () => Promise<void> | void;
  /** Called immediately when the user clicks Undo (before the timer fires). */
  onUndo?: () => void;
}

export interface UseUndoSendResult {
  /** Schedule the send. Resolves with `true` if scheduled, `false` if blocked. */
  schedule: () => Promise<boolean>;
  /** Cancel the pending send without firing onSend. */
  cancel: () => void;
  /** True while the undo toast is visible. */
  visible: boolean;
}

/**
 * useUndoSend — wraps the "set timer → show toast → fire onSend → hide toast"
 * pattern used by both the full-page Composer and the InlineReply.
 *
 * Reads the user-configured `undo_send_delay_seconds` from settings, shows
 * the existing `UndoSendToast` via the composer store, and invokes `onSend`
 * after the delay. Exposes `cancel()` so the Undo button can stop the send
 * and call `onUndo` (e.g. to delete the queued operation).
 *
 * Cleans up the underlying timer on unmount and on cancel.
 *
 * @example
 * ```ts
 * const { schedule, cancel } = useUndoSend({
 *   onSend: async () => {
 *     await sendEmail(accountId, raw, threadId);
 *   },
 *   onUndo: () => { /* undo logic *\/ },
 * });
 *
 * // In the send handler:
 * await schedule();
 * ```
 */
export function useUndoSend({
  onSend,
  onUndo,
}: UseUndoSendOptions): UseUndoSendResult {
  const setUndoSendTimer = useComposerStore((s) => s.setUndoSendTimer);
  const setUndoSendVisible = useComposerStore((s) => s.setUndoSendVisible);
  const visible = useComposerStore((s) => s.undoSendVisible);

  // Stash latest callbacks in refs so the schedule() function never goes stale.
  const onSendRef = useRef(onSend);
  const onUndoRef = useRef(onUndo);
  useEffect(() => {
    onSendRef.current = onSend;
    onUndoRef.current = onUndo;
  });

  // Track the active timer so we can cancel it.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActiveTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearActiveTimer();
    setUndoSendTimer(null);
    setUndoSendVisible(false);
    onUndoRef.current?.();
  }, [clearActiveTimer, setUndoSendTimer, setUndoSendVisible]);

  const schedule = useCallback(async (): Promise<boolean> => {
    // If something is already pending, refuse to overlap.
    if (timerRef.current !== null) return false;

    const rawDelay = await getSetting("undo_send_delay_seconds");
    const delaySeconds = parseInt(rawDelay ?? "", 10);
    const seconds = Number.isFinite(delaySeconds) && delaySeconds > 0
      ? delaySeconds
      : DEFAULT_UNDO_SEND_SECONDS;
    const delayMs = seconds * 1000;

    setUndoSendVisible(true);

    const timer = setTimeout(async () => {
      timerRef.current = null;
      setUndoSendTimer(null);
      try {
        await onSendRef.current();
      } finally {
        setUndoSendVisible(false);
      }
    }, delayMs);

    timerRef.current = timer;
    setUndoSendTimer(timer);
    return true;
  }, [setUndoSendTimer, setUndoSendVisible]);

  // Cleanup the timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { schedule, cancel, visible };
}

