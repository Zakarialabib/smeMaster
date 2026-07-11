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
  /** User-facing name */
  name: string;
  /** Short description of what the feature does */
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
    name: "General",
    description: "Theme, layout, language, privacy, and appearance settings",
    icon: "Settings",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Getting Started",
    isCore: true,
  },
  {
    id: "people",
    name: "People",
    description: "Contact management, groups, tags, segments, CSV import",
    icon: "Users",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Getting Started",
    isCore: true,
  },

  // ─── Daily Workflow ───
  {
    id: "composing",
    name: "Composing",
    description: "Rich text editor, signatures, quick replies, pre-send checklist",
    icon: "PenLine",
    tier: "basic",
    basicLimit: { max: 5, unit: "quick replies" },
    proLimit: null,
    group: "Daily Workflow",
    isCore: true,
  },
  {
    id: "templates",
    name: "Templates",
    description: "Email templates with variables, categories, and conditional blocks",
    icon: "FileText",
    tier: "basic",
    basicLimit: { max: 10, unit: "templates" },
    proLimit: null,
    group: "Daily Workflow",
    isCore: false,
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Desktop and push notifications for incoming mail",
    icon: "Bell",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Daily Workflow",
    isCore: true,
  },
  {
    id: "snooze",
    name: "Snooze",
    description: "Snooze presets for delaying email visibility until later",
    icon: "Clock",
    tier: "basic",
    basicLimit: { max: 3, unit: "presets" },
    proLimit: null,
    group: "Daily Workflow",
    isCore: true,
  },
  {
    id: "shortcuts",
    name: "Shortcuts",
    description: "Customizable keyboard shortcuts with two-key sequences",
    icon: "Keyboard",
    tier: "basic",
    basicLimit: { max: 10, unit: "custom shortcuts" },
    proLimit: null,
    group: "Daily Workflow",
    isCore: true,
  },

  // ─── AI & Automation ───
  {
    id: "ai",
    name: "AI",
    description: "Claude/OpenAI/Gemini integration, smart replies, auto-categorization, thread summaries",
    icon: "Sparkles",
    tier: "pro",
    basicLimit: { max: 0, unit: "AI features" },
    proLimit: null,
    group: "AI & Automation",
    isCore: false,
  },
  {
    id: "mail-rules",
    name: "Mail Rules",
    description: "Labels, filters, smart folders, quick steps for auto-organizing mail",
    icon: "Filter",
    tier: "basic",
    basicLimit: { max: 5, unit: "rules" },
    proLimit: null,
    group: "AI & Automation",
    isCore: false,
  },
  {
    id: "workflows",
    name: "Workflows",
    description: "Trigger/action automation engine: auto-reply, follow-ups, task creation, forwarding",
    icon: "GitBranch",
    tier: "pro",
    basicLimit: { max: 0, unit: "workflows" },
    proLimit: null,
    group: "AI & Automation",
    isCore: false,
  },
  {
    id: "campaigns",
    name: "Campaigns",
    description: "Bulk email campaigns, mail merge, A/B testing, and campaign analytics",
    icon: "BarChart3",
    tier: "pro",
    basicLimit: { max: 0, unit: "campaigns" },
    proLimit: null,
    group: "AI & Automation",
    isCore: false,
  },

  // ─── Security & Data ───
  {
    id: "pgp",
    name: "PGP Encryption",
    description: "End-to-end encryption with Sequoia OpenPGP key management",
    icon: "Lock",
    tier: "pro",
    basicLimit: { max: 0, unit: "PGP keys" },
    proLimit: null,
    group: "Security & Data",
    isCore: false,
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "GDPR, CAN-SPAM, LGPD profiles with rule engine and AI enhancer",
    icon: "ShieldCheck",
    tier: "pro",
    basicLimit: { max: 0, unit: "compliance profiles" },
    proLimit: null,
    group: "Security & Data",
    isCore: false,
  },
  {
    id: "backup",
    name: "Backup",
    description: "Full data backup, restore, export, and archive management",
    icon: "HardDrive",
    tier: "pro",
    basicLimit: { max: 0, unit: "backups" },
    proLimit: null,
    group: "Security & Data",
    isCore: false,
  },
  {
    id: "pairing",
    name: "Pairing",
    description: "QR-based secure pairing between Desktop and Mobile devices",
    icon: "Smartphone",
    tier: "pro",
    basicLimit: { max: 0, unit: "paired devices" },
    proLimit: null,
    group: "Security & Data",
    isCore: false,
  },

  // ─── Monitoring ───
  {
    id: "queue",
    name: "Queue",
    description: "Offline queue, pending operations, send scheduling, and retry management",
    icon: "Activity",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Monitoring",
    isCore: false,
  },
  {
    id: "deliverability-dashboard",
    name: "Deliverability",
    description: "Domain health scores, provider compatibility, and remediation wizard",
    icon: "BarChart3",
    tier: "pro",
    basicLimit: { max: 0, unit: "dashboard views" },
    proLimit: null,
    group: "Monitoring",
    isCore: false,
  },
  {
    id: "presend",
    name: "Pre-send",
    description: "Pre-flight checklist, attachment validation, and send verification",
    icon: "ClipboardCheck",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Monitoring",
    isCore: false,
  },
  {
    id: "content",
    name: "Quality",
    description: "Content quality analysis, readability scoring, and tone suggestions",
    icon: "FileCheck",
    tier: "pro",
    basicLimit: { max: 0, unit: "analyses" },
    proLimit: null,
    group: "Monitoring",
    isCore: false,
  },

  // ─── Deliverability Tools ───
  {
    id: "dns",
    name: "DNS",
    description: "SPF, DKIM, DMARC, MX, and DNS record verification",
    icon: "Globe",
    tier: "pro",
    basicLimit: { max: 0, unit: "DNS checks" },
    proLimit: null,
    group: "Deliverability Tools",
    isCore: false,
  },
  {
    id: "blacklist",
    name: "Blacklist",
    description: "Blacklist monitoring, IP reputation, and DNSBL queries",
    icon: "Ban",
    tier: "pro",
    basicLimit: { max: 0, unit: "checks" },
    proLimit: null,
    group: "Deliverability Tools",
    isCore: false,
  },
  {
    id: "bounce",
    name: "Bounces",
    description: "Bounce classification, suppression list, and undelivered email tracking",
    icon: "MailX",
    tier: "pro",
    basicLimit: { max: 0, unit: "bounce rules" },
    proLimit: null,
    group: "Deliverability Tools",
    isCore: false,
  },
  {
    id: "warming",
    name: "Warming",
    description: "Sender reputation warming, volume ramp-up, and IP warm-up schedules",
    icon: "Thermometer",
    tier: "pro",
    basicLimit: { max: 0, unit: "warming schedules" },
    proLimit: null,
    group: "Deliverability Tools",
    isCore: false,
  },

  // ─── Offline & Sync ───
  {
    id: "offline-availability",
    name: "Offline Availability",
    description: "Mark accounts, folders, and contacts as available offline — compose, search, and act without network",
    icon: "WifiOff",
    tier: "pro",
    basicLimit: { max: 0, unit: "offline items" },
    proLimit: null,
    group: "Offline & Sync",
    isCore: false,
  },

  // ─── Intelligence & Insights ───
  {
    id: "rag",
    name: "Local RAG",
    description: "On-device retrieval-augmented generation for private, context-aware AI answers over your mail and documents",
    icon: "BrainCircuit",
    tier: "pro",
    basicLimit: { max: 0, unit: "RAG indexes" },
    proLimit: null,
    group: "AI & Automation",
    isCore: false,
  },
  {
    id: "business-profile",
    name: "Business Profile",
    description: "Company legal, tax, and compliance identity (ICE, CNSS, RC) used across documents and invoicing",
    icon: "Building2",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Getting Started",
    isCore: false,
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Business health, KPIs, and analytics across mail, tasks, and campaigns",
    icon: "Gauge",
    tier: "basic",
    basicLimit: null,
    proLimit: null,
    group: "Monitoring",
    isCore: true,
  },
  {
    id: "invoicing",
    name: "Invoicing",
    description: "Create, send, and track professional invoices and estimates with PDF export",
    icon: "FileSpreadsheet",
    tier: "pro",
    basicLimit: { max: 0, unit: "invoices" },
    proLimit: null,
    group: "Business",
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
