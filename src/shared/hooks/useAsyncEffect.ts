import { useEffect, type DependencyList } from "react";

/**
 * Like `useEffect`, but the callback may return a promise. The hook owns a
 * per-run "cancelled" flag and exposes a stable `isStale()` predicate so the
 * callback can avoid calling `setState` after a re-run has superseded it.
 *
 * @example
 *   useAsyncEffect(async (isStale) => {
 *     const data = await fetchData(id);
 *     if (!isStale()) setData(data);
 *   }, [id]);
 */
export function useAsyncEffect(
  fn: (isStale: () => boolean) => Promise<void> | void,
  deps: DependencyList,
): void {
  useEffect(() => {
    let cancelled = false;
    const isStale = () => cancelled;
    void fn(isStale);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

