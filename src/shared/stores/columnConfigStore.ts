/**
 * Column Configuration Store
 *
 * Manages show/hide/reorder column configuration for list views:
 * - Email list
 * - Contact list
 * - Task list
 *
 * Persisted to localStorage via Zustand persist middleware.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: number;
}

export type ColumnConfigKey = "email" | "contacts" | "tasks";

export const DEFAULT_EMAIL_COLUMNS: ColumnConfig[] = [
  { id: "checkbox", label: "", visible: true, width: 32 },
  { id: "star", label: "", visible: true, width: 28 },
  { id: "sender", label: "Sender", visible: true },
  { id: "subject", label: "Subject", visible: true },
  { id: "preview", label: "Preview", visible: true },
  { id: "attachments", label: "", visible: true, width: 24 },
  { id: "date", label: "Date", visible: true, width: 80 },
];

/**
 * Default visible columns for contacts view.
 * `company` and `phone` are intentionally omitted — the current data model
 * (DbContact) does not include those fields. They may be added in a future
 * schema migration.
 */
export const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: "avatar", label: "", visible: true, width: 36 },
  { id: "name", label: "Name", visible: true },
  { id: "email", label: "Email", visible: true },
  { id: "tags", label: "Tags", visible: true },
  { id: "lastContacted", label: "Last Contact", visible: true, width: 110 },
];

export const DEFAULT_TASK_COLUMNS: ColumnConfig[] = [
  { id: "checkbox", label: "", visible: true, width: 32 },
  { id: "priority", label: "", visible: true, width: 12 },
  { id: "title", label: "Task", visible: true },
  { id: "tags", label: "Tags", visible: true },
  { id: "dueDate", label: "Due", visible: true, width: 80 },
  { id: "subtasks", label: "", visible: true, width: 40 },
  { id: "actions", label: "", visible: true, width: 60 },
];

const DEFAULTS: Record<ColumnConfigKey, ColumnConfig[]> = {
  email: DEFAULT_EMAIL_COLUMNS,
  contacts: DEFAULT_CONTACT_COLUMNS,
  tasks: DEFAULT_TASK_COLUMNS,
};

interface ColumnConfigState {
  columnVisibility: Record<ColumnConfigKey, ColumnConfig[]>;
  /** Toggle a single column's visibility for a given view key. */
  toggleColumn: (key: ColumnConfigKey, columnId: string) => void;
  /** Reorder columns for a given view key. */
  reorderColumns: (key: ColumnConfigKey, columns: ColumnConfig[]) => void;
  /** Reset columns for a given view key to defaults. */
  resetColumns: (key: ColumnConfigKey) => void;
}

export const useColumnConfigStore = create<ColumnConfigState>()(
  persist(
    (set) => ({
      columnVisibility: {
        email: [...DEFAULTS.email],
        contacts: [...DEFAULTS.contacts],
        tasks: [...DEFAULTS.tasks],
      },

      toggleColumn: (key, columnId) =>
        set((state) => {
          const columns = state.columnVisibility[key].map((col) =>
            col.id === columnId ? { ...col, visible: !col.visible } : col,
          );
          return {
            columnVisibility: { ...state.columnVisibility, [key]: columns },
          };
        }),

      reorderColumns: (key, columns) =>
        set((state) => ({
          columnVisibility: { ...state.columnVisibility, [key]: columns },
        })),

      resetColumns: (key) =>
        set((state) => ({
          columnVisibility: {
            ...state.columnVisibility,
            [key]: [...DEFAULTS[key]],
          },
        })),
    }),
    {
      name: "smemaster.column-config",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ columnVisibility: s.columnVisibility }),
    },
  ),
);
