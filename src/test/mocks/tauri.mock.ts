import { vi, beforeEach } from "vitest";

// ── Shared Tauri IPC mock functions ──────────────────────────────────────────
// Import these in tests to configure Tauri IPC behavior.
export const mockInvoke = vi.fn();
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
