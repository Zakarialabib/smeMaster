import { useCallback, useEffect, useRef, useState } from "react";
import { deleteAiCache } from "@features/mail/db/aiCache";

export interface UseRefreshableAiCacheOptions<T> {
  /** Account that owns the cached entry. */
  accountId: string;
  /** Thread that owns the cached entry. */
  threadId: string;
  /** Cache discriminator (e.g. `"summary"`, `"smart_replies"`). */
  cacheType: string;
  /**
   * Async fetcher that returns the AI result. The hook supplies `accountId`
   * and `threadId`. The fetcher is held in a ref so the caller's closure
   * (e.g. one that captures `messages`) may change on every render.
   */
  fetcher: (accountId: string, threadId: string) => Promise<T>;
  /**
   * If true (default), errors are stored in `error` and swallowed by the
   * hook. If false, the error is re-thrown from `load()` / `refresh()` so
   * the caller can handle it.
   */
  captureErrors?: boolean;
}

export interface UseRefreshableAiCacheResult<T> {
  /** Latest result from the fetcher, or `null` if not yet loaded. */
  data: T | null;
  /** True while a load or refresh is in flight (React state). */
  loading: boolean;
  /**
   * Synchronous in-flight flag. Exposed so callers can gate an auto-load
   * `useEffect` without waiting for the React `loading` state to flush —
   * this prevents a "fetcher returns null → effect re-fires → loop" race.
   */
  loadingRef: { readonly current: boolean };
  /** Latest error captured from the fetcher, or `null`. */
  error: Error | null;
  /**
   * Run the fetcher and store the result. No-op (returns immediately) if a
   * load or refresh is already in flight.
   */
  load: () => Promise<void>;
  /**
   * Delete the cache entry, clear `data`, then run the fetcher. No-op if
   * a load or refresh is already in flight.
   */
  refresh: () => Promise<void>;
  /**
   * Reset `data` and `error` to their initial values. Does not abort an
   * in-flight load.
   */
  clear: () => void;
}

/**
 * useRefreshableAiCache — wraps the "load cached AI result, refresh by
 * deleting the cache and re-fetching" pattern used by `ThreadSummary` and
 * `SmartReplySuggestions`.
 *
 * Responsibilities:
 * - Calls the supplied `fetcher(accountId, threadId)` and stores the result.
 * - Prevents overlapping loads (a `load()` or `refresh()` issued while
 *   another is in flight is a no-op — fixes a race in the originals where
 *   `handleRefresh` did not gate on the in-flight flag).
 * - `refresh()` first calls `deleteAiCache(accountId, threadId, cacheType)`
 *   and clears `data` to `null` before re-running the fetcher.
 * - Exposes a synchronous `loadingRef` for callers that need to gate an
 *   auto-load effect without the one-render lag of the `loading` state.
 * - Stashes the latest `fetcher` in a ref so the hook's `load`/`refresh`
 *   callbacks stay stable when the caller passes an inline closure.
 * - Bails out of state updates on unmount.
 *
 * The caller is responsible for triggering the initial load (typically
 * from a `useEffect` gated on `data === null && !loadingRef.current`).
 *
 * @example
 * ```ts
 * const { data, loading, loadingRef, load, refresh, clear } =
 *   useRefreshableAiCache<string>({
 *     accountId,
 *     threadId,
 *     cacheType: "summary",
 *     fetcher: useCallback(
 *       (a, t) => summarizeThread(t, a, messages),
 *       [messages],
 *     ),
 *   });
 *
 * useEffect(() => {
 *   if (data !== null || loadingRef.current) return;
 *   load();
 * }, [data, loadingRef, load]);
 * ```
 */
export function useRefreshableAiCache<T>({
  accountId,
  threadId,
  cacheType,
  fetcher,
  captureErrors = true,
}: UseRefreshableAiCacheOptions<T>): UseRefreshableAiCacheResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use a ref object (not a plain useRef boolean) so the *object identity*
  // is stable across renders — callers can safely put `loadingRef` in a
  // useEffect dep array without causing the effect to re-fire.
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Stash the latest fetcher in a ref so the stable `load` / `refresh`
  // callbacks always see the most recent closure (which may capture a
  // changing `messages` prop).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const runFetch = useCallback(
    async (mode: "load" | "refresh"): Promise<void> => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      if (mode === "refresh") {
        try {
          await deleteAiCache(accountId, threadId, cacheType);
        } catch {
          // Cache delete failure shouldn't block the refresh.
        }
        if (!mountedRef.current) {
          loadingRef.current = false;
          return;
        }
        setData(null);
      }
      setError(null);
      try {
        const result = await fetcherRef.current(accountId, threadId);
        if (!mountedRef.current) return;
        setData(result);
      } catch (err) {
        if (!mountedRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        if (captureErrors) {
          setError(e);
        } else {
          throw e;
        }
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [accountId, threadId, cacheType, captureErrors],
  );

  const load = useCallback(() => runFetch("load"), [runFetch]);
  const refresh = useCallback(() => runFetch("refresh"), [runFetch]);
  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, loadingRef, load, refresh, clear };
}

