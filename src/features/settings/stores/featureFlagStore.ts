/**
 * Feature Flag Store — Runtime Tier & Limit Enforcement
 *
 * Manages the current subscription tier (basic/pro) and tracks usage
 * counts for limit-gated features. Persists tier selection to SQLite.
 *
 * Testing override: the Feature Flags settings tab can toggle tier
 * and mock usage counts for development/demo purposes.
 */
import { create } from "zustand";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { type Tier, type FeatureAccess, FEATURE_FLAGS, getFeatureAccessWithDevPro } from "@/constants/featureFlags";
import { countTemplatesCount } from "@features/mail/db/templates";
import { countQuickReplies } from "@features/mail/db/quickReplies";
import { countMailRules } from "@features/mail/db/filters";

/** Runtime usage snapshot for a feature */
export interface FeatureUsage {
  /** Current usage count (e.g., 7 templates configured) */
  current: number;
  /** Max allowed (null = unlimited, 0 = locked) */
  max: number | null;
  /** Computed access level */
  access: FeatureAccess;
}

interface FeatureFlagState {
  /** Current subscription tier */
  tier: Tier;
  /** Whether override mode is enabled in the testing UI */
  overrideEnabled: boolean;
  /** Overridden tier (only used when overrideEnabled is true) */
  overrideTier: Tier;
  /**
   * Overridden usage counts keyed by feature id.
   * Only used when overrideEnabled is true.
   */
  overrideUsage: Record<string, number>;
  /** Real (auto-detected) usage counts keyed by feature id */
  realUsage: Record<string, number>;

  // ─── Actions ───
  /** Load tier from DB and initialize */
  init: () => Promise<void>;
  /** Set the real subscription tier (persisted) */
  setTier: (tier: Tier) => Promise<void>;
  /** Enable/disable testing overrides */
  setOverrideEnabled: (enabled: boolean) => void;
  /** Set override tier for testing */
  setOverrideTier: (tier: Tier) => void;
  /** Override usage count for a specific feature */
  setOverrideUsage: (featureId: string, count: number) => void;
  /** Reset all overrides to default */
  resetOverrides: () => void;
  /** Refresh real usage counts from the database */
  refreshUsageCounts: () => Promise<void>;

  // ─── Computed / Helpers ───
  /** Get the effective tier (respects override) */
  getEffectiveTier: () => Tier;
  /** Get feature access for a given feature id and real-world usage */
  getFeatureAccess: (featureId: string, realUsage: number) => FeatureAccess;
  /** Get feature usage info (respects override) */
  getFeatureUsage: (featureId: string, realUsage: number) => FeatureUsage;
  /** Check if user can create more of a limited resource */
  canCreate: (featureId: string, realUsage: number) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  tier: import.meta.env.DEV ? "pro" : "basic",
  overrideEnabled: false,
  overrideTier: "basic",
  overrideUsage: {},
  realUsage: {},

  init: async () => {
    const stored = await getSetting("subscription_tier");
    const tier = import.meta.env.DEV ? "pro" : (stored === "pro" ? "pro" : "basic");
    const overrideRaw = await getSetting("feature_flag_override_enabled");
    const overrideEnabled = overrideRaw === "true";
    const overrideTierRaw = await getSetting("feature_flag_override_tier");
    const overrideTier = overrideTierRaw === "pro" ? "pro" : "basic";
    const overrideUsageRaw = await getSetting("feature_flag_override_usage");
    let overrideUsage: Record<string, number> = {};
    if (overrideUsageRaw) {
      try { overrideUsage = JSON.parse(overrideUsageRaw); } catch { /* ignore */ }
    }

    // Query real usage counts from the database
    let realUsage: Record<string, number> = {};
    try {
      const [templates, quickReplies, mailRules] = await Promise.all([
        countTemplatesCount(),
        countQuickReplies(),
        countMailRules(),
      ]);
      realUsage = {
        templates,
        composing: quickReplies,
        "mail-rules": mailRules,
      };
    } catch (err) {
      console.error("[featureFlagStore] Failed to load real usage counts:", err);
    }

    set({ tier, overrideEnabled, overrideTier, overrideUsage, realUsage });
  },

  setTier: async (tier) => {
    await setSetting("subscription_tier", tier);
    set({ tier });
  },

  setOverrideEnabled: (enabled) => {
    setSetting("feature_flag_override_enabled", enabled ? "true" : "false").catch(() => {});
    set({ overrideEnabled: enabled });
  },

  setOverrideTier: (overrideTier) => {
    setSetting("feature_flag_override_tier", overrideTier).catch(() => {});
    set({ overrideTier });
  },

  setOverrideUsage: (featureId, count) => {
    const updated = { ...get().overrideUsage, [featureId]: count };
    setSetting("feature_flag_override_usage", JSON.stringify(updated)).catch(() => {});
    set({ overrideUsage: updated });
  },

  resetOverrides: () => {
    setSetting("feature_flag_override_usage", "{}").catch(() => {});
    set({ overrideUsage: {}, overrideEnabled: false, overrideTier: "basic" });
  },

  refreshUsageCounts: async () => {
    try {
      const [templates, quickReplies, mailRules] = await Promise.all([
        countTemplatesCount(),
        countQuickReplies(),
        countMailRules(),
      ]);
      set({
        realUsage: {
          templates,
          composing: quickReplies,
          "mail-rules": mailRules,
        },
      });
    } catch (err) {
      console.error("[featureFlagStore] Failed to refresh usage counts:", err);
    }
  },

  getEffectiveTier: () => {
    const state = get();
    return state.overrideEnabled ? state.overrideTier : state.tier;
  },

  getFeatureAccess: (featureId, realUsage) => {
    const state = get();
    const effectiveTier = state.getEffectiveTier();
    const usage = state.overrideEnabled
      ? (state.overrideUsage[featureId] ?? realUsage)
      : realUsage;
    return getFeatureAccessWithDevPro(featureId, effectiveTier, usage);
  },

  getFeatureUsage: (featureId, fallbackUsage) => {
    const state = get();
    const feature = FEATURE_FLAGS.find((f) => f.id === featureId);
    if (!feature) {
      return { current: 0, max: null, access: "enabled" };
    }
    const baseCount = state.realUsage[featureId] ?? fallbackUsage;
    const current = state.overrideEnabled
      ? (state.overrideUsage[featureId] ?? baseCount)
      : baseCount;
    const effectiveTier = state.getEffectiveTier();
    const limit = effectiveTier === "pro" ? feature.proLimit : feature.basicLimit;
    const max = limit?.max ?? null;
    const access = getFeatureAccessWithDevPro(featureId, effectiveTier, current);
    return { current, max, access };
  },

  canCreate: (featureId, realUsage) => {
    const usage = get().getFeatureUsage(featureId, realUsage);
    if (usage.max === null) return true;
    if (usage.max === 0) return false;
    return usage.current < usage.max;
  },
}));
