import { useMemo } from "react";
import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import type { DbCalendar } from "@features/calendar/db/calendars";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { CalendarDays, ListTodo, Send, Mail } from "lucide-react";
import { type IntegratedItemType } from "./EventCard";

interface AgendaViewProps {
  events: DbCalendarEvent[];
  integratedItems?: any[];
  calendars: DbCalendar[];
  onEventClick: (event: any, type: IntegratedItemType) => void;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

interface AgendaItem {
  item: any;
  type: IntegratedItemType;
  startTime: number;
}

interface EventGroup {
  date: Date;
  dateKey: string;
  items: AgendaItem[];
}

/**
 * Formats a Unix timestamp (seconds) to a local time string.
 */
function formatTime(item: AgendaItem): string {
  if (item.type === 'event' && item.item.is_all_day) return "All day";
  const start = new Date(item.startTime * 1000);
  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (item.type === 'event') {
    const end = new Date(item.item.end_time * 1000);
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  return fmt.format(start);
}

/**
 * Formats a date as a human-readable label.
 */
function formatDateLabel(date: Date): string {
  const today = new Date();
  const todayStr = today.toDateString();
  const dateStr = date.toDateString();

  if (dateStr === todayStr) return "Today";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toDateString()) return "Tomorrow";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns a sortable date-key string (YYYY-MM-DD) from a Unix timestamp.
 */
function toDateKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AgendaView({
  events,
  integratedItems,
  calendars,
  onEventClick,
  onRefresh,
  refreshing = false,
}: AgendaViewProps) {
  // Build a lookup map: calendar_id → DbCalendar (for color)
  const calendarMap = useMemo(() => {
    const map = new Map<string, DbCalendar>();
    for (const cal of calendars) {
      map.set(cal.id, cal);
    }
    return map;
  }, [calendars]);

  // Group events and integrated items by date, sorted chronologically
  const groupedEvents: EventGroup[] = useMemo(() => {
    const groups = new Map<string, AgendaItem[]>();

    const integratedWithType = (integratedItems || []).map(item => {
      let type: IntegratedItemType = 'task';
      let time = 0;
      if ('due_date' in item) { type = 'task'; time = item.due_date; }
      else if ('sent_at' in item) { type = 'campaign'; time = item.sent_at; }
      else if ('scheduled_at' in item) { type = 'scheduled_email'; time = item.scheduled_at; }
      return { item, type, startTime: time };
    });

    const allItems = [
      ...events.map(e => ({ item: e, type: 'event' as const, startTime: e.start_time })),
      ...integratedWithType
    ];

    for (const entry of allItems) {
      if (!entry.startTime) continue;
      const key = toDateKey(entry.startTime);
      const list = groups.get(key) || [];
      list.push(entry);
      groups.set(key, list);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, items]) => ({
        date: new Date(dateKey + "T00:00:00"),
        dateKey,
        items: items.sort((a, b) => a.startTime - b.startTime),
      }));
  }, [events, integratedItems]);

  // ── Empty state ──────────────────────────────────────────────────────
  if (groupedEvents.length === 0) {
    return (
      <div className="flex-1 overflow-auto px-4 pt-12">
        <div className="rounded-2xl bg-white/8 dark:bg-white/5 backdrop-blur-[12px] border border-white/15 dark:border-white/8 p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <CalendarDays size={28} className="text-accent/60" />
          </div>
          <p className="text-text-primary text-sm font-medium">No events</p>
          <p className="text-text-tertiary text-xs mt-2 max-w-[220px] leading-relaxed">
            Tap + to create an event or switch to a different date range
          </p>
        </div>
      </div>
    );
  }

  // ── Event list ───────────────────────────────────────────────────────
  const content = (
    <div className="divide-y divide-border-secondary">
      {groupedEvents.map((group) => (
        <section key={group.dateKey} aria-label={formatDateLabel(group.date)}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm px-4 py-2 border-b border-border-primary">
            <time
              dateTime={group.dateKey}
              className="text-xs font-semibold text-text-secondary uppercase tracking-wider"
            >
              {formatDateLabel(group.date)}
            </time>
          </div>

          {/* Items for this date */}
          <div className="divide-y divide-border-secondary" role="list">
            {group.items.map((entry) => {
              const { item, type } = entry;
              const cal = type === 'event' ? (calendarMap.get(item.calendar_id ?? "") ?? null) : null;

              let color = cal?.color ?? "var(--color-accent)";
              if (type === 'task') color = '#8b5cf6';
              else if (type === 'campaign') color = '#10b981';
              else if (type === 'scheduled_email') color = '#3b82f6';

              const summary = type === 'task' ? item.title
                : type === 'campaign' ? item.name
                : type === 'scheduled_email' ? (item.subject || "(No Subject)")
                : (item.summary || "(No Title)");

              return (
                <button
                  key={`${type}-${item.id}`}
                  onClick={() => onEventClick(item, type)}
                  role="listitem"
                  className="w-full flex items-start gap-3 px-4 py-3.5 min-h-[52px] text-left
                    active:bg-white/10 dark:active:bg-white/5
                    transition-all duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  {/* Icon or color dot */}
                  <div className="mt-1 shrink-0 w-6 flex justify-center" style={{ color }}>
                    {type === 'task' ? <ListTodo size={14} />
                      : type === 'campaign' ? <Send size={14} />
                      : type === 'scheduled_email' ? <Mail size={14} />
                      : <span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ backgroundColor: color }} aria-hidden="true" />}
                  </div>

                  {/* Time range */}
                  <span className="text-xs text-text-tertiary w-[4.5rem] shrink-0 pt-0.5 tabular-nums">
                    {formatTime(entry)}
                  </span>

                  {/* Title */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm text-text-primary font-medium truncate">
                      {summary}
                    </span>
                    {type !== 'event' && (
                      <span className="text-[10px] text-text-tertiary capitalize">
                        {type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  // ── Wrap in PullToRefresh if onRefresh is provided ───────────────────
  if (onRefresh) {
    return (
      <PullToRefresh
        onRefresh={onRefresh}
        refreshing={refreshing}
        className="flex-1 overflow-auto"
      >
        {content}
      </PullToRefresh>
    );
  }

  return <div className="flex-1 overflow-auto">{content}</div>;
}
