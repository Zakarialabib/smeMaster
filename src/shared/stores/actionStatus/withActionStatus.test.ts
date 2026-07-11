import { describe, it, expect, beforeEach, vi } from "vitest";
import { useActionStatusStore } from "./actionStatusStore";
import { withActionStatus } from "./withActionStatus";

beforeEach(() => {
  useActionStatusStore.setState({ statuses: {} });
});

describe("withActionStatus", () => {
  it("should set loading then success on resolve", async () => {
    const asyncFn = vi.fn().mockResolvedValue("ok");
    const { execute } = withActionStatus(asyncFn, "test-1");

    const promise = execute();

    // Should be loading immediately
    expect(
      useActionStatusStore.getState().statuses["test-1"]?.status,
    ).toBe("loading");

    const result = await promise;

    expect(result).toBe("ok");
    expect(
      useActionStatusStore.getState().statuses["test-1"]?.status,
    ).toBe("success");
  });

  it("should set loading then error on reject", async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error("Network failure"));
    const { execute } = withActionStatus(asyncFn, "test-1");

    const promise = execute();

    expect(
      useActionStatusStore.getState().statuses["test-1"]?.status,
    ).toBe("loading");

    const result = await promise;

    expect(result).toBeUndefined();
    const entry = useActionStatusStore.getState().statuses["test-1"];
    expect(entry?.status).toBe("error");
    expect(entry?.error).toBe("Network failure");
  });

  it("should call onSuccess callback when function succeeds", async () => {
    const onSuccess = vi.fn();
    const asyncFn = vi.fn().mockResolvedValue("result-data");

    const { execute } = withActionStatus(asyncFn, "test-1", { onSuccess });

    await execute();

    expect(onSuccess).toHaveBeenCalledWith("result-data");
  });

  it("should call onError callback when function fails", async () => {
    const onError = vi.fn();
    const asyncFn = vi.fn().mockRejectedValue(new Error("Failed"));

    const { execute } = withActionStatus(asyncFn, "test-1", { onError });

    await execute();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]?.message).toBe("Failed");
  });

  it("should auto-clear on success when autoClearMs is set", async () => {
    vi.useFakeTimers();

    const asyncFn = vi.fn().mockResolvedValue("ok");
    const { execute } = withActionStatus(asyncFn, "test-1", {
      autoClearMs: 500,
    });

    await execute();

    expect(
      useActionStatusStore.getState().statuses["test-1"],
    ).toBeDefined();

    vi.advanceTimersByTime(500);

    expect(
      useActionStatusStore.getState().statuses["test-1"],
    ).toBeUndefined();
  });

  it("should auto-clear on error when autoClearMs is set", async () => {
    vi.useFakeTimers();

    const asyncFn = vi.fn().mockRejectedValue(new Error("Fail"));
    const { execute } = withActionStatus(asyncFn, "test-1", {
      autoClearMs: 500,
    });

    await execute();

    vi.advanceTimersByTime(500);

    expect(
      useActionStatusStore.getState().statuses["test-1"],
    ).toBeUndefined();
  });

  it("should set category when provided", async () => {
    const asyncFn = vi.fn().mockResolvedValue("ok");
    const { execute } = withActionStatus(asyncFn, "test-1", {
      category: "sync",
    });

    await execute();

    const entry = useActionStatusStore.getState().statuses["test-1"];
    expect(entry?.category).toBe("sync");
  });

  it("should handle non-Error rejections gracefully", async () => {
    const asyncFn = vi.fn().mockRejectedValue("string error");
    const { execute } = withActionStatus(asyncFn, "test-1");

    const result = await execute();

    expect(result).toBeUndefined();
    const entry = useActionStatusStore.getState().statuses["test-1"];
    expect(entry?.status).toBe("error");
    expect(entry?.error).toBe("string error");
  });

  it("should return the correct actionId", () => {
    const { actionId } = withActionStatus(async () => "ok", "my-action");
    expect(actionId).toBe("my-action");
  });

  it("should pass arguments through to the wrapped function", async () => {
    const asyncFn = vi.fn().mockResolvedValue("ok");
    const { execute } = withActionStatus(asyncFn, "test-1");

    await execute("arg1", 42, { key: "val" });

    expect(asyncFn).toHaveBeenCalledWith("arg1", 42, { key: "val" });
  });
});
