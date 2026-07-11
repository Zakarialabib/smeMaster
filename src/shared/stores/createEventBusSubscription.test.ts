import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventBusSubscription } from "./createEventBusSubscription";
import { eventBus } from "@shared/services/events/eventBus";

describe("createEventBusSubscription", () => {
  beforeEach(() => {
    // Clean registry between tests so we observe exact dispatch counts.
    eventBus.destroy();
  });

  afterEach(() => {
    eventBus.destroy();
  });

  it("init() registers all subscribers and returns a cleanup function", () => {
    const onA = vi.fn();
    const onB = vi.fn();

    const sub = createEventBusSubscription("test", {
      "sync:complete": onA,
      "sync:account-error": onB,
    });

    const cleanup = sub.init();
    expect(cleanup).toBeTypeOf("function");

    eventBus.emit("sync:complete", { ok: true });
    eventBus.emit("sync:account-error", { host: "h", username: "u", error: "e" });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onA).toHaveBeenCalledWith({ ok: true }, "sync:complete");
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledWith(
      { host: "h", username: "u", error: "e" },
      "sync:account-error",
    );
  });

  it("init() is idempotent — second call does not double-register", () => {
    const onA = vi.fn();

    const sub = createEventBusSubscription("test", {
      "sync:complete": onA,
    });

    const c1 = sub.init();
    const c2 = sub.init();

    expect(c1).toBe(c2);

    eventBus.emit("sync:complete", { v: 1 });
    expect(onA).toHaveBeenCalledTimes(1);
  });

  it("init() returns the same cleanup function across calls", () => {
    const sub = createEventBusSubscription("test", {
      "sync:complete": vi.fn(),
    });

    const c1 = sub.init();
    const c2 = sub.init();

    expect(c1).toBe(c2);
  });

  it("dispose() unregisters all subscribers and allows re-init", () => {
    const onA = vi.fn();
    const sub = createEventBusSubscription("test", {
      "sync:complete": onA,
    });

    sub.init();
    eventBus.emit("sync:complete", {});
    expect(onA).toHaveBeenCalledTimes(1);

    sub.dispose();
    eventBus.emit("sync:complete", {});
    expect(onA).toHaveBeenCalledTimes(1); // still 1, handler was removed

    // Re-init should register a fresh handler.
    sub.init();
    eventBus.emit("sync:complete", {});
    expect(onA).toHaveBeenCalledTimes(2);
  });

  it("dispose() is safe to call before init()", () => {
    const sub = createEventBusSubscription("test", {
      "sync:complete": vi.fn(),
    });

    expect(() => sub.dispose()).not.toThrow();
  });

  it("forwards payloads unchanged to each handler", () => {
    const onPush = vi.fn();
    const sub = createEventBusSubscription("test", {
      "notification:received": onPush,
    });

    sub.init();
    const payload = { title: "hi", body: "there", thread_id: "t1" };
    eventBus.emit("notification:received", payload);

    expect(onPush).toHaveBeenCalledWith(payload, "notification:received");
  });
});
