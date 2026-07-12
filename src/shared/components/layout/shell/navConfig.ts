import {
  Mail,
  Users,
  Calendar,
  Settings,
  Bot,
  Inbox,
  Star,
  Clock,
  Send,
  FileEdit,
  Trash2,
  Ban,
  Bug,
  Paperclip,
  BarChart3,
  ReceiptText,
  CheckSquare,
  FolderSearch,
  Tag,
  UserCircle,
  PenLine,
  Bell,
  Sparkles,
  Filter,
  GitBranch,
  Lock,
  ShieldCheck,
  HardDrive,
  Smartphone,
  ClipboardCheck,
  Keyboard,
  HelpCircle,
  Info,
  FolderLock,
  Cpu,
  LayoutDashboard,
  Calculator,
} from "lucide-react";
import { navigateToLabel, navigateToSettings, navigateToHelp } from "@/router/navigate";
import { router } from "@/router";
import type { NavRailItem } from "./NavRail";
import type { LucideIcon } from "lucide-react";
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

// ─── Navigation tree ──────────────────────────────────────────────────────────

export const NAV_GROUPS: NavRailGroup[] = [
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
    ],
  },
  {
    id: "calendar",
    icon: Calendar,
    label: "calendar.calendar",
    items: [],
  },
  {
    id: "tasks",
    icon: CheckSquare,
    label: "tasks.tasks",
    items: [],
  },
  {
    id: "automation",
    icon: Bot,
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
    icon: Bot,
    label: "nav.aiAssistant",
    items: [],
  },
  {
    id: "settings",
    icon: Settings,
    label: "nav.settings",
    items: [
      // Workspace
      { id: "general", label: "settings.tabs.general", icon: Settings },
      { id: "composing", label: "settings.tabs.composing", icon: PenLine },
      { id: "calendar", label: "settings.tabs.calendar", icon: Calendar },
      { id: "shortcuts", label: "settings.tabs.shortcuts", icon: Keyboard },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // Accounts & Sync
      { id: "accounts", label: "settings.tabs.accounts", icon: UserCircle },
      { id: "pairing", label: "settings.devicePairing", icon: Smartphone },
      { id: "backup", label: "settings.tabs.backup", icon: HardDrive },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // Notifications
      { id: "notifications", label: "settings.tabs.notifications", icon: Bell },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // AI & Automation
      { id: "ai", label: "search.ai", icon: Sparkles },
      { id: "mail-rules", label: "settings.tabs.mailRules", icon: Filter },
      { id: "workflows", label: "settings.tabs.workflows", icon: GitBranch },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // Deliverability
      { id: "deliverability-dashboard", label: "settings.tabGroupDeliverability", icon: BarChart3 },
      { id: "presend", label: "settings.tabs.presend", icon: ClipboardCheck },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // Security & Compliance
      { id: "pgp", label: "settings.tabs.pgp", icon: Lock },
      { id: "compliance", label: "settings.tabs.compliance", icon: ShieldCheck },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // Developer
      { id: "developer", label: "settings.tabGroupDeveloper", icon: Bug },
      { id: "hardware", label: "Hardware", icon: Cpu },
      // ── divider ──
      { id: "__divider__", label: "", icon: undefined },
      // About
      { id: "about", label: "nav.about", icon: Info },
    ],
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

/**
 * Backward-compatible NAV_ITEMS derived from groups.
 * Used by MobileShell and any existing code that references NAV_ITEMS directly.
 */
export const NAV_ITEMS: NavRailItem[] = NAV_GROUPS.map((g) => ({
  id: g.id,
  icon: g.icon,
  label: g.label,
}));

// ─── Route helpers ────────────────────────────────────────────────────────────

/**
 * Maps a URL pathname to the active navigation rail group ID.
 * Distinguishes page routes (settings, tasks, calendar, etc.)
 * from mail-like routes (inbox, labels, smart folders).
 */
export function getActiveNavFromPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "mail";
  if (pathname.startsWith("/mail")) return "mail";
  if (pathname.startsWith("/label")) return "mail";
  if (pathname.startsWith("/smart-folder")) return "mail";
  if (pathname.startsWith("/people")) return "crm";
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/automation")) return "automation";
  if (pathname.startsWith("/workflows")) return "automation";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/help")) return "help";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/attachments")) return "mail";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/invoicing")) return "dashboard";
  if (pathname.startsWith("/erp")) return "dashboard";
  if (pathname.startsWith("/ai-assistant")) return "ai-assistant";
  if (pathname.startsWith("/pos")) return "mail"; // Or a separate 'pos' group if we add it
  return "mail";
}

/**
 * Maps a URL pathname to the active sub-item ID within its group.
 * Returns null for page routes without sub-items.
 */
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

  // Analytics sub-items
  if (pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/invoicing")) return "invoicing";
  if (pathname.startsWith("/erp")) return "erp";

  const helpMatch = pathname.match(/^\/help\/([^/]+)/);
  if (helpMatch) return helpMatch[1]!;
  if (pathname.startsWith("/help")) return "help-center";

  // Page routes with no sub-item
  if (pathname.startsWith("/tasks")) return null;
  if (pathname.startsWith("/calendar")) return null;
  if (pathname.startsWith("/ai-assistant")) return null;
  if (pathname.startsWith("/pos")) return null;

  return null;
}

/**
 * Returns the sub-items for a given group ID, or an empty array.
 */
export function getSubItemsForGroup(groupId: string): NavRailSubItem[] {
  const group = NAV_GROUPS.find((g) => g.id === groupId);
  return group?.items ?? [];
}

// ─── Navigation handlers ──────────────────────────────────────────────────────

/**
 * Navigates to the default view for each nav rail group.
 * Mail and People → mail-like routes (MailLayout)
 * Tasks, Calendar, Analytics, Automation → page routes
 * Help → help topic route
 * Settings → settings tab route
 */
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
      navigateToLabel("calendar");
      break;
    case "tasks":
      navigateToLabel("tasks");
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

/**
 * Navigates to the view associated with a sub-item within a group.
 */
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
