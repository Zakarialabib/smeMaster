/**
 * Feature Flag Definitions — Single Source of Truth
 *
 * Orchestrates Basic vs Pro tier limits and progressive disclosure.
 * Basic: core communication tools with usage caps
 * Pro: full platform with unlimited access
 */
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

export type Tier = "basic" | "pro";

/** Feature visibility / availability in the UI */
export type FeatureAccess = "enabled" | "limited" | "locked";

export interface UsageLimit {
  /** Max units allowed (null = unlimited) */
  max: number | null;
  /** Human-readable label for the limit, e.g. "accounts" */
  unit: string;
}

export interface FeatureFlag {
  /** Unique identifier (kebab-case, matches settings tab id where applicable) */
  id: string;
  /** User-facing name (i18n key, e.g. "settings.features.general.name") */
  name: string;
  /** Short description of what the feature does (i18n key) */
  description: string;
  /** Icon name from lucide-react (for UI) */
  icon: string;
  /** Which tier this belongs to */
  tier: Tier;
  /** Usage limit applied to Basic tier */
  basicLimit: UsageLimit | null;
  /** Usage limit applied to Pro tier */
  proLimit: UsageLimit | null;
  /** Settings tab group this belongs to */
  group: string;
  /** Whether this is a core feature (visible in simple mode) */
  isCore: boolean;
}

/**
 * Complete catalog of all features with tier assignments and limits.
 *
 * Orchestration principle:
 * - Basic = essential communication: contacts, compose, notifications, snooze, shortcuts
 * - Pro = power platform: AI, campaigns, workflows, deliverability suite, security, compliance
 * - Limits use progressive disclosure — Basic users see features but with upgrade prompts
 */
export const FEATURE_FLAGS: FeatureFlag[] = [
  // ─── Getting Started ───
  {
    id: "general",
    name: "settings.features.general.name",
    description: "settings.features.general.desc",
    icon: "Settings",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.gettingStarted",
    isCore: true,
  },
  {
    id: "people",
    name: "settings.features.people.name",
    description: "settings.features.people.desc",
    icon: "Users",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.gettingStarted",
    isCore: true,
  },

  // ─── Daily Workflow ───
  {
    id: "composing",
    name: "settings.features.composing.name",
    description: "settings.features.composing.desc",
    icon: "PenLine",
    tier: "basic",
    basicLimit: { max: 5, unit: "quick replies" },
    proLimit: null,
    group: "settings.featureGroups.dailyWorkflow",
    isCore: true,
  },
  {
    id: "templates",
    name: "settings.features.templates.name",
    description: "settings.features.templates.desc",
    icon: "FileText",
    tier: "basic",
    basicLimit: { max: 10, unit: "templates" },
    proLimit: null,
    group: "settings.featureGroups.dailyWorkflow",
    isCore: false,
  },
  {
    id: "notifications",
    name: "settings.features.notifications.name",
    description: "settings.features.notifications.desc",
    icon: "Bell",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.dailyWorkflow",
    isCore: true,
  },
  {
    id: "snooze",
    name: "settings.features.snooze.name",
    description: "settings.features.snooze.desc",
    icon: "Clock",
    tier: "basic",
    basicLimit: { max: 3, unit: "presets" },
    proLimit: null,
    group: "settings.featureGroups.dailyWorkflow",
    isCore: true,
  },
  {
    id: "shortcuts",
    name: "settings.features.shortcuts.name",
    description: "settings.features.shortcuts.desc",
    icon: "Keyboard",
    tier: "basic",
    basicLimit: { max: 10, unit: "custom shortcuts" },
    proLimit: null,
    group: "settings.featureGroups.dailyWorkflow",
    isCore: true,
  },

  // ─── AI & Automation ───
  {
    id: "ai",
    name: "settings.features.ai.name",
    description: "settings.features.ai.desc",
    icon: "Sparkles",
    tier: "pro",
    basicLimit: { max: 0, unit: "AI features" },
    proLimit: null,
    group: "settings.featureGroups.aiAutomation",
    isCore: false,
  },
  {
    id: "mail-rules",
    name: "settings.features.mailRules.name",
    description: "settings.features.mailRules.desc",
    icon: "Filter",
    tier: "basic",
    basicLimit: { max: 5, unit: "rules" },
    proLimit: null,
    group: "settings.featureGroups.aiAutomation",
    isCore: false,
  },
  {
    id: "workflows",
    name: "settings.features.workflows.name",
    description: "settings.features.workflows.desc",
    icon: "GitBranch",
    tier: "pro",
    basicLimit: { max: 0, unit: "workflows" },
    proLimit: null,
    group: "settings.featureGroups.aiAutomation",
    isCore: false,
  },
  {
    id: "campaigns",
    name: "settings.features.campaigns.name",
    description: "settings.features.campaigns.desc",
    icon: "BarChart3",
    tier: "pro",
    basicLimit: { max: 0, unit: "campaigns" },
    proLimit: null,
    group: "settings.featureGroups.aiAutomation",
    isCore: false,
  },

  // ─── Security & Data ───
  {
    id: "pgp",
    name: "settings.features.pgp.name",
    description: "settings.features.pgp.desc",
    icon: "Lock",
    tier: "pro",
    basicLimit: { max: 0, unit: "PGP keys" },
    proLimit: null,
    group: "settings.featureGroups.securityData",
    isCore: false,
  },
  {
    id: "compliance",
    name: "settings.features.compliance.name",
    description: "settings.features.compliance.desc",
    icon: "ShieldCheck",
    tier: "pro",
    basicLimit: { max: 0, unit: "compliance profiles" },
    proLimit: null,
    group: "settings.featureGroups.securityData",
    isCore: false,
  },
  {
    id: "backup",
    name: "settings.features.backup.name",
    description: "settings.features.backup.desc",
    icon: "HardDrive",
    tier: "pro",
    basicLimit: { max: 0, unit: "backups" },
    proLimit: null,
    group: "settings.featureGroups.securityData",
    isCore: false,
  },
  {
    id: "pairing",
    name: "settings.features.pairing.name",
    description: "settings.features.pairing.desc",
    icon: "Smartphone",
    tier: "pro",
    basicLimit: { max: 0, unit: "paired devices" },
    proLimit: null,
    group: "settings.featureGroups.securityData",
    isCore: false,
  },

  // ─── Monitoring ───
  {
    id: "queue",
    name: "settings.features.queue.name",
    description: "settings.features.queue.desc",
    icon: "Activity",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.monitoring",
    isCore: false,
  },
  {
    id: "deliverability-dashboard",
    name: "settings.features.deliverabilityDashboard.name",
    description: "settings.features.deliverabilityDashboard.desc",
    icon: "BarChart3",
    tier: "pro",
    basicLimit: { max: 0, unit: "dashboard views" },
    proLimit: null,
    group: "settings.featureGroups.monitoring",
    isCore: false,
  },
  {
    id: "presend",
    name: "settings.features.presend.name",
    description: "settings.features.presend.desc",
    icon: "ClipboardCheck",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.monitoring",
    isCore: false,
  },
  {
    id: "content",
    name: "settings.features.content.name",
    description: "settings.features.content.desc",
    icon: "FileCheck",
    tier: "pro",
    basicLimit: { max: 0, unit: "analyses" },
    proLimit: null,
    group: "settings.featureGroups.monitoring",
    isCore: false,
  },

  // ─── Deliverability Tools ───
  {
    id: "dns",
    name: "settings.features.dns.name",
    description: "settings.features.dns.desc",
    icon: "Globe",
    tier: "pro",
    basicLimit: { max: 0, unit: "DNS checks" },
    proLimit: null,
    group: "settings.featureGroups.deliverabilityTools",
    isCore: false,
  },
  {
    id: "blacklist",
    name: "settings.features.blacklist.name",
    description: "settings.features.blacklist.desc",
    icon: "Ban",
    tier: "pro",
    basicLimit: { max: 0, unit: "checks" },
    proLimit: null,
    group: "settings.featureGroups.deliverabilityTools",
    isCore: false,
  },
  {
    id: "bounce",
    name: "settings.features.bounce.name",
    description: "settings.features.bounce.desc",
    icon: "MailX",
    tier: "pro",
    basicLimit: { max: 0, unit: "bounce rules" },
    proLimit: null,
    group: "settings.featureGroups.deliverabilityTools",
    isCore: false,
  },
  {
    id: "warming",
    name: "settings.features.warming.name",
    description: "settings.features.warming.desc",
    icon: "Thermometer",
    tier: "pro",
    basicLimit: { max: 0, unit: "warming schedules" },
    proLimit: null,
    group: "settings.featureGroups.deliverabilityTools",
    isCore: false,
  },

  // ─── Offline & Sync ───
  {
    id: "offline-availability",
    name: "settings.features.offlineAvailability.name",
    description: "settings.features.offlineAvailability.desc",
    icon: "WifiOff",
    tier: "pro",
    basicLimit: { max: 0, unit: "offline items" },
    proLimit: null,
    group: "settings.featureGroups.offlineSync",
    isCore: false,
  },

  // ─── Intelligence & Insights ───
  {
    id: "rag",
    name: "settings.features.rag.name",
    description: "settings.features.rag.desc",
    icon: "BrainCircuit",
    tier: "pro",
    basicLimit: { max: 0, unit: "RAG indexes" },
    proLimit: null,
    group: "settings.featureGroups.aiAutomation",
    isCore: false,
  },
  {
    id: "business-profile",
    name: "settings.features.businessProfile.name",
    description: "settings.features.businessProfile.desc",
    icon: "Building2",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.gettingStarted",
    isCore: false,
  },
  {
    id: "dashboard",
    name: "settings.features.dashboard.name",
    description: "settings.features.dashboard.desc",
    icon: "Gauge",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "settings.featureGroups.monitoring",
    isCore: true,
  },
  {
    id: "invoicing",
    name: "settings.features.invoicing.name",
    description: "settings.features.invoicing.desc",
    icon: "FileSpreadsheet",
    tier: "pro",
    basicLimit: { max: 0, unit: "invoices" },
    proLimit: null,
    group: "settings.featureGroups.business",
    isCore: false,
  },
];

/** Lookup a feature flag by id */
export function getFeatureFlag(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id);
}

/** Get all features for a given tier */
export function getFeaturesByTier(tier: Tier): FeatureFlag[] {
  return FEATURE_FLAGS.filter((f) => f.tier === tier);
}

/** Get core features (visible in simple mode) */
export function getCoreFeatures(): FeatureFlag[] {
  return FEATURE_FLAGS.filter((f) => f.isCore);
}

/** Get the access level for a feature based on current tier and usage */
export function getFeatureAccess(
  featureId: string,
  currentTier: Tier,
  currentUsage: number,
): FeatureAccess {
  const feature = getFeatureFlag(featureId);
  if (!feature) return "enabled";

  // Pro tier — all features fully enabled
  if (currentTier === "pro") return "enabled";

  // Basic tier — check limits
  const limit = feature.basicLimit;
  if (!limit || limit.max === null) return "enabled";
  if (limit.max === 0) return "locked";
  if (currentUsage >= limit.max) return "locked";
  return "limited";
}

// ─── Dev Pro Mode ──────────────────────────────────────────────────────────

const DEV_PRO_STORAGE_KEY = "smemaster.devProMode";

/** Check if Developer Pro Mode is enabled (reads from tauri-plugin-store) */
export function isDevProMode(): boolean {
  // Sync read: tauriStoreStorage is async, but we keep this function
  // sync by mirroring the latest value in module scope. The mirror is
  // updated by `setDevProMode` and by the initial bootstrap call below.
  if (typeof window === "undefined") return false;
  // localStorage path: sync read is fine.
  if (!("__TAURI_INTERNALS__" in window) && !("__TAURI__" in window)) {
    try {
      return window.localStorage.getItem(DEV_PRO_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }
  // Tauri: use the in-memory mirror that the async bootstrap populates.
  return devProMirror;
}

let devProMirror = false;
// Async bootstrap: prime the mirror from the durable store on first import.
if (typeof window !== "undefined") {
  const isTauri =
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  if (isTauri) {
    void (async () => {
      try {
        const raw = await tauriStoreStorage.getItem(DEV_PRO_STORAGE_KEY);
        devProMirror = raw === '"true"';
      } catch {
        devProMirror = false;
      }
    })();
  }
}

/** Enable or disable Developer Pro Mode (persists to tauri-plugin-store) */
export function setDevProMode(enabled: boolean): void {
  devProMirror = enabled;
  void tauriStoreStorage.setItem(
    DEV_PRO_STORAGE_KEY,
    enabled ? JSON.stringify(true) : JSON.stringify(false),
  );
}

/**
 * Get the access level for a feature, respecting Dev Pro Mode.
 * When Dev Pro Mode is active, ALL features are returned as "enabled"
 * regardless of tier or usage limits.
 */
export function getFeatureAccessWithDevPro(
  featureId: string,
  currentTier: Tier,
  currentUsage: number,
): FeatureAccess {
  if (isDevProMode()) return "enabled";
  return getFeatureAccess(featureId, currentTier, currentUsage);
}
