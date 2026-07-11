import { create } from "zustand";

export interface SyncConflict {
  id: string;
  entityType: "thread" | "contact" | "task" | "calendar";
  entityId: string;
  localVersion: { title: string; summary: string; content: string };
  remoteVersion: { title: string; summary: string; content: string };
  resolved: boolean;
  resolution?: "local" | "remote" | "merge";
}

interface ConflictState {
  conflicts: SyncConflict[];
  activeConflictId: string | null;
  setConflicts: (conflicts: SyncConflict[]) => void;
  addConflict: (conflict: SyncConflict) => void;
  resolveConflict: (id: string, resolution: "local" | "remote" | "merge") => void;
  dismissAll: () => void;
  setActiveConflict: (id: string | null) => void;
}

export const useConflictStore = create<ConflictState>((set) => ({
  conflicts: [],
  activeConflictId: null,
  setConflicts: (conflicts) => set({ conflicts }),
  addConflict: (conflict) =>
    set((s) => ({ conflicts: [...s.conflicts, conflict] })),
  resolveConflict: (id, resolution) =>
    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.id === id ? { ...c, resolved: true, resolution } : c,
      ),
    })),
  dismissAll: () => set({ conflicts: [], activeConflictId: null }),
  setActiveConflict: (id) => set({ activeConflictId: id }),
}));
