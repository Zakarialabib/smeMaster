export interface AsyncSlice {
  isLoading: boolean;
  error: string | null;
}

export const initialAsyncState: AsyncSlice = {
  isLoading: false,
  error: null,
};

export function createAsyncActions<T extends AsyncSlice>(set: any) {
  return {
    withLoading: async <R>(fn: () => Promise<R>): Promise<R | undefined> => {
      set((s: T) => ({ ...s, isLoading: true, error: null }) as Partial<T>);
      try {
        const result = await fn();
        set((s: T) => ({ ...s, isLoading: false }) as Partial<T>);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set((s: T) => ({ ...s, isLoading: false, error: message }) as Partial<T>);
        return undefined;
      }
    },
  };
}

// ── withMutation ────────────────────────────────────────────────────────────
//
/**
 * Run an async mutation, toggling a loading flag and capturing any error
 * via caller-supplied setters.
 *
 * This is the callback-based cousin of {@link createAsyncActions.withLoading}
 * — it does not assume a particular state shape. Useful when the store's
 * `loading`/`error` fields are not named `isLoading`/`error` (e.g. while
 * migrating, or for stores that nest async state under a slice key).
 *
 * Semantics:
 * 1. If `opts.setLoading` is provided, calls it with `true`.
 * 2. If `opts.setError` is provided, calls it with `null`.
 * 3. Awaits `fn()`.
 * 4. On success: calls `opts.setLoading?.(false)` and returns `R`.
 * 5. On failure: stringifies the error (Error.message or String(err)),
 *    calls `opts.setError?.(message)`, calls `opts.setLoading?.(false)`,
 *    and returns `undefined`.
 *
 * @example
 * ```ts
 * await withMutation(
 *   async () => {
 *     await invoke("db_create_thing", { ... });
 *     await get().loadThings();
 *   },
 *   {
 *     setLoading: (l) => set({ isLoading: l }),
 *     setError:   (e) => set({ error: e }),
 *   },
 * );
 * ```
 */
export async function withMutation<R>(
  fn: () => Promise<R>,
  opts?: {
    setLoading?: (loading: boolean) => void;
    setError?: (error: string | null) => void;
  },
): Promise<R | undefined> {
  opts?.setLoading?.(true);
  opts?.setError?.(null);
  try {
    const result = await fn();
    opts?.setLoading?.(false);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    opts?.setError?.(message);
    opts?.setLoading?.(false);
    return undefined;
  }
}
