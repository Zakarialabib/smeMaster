import { useActionStatusStore } from "./actionStatusStore";

export interface WithActionStatusOptions<TReturn> {
  /** Called when the wrapped function succeeds */
  onSuccess?: (result: TReturn) => void;
  /** Called when the wrapped function throws */
  onError?: (error: Error) => void;
  /** If set, terminal states (success/error) auto-clear after this many ms */
  autoClearMs?: number;
  /** Optional category to help group related actions */
  category?: string;
}

export interface WithActionStatusReturn<TArgs extends unknown[], TReturn> {
  /**
   * Execute the wrapped function with lifecycle management.
   * Returns the result on success, or `undefined` on error.
   */
  execute: (...args: TArgs) => Promise<TReturn | undefined>;
  /** The actionId used for this binding */
  actionId: string;
}

/**
 * Wraps any async function with automatic ActionStatus lifecycle management.
 *
 * The returned `execute` function:
 * 1. Sets status → "loading"
 * 2. Calls the original function
 * 3. On success: sets status → "success", calls `onSuccess` if provided
 * 4. On error:   sets status → "error" with message, calls `onError` if provided
 * 5. If `autoClearMs` is provided, terminal states auto-clear after that delay
 *
 * @param fn      - The async function to wrap.
 * @param actionId - Unique identifier for this action (e.g. "sync-account-1").
 * @param options  - Lifecycle callbacks and auto-clear config.
 * @returns An object with `execute` and `actionId`.
 *
 * @example
 * ```ts
 * const { execute } = withActionStatus(sendEmail, "send-email-abc", {
 *   onSuccess: () => showToast("Sent!"),
 *   autoClearMs: 2000,
 * });
 * await execute(recipient, subject, body);
 * ```
 */
export function withActionStatus<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  actionId: string,
  options?: WithActionStatusOptions<TReturn>,
): WithActionStatusReturn<TArgs, TReturn> {
  const execute = async (
    ...args: TArgs
  ): Promise<TReturn | undefined> => {
    const store = useActionStatusStore.getState();

    store.setStatus(actionId, "loading", {
      ...(options?.category ? { category: options.category } : {}),
    });

    try {
      const result = await fn(...args);

      if (options?.autoClearMs !== undefined) {
        store.setStatusWithAutoClear(actionId, "success", {
          autoClearMs: options.autoClearMs,
          category: options.category,
        });
      } else {
        store.setStatus(actionId, "success", {
          category: options?.category,
        });
      }

      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorMessage = error.message;

      if (options?.autoClearMs !== undefined) {
        store.setStatusWithAutoClear(actionId, "error", {
          error: errorMessage,
          autoClearMs: options.autoClearMs,
          category: options.category,
        });
      } else {
        store.setStatus(actionId, "error", {
          error: errorMessage,
          category: options?.category,
        });
      }

      options?.onError?.(error);
      return undefined;
    }
  };

  return { execute, actionId };
}
