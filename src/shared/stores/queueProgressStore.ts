import { create } from "zustand";

export interface QueueProgress {
  operationId: string;
  operationType: string;
  status: "queued" | "processing" | "completed" | "failed";
  message?: string;
}

interface QueueProgressStore {
  activeProgress: QueueProgress[];
  completedCount: number;
  failedCount: number;
  totalCount: number;
  setProgress: (opId: string, opType: string, status: QueueProgress["status"], message?: string) => void;
  clearProgress: () => void;
  startBatch: (total: number) => void;
}

export const useQueueProgressStore = create<QueueProgressStore>((set) => ({
  activeProgress: [],
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  setProgress: (opId, opType, status, message) =>
    set((state) => {
      const existing = state.activeProgress.findIndex((p) => p.operationId === opId);
      const entry: QueueProgress = { operationId: opId, operationType: opType, status, message };
      const activeProgress =
        existing >= 0
          ? state.activeProgress.map((p, i) => (i === existing ? entry : p))
          : [entry, ...state.activeProgress].slice(0, 10);
      return {
        activeProgress,
        completedCount: status === "completed" ? state.completedCount + 1 : state.completedCount,
        failedCount: status === "failed" ? state.failedCount + 1 : state.failedCount,
      };
    }),
  clearProgress: () => set({ activeProgress: [], completedCount: 0, failedCount: 0, totalCount: 0 }),
  startBatch: (total) => set({ activeProgress: [], completedCount: 0, failedCount: 0, totalCount: total }),
}));
