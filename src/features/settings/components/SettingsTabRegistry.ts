// ── Single Source of Truth for Settings Tab Definitions ─────────────────────
// Refactored: consolidated from 28 tabs / 10 groups → 18 tabs / 8 groups.
// Deliverability sub-tools (DNS, Blacklist, Bounce, Warming) merged into
// the Deliverability Dashboard as sub-sections. Snooze merged into Notifications.
// Data Wipe merged into General. Feature Flags → Developer sub-section.
// Content Quality → Composing sub-section.

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
  /** Short subtitle shown in grid overview */
  subtitle?: string;
}

export interface SettingsGroup {
  label: string;
  icon?: LucideIcon;
  description?: string;
  tabs: SettingsTabItem[];
}

// ── Tab Groups (Condensed from 28 tabs / 10 groups → 18 tabs / 8 groups) ──

export const tabGroups: SettingsGroup[] = [
  {
    label: "Workspace",
    icon: Laptop,
    description: "Appearance, composition, shortcuts, and calendar",
    tabs: [
      {
        id: "general",
        label: "General",
        icon: Settings,
        subtitle: "Theme, layout, language, privacy, cache",
      },
      {
        id: "composing",
        label: "Composing",
        icon: PenLine,
        subtitle: "Editor, signatures, templates, quick replies, content quality",
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: Calendar,
        subtitle: "Calendar type, overlays, and CalDAV sync",
      },
      {
        id: "shortcuts",
        label: "Shortcuts",
        icon: Keyboard,
        subtitle: "Custom keyboard shortcuts",
      },
    ],
  },
  {
    label: "Accounts & Sync",
    icon: MonitorCheck,
    description: "Email accounts, device pairing, and data management",
    tabs: [
      {
        id: "accounts",
        label: "Accounts",
        icon: UserCircle,
        subtitle: "IMAP/SMTP, Gmail, OAuth, signatures, sync",
      },
      {
        id: "account-cleaning",
        label: "Account Cleaning",
        icon: Trash2,
        subtitle: "Cleanup rules, retention, and scheduled maintenance",
        platform: "desktop",
      },
      {
        id: "pairing",
        label: "Pairing",
        icon: Smartphone,
        subtitle: "Mobile device sync via QR code",
      },
      {
        id: "backup",
        label: "Backup",
        icon: HardDrive,
        subtitle: "Backup scheduler, restore, export",
        platform: "desktop",
      },
    ],
  },
  {
    label: "Notifications",
    icon: Bell,
    description: "Alerts, VIPs, category filters, and snooze presets",
    tabs: [
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        subtitle: "Push alerts, VIP senders, category filters, snooze",
      },
    ],
  },
  {
    label: "AI & Automation",
    icon: Sparkles,
    description: "AI providers, mail rules, and workflow automation",
    tabs: [
      {
        id: "ai",
        label: "AI",
        icon: Sparkles,
        subtitle: "Providers, smart replies, auto-categorize, writing style",
      },
      {
        id: "mail-rules",
        label: "Mail Rules",
        icon: Filter,
        subtitle: "Labels, filters, smart folders, quick steps",
      },
    ],
  },
  {
    label: "Deliverability",
    icon: BarChart3,
    description: "DNS checks, blacklist monitoring, bounce handling, warming",
    tabs: [
      {
        id: "deliverability-dashboard",
        label: "Deliverability",
        icon: BarChart3,
        subtitle: "DNS, blacklist, bounces, warming — all in one place",
        platform: "desktop",
      },
      {
        id: "presend",
        label: "Pre-send",
        icon: ClipboardCheck,
        subtitle: "Pre-flight checklist and send verification",
        platform: "desktop",
      },
    ],
  },
  {
    label: "Security & Compliance",
    icon: ShieldCheck,
    description: "Encryption, compliance profiles, and legal safeguards",
    tabs: [
      {
        id: "pgp",
        label: "PGP Encryption",
        icon: Lock,
        subtitle: "End-to-end encryption keys",
        platform: "desktop",
      },
      {
        id: "compliance",
        label: "Compliance",
        icon: ShieldCheck,
        subtitle: "GDPR, CAN-SPAM, disclaimers",
        platform: "desktop",
      },
      {
        id: "business-profile",
        label: "Business Profile",
        icon: Building2,
        subtitle: "Company info, ICE, IF, RC, CNSS (Morocco DGI)",
      },
    ],
  },
  {
    label: "Developer",
    icon: Code2,
    description: "System info, logs, updates, demo data, and feature flags",
    tabs: [
      {
        id: "developer",
        label: "Developer",
        icon: Code2,
        subtitle: "Health, logs, updates, demo data, feature flags",
        platform: "desktop",
      },
      {
        id: "hardware",
        label: "Hardware",
        icon: Cpu,
        subtitle: "Printers, scanners, scales, and cash drawers",
        platform: "desktop",
      },
      {
        id: "queue",
        label: "Queue",
        icon: Activity,
        subtitle: "Sync queue, pending operations, retry inspector",
        platform: "desktop",
      },
      {
        id: "feature-flags",
        label: "Feature Flags",
        icon: Flag,
        subtitle: "Basic vs Pro tiers, usage overrides, progressive disclosure",
        platform: "desktop",
      },
    ],
  },
  {
    label: "About & Help",
    icon: HelpCircle,
    description: "Version info, license, and documentation",
    tabs: [
      {
        id: "about",
        label: "About & License",
        icon: Info,
        subtitle: "Version, license, credits, reset onboarding",
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

// ── Section Subtitles ──────────────────────────────────────────────────────

export function getSectionSubtitle(id: string): string | undefined {
  const subtitles: Record<string, string> = {
    composing: "Email composition, signatures, templates, quick replies, undo send, and content quality analysis",
    general: "Appearance, layout, language, privacy, storage, and data management",
    accounts: "Manage email accounts, IMAP/SMTP settings, CalDAV sync, and API credentials",
    shortcuts: "Customize keyboard shortcuts for faster workflow",
    about: "Version information, license tier, credits, and onboarding reset",
    pairing: "Pair with mobile devices via QR code for cross-device sync",
    backup: "Backup scheduler, manual backup creation, restore, and export",
    "deliverability-dashboard": "All-in-one deliverability hub: DNS checks, blacklist monitoring, bounce tracking, and sender warming",
    ai: "AI providers, smart replies, auto-categorization, writing style learning, and bundle delivery",
    notifications: "Push notifications, smart alerts, VIP senders, category filters, and snooze presets",
    compliance: "GDPR, CAN-SPAM, and legal compliance profiles with auto-appended disclaimers",
    pgp: "PGP encryption keys for end-to-end email security",
    "mail-rules": "Labels, filters, smart labels, smart folders, quick steps, and workflow automation",
    presend: "Pre-flight checklist and send verification rules (attachments, spell check, recipients)",
    calendar: "Calendar type, task overlays, campaign display, and CalDAV synchronization",
    developer: "System health, app info, subsystem status, update management, demo data, feature flags, and logs",
    queue: "Outgoing send queue, background sync operations, retry inspector, and pause/resume controls",
    "account-cleaning": "Mailbox cleanup rules, retention policies, scheduled maintenance, and cleanup history",
    license: "Manage your license tier, activate a Pro key, or start a free trial",
    "feature-flags": "Toggle Basic vs Pro tiers, override usage counts, and preview progressive disclosure of locked features",
  };
  return subtitles[id];
}

// ── Education Content (Why/How/When) ───────────────────────────────────────
// Maps each settings tab to its consolidated education items shown in the
// HelpCenterSidebar "Quick Help" section. Replaces inline HelpCard usage.

export interface EducationItem {
  type: "why" | "how" | "when";
  text: string;
}

export const EDUCATION_CONTENT: Record<string, EducationItem[]> = {
  general: [
    { type: "why", text: "Appearance, layout, language, and privacy settings let you tailor the app to your workflow and environment." },
    { type: "how", text: "Theme and accent color are applied instantly. Font size, email density, and reading pane position change the layout without page reload." },
    { type: "when", text: "Adjust these once during initial setup, or revisit whenever your preferences change. Dark mode helps in low-light environments." },
  ],
  composing: [
    { type: "why", text: "Composing settings save keystrokes and prevent mistakes — signatures, templates, and undo send speed up your daily email workflow." },
    { type: "how", text: "Signatures are auto-appended to new emails. Templates insert pre-written content. Undo send holds the email briefly before delivery." },
    { type: "when", text: "Set up signatures and templates once, then forget them. Enable undo send for important or high-volume sending." },
  ],
  accounts: [
    { type: "why", text: "Account settings let you connect Gmail, IMAP/SMTP, and CalDAV accounts from a single interface." },
    { type: "how", text: "Each account maintains its own sync state, labels, and OAuth tokens. Credentials are encrypted with AES-256-GCM." },
    { type: "when", text: "Add accounts during initial setup. Update credentials or re-authorize when tokens expire or passwords change." },
  ],
  notifications: [
    { type: "why", text: "Notifications keep you informed of important emails without constantly checking your inbox." },
    { type: "how", text: "Smart notifications analyze sender priority and email category to reduce noise. VIP senders always trigger alerts." },
    { type: "when", text: "Enable for time-sensitive communications. Use smart mode to filter out marketing and social notifications." },
  ],
  shortcuts: [
    { type: "why", text: "Keyboard shortcuts let you navigate and act on email without the mouse, dramatically speeding up daily triage." },
    { type: "how", text: "Single-key shortcuts work when no text input is focused. Two-key sequences (g then i) enable quick navigation." },
    { type: "when", text: "Enable keyboard-first mode if you process more than 50 emails per day. Customize bindings to match your muscle memory." },
  ],
  calendar: [
    { type: "why", text: "Calendar integration lets you manage events and tasks alongside your email without switching apps." },
    { type: "how", text: "Events sync via CalDAV or Google Calendar. Task overlays show to-dos on your calendar. Campaign display shows email campaign schedules." },
    { type: "when", text: "Connect your calendar during setup for unified scheduling. Use overlays to see tasks and campaigns at a glance." },
  ],
  pairing: [
    { type: "why", text: "Device pairing syncs your app state between desktop and mobile for a seamless cross-device experience." },
    { type: "how", text: "Pairing uses a QR code exchange with end-to-end encryption. Once paired, accounts, settings, and drafts stay in sync." },
    { type: "when", text: "Pair when you install the app on a second device. Re-pair if sync breaks or after reinstalling on either device." },
  ],
  backup: [
    { type: "why", text: "Backups protect your local data — settings, templates, and cached email — against data loss or corruption." },
    { type: "how", text: "Backups export your SQLite database, encryption keys, and configuration to a file you choose. Restore re-imports everything." },
    { type: "when", text: "Schedule weekly backups if you rely on local data. Create a manual backup before major updates or device changes." },
  ],
  "deliverability-dashboard": [
    { type: "why", text: "Deliverability tools help ensure your emails reach the inbox, not the spam folder." },
    { type: "how", text: "DNS checks validate SPF, DKIM, and DMARC records. Blacklist monitoring alerts you if your domain is flagged. Warming gradually builds sender reputation." },
    { type: "when", text: "Check deliverability when setting up a new sending domain, after DNS changes, or if you notice emails going to spam." },
  ],
  ai: [
    { type: "why", text: "AI features save time by drafting replies, summarizing long threads, and categorizing email automatically. The optional Local RAG system indexes your email for on-device semantic search without sending data to the cloud." },
    { type: "how", text: "Your API key is stored locally. Email content is sent directly to your chosen provider — no middleman server involved. For RAG, embeddings are generated via the built-in BGE-small model or through your provider's embeddings API (LM Studio, Ollama, OpenAI-compatible)." },
    { type: "when", text: "Enable AI if you process a high volume of email and want automated assistance. Set up your API key from Anthropic, OpenAI, or Google. Enable Local RAG for offline-first semantic search or when working with sensitive data." },
  ],
  "mail-rules": [
    { type: "why", text: "Mail rules automate organization — labels, filters, smart folders, and quick steps keep your inbox tidy without manual effort." },
    { type: "how", text: "Filters match incoming mail by sender/subject/content and apply actions automatically. Smart labels use AI for natural-language matching." },
    { type: "when", text: "Create rules for recurring patterns: newsletters, recurring invoices, project notifications. Smart labels for fuzzy categorization." },
  ],
  compliance: [
    { type: "why", text: "Compliance profiles help you meet legal requirements like GDPR, CAN-SPAM, and industry-specific regulations." },
    { type: "how", text: "Each profile auto-appends disclaimers, unsubscribe links, and required disclosures to outgoing email based on jurisdiction rules." },
    { type: "when", text: "Enable compliance if you send marketing email, operate in regulated industries, or have subscribers in the EU or California." },
  ],
  pgp: [
    { type: "why", text: "PGP encryption ensures only the intended recipient can read your email content — end-to-end." },
    { type: "how", text: "Your public key is shared so others can encrypt email to you. Your private key is stored locally and never leaves your device." },
    { type: "when", text: "Use PGP for sensitive communications: legal, financial, or confidential business correspondence that must not be readable in transit." },
  ],
  presend: [
    { type: "why", text: "Pre-send checks catch mistakes before email goes out — missing attachments, wrong recipients, or compliance violations." },
    { type: "how", text: "The checklist runs automatically when you hit send: checks for attachment mentions, recipient validity, and disclaimer presence." },
    { type: "when", text: "Enable all pre-send checks by default. Customize severity: block for critical issues, warn for suggestions." },
  ],
  developer: [
    { type: "why", text: "Developer tools let you monitor app health, manage updates, debug issues, and configure advanced behaviors." },
    { type: "how", text: "System health shows memory, CPU, sync status, and database integrity. Feature flags toggle in-development capabilities." },
    { type: "when", text: "Use for troubleshooting, when reporting bugs, or if you want early access to experimental features." },
  ],
  queue: [
    { type: "why", text: "The queue manages all background operations — sending emails, syncing folders, and processing retries. Monitoring it helps diagnose slow sends and sync issues." },
    { type: "how", text: "Operations are processed in FIFO order. Failed items are retried with exponential backoff. The inspector shows pending, processing, and failed items in real time." },
    { type: "when", text: "Inspect the queue when emails aren't sending, sync appears stuck, or before making major configuration changes. Pause during demos to prevent interruptions." },
  ],
  "account-cleaning": [
    { type: "why", text: "Mailbox cleanup rules help you stay within storage limits by automatically archiving or deleting old email based on sender, age, or subject patterns." },
    { type: "how", text: "Rules define conditions (sender, age, subject) and actions (delete, archive, mark read). Scheduled rules run automatically at set intervals via cron." },
    { type: "when", text: "Set up rules when approaching storage limits, for recurring newsletters, or to enforce data retention policies. Schedule during off-peak hours." },
  ],
  about: [
    { type: "why", text: "The About section shows version information, license details, and app credits so you know exactly what you're running." },
    { type: "how", text: "Version info is read from the app build. License status is checked against your activation key via the licensing service." },
    { type: "when", text: "Check here when verifying you're on the latest version, troubleshooting license activation, or viewing app credits." },
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
