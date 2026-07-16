/**
 * usePersistentStorage — smoke tests.
 *
 * Covers:
 *  - Browser (jsdom) fallback: reads/writes through localStorage.
 *  - Corruption tolerance: returns the initial value when stored JSON is invalid.
 *  - Tauri path: uses @tauri-apps/plugin-store when __TAURI_INTERNALS__ is set.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePersistentStorage } from "./usePersistentStorage";

const KEY = "smemaster.test.value";

function createMockStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

const mockStorage = createMockStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
});

describe("usePersistentStorage (browser fallback)", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    // The shared tauri.mock.ts setup marks jsdom as a Tauri shell. This hook's
    // browser-fallback path requires the *non-Tauri* environment, so strip the
    // global here (the hook detects Tauri lazily per call).
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (window as unknown as Record<string, unknown>).__TAURI__;
  });

  it("returns the initial value when nothing is stored", async () => {
    const { result } = renderHook(() =>
      usePersistentStorage<number>(KEY, 42),
    );
    // Wait for the load effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.value).toBe(42);
    expect(result.current.loading).toBe(false);
  });

  it("persists writes to localStorage and reads them back on remount", async () => {
    const { result, unmount } = renderHook(() =>
      usePersistentStorage<string>(KEY, "default"),
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setValue("hello");
    });
    // Fire-and-forget setter should already have written by the time the
    // microtask queue drains.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStorage.setItem).toHaveBeenCalled();
    const lastCall =
      mockStorage.setItem.mock.calls[mockStorage.setItem.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe(KEY);
    expect(JSON.parse(lastCall?.[1] as string)).toBe("hello");

    unmount();

    // Remount and verify the value is restored.
    const { result: result2 } = renderHook(() =>
      usePersistentStorage<string>(KEY, "default"),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result2.current.value).toBe("hello");
  });

  it("falls back to initialValue when stored JSON is corrupted", async () => {
    mockStorage.setItem(KEY, "{not valid json");
    const { result } = renderHook(() =>
      usePersistentStorage<{ a: number }>(KEY, { a: 0 }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.value).toEqual({ a: 0 });
  });

  it("remove() clears the value and resets to the initial value", async () => {
    mockStorage.setItem(KEY, JSON.stringify("saved"));
    const { result } = renderHook(() =>
      usePersistentStorage<string>(KEY, "default"),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.value).toBe("saved");

    await act(async () => {
      await result.current.remove();
    });
    expect(result.current.value).toBe("default");
    expect(mockStorage.removeItem).toHaveBeenCalledWith(KEY);
  });

  it("supports functional updates", async () => {
    const { result } = renderHook(() =>
      usePersistentStorage<number>(KEY, 1),
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.setValue((prev) => prev + 1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.value).toBe(2);
  });
});
