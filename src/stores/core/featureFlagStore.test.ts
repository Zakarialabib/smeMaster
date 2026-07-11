import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFeatureFlagStore } from "@/stores/core";
import type { FeatureUsage } from "@/stores/core";

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(() => Promise.resolve()),
}));

vi.mock("@features/mail/db/templates", () => ({ countTemplatesCount: vi.fn() }));
vi.mock("@features/mail/db/quickReplies", () => ({ countQuickReplies: vi.fn() }));
vi.mock("@features/mail/db/filters", () => ({ countMailRules: vi.fn() }));

vi.mock("@/constants/featureFlags", () => {
  const actual = vi.importActual("@/constants/featureFlags");
  return actual;
});

import { getSetting, setSetting } from "@features/settings/db/settings";
import { countTemplatesCount } from "@features/mail/db/templates";
import { countQuickReplies } from "@features/mail/db/quickReplies";
import { countMailRules } from "@features/mail/db/filters";

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);
const mockCountTemplates = vi.mocked(countTemplatesCount);
const mockCountQuickReplies = vi.mocked(countQuickReplies);
const mockCountMailRules = vi.mocked(countMailRules);

beforeEach(() => {
  useFeatureFlagStore.setState({
    tier: "pro",
    overrideEnabled: false,
    overrideTier: "basic",
    overrideUsage: {},
    realUsage: {},
  });
  vi.clearAllMocks();
  mockSetSetting.mockImplementation(() => Promise.resolve());
});

describe("featureFlagStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useFeatureFlagStore.getState();
      expect(state.tier).toBe("pro");
      expect(state.overrideEnabled).toBe(false);
      expect(state.overrideTier).toBe("basic");
      expect(state.overrideUsage).toEqual({});
      expect(state.realUsage).toEqual({});
    });
  });

  describe("setTier", () => {
    it("should update tier and persist to settings", async () => {
      await useFeatureFlagStore.getState().setTier("basic");
      expect(useFeatureFlagStore.getState().tier).toBe("basic");
      expect(mockSetSetting).toHaveBeenCalledWith("subscription_tier", "basic");
    });

    it("should set tier to pro", async () => {
      await useFeatureFlagStore.getState().setTier("pro");
      expect(useFeatureFlagStore.getState().tier).toBe("pro");
      expect(mockSetSetting).toHaveBeenCalledWith("subscription_tier", "pro");
    });
  });

  describe("setOverrideEnabled", () => {
    it("should enable override", () => {
      useFeatureFlagStore.getState().setOverrideEnabled(true);
      expect(useFeatureFlagStore.getState().overrideEnabled).toBe(true);
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_enabled", "true");
    });

    it("should disable override", () => {
      useFeatureFlagStore.getState().setOverrideEnabled(true);
      useFeatureFlagStore.getState().setOverrideEnabled(false);
      expect(useFeatureFlagStore.getState().overrideEnabled).toBe(false);
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_enabled", "false");
    });
  });

  describe("setOverrideTier", () => {
    it("should set override tier to pro", () => {
      useFeatureFlagStore.getState().setOverrideTier("pro");
      expect(useFeatureFlagStore.getState().overrideTier).toBe("pro");
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_tier", "pro");
    });

    it("should set override tier to basic", () => {
      useFeatureFlagStore.getState().setOverrideTier("basic");
      expect(useFeatureFlagStore.getState().overrideTier).toBe("basic");
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_tier", "basic");
    });
  });

  describe("setOverrideUsage", () => {
    it("should set override usage for a feature", () => {
      useFeatureFlagStore.getState().setOverrideUsage("templates", 5);
      expect(useFeatureFlagStore.getState().overrideUsage).toEqual({ templates: 5 });
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_usage", '{"templates":5}');
    });

    it("should merge with existing override usage", () => {
      useFeatureFlagStore.getState().setOverrideUsage("templates", 5);
      useFeatureFlagStore.getState().setOverrideUsage("composing", 3);
      expect(useFeatureFlagStore.getState().overrideUsage).toEqual({ templates: 5, composing: 3 });
    });
  });

  describe("resetOverrides", () => {
    it("should clear all overrides", () => {
      useFeatureFlagStore.getState().setOverrideEnabled(true);
      useFeatureFlagStore.getState().setOverrideTier("pro");
      useFeatureFlagStore.getState().setOverrideUsage("templates", 5);

      useFeatureFlagStore.getState().resetOverrides();

      const state = useFeatureFlagStore.getState();
      expect(state.overrideEnabled).toBe(false);
      expect(state.overrideTier).toBe("basic");
      expect(state.overrideUsage).toEqual({});
      expect(mockSetSetting).toHaveBeenCalledWith("feature_flag_override_usage", "{}");
    });
  });

  describe("getEffectiveTier", () => {
    it("should return tier when override is disabled", () => {
      const result = useFeatureFlagStore.getState().getEffectiveTier();
      expect(result).toBe("pro");
    });

    it("should return overrideTier when override is enabled", () => {
      useFeatureFlagStore.setState({ overrideEnabled: true, overrideTier: "basic" });
      const result = useFeatureFlagStore.getState().getEffectiveTier();
      expect(result).toBe("basic");
    });
  });

  describe("getFeatureUsage", () => {
    it("should return usage for a known feature without overrides", () => {
      useFeatureFlagStore.setState({ realUsage: { templates: 1 } });
      const result = useFeatureFlagStore.getState().getFeatureUsage("templates", 0);
      expect(result.current).toBe(1);
      expect(result.max).toBeNull();
      expect(result.access).toBe("enabled");
    });

    it("should return usage with basic tier limits", () => {
      useFeatureFlagStore.setState({ tier: "basic", realUsage: { templates: 1 } });
      const result = useFeatureFlagStore.getState().getFeatureUsage("templates", 0);
      expect(result.current).toBe(1);
      expect(result.max).toBe(10);
      expect(result.access).toBe("limited");
    });

    it("should return locked access when usage exceeds basic limit", () => {
      useFeatureFlagStore.setState({ tier: "basic", realUsage: { templates: 10 } });
      const result = useFeatureFlagStore.getState().getFeatureUsage("templates", 0);
      expect(result.current).toBe(10);
      expect(result.max).toBe(10);
      expect(result.access).toBe("locked");
    });

    it("should return enabled for pro-only features with null limit", () => {
      const result = useFeatureFlagStore.getState().getFeatureUsage("ai", 0);
      expect(result.current).toBe(0);
      expect(result.max).toBeNull();
      expect(result.access).toBe("enabled");
    });

    it("should return locked for pro-only features on basic tier", () => {
      useFeatureFlagStore.setState({ tier: "basic" });
      const result = useFeatureFlagStore.getState().getFeatureUsage("ai", 0);
      expect(result.current).toBe(0);
      expect(result.max).toBe(0);
      expect(result.access).toBe("locked");
    });

    it("should return fallback when realUsage does not have the feature", () => {
      const result = useFeatureFlagStore.getState().getFeatureUsage("templates", 3);
      expect(result.current).toBe(3);
    });

    it("should use override usage when override is enabled", () => {
      useFeatureFlagStore.setState({
        overrideEnabled: true,
        overrideUsage: { templates: 10 },
        realUsage: { templates: 1 },
      });
      const result = useFeatureFlagStore.getState().getFeatureUsage("templates", 0);
      expect(result.current).toBe(10);
    });

    it("should return defaults for unknown feature", () => {
      const result = useFeatureFlagStore.getState().getFeatureUsage("unknown-feature", 0);
      expect(result.current).toBe(0);
      expect(result.max).toBeNull();
      expect(result.access).toBe("enabled");
    });
  });

  describe("canCreate", () => {
    it("should return true when max is null (unlimited)", () => {
      expect(useFeatureFlagStore.getState().canCreate("people", 0)).toBe(true);
    });

    it("should return true when current is below max", () => {
      useFeatureFlagStore.setState({ tier: "basic", realUsage: { templates: 5 } });
      expect(useFeatureFlagStore.getState().canCreate("templates", 0)).toBe(true);
    });

    it("should return false when current equals max", () => {
      useFeatureFlagStore.setState({ tier: "basic", realUsage: { templates: 10 } });
      expect(useFeatureFlagStore.getState().canCreate("templates", 0)).toBe(false);
    });

    it("should return false when current exceeds max", () => {
      useFeatureFlagStore.setState({ tier: "basic", realUsage: { templates: 15 } });
      expect(useFeatureFlagStore.getState().canCreate("templates", 0)).toBe(false);
    });

    it("should return false when max is 0 (locked feature)", () => {
      useFeatureFlagStore.setState({ tier: "basic" });
      expect(useFeatureFlagStore.getState().canCreate("ai", 0)).toBe(false);
    });
  });

  describe("init", () => {
    it("should load settings and usage counts", async () => {
      mockGetSetting.mockImplementation(async (key: string) => {
        const settings: Record<string, string> = {
          subscription_tier: "pro",
          feature_flag_override_enabled: "true",
          feature_flag_override_tier: "pro",
          feature_flag_override_usage: '{"templates":3}',
        };
        return settings[key] ?? null;
      });
      mockCountTemplates.mockResolvedValue(5);
      mockCountQuickReplies.mockResolvedValue(3);
      mockCountMailRules.mockResolvedValue(1);

      await useFeatureFlagStore.getState().init();

      const state = useFeatureFlagStore.getState();
      expect(state.tier).toBe("pro");
      expect(state.overrideEnabled).toBe(true);
      expect(state.overrideTier).toBe("pro");
      expect(state.overrideUsage).toEqual({ templates: 3 });
      expect(state.realUsage).toEqual({
        templates: 5,
        composing: 3,
        "mail-rules": 1,
      });
    });

    it("should handle null settings gracefully", async () => {
      mockGetSetting.mockResolvedValue(null);
      mockCountTemplates.mockResolvedValue(0);
      mockCountQuickReplies.mockResolvedValue(0);
      mockCountMailRules.mockResolvedValue(0);

      await useFeatureFlagStore.getState().init();

      const state = useFeatureFlagStore.getState();
      expect(state.overrideEnabled).toBe(false);
      expect(state.overrideTier).toBe("basic");
      expect(state.overrideUsage).toEqual({});
    });

    it("should handle invalid override usage JSON", async () => {
      mockGetSetting.mockImplementation(async (key: string) => {
        if (key === "feature_flag_override_usage") return "not valid json";
        return null;
      });
      mockCountTemplates.mockResolvedValue(0);
      mockCountQuickReplies.mockResolvedValue(0);
      mockCountMailRules.mockResolvedValue(0);

      await useFeatureFlagStore.getState().init();

      expect(useFeatureFlagStore.getState().overrideUsage).toEqual({});
    });

    it("should handle DB errors during usage count loading", async () => {
      mockGetSetting.mockResolvedValue(null);
      mockCountTemplates.mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useFeatureFlagStore.getState().init();

      expect(consoleSpy).toHaveBeenCalled();
      expect(useFeatureFlagStore.getState().realUsage).toEqual({});
      consoleSpy.mockRestore();
    });
  });

  describe("refreshUsageCounts", () => {
    it("should query and update real usage counts", async () => {
      mockCountTemplates.mockResolvedValue(7);
      mockCountQuickReplies.mockResolvedValue(2);
      mockCountMailRules.mockResolvedValue(4);

      await useFeatureFlagStore.getState().refreshUsageCounts();

      const state = useFeatureFlagStore.getState();
      expect(state.realUsage).toEqual({
        templates: 7,
        composing: 2,
        "mail-rules": 4,
      });
    });

    it("should handle errors gracefully", async () => {
      mockCountTemplates.mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useFeatureFlagStore.getState().refreshUsageCounts();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
