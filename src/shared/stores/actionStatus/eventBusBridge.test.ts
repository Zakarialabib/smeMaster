import { describe, it, expect, beforeEach, vi } from "vitest";
import { useActionStatusStore } from "./actionStatusStore";
import { initActionStatusEventBridge } from "./eventBusBridge";

// Mock the eventBus to avoid Tauri dependency
vi.mock("@shared/services/events/eventBus", () => ({
  eventBus: {
    register: vi.fn().mockReturnValue(vi.fn()),
    on: vi.fn().mockReturnValue(vi.fn()),
    emit: vi.fn(),
  },
}));

// Need to get the mocked eventBus reference after mock is applied
import { eventBus } from "@shared/services/events/eventBus";

beforeEach(() => {
  useActionStatusStore.setState({ statuses: {} });
  vi.clearAllMocks();
});

describe("initActionStatusEventBridge", () => {
  it("should register handlers for queue:progress and sync:phase", () => {
    const unsub = initActionStatusEventBridge();

    expect(eventBus.register).toHaveBeenCalledWith(
      "queue:progress",
      expect.any(Function),
    );
    expect(eventBus.register).toHaveBeenCalledWith(
      "sync:phase",
      expect.any(Function),
    );

    unsub();
  });

  it("should return an unsubscribe function", () => {
    const unsub = initActionStatusEventBridge();
    expect(typeof unsub).toBe("function");

    // Calling unsub should not throw
    expect(() => unsub()).not.toThrow();
  });

  describe("queue:progress handler", () => {
    it("should update progress on the store", () => {
      // Get the queue:progress handler
      const unsub = initActionStatusEventBridge();
      const queueProgressHandler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "queue:progress",
      )?.[1];

      // Pre-set the status
      useActionStatusStore.getState().setStatus("sync-1", "loading");
      expect(
        useActionStatusStore.getState().statuses["sync-1"]?.progress,
      ).toBeUndefined();

      // Fire the handler
      queueProgressHandler?.({
        actionId: "sync-1",
        progress: 50,
      });

      expect(
        useActionStatusStore.getState().statuses["sync-1"]?.progress,
      ).toBe(50);

      unsub();
    });

    it("should default to loading status if no existing entry", () => {
      const unsub = initActionStatusEventBridge();
      const queueProgressHandler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "queue:progress",
      )?.[1];

      queueProgressHandler?.({
        actionId: "new-action",
        progress: 25,
      });

      const entry = useActionStatusStore.getState().statuses["new-action"];
      expect(entry?.status).toBe("loading");
      expect(entry?.progress).toBe(25);

      unsub();
    });

    it("should ignore events without actionId", () => {
      const unsub = initActionStatusEventBridge();
      const queueProgressHandler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "queue:progress",
      )?.[1];

      expect(() => {
        queueProgressHandler?.({ progress: 50 });
      }).not.toThrow();

      unsub();
    });
  });

  describe("sync:phase handler", () => {
    it("should set loading for started phase", () => {
      const unsub = initActionStatusEventBridge();
      const handler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "sync:phase",
      )?.[1];

      handler?.({
        actionId: "sync-account-1",
        phase: "folders",
        status: "started",
      });

      const entry = useActionStatusStore.getState().statuses["sync-account-1"];
      expect(entry?.status).toBe("loading");
      expect(entry?.category).toBe("sync");

      unsub();
    });

    it("should set success for completed phase with auto-clear", () => {
      vi.useFakeTimers();
      const unsub = initActionStatusEventBridge();
      const handler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "sync:phase",
      )?.[1];

      handler?.({
        actionId: "sync-account-1",
        phase: "folders",
        status: "completed",
      });

      const entry = useActionStatusStore.getState().statuses["sync-account-1"];
      expect(entry?.status).toBe("success");

      // Advance past the 2000ms auto-clear
      vi.advanceTimersByTime(2000);
      expect(
        useActionStatusStore.getState().statuses["sync-account-1"],
      ).toBeUndefined();

      unsub();
    });

    it("should set error for error phase with auto-clear", () => {
      vi.useFakeTimers();
      const unsub = initActionStatusEventBridge();
      const handler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "sync:phase",
      )?.[1];

      handler?.({
        actionId: "sync-account-1",
        phase: "folders",
        status: "error",
        error: "Connection timeout",
      });

      const entry = useActionStatusStore.getState().statuses["sync-account-1"];
      expect(entry?.status).toBe("error");
      expect(entry?.error).toBe("Connection timeout");

      unsub();
    });

    it("should ignore events without actionId", () => {
      const unsub = initActionStatusEventBridge();
      const handler = vi.mocked(eventBus.register).mock.calls.find(
        (call) => call[0] === "sync:phase",
      )?.[1];

      expect(() => {
        handler?.({ phase: "folders", status: "started" });
      }).not.toThrow();

      unsub();
    });
  });
});
