import { useCallback, useRef, useState } from "react";
import { useAsyncEffect } from "./useAsyncEffect";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import type { DependencyList } from "react";

export interface UseAccountScopedLoaderResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Re-runs `loadFn(activeAccountId)` whenever the active account id changes.
 *
 * - Returns `{ data: null, loading: false, error: null }` if no account is active.
 * - The `reload` function forces a re-run with the same account id.
 * - Optional `deps` are merged with the implicit `[activeAccountId]` dep.
 *
 * @example
 *   const { data, loading, error, reload } = useAccountScopedLoader(
 *     (id) => getWorkflowRules(id),
 *   );
 */
export function useAccountScopedLoader<T>(
  loadFn: (accountId: string) => Promise<T>,
  deps?: DependencyList,
): UseAccountScopedLoaderResult<T> {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadFnRef = useRef(loadFn);
  loadFnRef.current = loadFn;

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useAsyncEffect(
    async (isStale) => {
      if (!activeAccountId) {
        if (!isStale()) {
          setData(null);
          setLoading(false);
          setError(null);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await loadFnRef.current(activeAccountId);
        if (isStale()) return;
        setData(result);
      } catch (err) {
        if (isStale()) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    // deps include the active account id, the user-supplied deps, and the reload token
    [activeAccountId, reloadToken, ...(deps ?? [])],
  );

  return { data, loading, error, reload };
}

