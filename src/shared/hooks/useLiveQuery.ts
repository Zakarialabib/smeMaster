import { useState, useEffect, useCallback, useRef } from "react";
import { eventBus, type DbChangePayload } from "@shared/services/events/eventBus";

export interface UseLiveQueryOptions {
  /** Tables to watch. If undefined, all changes trigger a refetch. */
  watch?: string[];
  /** Debounce in ms (default 100) to batch rapid changes */
  debounceMs?: number;
  /** Disable the listener (e.g. when a component is hidden) */
  enabled?: boolean;
}

export interface UseLiveQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useLiveQuery<T>(
  queryFn: () => Promise<T>,
  options: UseLiveQueryOptions = {}
): UseLiveQueryResult<T> {
  const { watch, debounceMs = 100, enabled = true } = options;
  const watchKey = watch?.join(",");
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const refresh = useCallback(async () => {
    try {
      const result = await queryFnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tables = watchKey?.split(",");

    const unregister = eventBus.register("db:change", (payload) => {
      const change = payload as DbChangePayload;
      if (tables && !tables.includes(change.table)) return;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refresh();
        timeoutId = null;
      }, debounceMs);
    });

    return () => {
      unregister();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, watchKey, debounceMs, refresh]);

  return { data, isLoading, error, refresh };
}
