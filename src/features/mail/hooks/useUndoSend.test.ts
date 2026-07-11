import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoSend } from "./useUndoSend";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { getSetting } from "@features/settings/db/settings";

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn(),
}));

const mockGetSetting = vi.mocked(getSetting);

describe("useUndoSend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetSetting.mockReset();
    useComposerStore.setState({
      undoSendTimer: null,
      undoSendVisible: false,
      pendingSendOpId: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the configured delay from settings and schedules a send", async () => {
    mockGetSetting.mockResolvedValue("10");
    const onSend = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      const ok = await result.current.schedule();
      expect(ok).toBe(true);
    });

    // Toast is visible immediately
    expect(useComposerStore.getState().undoSendVisible).toBe(true);
    expect(useComposerStore.getState().undoSendTimer).not.toBeNull();

    // After 10 seconds the send fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(useComposerStore.getState().undoSendVisible).toBe(false);
  });

  it("falls back to the default 5s when the setting is missing or unparseable", async () => {
    mockGetSetting.mockResolvedValue(null);
    const onSend = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      await result.current.schedule();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999);
    });
    expect(onSend).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("uses the default delay when the setting is not a valid number", async () => {
    mockGetSetting.mockResolvedValue("not-a-number");
    const onSend = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      await result.current.schedule();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("uses the default delay when the setting is non-positive", async () => {
    mockGetSetting.mockResolvedValue("0");
    const onSend = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      await result.current.schedule();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("cancel() stops the timer, hides the toast, and invokes onUndo", async () => {
    mockGetSetting.mockResolvedValue("10");
    const onSend = vi.fn();
    const onUndo = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend, onUndo }));
    await act(async () => {
      await result.current.schedule();
    });

    act(() => {
      result.current.cancel();
    });

    expect(useComposerStore.getState().undoSendVisible).toBe(false);
    expect(useComposerStore.getState().undoSendTimer).toBeNull();
    expect(onUndo).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("schedule() refuses to overlap a pending send", async () => {
    mockGetSetting.mockResolvedValue("5");
    const onSend = vi.fn();

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      const first = await result.current.schedule();
      expect(first).toBe(true);
    });

    await act(async () => {
      const second = await result.current.schedule();
      expect(second).toBe(false);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("hides the toast even when onSend throws", async () => {
    mockGetSetting.mockResolvedValue("1");
    const sendError = new Error("send failed");
    const onSend = vi.fn().mockImplementation(() => {
      // Attach a no-op rejection handler so the unhandled-rejection warning
      // stays out of the test output — the test only verifies the toast hides.
      return Promise.reject(sendError).catch(() => {});
    });

    const { result } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      await result.current.schedule();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(useComposerStore.getState().undoSendVisible).toBe(false);
  });

  it("cleans up the timer on unmount", async () => {
    mockGetSetting.mockResolvedValue("10");
    const onSend = vi.fn();

    const { result, unmount } = renderHook(() => useUndoSend({ onSend }));
    await act(async () => {
      await result.current.schedule();
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("exposes the current visibility from the store", () => {
    useComposerStore.setState({ undoSendVisible: true });
    const { result } = renderHook(() => useUndoSend({ onSend: vi.fn() }));
    expect(result.current.visible).toBe(true);
  });
});
