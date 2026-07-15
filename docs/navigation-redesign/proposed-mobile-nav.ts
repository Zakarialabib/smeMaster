/**
 * PROPOSED mobile navigation for smeMaster (Android / narrow viewports).
 *
 * Rule: MAX 5 bottom tabs. Thumb-zone the owner's literal daily quartet
 * (Mail, CRM, Marketing, Automation) + a Hub ("More") sheet.
 *
 * Pass MOBILE_BOTTOM_TABS to BottomTabBar and HUB_SHEET_GROUPS to the
 * bottom-sheet renderer. A center FAB opens a context-aware "New" action sheet.
 */
import { Mail, Users, Megaphone, GitBranch, Grid, type LucideIcon } from "lucide-react";

export interface MobileTab {
  id: string;
  label: string; // i18n key
  icon: LucideIcon;
  route: string;
}

/** Fixed bottom tabs — exactly 5. */
export const MOBILE_BOTTOM_TABS: MobileTab[] = [
  { id: "mail", label: "nav.mail", icon: Mail, route: "/mail/inbox" },
  { id: "crm", label: "nav.crm", icon: Users, route: "/people" },
  { id: "marketing", label: "nav.marketing", icon: Megaphone, route: "/marketing/campaigns" },
  { id: "automation", label: "nav.automation", icon: GitBranch, route: "/automation" },
  { id: "more", label: "nav.more", icon: Grid, route: "#hub" }, // opens Hub sheet
];

export interface HubGroup {
  title: string; // i18n key
  items: MobileTab[];
}

/** Hub sheet — everything beyond the 4 priority tabs, grouped, 1 tap away. */
export const HUB_SHEET_GROUPS: HubGroup[] = [
  {
    title: "nav.plan",
    items: [
      { id: "calendar", label: "nav.calendar", icon: undefined as unknown as LucideIcon, route: "/calendar" },
      { id: "tasks", label: "nav.tasks", icon: undefined as unknown as LucideIcon, route: "/tasks" },
    ],
  },
  {
    title: "nav.finance",
    items: [
      { id: "invoicing", label: "nav.invoicing", icon: undefined as unknown as LucideIcon, route: "/invoicing" },
      { id: "erp", label: "nav.erp", icon: undefined as unknown as LucideIcon, route: "/erp" },
    ],
  },
  {
    title: "nav.workspace",
    items: [
      { id: "vault", label: "nav.vault", icon: undefined as unknown as LucideIcon, route: "/vault" },
      { id: "ai-assistant", label: "nav.aiAssistant", icon: undefined as unknown as LucideIcon, route: "/ai-assistant" },
    ],
  },
  {
    title: "nav.system",
    items: [
      { id: "settings", label: "nav.settings", icon: undefined as unknown as LucideIcon, route: "/settings" },
      { id: "help", label: "nav.help", icon: undefined as unknown as LucideIcon, route: "/help" },
    ],
  },
];

/** Context-aware FAB: cue depends on active tab (compose / new contact / new task / new invoice). */
export type FabAction =
  | { kind: "compose-email" }
  | { kind: "new-contact" }
  | { kind: "new-task" }
  | { kind: "new-invoice" }
  | { kind: "new-campaign" }
  | { kind: "run-workflow" };

export function fabActionForTab(tabId: string): FabAction {
  switch (tabId) {
    case "mail": return { kind: "compose-email" };
    case "crm": return { kind: "new-contact" };
    case "marketing": return { kind: "new-campaign" };
    case "automation": return { kind: "run-workflow" };
    case "more": return { kind: "new-task" };
    default: return { kind: "new-task" };
  }
}
