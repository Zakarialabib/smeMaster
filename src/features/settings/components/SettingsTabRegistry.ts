// ── Single Source of Truth for Settings Tab Definitions ─────────────────────
// Refactored: consolidated from 28 tabs / 10 groups → 18 tabs / 8 groups.
// Deliverability sub-tools (DNS, Blacklist, Bounce, Warming) merged into
// the Deliverability Dashboard as sub-sections. Snooze merged into Notifications.
// Data Wipe merged into General. Feature Flags → Developer sub-section.
// Content Quality → Composing sub-section.
//
// i18n: all user-facing strings below are stored as translation keys and
// resolved via t() at the call site (see SettingsSidebar / SettingsPage /
// HelpCenterSidebar). No English literals are rendered directly.

import type { LucideIcon } from "lucide-react";
import {
  Settings, UserCircle, PenLine, Bell, Keyboard,
  Sparkles, Filter, Lock, ShieldCheck, HardDrive, Smartphone,
  BarChart3, ClipboardCheck, Info, HelpCircle, Calendar, Code2,
  MonitorCheck, Laptop, Activity, Trash2, Cpu,Building2, Flag,
} from "lucide-react";
import {
  GeneralTab, ComposingTab, AccountsTab, ShortcutsTab,
  AboutTab, PairingSettings, BackupTab, AiTab, ComplianceTab,
  MailRulesTab, NotificationsTab, PgpTab,
  PresendTab, CalendarTab, DeveloperTab,
  LicenseTab, DeliverabilityTab, FeatureFlagsTab,
  QueueTab, AccountCleaningTab, HardwareTab,BusinessProfileTab,
} from "./tabs";

// ── Types ──────────────────────────────────────────────────────────────────

export type SettingsTabId =
  | "general" | "composing" | "accounts"
  | "shortcuts" | "about" | "pairing" | "backup"
  | "deliverability-dashboard" | "help-center" | "ai" | "notifications"
  | "compliance" | "pgp" | "mail-rules" | "presend"
  | "calendar" | "developer"
  | "license" | "feature-flags"
  | "queue" | "account-cleaning" | "hardware"
  | "business-profile";

export type SettingsPlatform = "all" | "desktop" | "mobile";

export interface SettingsTabItem {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
  platform?: SettingsPlatform; // default: "all"
  /** i18n key for the short subtitle shown in grid overview */
  subtitle?: string;
}

export interface SettingsGroup {
  /** i18n key for the group label */
  label: string;
  icon?: LucideIcon;
  description?: string;
  tabs: SettingsTabItem[];
}

// ── Tab Groups (Condensed from 28 tabs / 10 groups → 18 tabs / 8 groups) ──
// Group labels and tab subtitles are i18n keys resolved via t().

export const tabGroups: SettingsGroup[] = [
  {
    label: "settings.groups.workspace.label",
    icon: Laptop,
    description: "Appearance, composition, shortcuts, and calendar",
    tabs: [
      {
        id: "general",
        label: "General",
        icon: Settings,
        subtitle: "settings.tabSubtitles.general",
      },
      {
        id: "composing",
        label: "Composing",
        icon: PenLine,
        subtitle: "settings.tabSubtitles.composing",
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: Calendar,
        subtitle: "settings.tabSubtitles.calendar",
      },
      {
        id: "shortcuts",
        label: "Shortcuts",
        icon: Keyboard,
        subtitle: "settings.tabSubtitles.shortcuts",
      },
    ],
  },
  {
    label: "settings.groups.accountsSync.label",
    icon: MonitorCheck,
    description: "Email accounts, device pairing, and data management",
    tabs: [
      {
        id: "accounts",
        label: "Accounts",
        icon: UserCircle,
        subtitle: "settings.tabSubtitles.accounts",
      },
      {
        id: "account-cleaning",
        label: "Account Cleaning",
        icon: Trash2,
        subtitle: "settings.tabSubtitles.accountCleaning",
        platform: "desktop",
      },
      {
        id: "pairing",
        label: "Pairing",
        icon: Smartphone,
        subtitle: "settings.tabSubtitles.pairing",
      },
      {
        id: "backup",
        label: "Backup",
        icon: HardDrive,
        subtitle: "settings.tabSubtitles.backup",
        platform: "desktop",
      },
    ],
  },
  {
    label: "settings.groups.notifications.label",
    icon: Bell,
    description: "Alerts, VIPs, category filters, and snooze presets",
    tabs: [
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        subtitle: "settings.tabSubtitles.notifications",
      },
    ],
  },
  {
    label: "settings.groups.aiAutomation.label",
    icon: Sparkles,
    description: "AI providers, mail rules, and workflow automation",
    tabs: [
      {
        id: "ai",
        label: "AI",
        icon: Sparkles,
        subtitle: "settings.tabSubtitles.ai",
      },
      {
        id: "mail-rules",
        label: "Mail Rules",
        icon: Filter,
        subtitle: "settings.tabSubtitles.mailRules",
      },
    ],
  },
  {
    label: "settings.groups.deliverability.label",
    icon: BarChart3,
    description: "DNS checks, blacklist monitoring, bounce handling, warming",
    tabs: [
      {
        id: "deliverability-dashboard",
        label: "Deliverability",
        icon: BarChart3,
        subtitle: "settings.tabSubtitles.deliverabilityDashboard",
        platform: "desktop",
      },
      {
        id: "presend",
        label: "Pre-send",
        icon: ClipboardCheck,
        subtitle: "settings.tabSubtitles.presend",
        platform: "desktop",
      },
    ],
  },
  {
    label: "settings.groups.securityCompliance.label",
    icon: ShieldCheck,
    description: "Encryption, compliance profiles, and legal safeguards",
    tabs: [
      {
        id: "pgp",
        label: "PGP Encryption",
        icon: Lock,
        subtitle: "settings.tabSubtitles.pgp",
        platform: "desktop",
      },
      {
        id: "compliance",
        label: "Compliance",
        icon: ShieldCheck,
        subtitle: "settings.tabSubtitles.compliance",
        platform: "desktop",
      },
      {
        id: "business-profile",
        label: "Business Profile",
        icon: Building2,
        subtitle: "settings.tabSubtitles.businessProfile",
      },
    ],
  },
  {
    label: "settings.groups.developer.label",
    icon: Code2,
    description: "System info, logs, updates, demo data, and feature flags",
    tabs: [
      {
        id: "developer",
        label: "Developer",
        icon: Code2,
        subtitle: "settings.tabSubtitles.developer",
        platform: "desktop",
      },
      {
        id: "hardware",
        label: "Hardware",
        icon: Cpu,
        subtitle: "settings.tabSubtitles.hardware",
        platform: "desktop",
      },
      {
        id: "queue",
        label: "Queue",
        icon: Activity,
        subtitle: "settings.tabSubtitles.queue",
        platform: "desktop",
      },
      {
        id: "feature-flags",
        label: "Feature Flags",
        icon: Flag,
        subtitle: "settings.tabSubtitles.featureFlags",
        platform: "desktop",
      },
    ],
  },
  {
    label: "settings.groups.aboutHelp.label",
    icon: HelpCircle,
    description: "Version info, license, and documentation",
    tabs: [
      {
        id: "about",
        label: "About & License",
        icon: Info,
        subtitle: "settings.tabSubtitles.about",
      },
    ],
  },
];

// ── Tab ID → Section Component ─────────────────────────────────────────────

export const sectionComponents: Record<string, React.ComponentType> = {
  general: GeneralTab,
  composing: ComposingTab,
  accounts: AccountsTab,
  pairing: PairingSettings,
  backup: BackupTab,
  shortcuts: ShortcutsTab,
  about: AboutTab,
  ai: AiTab,
  notifications: NotificationsTab,
  compliance: ComplianceTab,
  pgp: PgpTab,
  "mail-rules": MailRulesTab,
  "deliverability-dashboard": DeliverabilityTab,
  presend: PresendTab,
  calendar: CalendarTab,
  developer: DeveloperTab,
  license: LicenseTab,
  "feature-flags": FeatureFlagsTab,
  queue: QueueTab,
  "account-cleaning": AccountCleaningTab,
  hardware: HardwareTab,
  "business-profile": BusinessProfileTab,
};

// ── Search Keywords ────────────────────────────────────────────────────────

export const TAB_KEYWORDS: Record<string, string[]> = {
  general: ["theme", "dark", "light", "language", "appearance", "locale", "timezone", "data", "wipe", "cache", "storage", "privacy", "security"],
  shortcuts: ["keyboard", "keys", "hotkeys", "shortcut", "bindings", "⌘", "ctrl", "command"],
  about: ["version", "license", "updates", "credits", "onboarding"],
  accounts: ["email", "imap", "smtp", "gmail", "oauth", "caldav", "signature", "aliases", "sync"],
  pairing: ["device", "sync", "qr", "pair", "mobile", "android"],
  composing: ["editor", "signature", "quick reply", "template", "snooze", "follow-up", "pre-send", "checklist", "content", "quality", "readability", "tone"],
  "deliverability-dashboard": ["dns", "spf", "dkim", "dmarc", "blacklist", "warm", "bounce", "domain health", "reputation"],
  backup: ["backup", "restore", "export", "import", "database", "save", "archive"],
  ai: ["artificial intelligence", "claude", "openai", "gemini", "ollama", "copilot", "smart reply", "draft", "categorize", "summarize", "writing style"],
  notifications: ["bell", "alert", "vip", "category", "smart notification", "push", "desktop", "snooze", "delay", "remind", "postpone"],
  compliance: ["gdpr", "can-spam", "disclaimer", "footer", "legal", "regulation", "unsubscribe"],
  pgp: ["encryption", "public key", "private key", "end-to-end", "secure", "crypto", "pgp key"],
  "mail-rules": ["label", "filter", "smart label", "smart folder", "quick step", "rule", "auto-organize", "automation", "trigger", "workflow"],
  presend: ["checklist", "pre-flight", "verify", "attachment check", "spell check"],
  calendar: ["calendar", "caldav", "events", "scheduling", "sync", "appointment"],
  developer: ["dev", "debug", "seed", "demo", "version", "update", "tools", "console", "devtools", "feature flags", "health", "logs"],
  queue: ["sync", "pending", "operation", "queue", "retry", "inspector", "fail", "background", "outbox", "send"],
  "account-cleaning": ["clean", "cleanup", "retention", "purge", "archive", "delete", "maintenance", "rule", "schedule", "storage", "old email"],
  license: ["license", "key", "activation", "tier", "trial", "pro", "basic", "upgrade", "subscription", "premium"],
  "business-profile": ["company", "business", "ice", "tax", "rc", "cnss", "legal", "morocco", "dgi"],
    "feature-flags": ["feature", "flag", "flags", "tier", "pro", "basic", "override", "beta", "experimental", "rag", "progressive", "disclosure"],
};

// ── Tab Label (i18n-aware) ─────────────────────────────────────────────────

export function getTabLabel(id: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    general: t("settings.tabs.general"),
    shortcuts: t("settings.tabs.shortcuts"),
    about: t("settings.tabs.about"),
    accounts: t("settings.tabs.accounts"),
    composing: t("settings.tabs.composing"),
    "deliverability-dashboard": t("settings.tabs.deliverabilityDashboard"),
    pairing: t("settings.tabs.pairing"),
    backup: t("settings.tabs.backup"),
    "help-center": t("settings.tabs.helpCenter"),
    ai: t("search.ai"),
    notifications: t("settings.tabs.notifications"),
    compliance: t("settings.tabs.compliance"),
    pgp: t("settings.tabs.pgp"),
    "mail-rules": t("settings.tabs.mailRules"),
    presend: t("settings.tabs.presend"),
    calendar: t("settings.tabs.calendar"),
    developer: t("settings.tabs.developer"),
    queue: t("settings.tabs.queue"),
    "account-cleaning": t("settings.tabs.accountCleaning"),
    license: t("settings.tabs.license"),
    hardware: t("settings.tabs.hardware"),
    "business-profile": t("settings.tabs.businessProfile"),
    "feature-flags": t("settings.tabs.featureFlags"),
  };
  return labels[id] ?? id;
}

// ── Section Subtitles (i18n keys) ──────────────────────────────────────────

export function getSectionSubtitle(id: string): string | undefined {
  const subtitles: Record<string, string> = {
    composing: "settings.sectionSubtitles.composing",
    general: "settings.sectionSubtitles.general",
    accounts: "settings.sectionSubtitles.accounts",
    shortcuts: "settings.sectionSubtitles.shortcuts",
    about: "settings.sectionSubtitles.about",
    pairing: "settings.sectionSubtitles.pairing",
    backup: "settings.sectionSubtitles.backup",
    "deliverability-dashboard": "settings.sectionSubtitles.deliverabilityDashboard",
    ai: "settings.sectionSubtitles.ai",
    notifications: "settings.sectionSubtitles.notifications",
    compliance: "settings.sectionSubtitles.compliance",
    pgp: "settings.sectionSubtitles.pgp",
    "mail-rules": "settings.sectionSubtitles.mailRules",
    presend: "settings.sectionSubtitles.presend",
    calendar: "settings.sectionSubtitles.calendar",
    developer: "settings.sectionSubtitles.developer",
    queue: "settings.sectionSubtitles.queue",
    "account-cleaning": "settings.sectionSubtitles.accountCleaning",
    license: "settings.sectionSubtitles.license",
    "feature-flags": "settings.sectionSubtitles.featureFlags",
  };
  return subtitles[id];
}

// ── Education Content (Why/How/When) ───────────────────────────────────────
// Maps each settings tab to its consolidated education items shown in the
// HelpCenterSidebar "Quick Help" section. Replaces inline HelpCard usage.
// Each `text` is an i18n key resolved via t() in HelpCenterSidebar.

export interface EducationItem {
  type: "why" | "how" | "when";
  text: string; // i18n key, e.g. "settings.education.general.why"
}

export const EDUCATION_CONTENT: Record<string, EducationItem[]> = {
  general: [
    { type: "why", text: "settings.education.general.why" },
    { type: "how", text: "settings.education.general.how" },
    { type: "when", text: "settings.education.general.when" },
  ],
  composing: [
    { type: "why", text: "settings.education.composing.why" },
    { type: "how", text: "settings.education.composing.how" },
    { type: "when", text: "settings.education.composing.when" },
  ],
  accounts: [
    { type: "why", text: "settings.education.accounts.why" },
    { type: "how", text: "settings.education.accounts.how" },
    { type: "when", text: "settings.education.accounts.when" },
  ],
  notifications: [
    { type: "why", text: "settings.education.notifications.why" },
    { type: "how", text: "settings.education.notifications.how" },
    { type: "when", text: "settings.education.notifications.when" },
  ],
  shortcuts: [
    { type: "why", text: "settings.education.shortcuts.why" },
    { type: "how", text: "settings.education.shortcuts.how" },
    { type: "when", text: "settings.education.shortcuts.when" },
  ],
  calendar: [
    { type: "why", text: "settings.education.calendar.why" },
    { type: "how", text: "settings.education.calendar.how" },
    { type: "when", text: "settings.education.calendar.when" },
  ],
  pairing: [
    { type: "why", text: "settings.education.pairing.why" },
    { type: "how", text: "settings.education.pairing.how" },
    { type: "when", text: "settings.education.pairing.when" },
  ],
  backup: [
    { type: "why", text: "settings.education.backup.why" },
    { type: "how", text: "settings.education.backup.how" },
    { type: "when", text: "settings.education.backup.when" },
  ],
  "deliverability-dashboard": [
    { type: "why", text: "settings.education.deliverabilityDashboard.why" },
    { type: "how", text: "settings.education.deliverabilityDashboard.how" },
    { type: "when", text: "settings.education.deliverabilityDashboard.when" },
  ],
  ai: [
    { type: "why", text: "settings.education.ai.why" },
    { type: "how", text: "settings.education.ai.how" },
    { type: "when", text: "settings.education.ai.when" },
  ],
  "mail-rules": [
    { type: "why", text: "settings.education.mailRules.why" },
    { type: "how", text: "settings.education.mailRules.how" },
    { type: "when", text: "settings.education.mailRules.when" },
  ],
  compliance: [
    { type: "why", text: "settings.education.compliance.why" },
    { type: "how", text: "settings.education.compliance.how" },
    { type: "when", text: "settings.education.compliance.when" },
  ],
  pgp: [
    { type: "why", text: "settings.education.pgp.why" },
    { type: "how", text: "settings.education.pgp.how" },
    { type: "when", text: "settings.education.pgp.when" },
  ],
  presend: [
    { type: "why", text: "settings.education.presend.why" },
    { type: "how", text: "settings.education.presend.how" },
    { type: "when", text: "settings.education.presend.when" },
  ],
  developer: [
    { type: "why", text: "settings.education.developer.why" },
    { type: "how", text: "settings.education.developer.how" },
    { type: "when", text: "settings.education.developer.when" },
  ],
  queue: [
    { type: "why", text: "settings.education.queue.why" },
    { type: "how", text: "settings.education.queue.how" },
    { type: "when", text: "settings.education.queue.when" },
  ],
  "account-cleaning": [
    { type: "why", text: "settings.education.accountCleaning.why" },
    { type: "how", text: "settings.education.accountCleaning.how" },
    { type: "when", text: "settings.education.accountCleaning.when" },
  ],
  about: [
    { type: "why", text: "settings.education.about.why" },
    { type: "how", text: "settings.education.about.how" },
    { type: "when", text: "settings.education.about.when" },
  ],
};

// ── Help Content Registry ──────────────────────────────────────────────────
// Maps each tab to relevant help articles shown in the HelpCenterSidebar.
// Generated contextual help keys link to constants/contextualHelp.ts entries.

export const TAB_HELP_KEYS: Record<string, string[]> = {
  general: ["smart-folders", "split-inbox", "bundle-rules"],
  composing: ["composer-templates", "composer-compliance", "composer-schedule"],
  accounts: ["pgp-encryption", "calendar-sync"],
  "deliverability-dashboard": ["deliverability-dns", "deliverability-warming"],
  notifications: ["smart-notifications"],
  "mail-rules": ["smart-folders", "workflow-automation"],
  pgp: ["pgp-encryption"],
  backups: ["backup-restore"],
  ai: ["ai-features"],
  queue: ["sync-status"],
  "account-cleaning": ["backup-restore"],
};
