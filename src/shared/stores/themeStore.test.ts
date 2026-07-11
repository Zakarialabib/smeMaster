import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock zustand persist middleware (matches pattern from useTaskViewPrefs.test.ts)
vi.mock("zustand/middleware", () => ({
  persist: vi.fn((configFn: unknown) => configFn),
  createJSONStorage: vi.fn((fn: unknown) => fn),
}));

import { useConfigStore } from "@/stores/core";

beforeEach(() => {
  useConfigStore.setState({
    theme: "system",
    colorTheme: "indigo",
    fontScale: "default",
    reduceMotion: false,
  });
});

describe("themeStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useConfigStore.getState();
      expect(state.theme).toBe("system");
      expect(state.colorTheme).toBe("indigo");
      expect(state.fontScale).toBe("default");
      expect(state.reduceMotion).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("should set theme to light", () => {
      useConfigStore.getState().setTheme("light");
      expect(useConfigStore.getState().theme).toBe("light");
    });

    it("should set theme to dark", () => {
      useConfigStore.getState().setTheme("dark");
      expect(useConfigStore.getState().theme).toBe("dark");
    });

    it("should set theme to system", () => {
      useConfigStore.getState().setTheme("dark");
      useConfigStore.getState().setTheme("system");
      expect(useConfigStore.getState().theme).toBe("system");
    });
  });

  describe("setColorTheme", () => {
    it("should set color theme", () => {
      useConfigStore.getState().setColorTheme("rose");
      expect(useConfigStore.getState().colorTheme).toBe("rose");
    });

    it("should allow switching between themes", () => {
      useConfigStore.getState().setColorTheme("rose");
      expect(useConfigStore.getState().colorTheme).toBe("rose");
      useConfigStore.getState().setColorTheme("emerald");
      expect(useConfigStore.getState().colorTheme).toBe("emerald");
    });
  });

  describe("setFontScale", () => {
    it("should set font scale to small", () => {
      useConfigStore.getState().setFontScale("small");
      expect(useConfigStore.getState().fontScale).toBe("small");
    });

    it("should set font scale to large", () => {
      useConfigStore.getState().setFontScale("large");
      expect(useConfigStore.getState().fontScale).toBe("large");
    });

    it("should set font scale to xlarge", () => {
      useConfigStore.getState().setFontScale("xlarge");
      expect(useConfigStore.getState().fontScale).toBe("xlarge");
    });

    it("should set font scale back to default", () => {
      useConfigStore.getState().setFontScale("large");
      useConfigStore.getState().setFontScale("default");
      expect(useConfigStore.getState().fontScale).toBe("default");
    });
  });

  describe("setReduceMotion", () => {
    it("should enable reduce motion", () => {
      useConfigStore.getState().setReduceMotion(true);
      expect(useConfigStore.getState().reduceMotion).toBe(true);
    });

    it("should disable reduce motion", () => {
      useConfigStore.getState().setReduceMotion(true);
      useConfigStore.getState().setReduceMotion(false);
      expect(useConfigStore.getState().reduceMotion).toBe(false);
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when setting one field", () => {
      useConfigStore.getState().setTheme("dark");
      const state = useConfigStore.getState();
      expect(state.colorTheme).toBe("indigo");
      expect(state.fontScale).toBe("default");
      expect(state.reduceMotion).toBe(false);
    });
  });
});
