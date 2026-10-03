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
  CalendarRange,
  Bot,
  Store,
  ShoppingCart,
  FileText,
} from 'lucide-react';
import { navigateToLabel, navigateToSettings, navigateToHelp } from '@/router/navigate';
import { router } from '@/router';
import type { NavRailItem } from './NavRail';
import type { LucideIcon } from 'lucide-react';
import { tabGroups } from '@/features/settings/components/SettingsTabRegistry';

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
export const SECTION_HEADER = '__section__';

/**
 * Flat list of all navigable mail-sidebar items (mail-specific only).
 * Used by SidebarNavEditor and the premium sidebar content panel.
 * Non-mail pages (tasks, calendar, analytics) have their own NavRail groups.
 */
export const ALL_NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'inbox', label: 'nav.inbox', icon: Inbox },
  { id: 'starred', label: 'nav.starred', icon: Star },
  { id: 'snoozed', label: 'nav.snoozed', icon: Clock },
  { id: 'sent', label: 'common.sent', icon: Send },
  { id: 'drafts', label: 'nav.drafts', icon: FileEdit },
  { id: 'trash', label: 'nav.trash', icon: Trash2 },
  { id: 'spam', label: 'nav.spam', icon: Ban },
  { id: 'all', label: 'nav.allMail', icon: Mail },
  { id: 'attachments', label: 'common.attachments', icon: Paperclip },
  { id: 'smart-folders', label: 'nav.smartFolders', icon: FolderSearch },
  { id: 'labels', label: 'nav.labels', icon: Tag },
];

// ─── Settings labels override ────────────────────────────────────────────────
// Some tabs need nav-specific i18n keys; default to `settings.tabs.<id>`.
const SETTINGS_NAV_LABELS: Record<string, string> = {
  pairing: 'settings.devicePairing',
  'deliverability-dashboard': 'settings.tabGroupDeliverability',
  developer: 'common.developer',
  about: 'nav.about',
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
    items.push({ id: '__divider__', label: '', icon: undefined });
  }
  items.pop();
  return items;
}

// ─── Navigation tree ──────────────────────────────────────────────────────────

export const NAV_GROUPS: NavRailGroup[] = [
  {
    id: 'dashboard',
    label: 'nav.dashboard',
    icon: LayoutDashboard,
    items: [],
  },
  {
    id: 'sell',
    label: 'nav.sell',
    icon: Store,
    items: [
      { id: 'pos', label: 'nav.pos', icon: ShoppingCart, path: '/pos' },
      { id: 'invoicing', label: 'common.invoicing', icon: ReceiptText, path: '/invoicing' },
      { id: 'erp', label: 'nav.erp', icon: Calculator, path: '/erp' },
    ],
  },
  {
    id: 'mail',
    icon: Mail,
    label: 'nav.mail',
    items: [
      { id: 'inbox', label: 'nav.inbox', icon: Inbox },
      { id: 'starred', label: 'nav.starred', icon: Star },
      { id: 'snoozed', label: 'nav.snoozed', icon: Clock },
      { id: 'sent', label: 'common.sent', icon: Send },
      { id: 'drafts', label: 'nav.drafts', icon: FileEdit },
      { id: 'trash', label: 'nav.trash', icon: Trash2 },
      { id: 'spam', label: 'nav.spam', icon: Ban },
      { id: 'all', label: 'nav.allMail', icon: Mail },
      // ── divider ──
      { id: '__divider__', label: '', icon: undefined },
      { id: 'attachments', label: 'common.attachments', icon: Paperclip },
      { id: 'smart-folders', label: 'nav.smartFolders', icon: FolderSearch },
      { id: 'labels', label: 'nav.labels', icon: Tag },
    ],
  },
  {
    id: 'crm',
    icon: Users,
    label: 'nav.crm',
    items: [
      { id: 'contacts', label: 'common.contacts', icon: Users, path: '/people' },
      { id: 'deals', label: 'nav.deals', icon: FileText, path: '/people?tab=deals' },
    ],
  },
  {
    id: 'tasks',
    icon: ListChecks,
    label: 'common.schedule',
    items: [
      { id: 'today', label: 'common.today', icon: ListChecks, path: '/tasks' },
      { id: 'upcoming', label: 'nav.tasksUpcoming', icon: Clock, path: '/tasks?view=upcoming' },
      // ── divider ──
      { id: '__divider__', label: '', icon: undefined },
      { id: 'month', label: 'nav.calendarMonth', icon: CalendarDays, path: '/tasks?tab=calendar' },
      {
        id: 'agenda',
        label: 'nav.calendarAgenda',
        icon: CalendarRange,
        path: '/tasks?tab=calendar&view=agenda',
      },
    ],
  },
  {
    id: 'automation',
    icon: GitBranch,
    label: 'common.automation',
    items: [],
  },
  {
    id: 'vault',
    icon: FolderLock,
    label: 'nav.vault',
    items: [],
  },
  {
    id: 'ai-assistant',
    icon: Sparkles,
    label: 'nav.aiAssistant',
    items: [],
  },
  {
    id: 'agent-console',
    icon: Bot,
    label: 'nav.agentConsole',
    items: [],
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'common.settings',
    items: buildSettingsItems(),
  },
  {
    id: 'help',
    icon: HelpCircle,
    label: 'nav.help',
    items: [{ id: 'help-center', label: 'settings.tabs.helpCenter', icon: HelpCircle }],
  },
];

// ─── Contextual Intelligence ──────────────────────────────────────────────────
// Describes what the right "Insights" rail surfaces per top-level section.
// The shell consumes this to render the right context-aware widgets, so every
// page shows "what matters now" for its domain — the unified UX principle.
export type InsightWidget =
  'ai-tasks' | 'today' | 'hot-leads' | 'upcoming' | 'recent' | 'ai-summary';

export const INSIGHT_WIDGETS: Record<string, InsightWidget[]> = {
  mail: ['ai-tasks', 'today', 'hot-leads'],
  crm: ['hot-leads', 'ai-summary', 'upcoming'],
  tasks: ['today', 'upcoming', 'ai-tasks'],
  automation: ['ai-summary', 'recent'],
  vault: ['recent'],
  'ai-assistant': ['ai-summary', 'recent'],
  'agent-console': ['ai-summary', 'recent'],
  dashboard: ['today', 'upcoming', 'hot-leads'],
  sell: ['today', 'upcoming', 'hot-leads'],
  settings: ['recent'],
  help: ['recent'],
};

/** Default insight rail title per section. */
export const INSIGHT_TITLE: Record<string, string> = {
  mail: 'Today',
  crm: 'Relationships',
  tasks: 'My day',
  automation: 'Activity',
  vault: 'Recent',
  'ai-assistant': 'AI',
  'agent-console': 'Agent',
  dashboard: 'Overview',
  sell: 'Sales',
  settings: 'Recent',
  help: 'Recent',
};

/** Backward-compatible NAV_ITEMS derived from groups. */
export const NAV_ITEMS: NavRailItem[] = NAV_GROUPS.map((g) => ({
  id: g.id,
  icon: g.icon,
  label: g.label,
}));

// ─── Route helpers ────────────────────────────────────────────────────────────

export function getActiveNavFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'mail';
  if (pathname.startsWith('/mail')) return 'mail';
  if (pathname.startsWith('/label')) return 'mail';
  if (pathname.startsWith('/smart-folder')) return 'mail';
  if (pathname.startsWith('/people')) return 'crm';
  if (pathname.startsWith('/crm')) return 'crm';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/calendar')) return 'tasks';
  if (pathname.startsWith('/automation')) return 'automation';
  if (pathname.startsWith('/workflows')) return 'automation';
  if (pathname.startsWith('/vault')) return 'vault';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/attachments')) return 'mail';
  if (pathname.startsWith('/unified')) return 'unified';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/invoicing')) return 'sell';
  if (pathname.startsWith('/erp')) return 'sell';
  if (pathname.startsWith('/ai-assistant')) return 'ai-assistant';
  if (pathname.startsWith('/agent-console')) return 'agent-console';
  if (pathname.startsWith('/pos')) return 'sell';
  return 'mail';
}

export function getActiveSubItem(pathname: string, searchStr = ''): string | null {
  if (pathname === '/' || pathname === '') return 'inbox';

  const search = new URLSearchParams(searchStr);
  const view = search.get('view');

  const mailMatch = pathname.match(/^\/mail\/([^/]+)/);
  if (mailMatch) return mailMatch[1]!;

  const labelMatch = pathname.match(/^\/label\/([^/]+)/);
  if (labelMatch) return labelMatch[1]!;

  if (pathname.startsWith('/smart-folder')) return 'smart-folders';

  const settingsMatch = pathname.match(/^\/settings\/([^/]+)/);
  if (settingsMatch) return settingsMatch[1]!;

  if (pathname.startsWith('/people')) return search.get('tab') === 'deals' ? 'deals' : 'contacts';
  if (pathname.startsWith('/crm')) return 'contacts';
  if (pathname.startsWith('/attachments')) return 'attachments';

  if (pathname.startsWith('/dashboard')) return null;
  if (pathname.startsWith('/invoicing')) return 'invoicing';
  if (pathname.startsWith('/erp')) return 'erp';

  const helpMatch = pathname.match(/^\/help\/([^/]+)/);
  if (helpMatch) return helpMatch[1]!;
  if (pathname.startsWith('/help')) return 'help-center';

  if (pathname.startsWith('/tasks')) {
    if (search.get('tab') === 'calendar') return view === 'agenda' ? 'agenda' : 'month';
    return view === 'upcoming' ? 'upcoming' : 'today';
  }
  // Legacy /calendar deep links (redirected to /tasks?tab=calendar).
  if (pathname.startsWith('/calendar')) return view === 'agenda' ? 'agenda' : 'month';
  if (pathname.startsWith('/ai-assistant')) return null;
  if (pathname.startsWith('/agent-console')) return null;
  if (pathname.startsWith('/pos')) return 'pos';

  return null;
}

export function getSubItemsForGroup(groupId: string): NavRailSubItem[] {
  const group = NAV_GROUPS.find((g) => g.id === groupId);
  return group?.items ?? [];
}

// ─── Navigation handlers ──────────────────────────────────────────────────────

/**
 * Navigate to a sub-item `path` like `/people?tab=deals` — splits off the
 * query string and passes it as typed search params instead of raw text.
 */
function navigateToItemPath(path: string): void {
  const [pathname, query] = path.split('?');
  if (!pathname) return;
  if (!query) {
    router.navigate({ to: pathname });
    return;
  }
  router.navigate({ to: pathname, search: Object.fromEntries(new URLSearchParams(query)) });
}

export function handleNavSelect(id: string): void {
  switch (id) {
    case 'mail':
      navigateToLabel('inbox');
      break;
    case 'settings':
      navigateToSettings('general');
      break;
    case 'help':
      navigateToHelp();
      break;
    case 'tasks':
      router.navigate({ to: '/tasks' });
      break;
    case 'sell':
      router.navigate({ to: '/pos' });
      break;
    case 'automation':
      navigateToLabel('automation');
      break;
    case 'workflows':
      navigateToLabel('automation');
      break;
    case 'vault':
      router.navigate({ to: '/vault' });
      break;
    case 'crm':
    case 'people':
      router.navigate({ to: '/people' });
      break;
    case 'dashboard':
      router.navigate({ to: '/dashboard' });
      break;
    case 'ai-assistant':
      router.navigate({ to: '/ai-assistant' });
      break;
    case 'agent-console':
      router.navigate({ to: '/agent-console' });
      break;
    case 'pos':
      router.navigate({ to: '/pos' });
      break;
    default:
      navigateToLabel(id);
      break;
  }
}

export function handleSubItemSelect(groupId: string, subItemId: string): void {
  // Sub-items with a `path` (dashboard, crm, tasks, sell, …) navigate there.
  const item = NAV_GROUPS.find((g) => g.id === groupId)?.items.find((i) => i.id === subItemId);
  if (item?.path) {
    navigateToItemPath(item.path);
    return;
  }

  // Path-less groups resolve through their dedicated helpers.
  switch (groupId) {
    case 'mail':
      navigateToLabel(subItemId);
      break;
    case 'settings':
      navigateToSettings(subItemId);
      break;
    case 'help':
      if (subItemId === 'about') {
        navigateToSettings('about');
      } else {
        navigateToHelp();
      }
      break;
    default:
      break;
  }
}
