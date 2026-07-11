import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLiveQuery } from "./useLiveQuery";
import { eventBus } from "@shared/services/events/eventBus";

describe("useLiveQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches on mount", async () => {
    const queryFn = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() =>
      useLiveQuery(queryFn, { watch: ["messages"] })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: 1 }]);
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("sets isLoading to false after fetch", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useLiveQuery(queryFn));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("captures errors from queryFn", async () => {
    const error = new Error("DB error");
    const queryFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useLiveQuery(queryFn));

    await waitFor(() => {
      expect(result.current.error).toBe(error);
    });
  });

  it("refetches when watched table changes", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }]);
    const { result } = renderHook(() =>
      useLiveQuery(queryFn, { watch: ["messages"], debounceMs: 10 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    act(() => {
      eventBus.dispatch("db:change", {
        table: "messages",
        op: "INSERT",
        row_id: 1,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: 1 }]);
    }, { timeout: 1000 });
  });

  it("ignores non-watched table changes", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    renderHook(() => useLiveQuery(queryFn, { watch: ["messages"] }));

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      eventBus.dispatch("db:change", {
        table: "contacts",
        op: "INSERT",
        row_id: 1,
        timestamp: Date.now(),
      });
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("refetches on every change when watch is undefined", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    renderHook(() => useLiveQuery(queryFn, { debounceMs: 10 }));

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      eventBus.dispatch("db:change", {
        table: "any_table",
        op: "INSERT",
        row_id: 1,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  it("does not fetch when disabled", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    renderHook(() => useLiveQuery(queryFn, { enabled: false }));

    await new Promise((r) => setTimeout(r, 50));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("debounces rapid changes", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    renderHook(() => useLiveQuery(queryFn, { debounceMs: 50 }));

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      eventBus.dispatch("db:change", { table: "t", op: "INSERT", row_id: 1, timestamp: 0 });
      eventBus.dispatch("db:change", { table: "t", op: "INSERT", row_id: 2, timestamp: 0 });
      eventBus.dispatch("db:change", { table: "t", op: "INSERT", row_id: 3, timestamp: 0 });
    });

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });
});
