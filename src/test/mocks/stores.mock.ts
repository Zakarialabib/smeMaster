import { vi } from "vitest";

export function createMockUIStoreState(overrides: Record<string, unknown> = {}) {
  return {
    isOnline: true,
    setPendingOpsCount: vi.fn(),
    ...overrides,
  };
}

export function createMockThreadStoreState(
  overrides: Record<string, unknown> = {},
) {
  return {
    threads: [],
    updateThread: vi.fn(),
    removeThread: vi.fn(),
    removeThreads: vi.fn(),
    stashThread: vi.fn(),
    unstashThread: vi.fn(),
    markThreadPending: vi.fn(),
    unmarkThreadPending: vi.fn(),
    stashedThreads: new Map(),
    pendingThreadIds: new Set(),
    ...overrides,
  };
}

export function createMockAccountStoreState(
  overrides: Record<string, unknown> = {},
) {
  return {
    accounts: [],
    activeAccountId: null,
    ...overrides,
  };
}
