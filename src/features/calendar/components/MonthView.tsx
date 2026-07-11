import { useMemo } from "react";
import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import type { DbCalendar } from "@features/calendar/db/calendars";
import { EventCard, type IntegratedItemType } from "./EventCard";

interface MonthViewProps {
  currentDate: Date;
  events: DbCalendarEvent[];
  integratedItems?: any[];
  calendars: DbCalendar[];
  onEventClick: (event: any, type: IntegratedItemType) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({ currentDate, events, integratedItems, calendars, onEventClick }: MonthViewProps) {
  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cal of calendars) map.set(cal.id, cal.color ?? "var(--color-accent)");
    return map;
  }, [calendars]);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Build grid of weeks
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Pre-bucket events by day (O(E×D) → O(E)) instead of filtering per cell
  const itemsByDay = useMemo(() => {
    const map = new Map<number, { item: any; type: IntegratedItemType }[]>();
    for (let d = 1; d <= totalDays; d++) {
      const dayStart = new Date(year, month, d).getTime() / 1000;
      const dayEnd = new Date(year, month, d + 1).getTime() / 1000;

      const dayEvents = events
        .filter((e) => e.start_time < dayEnd && e.end_time > dayStart)
        .map(e => ({ item: e, type: 'event' as const }));

      const dayIntegrated = (integratedItems || [])
        .map(item => {
          let type: IntegratedItemType = 'task';
          let time = 0;
          if ('due_date' in item) { type = 'task'; time = item.due_date; }
          else if ('sent_at' in item) { type = 'campaign'; time = item.sent_at; }
          else if ('scheduled_at' in item) { type = 'scheduled_email'; time = item.scheduled_at; }
          return { item, type, time };
        })
        .filter(i => i.time && i.time >= dayStart && i.time < dayEnd)
        .map(({ item, type }) => ({ item, type }));

      const allItems = [...dayEvents, ...dayIntegrated];
      if (allItems.length > 0) map.set(d, allItems);
    }
    return map;
  }, [events, integratedItems, year, month, totalDays]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-primary">
        {DAY_NAMES.map((name) => (
          <div key={name} className="px-2 py-2 text-xs font-medium text-text-tertiary text-center">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="calendar-grid grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="border-b border-r border-border-secondary bg-bg-tertiary/30" />;
          }
          const isToday = `${year}-${month}-${day}` === todayStr;
          const dayItems = itemsByDay.get(day) ?? [];

          return (
            <div
              key={day}
              className="calendar-cell border-b border-r border-border-secondary p-1 min-h-[80px]"
            >
              <div className={`text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? "bg-accent text-white" : "text-text-secondary"
              }`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 4).map(({ item, type }) => (
                  <EventCard
                    key={`${type}-${item.id}`}
                    event={item}
                    type={type}
                    compact
                    calendarColor={type === 'event' ? calendarColorMap.get(item.calendar_id ?? "") : undefined}
                    onClick={() => onEventClick(item, type)}
                  />
                ))}
                {dayItems.length > 4 && (
                  <div className="text-[0.625rem] text-text-tertiary pl-1">
                    +{dayItems.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

