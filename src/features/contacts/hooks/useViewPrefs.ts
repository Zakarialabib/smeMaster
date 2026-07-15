import { useCallback, useMemo } from "react";
import { usePersistentStorage } from "@shared/hooks/usePersistentStorage";

export type ViewMode = "list" | "grid";
export type Density = "compact" | "normal" | "comfortable";
export type SortField = "name" | "email" | "last_contact" | "frequency" | "score";
export type SortDirection = "asc" | "desc";

export interface ContactsViewPrefs {
  viewMode: ViewMode;
  density: Density;
  sortField: SortField;
  sortDirection: SortDirection;
}

const STORAGE_KEY = "smemaster.contacts.prefs";

export const DEFAULT_PREFS: ContactsViewPrefs = {
  viewMode: "list",
  density: "normal",
  sortField: "last_contact",
  sortDirection: "desc",
};

function isValidPrefs(value: unknown): value is ContactsViewPrefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.viewMode === "list" || v.viewMode === "grid") &&
    (v.density === "compact" ||
      v.density === "normal" ||
      v.density === "comfortable") &&
    typeof v.sortField === "string" &&
    (v.sortDirection === "asc" || v.sortDirection === "desc")
  );
}

function isTabletViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 640px) and (max-width: 1023px)").matches;
}

function computeInitialPrefs(): ContactsViewPrefs {
  // First-time visitor on tablet: default to grid view.
  if (typeof window !== "undefined" && isTabletViewport()) {
    return { ...DEFAULT_PREFS, viewMode: "grid" };
  }
  return DEFAULT_PREFS;
}

/**
 * Persistent contacts view preferences.
 *
 * Backed by `usePersistentStorage` — values live in a real on-disk store
 * (via `tauri-plugin-store` on Windows / Android) with a `localStorage`
 * fallback in browser dev mode. Replaces the old direct `localStorage`
 * usage so preferences survive Android cache clears and are visible to
 * the native layer.
 */
export function useViewPrefs(): {
  prefs: ContactsViewPrefs;
  setViewMode: (mode: ViewMode) => void;
  setDensity: (density: Density) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  toggleSortDirection: () => void;
  reset: () => void;
  loading: boolean;
} {
  const initial = useMemo(computeInitialPrefs, []);
  const { value, setValue, loading } = usePersistentStorage<ContactsViewPrefs>(
    STORAGE_KEY,
    initial,
  );

  // Validate what we read back from the store; fall back to defaults if
  // the persisted value is from an older schema.
  const prefs: ContactsViewPrefs = isValidPrefs(value)
    ? { ...DEFAULT_PREFS, ...value }
    : initial;

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setValue((p) => ({ ...p, viewMode: mode }));
    },
    [setValue],
  );

  const setDensity = useCallback(
    (density: Density) => {
      setValue((p) => ({ ...p, density }));
    },
    [setValue],
  );

  const setSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setValue((p) => ({ ...p, sortField: field, sortDirection: direction }));
    },
    [setValue],
  );

  const toggleSortDirection = useCallback(() => {
    setValue((p) => ({
      ...p,
      sortDirection: p.sortDirection === "asc" ? "desc" : "asc",
    }));
  }, [setValue]);

  const reset = useCallback(() => {
    setValue(DEFAULT_PREFS);
  }, [setValue]);

  return {
    prefs,
    setViewMode,
    setDensity,
    setSort,
    toggleSortDirection,
    reset,
    loading,
  };
}
