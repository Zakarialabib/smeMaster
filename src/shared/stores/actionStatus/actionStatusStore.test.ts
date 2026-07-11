import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useActionStatusStore } from "./actionStatusStore";
import type { ActionStatus } from "./types";

beforeEach(() => {
  // Reset the store before each test
  useActionStatusStore.setState({ statuses: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("actionStatusStore", () => {
  describe("setStatus", () => {
    it("should set a status entry", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading");

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry).toBeDefined();
      expect(entry?.id).toBe("test-1");
      expect(entry?.status).toBe("loading");
      expect(entry?.startedAt).toBeGreaterThan(0);
    });

    it("should update an existing entry", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading");
      useActionStatusStore.getState().setStatus("test-1", "success");

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.status).toBe("success");
      expect(entry?.startedAt).toBeGreaterThan(0);
      expect(entry?.completedAt).toBeGreaterThan(0);
    });

    it("should include error message when provided", () => {
      useActionStatusStore.getState().setStatus("test-1", "error", {
        error: "Something went wrong",
      });

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.status).toBe("error");
      expect(entry?.error).toBe("Something went wrong");
    });

    it("should include progress when provided", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading", {
        progress: 50,
      });

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.progress).toBe(50);
    });

    it("should include category when provided", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading", {
        category: "sync",
      });

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.category).toBe("sync");
    });

    it("should set completedAt for terminal states", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading");
      const beforeComplete = useActionStatusStore.getState().statuses["test-1"]?.startedAt;
      expect(beforeComplete).toBeGreaterThan(0);

      useActionStatusStore.getState().setStatus("test-1", "success");
      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.completedAt).toBeGreaterThanOrEqual(entry?.startedAt ?? 0);
    });

    it("should preserve existing fields when not overwritten", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading", {
        progress: 25,
        category: "sync",
      });
      useActionStatusStore.getState().setStatus("test-1", "success");

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.status).toBe("success");
      expect(entry?.progress).toBe(25);
      expect(entry?.category).toBe("sync");
    });
  });

  describe("clearStatus", () => {
    it("should remove a single status entry", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading");
      useActionStatusStore.getState().setStatus("test-2", "loading");
      expect(Object.keys(useActionStatusStore.getState().statuses)).toHaveLength(2);

      useActionStatusStore.getState().clearStatus("test-1");
      expect(Object.keys(useActionStatusStore.getState().statuses)).toHaveLength(1);
      expect(useActionStatusStore.getState().statuses["test-1"]).toBeUndefined();
      expect(useActionStatusStore.getState().statuses["test-2"]).toBeDefined();
    });

    it("should handle clearing a non-existent entry", () => {
      expect(() => {
        useActionStatusStore.getState().clearStatus("non-existent");
      }).not.toThrow();
    });
  });

  describe("clearCategory", () => {
    it("should remove all entries in a category", () => {
      useActionStatusStore.getState().setStatus("sync-1", "loading", { category: "sync" });
      useActionStatusStore.getState().setStatus("sync-2", "success", { category: "sync" });
      useActionStatusStore.getState().setStatus("send-1", "loading", { category: "send" });

      useActionStatusStore.getState().clearCategory("sync");

      expect(useActionStatusStore.getState().statuses["sync-1"]).toBeUndefined();
      expect(useActionStatusStore.getState().statuses["sync-2"]).toBeUndefined();
      expect(useActionStatusStore.getState().statuses["send-1"]).toBeDefined();
    });

    it("should not affect entries without a category", () => {
      useActionStatusStore.getState().setStatus("no-cat", "loading");
      useActionStatusStore.getState().clearCategory("sync");

      expect(useActionStatusStore.getState().statuses["no-cat"]).toBeDefined();
    });
  });

  describe("setStatusWithAutoClear", () => {
    it("should auto-clear after the specified timeout", () => {
      vi.useFakeTimers();

      useActionStatusStore
        .getState()
        .setStatusWithAutoClear("test-1", "success", { autoClearMs: 1000 });

      expect(useActionStatusStore.getState().statuses["test-1"]).toBeDefined();

      vi.advanceTimersByTime(1000);

      expect(useActionStatusStore.getState().statuses["test-1"]).toBeUndefined();
    });

    it("should default to 3000ms timeout", () => {
      vi.useFakeTimers();

      useActionStatusStore.getState().setStatusWithAutoClear("test-1", "success");

      expect(useActionStatusStore.getState().statuses["test-1"]).toBeDefined();

      vi.advanceTimersByTime(2999);
      expect(useActionStatusStore.getState().statuses["test-1"]).toBeDefined();

      vi.advanceTimersByTime(1);
      expect(useActionStatusStore.getState().statuses["test-1"]).toBeUndefined();
    });

    it("should NOT auto-clear for loading status", () => {
      vi.useFakeTimers();

      useActionStatusStore
        .getState()
        .setStatusWithAutoClear("test-1", "loading", { autoClearMs: 100 });

      vi.advanceTimersByTime(1000);

      // Loading status should NOT be auto-cleared
      expect(useActionStatusStore.getState().statuses["test-1"]).toBeDefined();
    });

    it("should cancel existing auto-clear when setting new status", () => {
      vi.useFakeTimers();

      useActionStatusStore
        .getState()
        .setStatusWithAutoClear("test-1", "success", { autoClearMs: 1000 });

      useActionStatusStore
        .getState()
        .setStatusWithAutoClear("test-1", "success", { autoClearMs: 5000 });

      vi.advanceTimersByTime(1000);

      // Should not have been cleared (the 5s timer replaced the 1s timer)
      expect(useActionStatusStore.getState().statuses["test-1"]).toBeDefined();

      vi.advanceTimersByTime(4000);

      expect(useActionStatusStore.getState().statuses["test-1"]).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle multiple status updates for the same id", () => {
      useActionStatusStore.getState().setStatus("test-1", "loading");
      useActionStatusStore.getState().setStatus("test-1", "loading", { progress: 25 });
      useActionStatusStore.getState().setStatus("test-1", "loading", { progress: 50 });
      useActionStatusStore.getState().setStatus("test-1", "loading", { progress: 75 });
      useActionStatusStore.getState().setStatus("test-1", "success");

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.status).toBe("success");
      expect(entry?.startedAt).toBeDefined();
      expect(entry?.completedAt).toBeDefined();
    });

    it("should preserve startedAt across updates", () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);

      useActionStatusStore.getState().setStatus("test-1", "loading");

      vi.setSystemTime(5000);

      useActionStatusStore.getState().setStatus("test-1", "success");

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.startedAt).toBe(1000);
      expect(entry?.completedAt).toBe(5000);
    });
  });
});
