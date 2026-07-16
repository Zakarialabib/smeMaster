import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the low-level Tauri invoke so we control whether it "exists".
const mockTauriInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => (mockTauriInvoke as any)(...args),
}));

import { invoke, safeInvoke, isTauriEnvironment, TauriUnavailableError } from "./invoke";
import { isTauriEnvironment as envCheck } from "./environment";

describe("IPC environment guard", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    mockTauriInvoke.mockReset();
    // Ensure a clean browser-like window without Tauri internals.
    (globalThis as any).window = {
      ...originalWindow,
    };
    delete (globalThis.window as any).__TAURI_INTERNALS__;
    delete (globalThis.window as any).__TAURI__;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("isTauriEnvironment() is false in a plain browser dev server", () => {
    expect(isTauriEnvironment()).toBe(false);
    expect(envCheck()).toBe(false);
  });

  it("isTauriEnvironment() is true when __TAURI_INTERNALS__ is present", () => {
    (globalThis.window as any).__TAURI_INTERNALS__ = {};
    expect(isTauriEnvironment()).toBe(true);
  });

  it("throws a clean TauriUnavailableError (not 'reading invoke') outside Tauri", async () => {
    await expect(invoke("get_app_version", {})).rejects.toBeInstanceOf(
      TauriUnavailableError,
    );
    // The low-level invoke must NOT be called — no cryptic TypeError.
    expect(mockTauriInvoke).not.toHaveBeenCalled();
  });

  it("TauriUnavailableError carries the command name and is catchable", async () => {
    try {
      await invoke("get_app_version", {});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TauriUnavailableError);
      expect((err as TauriUnavailableError).command).toBe("get_app_version");
      expect((err as TauriUnavailableError).isTauriUnavailable).toBe(true);
      expect((err as Error).message).toMatch(/get_app_version/);
    }
  });

  it("safeInvoke returns the fallback instead of throwing outside Tauri", async () => {
    const result = await safeInvoke("get_app_version", {}, { fallback: true } as any);
    expect(result).toEqual({ fallback: true });
    expect(mockTauriInvoke).not.toHaveBeenCalled();
  });

  it("invoke still delegates to Tauri when available", async () => {
    (globalThis.window as any).__TAURI_INTERNALS__ = {};
    mockTauriInvoke.mockResolvedValueOnce({ ok: true });
    const res = await invoke("get_app_version", {});
    expect(res).toEqual({ ok: true });
    expect(mockTauriInvoke).toHaveBeenCalledWith("get_app_version", {});
  });
});
