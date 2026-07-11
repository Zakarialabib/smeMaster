import { vi } from "vitest";
import i18n from "i18next";

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as any;
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/translation.json";

// Polyfill window.matchMedia for jsdom (needed by usePlatform/useMobile hooks)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Tauri `invoke` is mocked in ./mocks/tauri.mock.ts (routes to `mockInvoke`,
// defaulting to [] for the db-invoke pattern). Do not re-mock @tauri-apps/api/core here.

// Mock Tauri notification API
vi.mock("@tauri-apps/api/notification", async () => {
  const actual = await vi.importActual("@tauri-apps/api/notification");
  return {
    ...actual,
    default: {
      notify: vi.fn().mockResolvedValue(undefined),
      requestPermission: vi.fn().mockResolvedValue("granted"),
      isPermissionGranted: vi.fn().mockResolvedValue(true),
    },
  };
});

// Mock Tauri window API
vi.mock("@tauri-apps/api/window", async () => {
  const actual = await vi.importActual("@tauri-apps/api/window");
  return {
    ...actual,
    getCurrentWindow: vi.fn().mockReturnValue({
      setBadgeCount: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      setSkipTaskbar: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

// plugin-sql has been fully migrated to Rust db_* commands.
// All database operations go through db-invoke.ts -> Rust Tauri commands.
// Integration tests mock @tauri-apps/api/core directly.

// Mock zustand persist middleware globally — localStorage is unreliable in test env
vi.mock("zustand/middleware", () => ({
  persist: vi.fn((configFn: unknown, _options: unknown) => configFn),
  createJSONStorage: vi.fn(() => ({})),
}));

import "@testing-library/jest-dom/vitest";