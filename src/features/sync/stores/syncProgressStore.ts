import { create } from "zustand";

export interface SyncOperation {
  id: string;
  label: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
}

interface SyncProgressState {
  operations: SyncOperation[];
  setOperation: (op: SyncOperation) => void;
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
}

export const useSyncProgressStore = create<SyncProgressState>((set) => ({
  operations: [],
  setOperation: (op) =>
    set((s) => {
      const existing = s.operations.findIndex((o) => o.id === op.id);
      if (existing >= 0) {
        const ops = [...s.operations];
        ops[existing] = op;
        return { operations: ops };
      }
      return { operations: [...s.operations, op] };
    }),
  removeOperation: (id) =>
    set((s) => ({ operations: s.operations.filter((o) => o.id !== id) })),
  clearCompleted: () =>
    set((s) => ({
      operations: s.operations.filter(
        (o) => o.status === "in_progress" || o.status === "pending",
      ),
    })),
}));
