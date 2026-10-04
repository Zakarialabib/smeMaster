import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Mail,
  Users,
  ListChecks,
  CalendarDays,
  Zap,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Loader2,
  LayoutDashboard,
} from 'lucide-react';
import {
  useLiveThreads,
  useLiveContacts,
  type Thread,
  type Contact,
} from '@shared/services/db/liveQueries';
import { useTaskStore } from '@features/tasks/stores/taskStore';
import { useAccountStore } from '@features/accounts/stores/accountStore';
import { useLiveQuery } from '@shared/hooks/useLiveQuery';
import { invokeCommand } from '@shared/services/db/invoke/command';
import { Avatar } from '@shared/components/ui/Avatar';
import { AiSuggestionBanner } from '@shared/components/ui/AiSuggestionBanner';
import { WidgetHeader } from './WidgetHelpers';
import { formatRelativeDate } from '@shared/utils/date';
import { ACTIVE_COMPANY_ID } from '@shared/constants/company';
import {
  detectMailActions,
  detectTaskRisks,
  latestContacts,
  latestThreads,
  AI_CHECK_LIMIT,
  type InsightItem,
} from './workspaceInsights';

type SectionId = 'mail' | 'people' | 'tasks' | 'calendar' | 'automation';

interface WorkflowRuleRow {
  id: string;
  name?: string | null;
  trigger_event?: string | null;
  is_active?: number | null;
}

const SECTION_META: {
  id: SectionId;
  label: string;
  icon: typeof Mail;
  to: string;
}[] = [
  { id: 'mail', label: 'Mail', icon: Mail, to: '/mail/inbox' },
  { id: 'people', label: 'People', icon: Users, to: '/people' },
  { id: 'tasks', label: 'Tasks', icon: ListChecks, to: '/tasks' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, to: '/calendar' },
  { id: 'automation', label: 'Automation', icon: Zap, to: '/automation' },
];

const PREVIEW_COUNT = 5;

function Row({
  primary,
  sub,
  unread = false,
  avatarName,
}: {
  primary: string;
  sub?: string;
  unread?: boolean;
  avatarName?: string;
}) {
  return (
    <li className="flex items-center gap-2.5 px-1 py-1.5">
      {avatarName !== undefined ? (
        <Avatar name={avatarName} size="sm" />
      ) : (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-border-primary'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${unread ? 'font-semibold text-text-primary' : 'text-text-primary'}`}
        >
          {primary}
        </p>
        {sub && <p className="truncate text-xs text-text-tertiary">{sub}</p>}
      </div>
    </li>
  );
}

/**
 * Unified Workspace — consolidated into the dashboard (was `/unified`).
 *
 * An accordion of the five workspace sections. Each section previews its
 * latest 5 items (no big lists) with a "View all" link to the full view.
 * The AI check is ON DEMAND: the header button scans live mail + tasks and
 * reports real findings — nothing is shown until the user asks.
 */
export function UnifiedWorkspace() {
  const [openSection, setOpenSection] = useState<SectionId | null>('mail');
  const [checking, setChecking] = useState(false);
  const [insights, setInsights] = useState<InsightItem[] | null>(null);
  const [allClear, setAllClear] = useState(false);

  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const threadsQ = useLiveThreads(activeAccountId);
  const contactsQ = useLiveContacts();
  const tasks = useTaskStore((s) => s.tasks);
  const eventsQ = useLiveQuery<any[]>(
    () => invokeCommand<any[]>('db_list_events').catch(() => []),
    { watch: ['calendar_events'] },
  );
  const rulesQ = useLiveQuery<WorkflowRuleRow[]>(
    () =>
      invokeCommand<WorkflowRuleRow[]>('db_list_workflow_rules', {
        companyId: ACTIVE_COMPANY_ID,
      }).catch(() => []),
    { watch: ['workflow_rules'] },
  );

  const threads = useMemo(() => threadsQ.data ?? [], [threadsQ.data]);
  const contacts = useMemo(() => contactsQ.data ?? [], [contactsQ.data]);
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const rules = useMemo(() => rulesQ.data ?? [], [rulesQ.data]);

  const unreadTotal = useMemo(
    () => threads.reduce((n, t) => n + (t.unread_count > 0 ? 1 : 0), 0),
    [threads],
  );
  const incompleteTasks = useMemo(() => tasks.filter((t) => !t.is_completed).length, [tasks]);

  const counts: Record<SectionId, number> = {
    mail: threads.length,
    people: contacts.length,
    tasks: incompleteTasks,
    calendar: events.length,
    automation: rules.length,
  };

  function runAiCheck() {
    setChecking(true);
    setAllClear(false);
    // Let the button paint its busy state before the (synchronous) scan.
    setTimeout(() => {
      try {
        const found = [
          ...detectMailActions(threads, AI_CHECK_LIMIT),
          ...detectTaskRisks(tasks, Date.now(), AI_CHECK_LIMIT),
        ].slice(0, AI_CHECK_LIMIT);
        setInsights(found);
        setAllClear(found.length === 0);
      } finally {
        setChecking(false);
      }
    }, 30);
  }

  function renderPreview(id: SectionId) {
    switch (id) {
      case 'mail': {
        const rows = latestThreads(threads, PREVIEW_COUNT);
        if (rows.length === 0) return <Empty label="No emails" />;
        return (
          <ul className="divide-y divide-border-secondary/60">
            {rows.map((t: Thread) => (
              <Row
                key={t.id}
                primary={t.subject || '(No subject)'}
                sub={formatRelativeDate(new Date(t.last_message_at).getTime())}
                unread={t.unread_count > 0}
              />
            ))}
          </ul>
        );
      }
      case 'people': {
        const rows = latestContacts(contacts, PREVIEW_COUNT);
        if (rows.length === 0) return <Empty label="No contacts yet" />;
        return (
          <ul className="divide-y divide-border-secondary/60">
            {rows.map((c: Contact) => (
              <Row
                key={c.id}
                primary={c.display_name || c.email}
                sub={c.company ?? c.email}
                avatarName={c.display_name || c.email}
              />
            ))}
          </ul>
        );
      }
      case 'tasks': {
        const rows = tasks.filter((t) => !t.is_completed).slice(0, PREVIEW_COUNT);
        if (rows.length === 0) return <Empty label="No open tasks" />;
        return (
          <ul className="divide-y divide-border-secondary/60">
            {rows.map((t) => (
              <Row
                key={t.id}
                primary={t.title}
                sub={
                  t.due_date ? formatRelativeDate(t.due_date * 1000) : (t.priority ?? 'no priority')
                }
              />
            ))}
          </ul>
        );
      }
      case 'calendar': {
        const rows = events.slice(0, PREVIEW_COUNT);
        if (rows.length === 0) return <Empty label="No upcoming events" />;
        return (
          <ul className="divide-y divide-border-secondary/60">
            {rows.map((e, i) => (
              <Row
                key={e.id ?? i}
                primary={e.title ?? '(No title)'}
                sub={e.start_time?.slice(0, 16).replace('T', ' ') ?? ''}
              />
            ))}
          </ul>
        );
      }
      case 'automation': {
        const rows = rules.slice(0, PREVIEW_COUNT);
        if (rows.length === 0) return <Empty label="No rules yet" />;
        return (
          <ul className="divide-y divide-border-secondary/60">
            {rows.map((r) => (
              <Row
                key={r.id}
                primary={r.name || 'Untitled rule'}
                sub={`${r.trigger_event ?? 'manual'} · ${r.is_active ? 'active' : 'paused'}`}
              />
            ))}
          </ul>
        );
      }
    }
  }

  return (
    <section aria-label="Unified workspace" className="flex min-h-0 flex-col">
      {/* Header: shared widget title + on-demand AI check */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <WidgetHeader icon={<LayoutDashboard size={16} />} title="Unified Workspace" />
        <button
          type="button"
          onClick={runAiCheck}
          disabled={checking}
          className="-mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ai transition-colors hover:bg-ai/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai disabled:opacity-50"
        >
          {checking ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={14} aria-hidden="true" />
          )}
          {checking ? 'Checking…' : 'Check with AI'}
        </button>
      </div>

      {/* On-demand findings — real scan results, never static content */}
      {insights !== null && insights.length > 0 && (
        <div className="mb-2">
          <AiSuggestionBanner
            suggestion={{
              id: 'workspace-check',
              title: 'Needs your attention',
              description: 'Found by scanning your latest mail and tasks.',
              count: insights.length,
              type: 'custom',
            }}
            items={insights.map((i) => ({ id: i.id, title: i.title, source: i.source }))}
            onDismiss={() => setInsights(null)}
            variant="info"
          />
        </div>
      )}
      {allClear && insights !== null && insights.length === 0 && (
        <p role="status" className="mb-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
          All clear — no urgent mail or overdue tasks found.
        </p>
      )}

      {/* Accordion sections */}
      <div className="divide-y divide-border-secondary/70 rounded-xl border border-border-secondary/70">
        {SECTION_META.map((s) => {
          const Icon = s.icon;
          const open = openSection === s.id;
          const count = counts[s.id];
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => setOpenSection(open ? null : s.id)}
                aria-expanded={open}
                aria-controls={`workspace-panel-${s.id}`}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-bg-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="flex-1 text-sm font-medium text-text-primary">{s.label}</span>
                {s.id === 'mail' && unreadTotal > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
                    {unreadTotal}
                  </span>
                )}
                {count > 0 && s.id !== 'mail' && (
                  <span className="rounded-full bg-bg-tertiary px-1.5 py-0.5 text-[0.625rem] font-semibold text-text-secondary">
                    {count}
                  </span>
                )}
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {open && (
                <div
                  id={`workspace-panel-${s.id}`}
                  className="border-t border-border-secondary/60 px-3 py-1.5"
                >
                  {renderPreview(s.id)}
                  <div className="flex justify-end py-1.5">
                    <Link
                      to={s.to}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      View all
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-1 py-3 text-center text-xs text-text-tertiary">{label}</p>;
}
