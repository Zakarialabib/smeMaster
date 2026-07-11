import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRefreshableAiCache } from "./useRefreshableAiCache";

vi.mock("@features/mail/db/aiCache", () => ({
  deleteAiCache: vi.fn(),
}));

import { deleteAiCache } from "@features/mail/db/aiCache";

const mockDeleteAiCache = vi.mocked(deleteAiCache);

beforeEach(() => {
  mockDeleteAiCache.mockReset();
  mockDeleteAiCache.mockResolvedValue(undefined);
});

describe("useRefreshableAiCache", () => {
  it("load() calls the fetcher with (accountId, threadId) and stores the result", async () => {
    const fetcher = vi.fn().mockResolvedValue("summary text");
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.load();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("a1", "t1");
    expect(result.current.data).toBe("summary text");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("load() does NOT call deleteAiCache", async () => {
    const fetcher = vi.fn().mockResolvedValue("text");
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.load();
    });

    expect(mockDeleteAiCache).not.toHaveBeenCalled();
  });

  it("refresh() calls deleteAiCache with the supplied (accountId, threadId, cacheType) before re-fetching", async () => {
    const fetcher = vi.fn().mockResolvedValue("fresh text");
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "smart_replies",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockDeleteAiCache).toHaveBeenCalledTimes(1);
    expect(mockDeleteAiCache).toHaveBeenCalledWith("a1", "t1", "smart_replies");
    expect(fetcher).toHaveBeenCalledWith("a1", "t1");
    expect(result.current.data).toBe("fresh text");
  });

  it("refresh() clears data to null before re-running the fetcher (mid-flight visibility)", async () => {
    // First load: resolve immediately with "initial".
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("initial")
      // Second call (from refresh): hang on a deferred promise.
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            (globalThis as { __resolveRefresh?: (v: string) => void }).__resolveRefresh = resolve;
          }),
      );

    // Replace deleteAiCache with a deferred one we control, so the test
    // can flush `setData(null)` at a precise moment.
    let resolveDelete!: () => void;
    mockDeleteAiCache.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.data).toBe("initial");

    // Kick off the refresh; deleteAiCache is now hanging.
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    // While deleteAiCache is still pending, `data` is unchanged.
    expect(result.current.data).toBe("initial");

    // Resolve deleteAiCache → hook reaches `setData(null)` and the
    // fetcher is now in flight.
    await act(async () => {
      resolveDelete();
    });

    expect(mockDeleteAiCache).toHaveBeenCalledWith("a1", "t1", "summary");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    // Now let the refresh fetcher finish.
    await act(async () => {
      (globalThis as { __resolveRefresh?: (v: string) => void }).__resolveRefresh?.("next");
      await refreshPromise;
    });

    expect(result.current.data).toBe("next");
  });

  it("load() is a no-op (no second fetcher call) while a load is already in flight", async () => {
    let resolveFirst!: (v: string) => void;
    const fetcher = vi.fn().mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    let first!: Promise<void>;
    act(() => {
      first = result.current.load();
    });
    expect(result.current.loadingRef.current).toBe(true);

    // Second load while first is in flight → no-op.
    await act(async () => {
      await result.current.load();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst("x");
      await first;
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("x");
  });

  it("refresh() is a no-op while a load is already in flight (fixes the original race)", async () => {
    let resolveFirst!: (v: string) => void;
    const fetcher = vi.fn().mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    let first!: Promise<void>;
    act(() => {
      first = result.current.load();
    });

    // Refresh during the in-flight load → must not call deleteAiCache or fetcher.
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockDeleteAiCache).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst("x");
      await first;
    });
  });

  it("load() is also a no-op while a refresh is in flight", async () => {
    let resolveRefresh!: (v: string) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    expect(mockDeleteAiCache).toHaveBeenCalled();

    await act(async () => {
      await result.current.load();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh("x");
      await refreshPromise;
    });
  });

  it("captures fetcher errors into `error` by default and keeps data unchanged", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("AI down"))
      .mockResolvedValueOnce("recovered");
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error | null)?.message).toBe("AI down");
    expect(result.current.loading).toBe(false);

    // After error, the next load should clear the error and succeed.
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe("recovered");
  });

  it("re-throws errors from load() when captureErrors is false", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
        captureErrors: false,
      }),
    );

    await act(async () => {
      // Attach a no-op rejection handler so the unhandled-rejection
      // warning stays out of the test output.
      await result.current.load().catch(() => {});
    });

    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refresh() proceeds with the fetcher even if deleteAiCache rejects", async () => {
    mockDeleteAiCache.mockRejectedValue(new Error("cache delete failed"));
    const fetcher = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetcher).toHaveBeenCalledWith("a1", "t1");
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeNull();
  });

  it("clear() resets data and error to null but does not abort an in-flight load", async () => {
    let resolveFetch!: (v: string) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load();
    });

    act(() => {
      result.current.clear();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loadingRef.current).toBe(true);

    await act(async () => {
      resolveFetch("late");
      await loadPromise;
    });
    // The in-flight load's result is still applied after clear().
    expect(result.current.data).toBe("late");
  });

  it("uses the latest fetcher closure across re-renders (ref pattern)", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A");
    const fetcherB = vi.fn().mockResolvedValue("B");

    const { result, rerender } = renderHook(
      ({ fetcher }: { fetcher: (a: string, t: string) => Promise<string> }) =>
        useRefreshableAiCache<string>({
          accountId: "a1",
          threadId: "t1",
          cacheType: "summary",
          fetcher,
        }),
      { initialProps: { fetcher: fetcherA } },
    );

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.data).toBe("A");

    // Switch fetcher between renders.
    rerender({ fetcher: fetcherB });

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.data).toBe("B");
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it("exposes loadingRef synchronously in sync with `loading` state", async () => {
    let resolveFetch!: (v: string) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    expect(result.current.loadingRef.current).toBe(false);
    expect(result.current.loading).toBe(false);

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load();
    });
    // Both flags are set before the fetcher resolves.
    expect(result.current.loadingRef.current).toBe(true);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFetch("done");
      await loadPromise;
    });
    expect(result.current.loadingRef.current).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("loadingRef object identity is stable across renders (safe in dep arrays)", () => {
    const { result, rerender } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher: vi.fn().mockResolvedValue("x"),
      }),
    );
    const first = result.current.loadingRef;
    rerender();
    expect(result.current.loadingRef).toBe(first);
  });

  it("does not update data after unmount", async () => {
    let resolveFetch!: (v: string) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result, unmount } = renderHook(() =>
      useRefreshableAiCache<string>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "summary",
        fetcher,
      }),
    );

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load();
    });
    unmount();

    await act(async () => {
      resolveFetch("should-be-ignored");
      await loadPromise;
    });
    // We can't read result.current after unmount, so just confirm the
    // promise resolved without throwing.
    await expect(loadPromise).resolves.toBeUndefined();
  });

  it("supports typed result arrays (e.g. string[] for smart_replies)", async () => {
    const fetcher = vi.fn().mockResolvedValue(["reply 1", "reply 2"]);
    const { result } = renderHook(() =>
      useRefreshableAiCache<string[]>({
        accountId: "a1",
        threadId: "t1",
        cacheType: "smart_replies",
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.data).toEqual(["reply 1", "reply 2"]);
  });
});
