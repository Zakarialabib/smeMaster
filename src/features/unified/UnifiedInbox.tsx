import { useMemo, useState } from "react";
import { useLiveThreads, useLiveContacts, type Thread, type Contact } from "@shared/services/db/liveQueries";
import { useTaskStore } from "@features/tasks/stores/taskStore";
import { useLiveQuery } from "@shared/hooks/useLiveQuery";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { Avatar } from "@shared/components/ui/Avatar";
import { AiSuggestionBanner, type AiSuggestionItem } from "@shared/components/ui/AiSuggestionBanner";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { formatRelativeDate } from "@shared/utils/date";
import { Mail, Users, ListChecks, CalendarDays, Zap, Plus, Search } from "lucide-react";

type Section = "mail" | "people" | "tasks" | "calendar" | "automation";

const SECTIONS: { id: Section; label: string; icon: typeof Mail }[] = [
  { id: "mail", label: "Mail", icon: Mail },
  { id: "people", label: "People", icon: Users },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "automation", label: "Automation", icon: Zap },
];

function initial(name?: string | null, fallback = "?") {
  return (name?.trim()?.[0] ?? fallback).toUpperCase();
}

/**
 * Unified Inbox — SMEMaster.
 * One workspace that consolidates Mail, People, Tasks and Calendar behind a
 * top navigation, with a "Today" insight column whose AI suggestion changes
 * per active section. All lists share the same DataTable grammar (columns are
 * config vars). Wired to the real data layer (live queries + task store).
 */
export function UnifiedInbox() {
  const [section, setSection] = useState<Section>("mail");
  const [aiDismissed, setAiDismissed] = useState<Record<Section, boolean>>({
    mail: false, people: false, tasks: false, calendar: false, automation: false,
  });

  const threadsQ = useLiveThreads();
  const contactsQ = useLiveContacts();
  const tasks = useTaskStore((s) => s.tasks);
  const eventsQ = useLiveQuery<any[]>(
    () => invokeCommand<any[]>("db_list_events").catch(() => []),
    { watch: ["calendar_events"], enabled: section === "calendar" },
  );

  const threads = threadsQ.data ?? [];
  const contacts = contactsQ.data ?? [];
  const events = eventsQ.data ?? [];

  const dismissAi = () => setAiDismissed((d) => ({ ...d, [section]: true }));
  const resetAi = () => setAiDismissed((d) => ({ ...d, [section]: false }));

  // ── Section-aware AI suggestion ──────────────────────────────────────
  const ai = useMemo<{ suggestion: Parameters<typeof AiSuggestionBanner>[0]["suggestion"]; items?: AiSuggestionItem[]; cta: string }>(() => {
    switch (section) {
      case "mail":
        return {
          suggestion: { id: "ai-mail", title: "AI Task Detection", description: "We spotted action items in your recent emails — review and turn them into tasks in one tap.", count: 3, type: "task" },
          items: [
            { id: "t1", title: "Send Q3 proposal draft", source: "from John Davis" },
            { id: "t2", title: "Book demo with Best Foods", source: "from Mike Brown" },
            { id: "t3", title: "Renew DGI VAT receipt", source: "from Automation" },
          ],
          cta: "Review & convert to tasks",
        };
      case "people":
        return {
          suggestion: { id: "ai-people", title: "AI found 2 hot leads", description: "These contacts show buying intent — start a conversation now.", count: 2, type: "contact" },
          items: [
            { id: "c1", title: "Sarah Douiri", source: "opened 3 proposals" },
            { id: "c2", title: "Youssef Karam", source: "replied to quote" },
          ],
          cta: "Create deals",
        };
      case "tasks":
        return {
          suggestion: { id: "ai-tasks", title: "AI turned 3 emails into tasks", description: "Auto-captured from your inbox so nothing slips.", count: 3, type: "task" },
          items: [
            { id: "k1", title: "Send Q3 proposal", source: "email" },
            { id: "k2", title: "Book Best Foods demo", source: "email" },
            { id: "k3", title: "VAT receipt renewal", source: "email" },
          ],
          cta: "Review tasks",
        };
      case "calendar":
        return {
          suggestion: { id: "ai-cal", title: "AI prioritized your day", description: "Two meetings need prep before they start.", count: 2, type: "custom" },
          items: [
            { id: "e1", title: "Best Foods demo", source: "10:00" },
            { id: "e2", title: "Q3 proposal review", source: "14:30" },
          ],
          cta: "Open agenda",
        };
      default:
        return {
          suggestion: { id: "ai-auto", title: "Generate a workflow with AI", description: "Describe a trigger and action in plain language.", count: 0, type: "custom" },
          cta: "Generate",
        };
    }
  }, [section]);

  // ── Columns per section (vars: every column is a config object) ──────
  const mailCols: DataTableColumn<Thread>[] = [
    { id: "from", header: "From", cell: (t) => <span className="font-medium text-text-primary">{t.subject || "(No subject)"}</span> },
    { id: "preview", header: "Preview", cell: (t) => <span className="text-text-tertiary truncate">{formatRelativeDate(new Date(t.last_message_at).getTime())}</span> },
    { id: "unread", header: "Status", align: "end", cell: (t) => t.unread_count > 0 ? <span className="text-xs font-semibold text-accent">Unread</span> : <span className="text-xs text-text-tertiary">Read</span> },
  ];

  const peopleCols: DataTableColumn<Contact>[] = [
    { id: "name", header: "Name", cell: (c) => <span className="flex items-center gap-2"><Avatar name={c.display_name || c.email} size="sm" /> <span className="font-medium text-text-primary truncate">{c.display_name || c.email}</span></span> },
    { id: "company", header: "Company", cell: (c) => <span className="text-text-secondary truncate">{c.company ?? "—"}</span> },
    { id: "tags", header: "Tags", cell: (c) => <span className="text-xs text-text-tertiary truncate">{(c.tags ?? []).join(", ") || "—"}</span> },
  ];

  const taskCols: DataTableColumn<{ id: string; title: string; priority?: string; is_completed: number }>[] = [
    { id: "done", header: "", width: "32px", cell: (t) => <span className={t.is_completed ? "text-success" : "text-text-tertiary"}>{t.is_completed ? "✓" : "○"}</span> },
    { id: "title", header: "Task", cell: (t) => <span className={t.is_completed ? "text-text-tertiary line-through" : "text-text-primary font-medium"}>{t.title}</span> },
    { id: "priority", header: "Priority", align: "end", cell: (t) => <span className="text-xs text-text-tertiary capitalize">{t.priority ?? "none"}</span> },
  ];

  const calCols: DataTableColumn<any>[] = [
    { id: "time", header: "Time", width: "90px", cell: (e) => <span className="text-accent font-medium">{e.start_time?.slice(11, 16) ?? "—"}</span> },
    { id: "title", header: "Event", cell: (e) => <span className="text-text-primary font-medium truncate">{e.title ?? "(No title)"}</span> },
  ];

  return (
    <div className="unified-inbox flex flex-col h-full bg-bg-primary text-text-primary">
      {/* TOP NAVIGATION (replaces left sidebar) */}
      <header className="unified-topnav flex items-center gap-2 px-4 py-2.5 border-b border-border-secondary bg-bg-secondary/60 backdrop-blur shrink-0">
        <div className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center font-bold mr-2">S</div>
        <nav className="flex items-center gap-1" role="tablist" aria-label="Unified sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-hover"
                }`}
              >
                <Icon size={16} /> {s.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 bg-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-tertiary w-64">
            <Search size={14} /> <span className="truncate">Search… from: to: has:att</span>
          </div>
          <button className="flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-accent-hover">
            <Plus size={15} /> New
          </button>
        </div>
      </header>

      {/* BODY: primary + insight column */}
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 overflow-auto p-4">
          {!aiDismissed[section] && (
            <div className="mb-4">
              <AiSuggestionBanner
                suggestion={ai.suggestion}
                items={ai.items}
                onReview={resetAi}
                onDismiss={dismissAi}
                variant="info"
              />
            </div>
          )}

          {section === "mail" && (
            <DataTable columns={mailCols} rows={threads ?? []} empty={<Empty label="No emails" />} />
          )}
          {section === "people" && (
            <DataTable columns={peopleCols} rows={contacts ?? []} empty={<Empty label="No contacts yet" />} />
          )}
          {section === "tasks" && (
            <DataTable columns={taskCols} rows={tasks} rowKey={(t) => t.id} empty={<Empty label="No tasks" />} />
          )}
          {section === "calendar" && (
            <DataTable columns={calCols} rows={events ?? []} empty={<Empty label="No events — connect a calendar" />} />
          )}
          {section === "automation" && (
            <div className="unified-table-empty text-text-tertiary">Workflows & rules live in the Automation section.</div>
          )}
        </main>

        {/* RIGHT "TODAY" INSIGHT COLUMN */}
        <aside className="w-80 shrink-0 border-l border-border-secondary bg-bg-secondary/40 overflow-auto p-4 hidden lg:block">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Today</h2>
          <MiniList title="Mail" items={threads.slice(0, 3).map((t) => ({ icon: initial(t.subject), label: t.subject || "(No subject)", sub: formatRelativeDate(new Date(t.last_message_at).getTime()) }))} />
          <MiniList title="People" items={(contacts ?? []).slice(0, 3).map((c) => ({ icon: initial(c.display_name || c.email), label: c.display_name || c.email, sub: c.company ?? "" }))} />
          <MiniList title="Tasks" items={tasks.slice(0, 3).map((t) => ({ icon: t.is_completed ? "✓" : "○", label: t.title, sub: t.priority ?? "" }))} />
          <MiniList title="Calendar" items={(events ?? []).slice(0, 3).map((e) => ({ icon: (e.start_time ?? "—").slice(11, 16), label: e.title ?? "(No title)", sub: "" }))} />
        </aside>
      </div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: { icon: string; label: string; sub: string }[] }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-col gap-1">
        {items.length === 0 && <p className="text-xs text-text-tertiary">—</p>}
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover">
            <span className="w-6 h-6 rounded-full bg-accent/15 text-accent grid place-items-center text-xs font-semibold shrink-0">{it.icon.slice(0, 1)}</span>
            <div className="min-w-0">
              <p className="text-sm text-text-primary truncate">{it.label}</p>
              {it.sub && <p className="text-xs text-text-tertiary truncate">{it.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center text-text-tertiary text-sm py-10">{label}</div>;
}
