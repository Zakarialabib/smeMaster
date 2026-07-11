import { useMemo } from "react";
import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import type { DbCalendar } from "@features/calendar/db/calendars";
import { type IntegratedItemType, EventCard } from "./EventCard";

interface DayViewProps {
  currentDate: Date;
  events: DbCalendarEvent[];
  integratedItems?: any[];
  calendars: DbCalendar[];
  onEventClick: (event: any, type: IntegratedItemType) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({ currentDate, events, integratedItems, calendars, onEventClick }: DayViewProps) {
  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cal of calendars) map.set(cal.id, cal.color ?? "var(--color-accent)");
    return map;
  }, [calendars]);
  const dayStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  // Pre-bucket items by hour (O(E) instead of O(24×E))
  const { hourItems: hourItemMap, allDayItems } = useMemo(() => {
    const hMap = new Map<number, { item: any; type: IntegratedItemType }[]>();
    const allDay: { item: any; type: IntegratedItemType }[] = [];
    const dayTs = dayStart.getTime() / 1000;

    const integratedWithType = (integratedItems || []).map(item => {
      let type: IntegratedItemType = 'task';
      let time = 0;
      if ('due_date' in item) { type = 'task'; time = item.due_date; }
      else if ('sent_at' in item) { type = 'campaign'; time = item.sent_at; }
      else if ('scheduled_at' in item) { type = 'scheduled_email'; time = item.scheduled_at; }
      return { item, type, startTime: time, endTime: time, is_all_day: false };
    });

    const allSources = [
      ...events.map(e => ({ item: e, type: 'event' as const, startTime: e.start_time, endTime: e.end_time, is_all_day: e.is_all_day })),
      ...integratedWithType
    ];

    for (const entry of allSources) {
      if (entry.is_all_day) {
        allDay.push({ item: entry.item, type: entry.type });
      } else {
        for (const hour of HOURS) {
          const hStart = dayTs + hour * 3600;
          const hEnd = hStart + 3600;
          if (entry.startTime < hEnd && entry.startTime >= hStart) {
            const list = hMap.get(hour) || [];
            list.push({ item: entry.item, type: entry.type });
            hMap.set(hour, list);
          }
        }
      }
    }

    return { hourItems: hMap, allDayItems: allDay };
  }, [events, integratedItems, dayStart]);
  const isToday = new Date().toDateString() === currentDate.toDateString();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border-primary flex items-center gap-3 shrink-0">
        <div className={`text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full ${
          isToday ? "bg-accent text-white" : "text-text-primary"
        }`}>
          {currentDate.getDate()}
        </div>
        <div className="text-sm text-text-secondary">
          {currentDate.toLocaleDateString(undefined, { weekday: "long" })}
        </div>
      </div>

      {/* All-day events */}
      {allDayItems.length > 0 && (
        <div className="px-6 py-2 border-b border-border-secondary space-y-1">
          {allDayItems.map(({ item, type }) => (
            <EventCard
              key={`${type}-${item.id}`}
              event={item}
              type={type}
              calendarColor={type === 'event' ? calendarColorMap.get(item.calendar_id ?? "") : undefined}
              onClick={() => onEventClick(item, type)}
            />
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourItems = hourItemMap.get(hour) ?? [];
          return (
            <div key={hour} className="flex border-b border-border-secondary h-min min-h-[3.5rem] py-1">
              <div className="w-16 shrink-0 px-2 flex items-start justify-end -mt-1.5">
                <span className="text-[0.625rem] text-text-tertiary">
                  {hour === 0 ? "" : `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`}
                </span>
              </div>
              <div className="flex-1 space-y-1 px-1">
                {hourItems.map(({ item, type }) => (
                  <EventCard
                    key={`${type}-${item.id}`}
                    event={item}
                    type={type}
                    calendarColor={type === 'event' ? calendarColorMap.get(item.calendar_id ?? "") : undefined}
                    onClick={() => onEventClick(item, type)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

