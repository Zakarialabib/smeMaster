import { useCallback, useRef, useState } from "react";
import { useAsyncEffect } from "./useAsyncEffect";

export type AsyncResource<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: string };

export interface UseAsyncResourceResult<T> {
  resource: AsyncResource<T>;
  retry: () => void;
}

/**
 * Manages `{ idle | loading | ready | error }` for an async loader.
 *
 * - Auto-cancels stale fetches via the `isStale()` predicate.
 * - `retry` re-runs the loader with the same args; the new args are captured
 *   at the time of the next effect tick.
 * - Returns `idle` until the first effect tick so callers can distinguish
 *   "not yet started" from "loading".
 *
 * @example
 *   const { resource, retry } = useAsyncResource(getAccount, [accountId]);
 *   if (resource.status === "loading") return <Spinner />;
 *   if (resource.status === "error") return <ErrorState onRetry={retry} />;
 *   if (resource.status === "ready") return <View data={resource.data} />;
 */
export function useAsyncResource<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  args: Args,
): UseAsyncResourceResult<T> {
  const [resource, setResource] = useState<AsyncResource<T>>({ status: "idle" });
  // Refs hold the latest fn and args so `retry` always uses current values.
  const fnRef = useRef(fn);
  const argsRef = useRef(args);
  fnRef.current = fn;
  argsRef.current = args;

  // Bump on retry() to force the effect to re-run with the latest fn/args.
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useAsyncEffect(
    async (isStale) => {
      setResource({ status: "loading" });
      try {
        const data = await fnRef.current(...argsRef.current);
        if (isStale()) return;
        setResource({ status: "ready", data });
      } catch (err) {
        if (isStale()) return;
        const message = err instanceof Error ? err.message : String(err);
        setResource({ status: "error", error: message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [retryToken, ...args],
  );

  return { resource, retry };
}

