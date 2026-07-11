import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActionStatusStore } from "./actionStatusStore";
import { useActionStatus } from "./useActionStatus";

beforeEach(() => {
  useActionStatusStore.setState({ statuses: {} });
});

describe("useActionStatus", () => {
  it("should return idle for unknown actionId", () => {
    const { result } = renderHook(() => useActionStatus("unknown"));

    expect(result.current.status).toBe("idle");
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.progress).toBeUndefined();
  });

  it("should reflect loading status from store", () => {
    const { result } = renderHook(() => useActionStatus("test-1"));

    act(() => {
      useActionStatusStore.getState().setStatus("test-1", "loading");
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isIdle).toBe(false);
  });

  it("should reflect success status from store", () => {
    const { result } = renderHook(() => useActionStatus("test-1"));

    act(() => {
      useActionStatusStore.getState().setStatus("test-1", "success");
    });

    expect(result.current.status).toBe("success");
    expect(result.current.isSuccess).toBe(true);
  });

  it("should reflect error status with message from store", () => {
    const { result } = renderHook(() => useActionStatus("test-1"));

    act(() => {
      useActionStatusStore.getState().setStatus("test-1", "error", {
        error: "Failed to connect",
      });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe("Failed to connect");
  });

  it("should reflect progress from store", () => {
    const { result } = renderHook(() => useActionStatus("test-1"));

    act(() => {
      useActionStatusStore.getState().setStatus("test-1", "loading", {
        progress: 42,
      });
    });

    expect(result.current.progress).toBe(42);
  });

  describe("setter methods", () => {
    it("setLoading should update store", () => {
      const { result } = renderHook(() => useActionStatus("test-1"));

      act(() => {
        result.current.setLoading();
      });

      expect(useActionStatusStore.getState().statuses["test-1"]?.status).toBe(
        "loading",
      );
    });

    it("setSuccess should update store", () => {
      const { result } = renderHook(() => useActionStatus("test-1"));

      act(() => {
        result.current.setSuccess();
      });

      expect(useActionStatusStore.getState().statuses["test-1"]?.status).toBe(
        "success",
      );
    });

    it("setError should update store with message", () => {
      const { result } = renderHook(() => useActionStatus("test-1"));

      act(() => {
        result.current.setError("Something failed");
      });

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.status).toBe("error");
      expect(entry?.error).toBe("Something failed");
    });

    it("setProgress should update progress and keep current status", () => {
      const { result } = renderHook(() => useActionStatus("test-1"));

      act(() => {
        useActionStatusStore.getState().setStatus("test-1", "loading");
      });

      act(() => {
        result.current.setProgress(75);
      });

      const entry = useActionStatusStore.getState().statuses["test-1"];
      expect(entry?.progress).toBe(75);
      expect(entry?.status).toBe("loading");
    });

    it("reset should clear the status entry", () => {
      const { result } = renderHook(() => useActionStatus("test-1"));

      act(() => {
        useActionStatusStore.getState().setStatus("test-1", "loading");
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(useActionStatusStore.getState().statuses["test-1"]).toBeUndefined();
      expect(result.current.isIdle).toBe(true);
    });
  });
});
