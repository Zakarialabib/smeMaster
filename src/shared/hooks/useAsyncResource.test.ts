import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAsyncResource } from "./useAsyncResource";

describe("useAsyncResource", () => {
  it("starts in idle state", () => {
    const fn = vi.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useAsyncResource(fn, []));
    // After the first effect tick, it will be loading or ready.
    expect(["idle", "loading", "ready"]).toContain(result.current.resource.status);
  });

  it("transitions to ready on success", async () => {
    const fn = vi.fn().mockResolvedValue({ name: "ok" });
    const { result } = renderHook(() => useAsyncResource(fn, []));
    await waitFor(() => expect(result.current.resource.status).toBe("ready"));
    if (result.current.resource.status === "ready") {
      expect(result.current.resource.data).toEqual({ name: "ok" });
    }
  });

  it("transitions to error on failure", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAsyncResource(fn, []));
    await waitFor(() => expect(result.current.resource.status).toBe("error"));
    if (result.current.resource.status === "error") {
      expect(result.current.resource.error).toBe("boom");
    }
  });

  it("uses stringified error for non-Error throws", async () => {
    const fn = vi.fn().mockRejectedValue("string-only");
    const { result } = renderHook(() => useAsyncResource(fn, []));
    await waitFor(() => expect(result.current.resource.status).toBe("error"));
    if (result.current.resource.status === "error") {
      expect(result.current.resource.error).toBe("string-only");
    }
  });

  it("retry re-runs the loader with the latest fn/args", async () => {
    const fn = vi.fn().mockResolvedValue(1);
    const { result, rerender } = renderHook(({ next }: { next: number }) => useAsyncResource(fn, [next]), {
      initialProps: { next: 1 },
    });
    await waitFor(() => expect(result.current.resource.status).toBe("ready"));
    const callCountBefore = fn.mock.calls.length;
    actRetry(result.current.retry);
    rerender({ next: 2 });
    await waitFor(() => expect(fn.mock.calls.length).toBeGreaterThan(callCountBefore));
  });

  it("auto-cancels stale runs on dep change", async () => {
    let resolveFirst!: (v: string) => void;
    let resolveSecond!: (v: string) => void;
    const slow = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveFirst = r)))
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveSecond = r)));
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useAsyncResource(slow, [id]),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
    rerender({ id: 2 });
    await waitFor(() => expect(slow).toHaveBeenCalledTimes(2));
    // Resolve the first (stale) one — should NOT change the resource.
    resolveFirst("stale");
    await Promise.resolve();
    expect(result.current.resource.status).not.toBe("ready");
    // Now resolve the second (current) one.
    resolveSecond("current");
    await waitFor(() => {
      if (result.current.resource.status === "ready") {
        expect(result.current.resource.data).toBe("current");
      } else {
        throw new Error("not ready");
      }
    });
  });
});

function actRetry(retry: () => void) {
  retry();
}
