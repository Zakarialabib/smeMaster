import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import { ListTodo, Send, Mail } from "lucide-react";

export type IntegratedItemType = 'task' | 'campaign' | 'scheduled_email' | 'event';

interface EventCardProps {
  event: DbCalendarEvent | any;
  type?: IntegratedItemType;
  compact?: boolean;
  calendarColor?: string;
  onClick?: () => void;
}

export function EventCard({ event, type = 'event', compact, calendarColor, onClick }: EventCardProps) {
  const getStartTime = () => {
    if (type === 'task') return event.due_date;
    if (type === 'campaign') return event.sent_at;
    if (type === 'scheduled_email') return event.scheduled_at;
    return event.start_time;
  };

  const startTime = getStartTime();
  const startDate = new Date(startTime * 1000);
  const timeStr = event.is_all_day
    ? "All day"
    : startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const getSummary = () => {
    if (type === 'task') return event.title;
    if (type === 'campaign') return event.name;
    if (type === 'scheduled_email') return event.subject || "(No Subject)";
    return event.summary || "(No Title)";
  };

  const summary = getSummary();

  const getTypeIcon = () => {
    if (type === 'task') return <ListTodo size={compact ? 10 : 12} />;
    if (type === 'campaign') return <Send size={compact ? 10 : 12} />;
    if (type === 'scheduled_email') return <Mail size={compact ? 10 : 12} />;
    return null;
  };

  const getTypeColor = () => {
    if (type === 'task') return '#8b5cf6'; // Violet
    if (type === 'campaign') return '#10b981'; // Emerald
    if (type === 'scheduled_email') return '#3b82f6'; // Blue
    return calendarColor || "var(--color-accent)";
  };

  const bgColor = getTypeColor();

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left text-[0.625rem] px-1 py-0.5 rounded truncate hover:opacity-80 transition-all flex items-center gap-1"
        style={{
          backgroundColor: `${bgColor}18`,
          color: bgColor,
        }}
        title={summary}
      >
        <span className="shrink-0 flex items-center">
          {getTypeIcon() || (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: bgColor }}
            />
          )}
        </span>
        <span className="truncate">{summary}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-md border border-border-secondary hover:bg-bg-hover transition-colors"
    >
      <div className="flex items-start gap-2">
        <div
          className="w-1 h-full min-h-[24px] rounded-full shrink-0"
          style={{ backgroundColor: bgColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span style={{ color: bgColor }}>{getTypeIcon()}</span>
            <div className="text-sm font-medium text-text-primary truncate">
              {summary}
            </div>
          </div>
          <div className="text-xs text-text-tertiary flex items-center gap-1.5">
            {!getTypeIcon() && calendarColor && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: bgColor }}
              />
            )}
            <span>{timeStr}</span>
            {event.location && (
              <>
                <span className="text-text-tertiary/50">·</span>
                <span className="truncate">{event.location}</span>
              </>
            )}
            {type !== 'event' && (
              <>
                <span className="text-text-tertiary/50">·</span>
                <span className="capitalize">{type.replace('_', ' ')}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

