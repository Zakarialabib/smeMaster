import {
  Mail,
  Users,
  CheckSquare,
  FileText,
  Megaphone,
  Workflow,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import {
  getUnreadInboxCount,
  getThreadCount,
  dashboardContactsTotal,
  dashboardContactsNewWeek,
  dashboardTasksDueToday,
  dashboardTasksOverdue,
  listInvoices,
  dashboardCampaignsTotal,
  dashboardCampaignsSent,
  dashboardWorkflowRulesTotal,
  dashboardWorkflowRulesActive,
  listCalendarEvents,
} from "@shared/services/db/db-invoke";
import { ACTIVE_COMPANY_ID } from "@shared/constants/company";
import type { SectionAccent, SectionStat } from "../components/SectionCard";

/**
 * Static "menu console" configuration for the dashboard section cards.
 *
 * Each entry declares its section route, icon, i18n keys, accent, and a
 * stat skeleton (`value: null` → rendered as "—" until values arrive).
 * `fetchValues()` resolves the numbers using EXISTING db-invoke wrappers —
 * zero SQL in TypeScript, zero invented IPC commands. Every value is
 * defensively coerced: a non-finite number (or a failed/absent backend)
 * becomes `null`, which SectionCard renders as "—".
 *
 * `fetchValues` receives an `accountId` context for the rare command that
 * needs one (thread counts); everything else is account-agnostic or uses
 * the shared ACTIVE_COMPANY_ID constant.
 */

export interface SectionFetchContext {
  accountId: string | null;
}

export interface SectionCardConfig {
  id: string;
  /** Router path (hash history) the card navigates to. */
  to: string;
  icon: LucideIcon;
  /** i18n key — card title. */
  titleKey: string;
  /** i18n key — "what is this section" description (slide-over). */
  descriptionKey: string;
  accent: SectionAccent;
  /** i18n key for an optional pill badge. */
  badgeKey?: string;
  /** Stat skeletons — `value` is filled by `fetchValues` (index-aligned). */
  stats: SectionStat[];
  /**
   * Resolves one value per entry in `stats`, in the same order.
   * Never throws — failures resolve to `null` (rendered as "—").
   */
  fetchValues: (ctx: SectionFetchContext) => Promise<Array<string | number | null>>;
}

/** Coerce an IPC result to a finite number, else null (→ "—" placeholder). */
async function safeNum(promise: Promise<unknown>): Promise<number | null> {
  try {
    const value = await promise;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Coerce an IPC result to an array, else null (caller shows "—"). */
async function safeArray<T>(promise: Promise<T[]>): Promise<T[] | null> {
  try {
    const value = await promise;
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export const SECTION_CARDS: SectionCardConfig[] = [
  {
    id: "emails",
    to: "/mail/inbox",
    icon: Mail,
    titleKey: "dashboard.sections.emails.title",
    descriptionKey: "dashboard.sections.emails.description",
    accent: "accent",
    stats: [
      { label: "dashboard.cards.stat.unread", value: null },
      { label: "dashboard.cards.stat.threads", value: null },
    ],
    fetchValues: async ({ accountId }) => {
      const [unread, threads] = await Promise.all([
        safeNum(getUnreadInboxCount()),
        accountId ? safeNum(getThreadCount(accountId)) : Promise.resolve(null),
      ]);
      return [unread, threads];
    },
  },
  {
    id: "people",
    to: "/people",
    icon: Users,
    titleKey: "dashboard.sections.people.title",
    descriptionKey: "dashboard.sections.people.description",
    accent: "success",
    stats: [
      { label: "dashboard.cards.stat.total", value: null },
      { label: "dashboard.cards.stat.newWeek", value: null },
    ],
    fetchValues: async () => {
      const [total, newWeek] = await Promise.all([
        safeNum(dashboardContactsTotal()),
        safeNum(dashboardContactsNewWeek()),
      ]);
      return [total, newWeek];
    },
  },
  {
    id: "tasks",
    to: "/tasks",
    icon: CheckSquare,
    titleKey: "dashboard.sections.tasks.title",
    descriptionKey: "dashboard.sections.tasks.description",
    accent: "warning",
    stats: [
      { label: "dashboard.cards.stat.dueToday", value: null, variant: "warning" },
      { label: "dashboard.cards.stat.overdue", value: null, variant: "danger" },
    ],
    fetchValues: async () => {
      const [dueToday, overdue] = await Promise.all([
        safeNum(dashboardTasksDueToday()),
        safeNum(dashboardTasksOverdue()),
      ]);
      return [dueToday, overdue];
    },
  },
  {
    id: "invoicing",
    to: "/invoicing",
    icon: FileText,
    titleKey: "dashboard.sections.invoicing.title",
    descriptionKey: "dashboard.sections.invoicing.description",
    accent: "danger",
    stats: [
      { label: "dashboard.cards.stat.unpaid", value: null, variant: "warning" },
      { label: "dashboard.cards.stat.total", value: null },
    ],
    fetchValues: async () => {
      const invoices = await safeArray(listInvoices(ACTIVE_COMPANY_ID));
      if (!invoices) return [null, null];
      const unpaid = invoices.filter(
        (i) => i.status !== "paid" && i.status !== "cancelled",
      ).length;
      return [unpaid, invoices.length];
    },
  },
  {
    id: "campaigns",
    to: "/campaigns",
    icon: Megaphone,
    titleKey: "dashboard.sections.campaigns.title",
    descriptionKey: "dashboard.sections.campaigns.description",
    accent: "accent",
    stats: [
      { label: "dashboard.cards.stat.total", value: null },
      { label: "dashboard.cards.stat.sent", value: null },
    ],
    fetchValues: async () => {
      const [total, sent] = await Promise.all([
        safeNum(dashboardCampaignsTotal()),
        safeNum(dashboardCampaignsSent()),
      ]);
      return [total, sent];
    },
  },
  {
    id: "automation",
    to: "/automation",
    icon: Workflow,
    titleKey: "dashboard.sections.automation.title",
    descriptionKey: "dashboard.sections.automation.description",
    accent: "success",
    stats: [
      { label: "dashboard.cards.stat.rules", value: null },
      { label: "dashboard.cards.stat.active", value: null },
    ],
    fetchValues: async () => {
      const [rules, active] = await Promise.all([
        safeNum(dashboardWorkflowRulesTotal()),
        safeNum(dashboardWorkflowRulesActive()),
      ]);
      return [rules, active];
    },
  },
  {
    id: "calendar",
    to: "/calendar",
    icon: CalendarDays,
    titleKey: "dashboard.sections.calendar.title",
    descriptionKey: "dashboard.sections.calendar.description",
    accent: "warning",
    stats: [{ label: "dashboard.cards.stat.eventsToday", value: null }],
    fetchValues: async () => {
      // Bounded to today — calendar times are epoch seconds (schema.ts).
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const events = await safeArray(
        listCalendarEvents(
          ACTIVE_COMPANY_ID,
          null,
          Math.floor(start.getTime() / 1000),
          Math.ceil(end.getTime() / 1000),
        ),
      );
      return [events ? events.length : null];
    },
  },
];
