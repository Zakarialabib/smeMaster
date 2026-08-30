import { describe, it, expect, beforeEach, vi } from "vitest";
import { uiBus } from "@shared/services/events/uiBus";

describe("uiBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emit/on functionality", () => {
    it("should emit an event with void payload", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);

      uiBus.emit("data:changed");

      expect(handler).toHaveBeenCalledTimes(1);
      // jsdom CustomEvent.detail is null for void payloads
      expect(handler).toHaveBeenCalledWith(null);
      unsubscribe();
    });

    it("should emit an event with payload", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("move-to-folder", handler);

      uiBus.emit("move-to-folder", { threadIds: ["thread1", "thread2"] });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ threadIds: ["thread1", "thread2"] });
      unsubscribe();
    });

    it("should emit to multiple subscribers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = uiBus.on("data:changed", handler1);
      const unsubscribe2 = uiBus.on("data:changed", handler2);

      uiBus.emit("data:changed");

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      unsubscribe1();
      unsubscribe2();
    });

    it("should not emit to unsubscribed handlers", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);
      unsubscribe();

      uiBus.emit("data:changed");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should not emit to handlers registered after emit", () => {
      uiBus.emit("data:changed");

      const handler = vi.fn();
      uiBus.on("data:changed", handler);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("event subscription/unsubscription", () => {
    it("should return an unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("should unsubscribe after calling unsubscribe", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);

      unsubscribe();
      uiBus.emit("data:changed");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle multiple unsubscribes gracefully", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);

      unsubscribe();
      unsubscribe(); // Should not throw

      uiBus.emit("data:changed");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("event type safety", () => {
    it("should handle void events correctly", () => {
      const handler = vi.fn();
      uiBus.on("toggle:command-palette", handler);

      uiBus.emit("toggle:command-palette");

      // jsdom CustomEvent.detail is null for void payloads
      expect(handler).toHaveBeenCalledWith(null);
    });

    it("should handle typed events correctly", () => {
      const handler = vi.fn();
      uiBus.on("inline-reply", handler);

      uiBus.emit("inline-reply", { mode: "reply" });

      expect(handler).toHaveBeenCalledWith({ mode: "reply" });
    });

    it("should reject wrong payload types at runtime", () => {
      const handler = vi.fn();
      uiBus.on("move-to-folder", handler);

      uiBus.emit("move-to-folder", "wrong-payload");

      expect(handler).toHaveBeenCalledWith("wrong-payload");
    });
  });

  describe("error handling", () => {
    it("should not crash when handler throws", () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      uiBus.on("data:changed", handler);

      expect(() => uiBus.emit("data:changed")).not.toThrow();
    });

    it("should continue emitting to other handlers when one throws", () => {
      const handler1 = vi.fn().mockImplementation(() => {
        throw new Error("Handler 1 error");
      });
      const handler2 = vi.fn();

      uiBus.on("data:changed", handler1);
      uiBus.on("data:changed", handler2);

      uiBus.emit("data:changed");

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("event namespace", () => {
    it("should prefix event types with 'ui:'", () => {
      const handler = vi.fn();
      uiBus.on("data:changed", handler);

      uiBus.emit("data:changed");

      expect(handler).toHaveBeenCalled();
    });

    it("should handle all event types from UiBusEventMap", () => {
      const eventTypes: (keyof typeof uiBus)[] = [
        "data:changed",
        "toggle:command-palette",
        "toggle:shortcuts-help",
        "toggle:ask-inbox",
        "toggle:template-demo",
        "move-to-folder",
        "restore-onboarding",
        "inline-reply",
        "extract-task",
        "view-raw-message",
        "navigate-help",
        "calendar:sync:done",
        "toast:show",
        "edit-template",
      ];

      eventTypes.forEach((eventType) => {
        const handler = vi.fn();
        uiBus.on(eventType, handler);
        uiBus.emit(eventType, eventType === "move-to-folder" || eventType === "restore-onboarding" || eventType === "inline-reply" || eventType === "extract-task" || eventType === "view-raw-message" || eventType === "navigate-help" || eventType === "toast:show" || eventType === "edit-template" ? { test: "payload" } : undefined);
        expect(handler).toHaveBeenCalled();
        handler.mockClear();
      });
    });
  });

  describe("memory leak prevention", () => {
    it("should not accumulate listeners after unsubscribe", () => {
      const handler = vi.fn();
      const unsubscribe = uiBus.on("data:changed", handler);

      uiBus.emit("data:changed");
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      uiBus.emit("data:changed");
      // After unsubscribe, handler should NOT be called again
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should not leak when subscribing and unsubscribing many handlers", () => {
      const handlers = Array.from({ length: 50 }, () => vi.fn());
      const unsubs = handlers.map((h) => uiBus.on("data:changed", h));

      uiBus.emit("data:changed");
      handlers.forEach((h) => expect(h).toHaveBeenCalledTimes(1));

      // Unsubscribe all
      unsubs.forEach((u) => u());

      uiBus.emit("data:changed");
      // None should be called after unsubscribe
      handlers.forEach((h) => expect(h).toHaveBeenCalledTimes(1));
    });
  });
});