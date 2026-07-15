import { vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/translation.json";

// Node-environment setup for integration tests.
// Unlike the browser (jsdom) setup, there is no `window`/`document` here, so we
// only install what integration tests need: i18n + Tauri API mocks.
// (ResizeObserver / matchMedia polyfills are browser-only and skipped.)

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Tauri `invoke` is mocked per-test via ./setup (creates the in-memory DB mock).
// Notification / window APIs are irrelevant for node integration runs — but
// some imported modules may reference them, so provide harmless stubs.
vi.mock("@tauri-apps/api/notification", () => ({
  default: {
    notify: vi.fn().mockResolvedValue(undefined),
    requestPermission: vi.fn().mockResolvedValue("granted"),
    isPermissionGranted: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    setBadgeCount: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    setSkipTaskbar: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock zustand persist middleware globally — no localStorage in node either.
vi.mock("zustand/middleware", () => ({
  persist: vi.fn((configFn: unknown, _options: unknown) => configFn),
  createJSONStorage: vi.fn(() => ({})),
}));
