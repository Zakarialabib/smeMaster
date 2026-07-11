import { describe, it, expect, beforeEach, vi } from "vitest";
import { useQueueProgressStore } from "./queueProgressStore";

beforeEach(() => {
  useQueueProgressStore.setState({
    activeProgress: [],
    completedCount: 0,
    failedCount: 0,
    totalCount: 0,
  });
});

describe("queueProgressStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useQueueProgressStore.getState();
      expect(state.activeProgress).toEqual([]);
      expect(state.completedCount).toBe(0);
      expect(state.failedCount).toBe(0);
      expect(state.totalCount).toBe(0);
    });
  });

  describe("setProgress", () => {
    it("should add a new progress entry", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "queued");

      const state = useQueueProgressStore.getState();
      expect(state.activeProgress).toHaveLength(1);
      expect(state.activeProgress[0]).toEqual({
        operationId: "op-1",
        operationType: "send",
        status: "queued",
        message: undefined,
      });
    });

    it("should update an existing progress entry", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "queued");
      useQueueProgressStore.getState().setProgress("op-1", "send", "processing");

      const state = useQueueProgressStore.getState();
      expect(state.activeProgress).toHaveLength(1);
      expect(state.activeProgress[0].status).toBe("processing");
    });

    it("should add message to progress entry", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "failed", "Connection refused");

      const entry = useQueueProgressStore.getState().activeProgress[0];
      expect(entry.message).toBe("Connection refused");
    });

    it("should increment completedCount on completed status", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "completed");

      expect(useQueueProgressStore.getState().completedCount).toBe(1);
    });

    it("should increment failedCount on failed status", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "failed");

      expect(useQueueProgressStore.getState().failedCount).toBe(1);
    });

    it("should not increment counts on queued status", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "queued");

      expect(useQueueProgressStore.getState().completedCount).toBe(0);
      expect(useQueueProgressStore.getState().failedCount).toBe(0);
    });

    it("should not increment counts on processing status", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "processing");

      expect(useQueueProgressStore.getState().completedCount).toBe(0);
      expect(useQueueProgressStore.getState().failedCount).toBe(0);
    });

    it("should not double-count when updating existing entry to completed", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "processing");
      useQueueProgressStore.getState().setProgress("op-1", "send", "completed");

      expect(useQueueProgressStore.getState().completedCount).toBe(1);
      expect(useQueueProgressStore.getState().activeProgress).toHaveLength(1);
    });

    it("should accumulate completed and failed counts", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "completed");
      useQueueProgressStore.getState().setProgress("op-2", "send", "completed");
      useQueueProgressStore.getState().setProgress("op-3", "send", "failed");

      const state = useQueueProgressStore.getState();
      expect(state.completedCount).toBe(2);
      expect(state.failedCount).toBe(1);
    });

    it("should limit activeProgress to 10 entries", () => {
      for (let i = 0; i < 15; i++) {
        useQueueProgressStore.getState().setProgress(`op-${i}`, "send", "queued");
      }

      expect(useQueueProgressStore.getState().activeProgress).toHaveLength(10);
      // Most recent entries should be kept (new entries go to front)
      expect(useQueueProgressStore.getState().activeProgress[0].operationId).toBe("op-14");
    });

    it("should place new entries at the front", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "queued");
      useQueueProgressStore.getState().setProgress("op-2", "send", "queued");

      const ids = useQueueProgressStore.getState().activeProgress.map((p) => p.operationId);
      expect(ids).toEqual(["op-2", "op-1"]);
    });
  });

  describe("clearProgress", () => {
    it("should reset all state", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "completed");
      useQueueProgressStore.getState().setProgress("op-2", "send", "failed");
      useQueueProgressStore.getState().startBatch(10);

      useQueueProgressStore.getState().clearProgress();

      const state = useQueueProgressStore.getState();
      expect(state.activeProgress).toEqual([]);
      expect(state.completedCount).toBe(0);
      expect(state.failedCount).toBe(0);
      expect(state.totalCount).toBe(0);
    });

    it("should handle clearing when already empty", () => {
      expect(() => {
        useQueueProgressStore.getState().clearProgress();
      }).not.toThrow();

      const state = useQueueProgressStore.getState();
      expect(state.activeProgress).toEqual([]);
      expect(state.completedCount).toBe(0);
      expect(state.failedCount).toBe(0);
      expect(state.totalCount).toBe(0);
    });
  });

  describe("startBatch", () => {
    it("should set totalCount and reset counters", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "completed");
      useQueueProgressStore.getState().setProgress("op-2", "send", "failed");

      useQueueProgressStore.getState().startBatch(50);

      const state = useQueueProgressStore.getState();
      expect(state.totalCount).toBe(50);
      expect(state.completedCount).toBe(0);
      expect(state.failedCount).toBe(0);
      expect(state.activeProgress).toEqual([]);
    });

    it("should handle batch of zero", () => {
      useQueueProgressStore.getState().startBatch(0);

      const state = useQueueProgressStore.getState();
      expect(state.totalCount).toBe(0);
      expect(state.completedCount).toBe(0);
      expect(state.failedCount).toBe(0);
      expect(state.activeProgress).toEqual([]);
    });

    it("should clear previous progress entries", () => {
      useQueueProgressStore.getState().setProgress("op-1", "send", "processing");
      useQueueProgressStore.getState().setProgress("op-2", "send", "queued");

      useQueueProgressStore.getState().startBatch(10);

      expect(useQueueProgressStore.getState().activeProgress).toEqual([]);
    });
  });
});
