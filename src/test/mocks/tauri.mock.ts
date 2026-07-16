import { vi, beforeEach } from "vitest";

// ── Shared Tauri IPC mock functions ──────────────────────────────────────────
// Import these in tests to configure Tauri IPC behavior.
export const mockInvoke = vi.fn();

// Mark the jsdom window as a Tauri shell for the duration of the unit suite.
// The IPC layer (src/shared/services/ipc/invoke.ts and commands.ts) short-circuits
// with a `TauriUnavailableError` when `isTauriEnvironment()` is false, which would
// otherwise defeat the `@tauri-apps/api/core` `invoke` mock below and break every
// DB-service test that exercises the real invoke path. Setting the global lets the
// mocked invoke actually run, restoring pre-guard test behavior.
//
// Tests that intentionally exercise the *non-Tauri* path (e.g. usePlatform web
// fallback, invoke.ts environment-guard specs) delete this global in their own
// `beforeEach` — see src/shared/hooks/usePlatform.test.tsx and
// src/shared/services/ipc/invoke.test.ts.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke: (...args: unknown[]) => (mockInvoke as unknown as (...a: unknown[]) => unknown)(...args),
  };
}
export const mockListen = vi.fn(() => vi.fn());   // returns cleanup fn
export const mockEmit = vi.fn();

vi.mock("@tauri-apps/api/core", async () => {
  const actual = await vi.importActual<typeof import("@tauri-apps/api/core")>(
    "@tauri-apps/api/core",
  );
  return {
    ...actual,
    invoke: (...args: any[]) => (mockInvoke as any)(...args),
  };
});

vi.mock("@tauri-apps/api/event", async () => {
  const actual = await vi.importActual<typeof import("@tauri-apps/api/event")>(
    "@tauri-apps/api/event",
  );
  return {
    ...actual,
    listen: (...args: any[]) => (mockListen as any)(...args),
    emit: (...args: any[]) => (mockEmit as any)(...args),
  };
});

// Auto-reset mocks before each test (runs when loaded as a setup file)
beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue([]); // default for the db-invoke pattern
  mockListen.mockReset();
  mockEmit.mockReset();
});

/**
 * Creates a mock for @tauri-apps/plugin-fs that simulates file operations
 * using an in-memory Map store. All operations use baseDir option (not absolute paths).
 */
export function createMockTauriFs() {
  const store = new Map<string, string>();

  return {
    store,
    mock: {
      exists: vi.fn(async (path: string) => store.has(path)),
      readTextFile: vi.fn(async (path: string) => store.get(path) ?? ""),
      writeTextFile: vi.fn(async (path: string, content: string) => {
        store.set(path, content);
      }),
      writeFile: vi.fn(),
      readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      mkdir: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      BaseDirectory: { AppData: 26 },
    },
  };
}

/**
 * Creates a mock for @tauri-apps/api/path with simple join behavior.
 */
export function createMockTauriPath() {
  return {
    join: vi.fn(async (...parts: string[]) => parts.join("/")),
    appDataDir: vi.fn(async () => "/mock/app/data/"),
  };
}
