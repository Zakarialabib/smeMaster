/**
 * PROPOSED navConfig.ts — email-first IA redesign for smeMaster.
 *
 * Drop-in replacement for src/shared/components/layout/shell/navConfig.ts.
 * Changes vs current:
 *   - Mail is home (already `/` → mail); panel defaults open.
 *   - Order: Mail, CRM, Marketing, Automation, Finance, Plan, Vault, AI, (Settings, Help pinned).
 *   - "Dashboard" regrouped/rebranded → "Finance" (Invoicing + ERP + Reports).
 *   - Calendar + Tasks folded into a "Plan" group to keep the rail ≤8 main icons.
 *   - mail-rules / workflows moved OUT of Settings → Automation (rules, triggers).
 *   - FIX: automation uses GitBranch, ai-assistant uses Sparkles (no duplicate Bot icon).
 * The NavRail component needs no behavioral change beyond the icon fix + default-open Mail.
 */
import {
  Mail, Users, Calendar, Settings, Inbox, Star, Clock, Send, FileEdit,
  Trash2, Ban, Bug, Paperclip, BarChart3, ReceiptText, FolderSearch, Tag,
  UserCircle, PenLine, Bell, Sparkles, Filter, GitBranch, Lock, ShieldCheck,
  HardDrive, Smartphone, ClipboardCheck, Keyboard, HelpCircle, Info, FolderLock,
  Cpu, Calculator, Megaphone, Workflow, CalendarDays, ListTodo,
  FileLock2, BrainCircuit, Layers,
} from "lucide-react";
import { navigateToLabel, navigateToSettings, navigateToHelp } from "@/router/navigate";
import { router } from "@/router";
import type { NavRailItem } from "./NavRail";
import type { LucideIcon } from "lucide-react";

export interface NavRailSubItem {
  id: string; label: string; icon?: LucideIcon; badge?: number; path?: string;
}
export interface NavRailGroup {
  id: string; icon: LucideIcon; label: string; items: NavRailSubItem[]; badge?: number;
}
export const SECTION_HEADER = "__section__";

export const NAV_GROUPS: NavRailGroup[] = [
  {
    id: "mail", icon: Mail, label: "nav.mail", badge: undefined, // badge injected at runtime (unread)
    items: [
      { id: "inbox", label: "nav.inbox", icon: Inbox },
      { id: "starred", label: "nav.starred", icon: Star },
      { id: "snoozed", label: "nav.snoozed", icon: Clock },
      { id: "sent", label: "nav.sent", icon: Send },
      { id: "drafts", label: "nav.drafts", icon: FileEdit },
      { id: "trash", label: "nav.trash", icon: Trash2 },
      { id: "spam", label: "nav.spam", icon: Ban },
      { id: "all", label: "nav.allMail", icon: Mail },
      { id: "__divider__", label: "", icon: undefined },
      { id: "attachments", label: "nav.attachments", icon: Paperclip },
      { id: "smart-folders", label: "nav.smartFolders", icon: FolderSearch },
      { id: "labels", label: "nav.labels", icon: Tag },
      { id: "splits", label: "nav.splits", icon: Layers },
    ],
  },
  {
    id: "crm", icon: Users, label: "nav.crm",
    items: [
      { id: "contacts", label: "nav.crmContacts", icon: Users },
      { id: "companies", label: "nav.crmCompanies", icon: UserCircle },
      { id: "deals", label: "nav.crmDeals", icon: Workflow },
      { id: "timeline", label: "nav.crmTimeline", icon: Clock },
    ],
  },
  {
    id: "marketing", icon: Megaphone, label: "nav.marketing",
    items: [
      { id: "campaigns", label: "nav.campaigns", icon: Megaphone },
      { id: "segments", label: "nav.segments", icon: Layers },
      { id: "templates", label: "nav.templates", icon: PenLine },
      { id: "analytics", label: "nav.analytics", icon: BarChart3 },
      { id: "deliverability", label: "nav.deliverability", icon: ClipboardCheck },
    ],
  },
  {
    id: "automation", icon: GitBranch, label: "nav.automation", // FIX: was Bot
    items: [
      { id: "workflows", label: "nav.workflows", icon: Workflow },
      { id: "triggers", label: "nav.triggers", icon: GitBranch },
      { id: "rules", label: "nav.mailRules", icon: Filter }, // moved from Settings
      { id: "webhooks", label: "nav.webhooks", icon: Cpu },
    ],
  },
  {
    id: "finance", icon: Calculator, label: "nav.finance", // was "dashboard"
    items: [
      { id: "invoicing", label: "nav.invoicing", icon: ReceiptText, path: "/invoicing" },
      { id: "erp", label: "nav.erp", icon: Calculator, path: "/erp" },
      { id: "reports", label: "nav.reports", icon: BarChart3, path: "/finance/reports" },
    ],
  },
  {
    id: "plan", icon: CalendarDays, label: "nav.plan", // Calendar + Tasks folded
    items: [
      { id: "calendar", label: "nav.calendar", icon: Calendar },
      { id: "tasks", label: "nav.tasks", icon: ListTodo },
    ],
  },
  {
    id: "vault", icon: FolderLock, label: "nav.vault",
    items: [
      { id: "files", label: "nav.vaultFiles", icon: FileLock2 },
      { id: "shared", label: "nav.vaultShared", icon: Users },
      { id: "recovery", label: "nav.vaultRecovery", icon: ShieldCheck },
    ],
  },
  {
    id: "ai-assistant", icon: Sparkles, label: "nav.aiAssistant", // FIX: was Bot
    items: [
      { id: "chat", label: "nav.aiChat", icon: Sparkles },
      { id: "knowledge", label: "nav.aiKnowledge", icon: BrainCircuit },
      { id: "index", label: "nav.aiIndex", icon: HardDrive },
    ],
  },
  {
    id: "settings", icon: Settings, label: "nav.settings",
    items: [
      { id: "general", label: "settings.tabs.general", icon: Settings },
      { id: "composing", label: "settings.tabs.composing", icon: PenLine },
      { id: "calendar", label: "settings.tabs.calendar", icon: Calendar },
      { id: "shortcuts", label: "settings.tabs.shortcuts", icon: Keyboard },
      { id: "__divider__", label: "", icon: undefined },
      { id: "accounts", label: "settings.tabs.accounts", icon: UserCircle },
      { id: "pairing", label: "settings.devicePairing", icon: Smartphone },
      { id: "backup", label: "settings.tabs.backup", icon: HardDrive },
      { id: "__divider__", label: "", icon: undefined },
      { id: "notifications", label: "settings.tabs.notifications", icon: Bell },
      { id: "__divider__", label: "", icon: undefined },
      { id: "ai", label: "search.ai", icon: Sparkles },
      { id: "__divider__", label: "", icon: undefined },
      { id: "pgp", label: "settings.tabs.pgp", icon: Lock },
      { id: "compliance", label: "settings.tabs.compliance", icon: ShieldCheck },
      { id: "__divider__", label: "", icon: undefined },
      { id: "developer", label: "settings.tabGroupDeveloper", icon: Bug },
      { id: "hardware", label: "settings.tabs.hardware", icon: Cpu },
      { id: "__divider__", label: "", icon: undefined },
      { id: "about", label: "nav.about", icon: Info },
    ],
  },
  {
    id: "help", icon: HelpCircle, label: "nav.help",
    items: [{ id: "help-center", label: "settings.tabs.helpCenter", icon: HelpCircle }],
  },
];

export const NAV_ITEMS: NavRailItem[] = NAV_GROUPS.map((g) => ({ id: g.id, icon: g.icon, label: g.label }));

export function getActiveNavFromPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "mail";
  if (pathname.startsWith("/mail")) return "mail";
  if (pathname.startsWith("/label")) return "mail";
  if (pathname.startsWith("/smart-folder")) return "mail";
  if (pathname.startsWith("/splits")) return "mail";
  if (pathname.startsWith("/attachments")) return "mail";
  if (pathname.startsWith("/people") || pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/campaign") || pathname.startsWith("/segment") || pathname.startsWith("/marketing")) return "marketing";
  if (pathname.startsWith("/automation") || pathname.startsWith("/workflows") || pathname.startsWith("/triggers") || pathname.startsWith("/rules")) return "automation";
  if (pathname.startsWith("/invoicing") || pathname.startsWith("/erp") || pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/calendar")) return "plan";
  if (pathname.startsWith("/tasks")) return "plan";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname.startsWith("/ai-assistant")) return "ai-assistant";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/help")) return "help";
  return "mail";
}

export function getActiveSubItem(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return "inbox";
  const mailMatch = pathname.match(/^\/mail\/([^/]+)/); if (mailMatch) return mailMatch[1]!;
  const labelMatch = pathname.match(/^\/label\/([^/]+)/); if (labelMatch) return labelMatch[1]!;
  if (pathname.startsWith("/smart-folder")) return "smart-folders";
  if (pathname.startsWith("/splits")) return "splits";
  if (pathname.startsWith("/attachments")) return "attachments";
  const settingsMatch = pathname.match(/^\/settings\/([^/]+)/); if (settingsMatch) return settingsMatch[1]!;
  if (pathname.startsWith("/people") || pathname.startsWith("/crm")) return "contacts";
  if (pathname.startsWith("/campaign")) return "campaigns";
  if (pathname.startsWith("/segment")) return "segments";
  if (pathname.startsWith("/marketing")) return "analytics";
  if (pathname.startsWith("/automation") || pathname.startsWith("/workflows")) return "workflows";
  if (pathname.startsWith("/triggers")) return "triggers";
  if (pathname.startsWith("/rules")) return "rules";
  if (pathname.startsWith("/invoicing")) return "invoicing";
  if (pathname.startsWith("/erp")) return "erp";
  if (pathname.startsWith("/finance")) return "reports";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/vault")) return "files";
  if (pathname.startsWith("/ai-assistant")) return "chat";
  const helpMatch = pathname.match(/^\/help\/([^/]+)/); if (helpMatch) return helpMatch[1]!;
  if (pathname.startsWith("/help")) return "help-center";
  return null;
}

export function getSubItemsForGroup(groupId: string): NavRailSubItem[] {
  return NAV_GROUPS.find((g) => g.id === groupId)?.items ?? [];
}

export function handleNavSelect(id: string): void {
  switch (id) {
    case "mail": navigateToLabel("inbox"); break;
    case "settings": navigateToSettings("general"); break;
    case "help": navigateToHelp(); break;
    case "automation": router.navigate({ to: "/automation" }); break;
    case "vault": router.navigate({ to: "/vault" }); break;
    case "crm": router.navigate({ to: "/people" }); break;
    case "marketing": router.navigate({ to: "/marketing/campaigns" }); break;
    case "finance": router.navigate({ to: "/finance" }); break;
    case "plan": router.navigate({ to: "/calendar" }); break;
    case "ai-assistant": router.navigate({ to: "/ai-assistant" }); break;
    default: navigateToLabel(id);
  }
}

export function handleSubItemSelect(groupId: string, subItemId: string): void {
  switch (groupId) {
    case "mail": navigateToLabel(subItemId); break;
    case "settings": navigateToSettings(subItemId); break;
    case "crm": router.navigate({ to: `/people?view=${subItemId}` }); break;
    case "marketing": router.navigate({ to: `/marketing/${subItemId}` }); break;
    case "automation": router.navigate({ to: `/automation/${subItemId}` }); break;
    case "finance": router.navigate({ to: subItemId === "reports" ? "/finance/reports" : `/${subItemId}` }); break;
    case "plan": router.navigate({ to: `/${subItemId}` }); break;
    case "vault": router.navigate({ to: `/vault?view=${subItemId}` }); break;
    case "ai-assistant": router.navigate({ to: `/ai-assistant?view=${subItemId}` }); break;
    case "help": subItemId === "about" ? navigateToSettings("about") : navigateToHelp(); break;
  }
}

/** Single Contact entity backs Mail, CRM, segments, automation (pattern #6). */
export const SHARED_CONTACT_MODEL = true;
