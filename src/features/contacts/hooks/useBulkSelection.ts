import { useCallback, useMemo, useState } from "react";

export interface BulkSelectionApi {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleRange: (startId: string, endId: string, orderedIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  setSelected: (ids: string[]) => void;
}

/**
 * Manages bulk selection state with shift+click range support.
 * `orderedIds` must be a stable list of currently rendered IDs (after filter/sort).
 */
export function useBulkSelection(): BulkSelectionApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRange = useCallback(
    (startId: string, endId: string, orderedIds: string[]) => {
      const startIdx = orderedIds.indexOf(startId);
      const endIdx = orderedIds.indexOf(endId);
      if (startIdx === -1 || endIdx === -1) return;
      const [lo, hi] =
        startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) {
          const id = orderedIds[i];
          if (id) next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  return useMemo(
    () => ({
      selectedIds,
      selectedCount: selectedIds.size,
      isSelected,
      toggle,
      toggleRange,
      selectAll,
      clear,
      setSelected,
    }),
    [selectedIds, isSelected, toggle, toggleRange, selectAll, clear, setSelected],
  );
}
