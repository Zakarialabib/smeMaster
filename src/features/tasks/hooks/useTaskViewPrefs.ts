import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TaskPriority } from "@features/tasks/db/tasks";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

// View mode types
export type TaskViewMode = "list" | "kanban" | "calendar" | "agenda";
export type TaskDensity = "compact" | "normal" | "comfortable";
export type TaskGroupBy = "none" | "priority" | "dueDate" | "tag";
export type TaskSortField = "priority" | "dueDate" | "created" | "title";
export type TaskDateFilter = "all" | "today" | "thisWeek" | "overdue";
export type TaskFilterStatus = "all" | "incomplete" | "completed";

// Filter priority type (matches taskStore's filterPriority)
export type TaskFilterPriority = TaskPriority | "all";

// Combined view preferences interface
export interface TaskViewPrefs {
  viewMode: TaskViewMode;
  density: TaskDensity;
  groupBy: TaskGroupBy;
  sortField: TaskSortField;
  sortDirection: "asc" | "desc";
  filterStatus: TaskFilterStatus;
  filterPriority: TaskFilterPriority;
  dateFilter: TaskDateFilter;
}

const DEFAULT_PREFS: TaskViewPrefs = {
  viewMode: "list",
  density: "normal",
  groupBy: "none",
  sortField: "priority",
  sortDirection: "asc",
  filterStatus: "incomplete",
  filterPriority: "all",
  dateFilter: "all",
};

const STORAGE_KEY = "smemaster.task.viewPrefs";

interface TaskViewPrefsState extends TaskViewPrefs {
  setViewMode: (mode: TaskViewMode) => void;
  setDensity: (density: TaskDensity) => void;
  setGroupBy: (groupBy: TaskGroupBy) => void;
  setSort: (field: TaskSortField, direction: "asc" | "desc") => void;
  setFilterStatus: (status: TaskFilterStatus) => void;
  setFilterPriority: (priority: TaskFilterPriority) => void;
  setDateFilter: (filter: TaskDateFilter) => void;
  reset: () => void;
}

/**
 * Validates that a value is a valid TaskViewMode.
 */
function isValidViewMode(value: unknown): value is TaskViewMode {
  return value === "list" || value === "kanban" || value === "calendar" || value === "agenda";
}

/**
 * Validates that a value is a valid TaskDensity.
 */
function isValidDensity(value: unknown): value is TaskDensity {
  return value === "compact" || value === "normal" || value === "comfortable";
}

/**
 * Validates that a value is a valid TaskGroupBy.
 */
function isValidGroupBy(value: unknown): value is TaskGroupBy {
  return value === "none" || value === "priority" || value === "dueDate" || value === "tag";
}

/**
 * Validates that a value is a valid TaskSortField.
 */
function isValidSortField(value: unknown): value is TaskSortField {
  return value === "priority" || value === "dueDate" || value === "created" || value === "title";
}

/**
 * Validates that a value is a valid sort direction.
 */
function isValidSortDirection(value: unknown): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}

/**
 * Validates that a value is a valid TaskFilterStatus.
 */
function isValidFilterStatus(value: unknown): value is TaskFilterStatus {
  return value === "all" || value === "incomplete" || value === "completed";
}

/**
 * Validates that a value is a valid TaskFilterPriority.
 */
function isValidFilterPriority(value: unknown): value is TaskFilterPriority {
  return (
    value === "all" ||
    value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "urgent"
  );
}

/**
 * Validates that a value is a valid TaskDateFilter.
 */
function isValidDateFilter(value: unknown): value is TaskDateFilter {
  return value === "all" || value === "today" || value === "thisWeek" || value === "overdue";
}

/**
 * Sanitizes persisted preferences, falling back to defaults for invalid values.
 */
function sanitize(raw: Partial<TaskViewPrefs> | undefined): TaskViewPrefs {
  return {
    viewMode: isValidViewMode(raw?.viewMode) ? raw!.viewMode : DEFAULT_PREFS.viewMode,
    density: isValidDensity(raw?.density) ? raw!.density : DEFAULT_PREFS.density,
    groupBy: isValidGroupBy(raw?.groupBy) ? raw!.groupBy : DEFAULT_PREFS.groupBy,
    sortField: isValidSortField(raw?.sortField) ? raw!.sortField : DEFAULT_PREFS.sortField,
    sortDirection: isValidSortDirection(raw?.sortDirection)
      ? raw!.sortDirection
      : DEFAULT_PREFS.sortDirection,
    filterStatus: isValidFilterStatus(raw?.filterStatus)
      ? raw!.filterStatus
      : DEFAULT_PREFS.filterStatus,
    filterPriority: isValidFilterPriority(raw?.filterPriority)
      ? raw!.filterPriority
      : DEFAULT_PREFS.filterPriority,
    dateFilter: isValidDateFilter(raw?.dateFilter) ? raw!.dateFilter : DEFAULT_PREFS.dateFilter,
  };
}

/**
 * Persistent task view preferences hook.
 *
 * Stores view preferences via Zustand persist middleware, backed by
 * `tauri-plugin-store` on Windows / Android (real on-disk KV file)
 * with a `localStorage` fallback in browser dev mode. Replaces the
 * old direct `localStorage` usage so preferences survive Android cache
 * clears and are visible to the native layer.
 *
 * - viewMode: list/kanban/calendar/agenda
 * - density: compact/normal/comfortable
 * - groupBy: none/priority/dueDate/tag
 * - sortField: priority/dueDate/created/title
 * - sortDirection: asc/desc
 * - filterStatus: all/incomplete/completed
 * - filterPriority: all/none/low/medium/high/urgent
 * - dateFilter: all/today/thisWeek/overdue
 */
export const useTaskViewPrefs = create<TaskViewPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,

      setViewMode: (viewMode) => set({ viewMode }),
      setDensity: (density) => set({ density }),
      setGroupBy: (groupBy) => set({ groupBy }),
      setSort: (sortField, sortDirection) => set({ sortField, sortDirection }),
      setFilterStatus: (filterStatus) => set({ filterStatus }),
      setFilterPriority: (filterPriority) => set({ filterPriority }),
      setDateFilter: (dateFilter) => set({ dateFilter }),
      reset: () => set(DEFAULT_PREFS),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => tauriStoreStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        density: state.density,
        groupBy: state.groupBy,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        filterStatus: state.filterStatus,
        filterPriority: state.filterPriority,
        dateFilter: state.dateFilter,
      }),
      merge: (persisted: unknown, current) => ({ ...current, ...sanitize(persisted as Partial<TaskViewPrefs>) }),
      migrate: (persistedState, version) => {
        // v1 stored under `smemaster_task_view_prefs` (snake_case root key)
        // and used `partialize` directly. v2 keeps the same shape but the
        // key is namespaced. Migration is a no-op because we only renamed
        // the storage key; values are forward-compatible.
        if (version < 2) {
          console.info(
            `[useTaskViewPrefs] migrating from v${version} to v2 (key rename)`,
          );
        }
        return persistedState as TaskViewPrefsState;
      },
    }
  )
);

export default useTaskViewPrefs;