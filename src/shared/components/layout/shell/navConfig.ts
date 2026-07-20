import {
  Mail,
  Users,
  ReceiptText,
  Settings,
  Inbox,
  Star,
  Clock,
  Send,
  FileEdit,
  Trash2,
  Ban,
  Paperclip,
  Tag,
  FolderSearch,
  GitBranch,
  FolderLock,
  Sparkles,
  HelpCircle,
  LayoutDashboard,
  Calculator,
  ListChecks,
  CalendarDays,
} from "lucide-react";
import { navigateToLabel, navigateToSettings, navigateToHelp } from "@/router/navigate";
import { router } from "@/router";
import type { NavRailItem } from "./NavRail";
import type { LucideIcon } from "lucide-react";
import { tabGroups } from "@/features/settings/components/SettingsTabRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavRailSubItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  path?: string;
}

export interface NavRailGroup {
  id: string;
  icon: LucideIcon;
  label: string;
  items: NavRailSubItem[];
}

// ─── Section marker ───────────────────────────────────────────────────────────
export const SECTION_HEADER = "__section__";

/**
 * Flat list of all navigable mail-sidebar items (mail-specific only).
 * Used by SidebarNavEditor and the premium sidebar content panel.
 * Non-mail pages (tasks, calendar, analytics) have their own NavRail groups.
 */
export const ALL_NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "nav.inbox", icon: Inbox },
  { id: "starred", label: "nav.starred", icon: Star },
  { id: "snoozed", label: "nav.snoozed", icon: Clock },
  { id: "sent", label: "nav.sent", icon: Send },
  { id: "drafts", label: "nav.drafts", icon: FileEdit },
  { id: "trash", label: "nav.trash", icon: Trash2 },
  { id: "spam", label: "nav.spam", icon: Ban },
  { id: "all", label: "nav.allMail", icon: Mail },
  { id: "attachments", label: "nav.attachments", icon: Paperclip },
  { id: "smart-folders", label: "nav.smartFolders", icon: FolderSearch },
  { id: "labels", label: "nav.labels", icon: Tag },
];

// ─── Settings labels override ────────────────────────────────────────────────
// Some tabs need nav-specific i18n keys; default to `settings.tabs.<id>`.
const SETTINGS_NAV_LABELS: Record<string, string> = {
  pairing: "settings.devicePairing",
  "deliverability-dashboard": "settings.tabGroupDeliverability",
  developer: "settings.tabGroupDeveloper",
  about: "nav.about",
};

/**
 * Build Settings group items from SettingsTabRegistry so the rail stays
 * aligned with the single source of truth.
 */
function buildSettingsItems(): NavRailSubItem[] {
  const items: NavRailSubItem[] = [];
  for (const group of tabGroups) {
    for (const tab of group.tabs) {
      items.push({
        id: tab.id,
        label: SETTINGS_NAV_LABELS[tab.id] ?? `settings.tabs.${tab.id}`,
        icon: tab.icon,
      });
    }
    items.push({ id: "__divider__", label: "", icon: undefined });
  }
  items.pop();
  return items;
}

// ─── Navigation tree ──────────────────────────────────────────────────────────

export const NAV_GROUPS: NavRailGroup[] = [
  {
    id: "unified",
    icon: LayoutDashboard,
    label: "nav.unified",
    items: [],
  },
  {
    id: "dashboard",
    label: "nav.dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "invoicing", label: "nav.invoicing", icon: ReceiptText, path: "/invoicing" },
      { id: "erp", label: "nav.erp", icon: Calculator, path: "/erp" },
    ]
  },
  {
    id: "mail",
    icon: Mail,
    label: "nav.mail",
    items: [
      { id: "inbox", label: "nav.inbox", icon: Inbox },
      { id: "starred", label: "nav.starred", icon: Star },
      { id: "snoozed", label: "nav.snoozed", icon: Clock },
      { id: "sent", label: "nav.sent", icon: Send },
      { id: "drafts", label: "nav.drafts", icon: FileEdit },
      { id: "trash", label: "nav.trash", icon: Trash2 },
      { id: "spam", label: "nav.spam", icon: Ban },
      { id: "all", label: "nav.allMail", icon: Mail },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      { id: "attachments", label: "nav.attachments", icon: Paperclip },
      { id: "smart-folders", label: "nav.smartFolders", icon: FolderSearch },
      { id: "labels", label: "nav.labels", icon: Tag },
    ],
  },
  {
    id: "crm",
    icon: Users,
    label: "nav.crm",
    items: [
      { id: "contacts", label: "nav.crm", icon: Users },
      { id: "deals", label: "nav.deals", icon: ReceiptText, path: "/people?tab=deals" },
    ],
  },
  {
    id: "tasks",
    icon: ListChecks,
    label: "nav.tasks",
    items: [
      { id: "today", label: "nav.tasksToday", icon: ListChecks, path: "/tasks" },
      { id: "upcoming", label: "nav.tasksUpcoming", icon: CalendarDays, path: "/tasks?view=upcoming" },
    ],
  },
  {
    id: "calendar",
    icon: CalendarDays,
    label: "nav.calendar",
    items: [
      { id: "month", label: "nav.calendarMonth", icon: CalendarDays, path: "/calendar" },
      { id: "agenda", label: "nav.calendarAgenda", icon: ListChecks, path: "/calendar?view=agenda" },
    ],
  },
  {
    id: "automation",
    icon: GitBranch,
    label: "nav.automation",
    items: [],
  },
  {
    id: "vault",
    icon: FolderLock,
    label: "nav.vault",
    items: [],
  },
  {
    id: "ai-assistant",
    icon: Sparkles,
    label: "nav.aiAssistant",
    items: [],
  },
  {
    id: "settings",
    icon: Settings,
    label: "nav.settings",
    items: buildSettingsItems(),
  },
  {
    id: "help",
    icon: HelpCircle,
    label: "nav.help",
    items: [
      { id: "help-center", label: "settings.tabs.helpCenter", icon: HelpCircle },
    ],
  },
];

// ─── Contextual Intelligence ──────────────────────────────────────────────────
// Describes what the right "Insights" rail surfaces per top-level section.
// The shell consumes this to render the right context-aware widgets, so every
// page shows "what matters now" for its domain — the unified UX principle.
export type InsightWidget = "ai-tasks" | "today" | "hot-leads" | "upcoming" | "recent" | "ai-summary";

export const INSIGHT_WIDGETS: Record<string, InsightWidget[]> = {
  unified: ["ai-tasks", "today", "hot-leads", "upcoming"],
  mail: ["ai-tasks", "today", "hot-leads"],
  crm: ["hot-leads", "ai-summary", "upcoming"],
  tasks: ["today", "upcoming", "ai-tasks"],
  calendar: ["upcoming", "today", "hot-leads"],
  automation: ["ai-summary", "recent"],
  vault: ["recent"],
  "ai-assistant": ["ai-summary", "recent"],
  dashboard: ["today", "upcoming", "hot-leads"],
  settings: ["recent"],
  help: ["recent"],
};

/** Default insight rail title per section. */
export const INSIGHT_TITLE: Record<string, string> = {
  unified: "Insights",
  mail: "Today",
  crm: "Relationships",
  tasks: "My day",
  calendar: "Upcoming",
  automation: "Activity",
  vault: "Recent",
  "ai-assistant": "AI",
  dashboard: "Overview",
  settings: "Recent",
  help: "Recent",
};

/** Backward-compatible NAV_ITEMS derived from groups. */
export const NAV_ITEMS: NavRailItem[] = NAV_GROUPS.map((g) => ({
  id: g.id,
  icon: g.icon,
  label: g.label,
}));

// ─── Route helpers ────────────────────────────────────────────────────────────

export function getActiveNavFromPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "mail";
  if (pathname.startsWith("/mail")) return "mail";
  if (pathname.startsWith("/label")) return "mail";
  if (pathname.startsWith("/smart-folder")) return "mail";
  if (pathname.startsWith("/people")) return "crm";
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/automation")) return "automation";
  if (pathname.startsWith("/workflows")) return "automation";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/help")) return "help";
  if (pathname.startsWith("/attachments")) return "mail";
  if (pathname.startsWith("/unified")) return "unified";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/invoicing")) return "dashboard";
  if (pathname.startsWith("/erp")) return "dashboard";
  if (pathname.startsWith("/ai-assistant")) return "ai-assistant";
  if (pathname.startsWith("/pos")) return "mail";
  return "mail";
}

export function getActiveSubItem(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return "inbox";

  const mailMatch = pathname.match(/^\/mail\/([^/]+)/);
  if (mailMatch) return mailMatch[1]!;

  const labelMatch = pathname.match(/^\/label\/([^/]+)/);
  if (labelMatch) return labelMatch[1]!;

  if (pathname.startsWith("/smart-folder")) return "smart-folders";

  const settingsMatch = pathname.match(/^\/settings\/([^/]+)/);
  if (settingsMatch) return settingsMatch[1]!;

  if (pathname.startsWith("/people")) return "contacts";
  if (pathname.startsWith("/crm")) return "contacts";
  if (pathname.startsWith("/attachments")) return "attachments";

  if (pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/invoicing")) return "invoicing";
  if (pathname.startsWith("/erp")) return "erp";

  const helpMatch = pathname.match(/^\/help\/([^/]+)/);
  if (helpMatch) return helpMatch[1]!;
  if (pathname.startsWith("/help")) return "help-center";

  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/ai-assistant")) return null;
  if (pathname.startsWith("/pos")) return null;

  return null;
}

export function getSubItemsForGroup(groupId: string): NavRailSubItem[] {
  const group = NAV_GROUPS.find((g) => g.id === groupId);
  return group?.items ?? [];
}

// ─── Navigation handlers ──────────────────────────────────────────────────────

export function handleNavSelect(id: string): void {
  switch (id) {
    case "mail":
      navigateToLabel("inbox");
      break;
    case "settings":
      navigateToSettings("general");
      break;
    case "help":
      navigateToHelp();
      break;
    case "calendar":
      router.navigate({ to: "/calendar" });
      break;
    case "tasks":
      router.navigate({ to: "/tasks" });
      break;
    case "automation":
      navigateToLabel("automation");
      break;
    case "workflows":
      navigateToLabel("automation");
      break;
    case "vault":
      router.navigate({ to: "/vault" });
      break;
    case "crm":
    case "people":
      router.navigate({ to: "/people" });
      break;
    case "unified":
      router.navigate({ to: "/unified" });
      break;
    case "dashboard":
      router.navigate({ to: "/dashboard" });
      break;
    case "ai-assistant":
      router.navigate({ to: "/ai-assistant" });
      break;
    case "pos":
      router.navigate({ to: "/pos" });
      break;
    default:
      navigateToLabel(id);
      break;
  }
}

export function handleSubItemSelect(groupId: string, subItemId: string): void {
  switch (groupId) {
    case "mail":
      navigateToLabel(subItemId);
      break;
    case "settings":
      navigateToSettings(subItemId);
      break;
    case "crm":
    case "people":
      navigateToLabel(subItemId);
      break;
    case "help":
      if (subItemId === "about") {
        navigateToSettings("about");
      } else {
        navigateToHelp();
      }
      break;
  }
}
