import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(() => Promise.resolve()),
}));

import { getSetting, setSetting } from "@features/settings/db/settings";
import { createPersistedJsonSetting } from "./createPersistedJsonSetting";

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);

beforeEach(() => {
  vi.clearAllMocks();
  mockSetSetting.mockImplementation(() => Promise.resolve());
});

describe("createPersistedJsonSetting", () => {
  describe("get()", () => {
    it("returns the default value when the key is missing", async () => {
      mockGetSetting.mockResolvedValue(null);

      const setting = createPersistedJsonSetting<string>({
        key: "missing",
        defaultValue: "fallback",
      });

      await expect(setting.get()).resolves.toBe("fallback");
    });

    it("parses the persisted JSON when no validator is supplied", async () => {
      mockGetSetting.mockResolvedValue('"hello"');

      const setting = createPersistedJsonSetting<string>({
        key: "greeting",
        defaultValue: "hi",
      });

      await expect(setting.get()).resolves.toBe("hello");
    });

    it("parses structured JSON values", async () => {
      mockGetSetting.mockResolvedValue('{"count":3,"name":"alpha"}');

      const setting = createPersistedJsonSetting<{ count: number; name: string }>({
        key: "obj",
        defaultValue: { count: 0, name: "default" },
      });

      await expect(setting.get()).resolves.toEqual({ count: 3, name: "alpha" });
    });

    it("returns the typed value when the validator accepts the raw string", async () => {
      mockGetSetting.mockResolvedValue("dark");

      type ThemeMode = "light" | "dark" | "system";
      const setting = createPersistedJsonSetting<ThemeMode>({
        key: "theme",
        defaultValue: "system",
        validate: (raw) =>
          raw === "light" || raw === "dark" || raw === "system" ? raw : null,
      });

      await expect(setting.get()).resolves.toBe("dark");
    });

    it("returns the default when the validator rejects the raw string", async () => {
      mockGetSetting.mockResolvedValue("neon");

      type ThemeMode = "light" | "dark" | "system";
      const setting = createPersistedJsonSetting<ThemeMode>({
        key: "theme",
        defaultValue: "system",
        validate: (raw) =>
          raw === "light" || raw === "dark" || raw === "system" ? raw : null,
      });

      await expect(setting.get()).resolves.toBe("system");
    });

    it("uses a custom deserializer when provided", async () => {
      mockGetSetting.mockResolvedValue("480");

      const setting = createPersistedJsonSetting<number>({
        key: "width",
        defaultValue: 320,
        deserialize: (raw) => parseInt(raw, 10),
      });

      await expect(setting.get()).resolves.toBe(480);
    });

    it("falls back to the default when JSON parsing throws", async () => {
      mockGetSetting.mockResolvedValue("not-json{");

      const setting = createPersistedJsonSetting<{ ok: boolean }>({
        key: "broken",
        defaultValue: { ok: false },
      });

      await expect(setting.get()).resolves.toEqual({ ok: false });
    });

    it("falls back to the default when the underlying getSetting rejects", async () => {
      mockGetSetting.mockRejectedValue(new Error("DB offline"));

      const setting = createPersistedJsonSetting<string>({
        key: "any",
        defaultValue: "safe",
      });

      await expect(setting.get()).resolves.toBe("safe");
    });

    it("falls back to the default when the validator throws", async () => {
      mockGetSetting.mockResolvedValue("boom");

      const setting = createPersistedJsonSetting<string>({
        key: "any",
        defaultValue: "fallback",
        validate: () => {
          throw new Error("validator exploded");
        },
      });

      await expect(setting.get()).resolves.toBe("fallback");
    });
  });

  describe("set()", () => {
    it("serializes via JSON.stringify by default", async () => {
      const setting = createPersistedJsonSetting<{ enabled: boolean }>({
        key: "feature",
        defaultValue: { enabled: false },
      });

      await setting.set({ enabled: true });

      expect(mockSetSetting).toHaveBeenCalledWith("feature", '{"enabled":true}');
    });

    it("uses a custom serializer when provided", async () => {
      const setting = createPersistedJsonSetting<number>({
        key: "width",
        defaultValue: 320,
        serialize: (n) => `w=${n}`,
      });

      await setting.set(640);

      expect(mockSetSetting).toHaveBeenCalledWith("width", "w=640");
    });

    it("propagates errors thrown by the underlying setSetting", async () => {
      mockSetSetting.mockRejectedValueOnce(new Error("write failed"));

      const setting = createPersistedJsonSetting<string>({
        key: "x",
        defaultValue: "",
      });

      await expect(setting.set("value")).rejects.toThrow("write failed");
    });
  });

  describe("round-trip", () => {
    it("round-trips a value through get / set", async () => {
      const store = new Map<string, string>();
      mockGetSetting.mockImplementation(async (key) => store.get(key) ?? null);
      mockSetSetting.mockImplementation(async (key, value) => {
        store.set(key, value);
      });

      interface Profile {
        name: string;
        count: number;
      }
      const profile = createPersistedJsonSetting<Profile>({
        key: "profile",
        defaultValue: { name: "anon", count: 0 },
      });

      await expect(profile.get()).resolves.toEqual({ name: "anon", count: 0 });

      await profile.set({ name: "ada", count: 42 });
      expect(mockSetSetting).toHaveBeenCalledWith(
        "profile",
        JSON.stringify({ name: "ada", count: 42 }),
      );

      await expect(profile.get()).resolves.toEqual({ name: "ada", count: 42 });
    });
  });
});
