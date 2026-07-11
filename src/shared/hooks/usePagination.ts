/**
 * usePagination — generic pagination hook for both page-based navigation
 * and infinite-scroll list views.
 *
 * Supports:
 *  - Page-based navigation (goToPage, currentPage, totalPages)
 *  - Infinite scroll (loadMore, hasMore)
 *  - Configurable page size
 *  - Automatic initial load on mount and when dependencies change
 *
 * @example
 * ```tsx
 * const { items, total, currentPage, totalPages, loading, goToPage, loadMore } = usePagination({
 *   fetchFn: async ({ limit, offset }) => {
 *     const items = await getItems(limit, offset);
 *     const total = await countItems();
 *     return { items, total };
 *   },
 *   pageSize: 50,
 *   deps: [accountId],
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UsePaginationOptions<T> {
  /** Async function to load a page. Returns { items, total } */
  fetchFn: (params: { limit: number; offset: number }) => Promise<{
    items: T[];
    total: number;
  }>;
  /** Number of items per page (default 50) */
  pageSize?: number;
  /** Initial offset (default 0) */
  initialOffset?: number;
  /** Dependencies that trigger a reload when changed (e.g., accountId, filter status) */
  deps?: unknown[];
}

export interface UsePaginationReturn<T> {
  /** Current page items */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether a load is in progress */
  loading: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
  /** Load the next page (appends items) */
  loadMore: () => Promise<void>;
  /** Go to a specific page number (1-indexed) */
  goToPage: (page: number) => Promise<void>;
  /** Reload from offset 0 */
  reset: () => Promise<void>;
  /** Set a new page size and reload */
  setPageSize: (size: number) => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePagination<T>({
  fetchFn,
  pageSize: initialPageSize = 50,
  initialOffset = 0,
  deps = [],
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Use refs to track mutable state without causing re-renders
  const offsetRef = useRef(initialOffset);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  const pageSizeRef = useRef(pageSize);

  // Keep refs in sync
  fetchFnRef.current = fetchFn;
  pageSizeRef.current = pageSize;

  // ── Computed values ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.floor(offsetRef.current / pageSize) + 1);
  const hasMore = offsetRef.current + pageSize < total;

  // ── Internal fetch function ─────────────────────────────────────────────
  const doFetch = useCallback(
    async (newOffset: number, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFnRef.current({
          limit: pageSizeRef.current,
          offset: newOffset,
        });

        if (append) {
          setItems((prev) => [...prev, ...result.items]);
        } else {
          setItems(result.items);
        }

        setTotal(result.total);
        offsetRef.current = newOffset;
        hasMoreRef.current = newOffset + pageSizeRef.current < result.total;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred while fetching data";
        setError(message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  // ── Public API ──────────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    await doFetch(offsetRef.current + pageSizeRef.current, true);
  }, [doFetch]);

  const goToPage = useCallback(
    async (page: number) => {
      const newOffset = (page - 1) * pageSizeRef.current;
      await doFetch(newOffset, false);
    },
    [doFetch],
  );

  const reset = useCallback(async () => {
    offsetRef.current = 0;
    setItems([]);
    await doFetch(0, false);
  }, [doFetch]);

  const setPageSizeFn = useCallback(
    (size: number) => {
      setPageSizeState(size);
      pageSizeRef.current = size;
      offsetRef.current = 0;
      setItems([]);
      doFetch(0, false);
    },
    [doFetch],
  );

  // ── Auto-load on mount and when deps change ─────────────────────────────
  useEffect(() => {
    offsetRef.current = 0;
    setItems([]);
    setTotal(0);
    setError(null);
    loadingRef.current = false;
    hasMoreRef.current = true;

    doFetch(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch, ...deps]);

  return {
    items,
    total,
    totalPages,
    currentPage,
    hasMore,
    loading,
    error,
    loadMore,
    goToPage,
    reset,
    setPageSize: setPageSizeFn,
  };
}
