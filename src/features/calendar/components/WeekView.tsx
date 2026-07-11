import { useMemo } from "react";
import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import type { DbCalendar } from "@features/calendar/db/calendars";
import { type IntegratedItemType, EventCard } from "./EventCard";

interface WeekViewProps {
  currentDate: Date;
  events: DbCalendarEvent[];
  integratedItems?: any[];
  calendars: DbCalendar[];
  onEventClick: (event: any, type: IntegratedItemType) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekView({ currentDate, events, integratedItems, calendars, onEventClick }: WeekViewProps) {
  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cal of calendars) map.set(cal.id, cal.color ?? "var(--color-accent)");
    return map;
  }, [calendars]);
  const weekStart = new Date(currentDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();
  const todayStr = today.toDateString();

  // Pre-bucket items by day+hour and all-day per day (O(E) instead of O(168×E))
  const { dayHourItems, allDayByDay } = useMemo(() => {
    const dhMap = new Map<string, { item: any; type: IntegratedItemType }[]>();
    const adMap = new Map<number, { item: any; type: IntegratedItemType }[]>();

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

    for (const day of days) {
      const dayTs = day.getTime() / 1000;
      const dayKey = day.getDate();
      const dayEnd = dayTs + 86400;

      for (const entry of allSources) {
        if (entry.is_all_day) {
          if (entry.startTime < dayEnd && entry.endTime > dayTs) {
            const list = adMap.get(dayKey) || [];
            list.push({ item: entry.item, type: entry.type });
            adMap.set(dayKey, list);
          }
        } else {
          for (const hour of HOURS) {
            const hStart = dayTs + hour * 3600;
            const hEnd = hStart + 3600;
            if (entry.startTime < hEnd && entry.startTime >= hStart) {
              const key = `${dayKey}-${hour}`;
              const list = dhMap.get(key) || [];
              list.push({ item: entry.item, type: entry.type });
              dhMap.set(key, list);
            }
          }
        }
      }
    }

    return { dayHourItems: dhMap, allDayByDay: adMap };
  }, [events, integratedItems, days]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-primary shrink-0">
        <div className="border-r border-border-secondary" />
        {days.map((day, i) => {
          const isToday = day.toDateString() === todayStr;
          return (
            <div key={i} className="px-2 py-2 text-center border-r border-border-secondary">
              <div className="text-xs text-text-tertiary">{DAY_NAMES[day.getDay()]}</div>
              <div className={`text-sm font-medium mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                isToday ? "bg-accent text-white" : "text-text-primary"
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-primary shrink-0">
        <div className="border-r border-border-secondary px-1 py-1 text-[0.625rem] text-text-tertiary">all-day</div>
        {days.map((day, i) => {
          const allDay = allDayByDay.get(day.getDate()) ?? [];
          return (
            <div key={i} className="border-r border-border-secondary px-1 py-1 space-y-0.5">
              {allDay.map(({ item, type }) => (
                <EventCard
                  key={`${type}-${item.id}`}
                  event={item}
                  type={type}
                  compact
                  calendarColor={type === 'event' ? calendarColorMap.get(item.calendar_id ?? "") : undefined}
                  onClick={() => onEventClick(item, type)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-b border-border-secondary h-12 px-1 flex items-start justify-end">
                <span className="text-[0.625rem] text-text-tertiary -mt-1.5">
                  {hour === 0 ? "" : `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`}
                </span>
              </div>
              {days.map((day, di) => {
                const hourItems = dayHourItems.get(`${day.getDate()}-${hour}`) ?? [];
                return (
                  <div key={di} className="border-r border-b border-border-secondary h-12 relative px-0.5 overflow-hidden">
                    <div className="flex flex-col gap-0.5">
                      {hourItems.map(({ item, type }) => (
                        <EventCard
                          key={`${type}-${item.id}`}
                          event={item}
                          type={type}
                          compact
                          calendarColor={type === 'event' ? calendarColorMap.get(item.calendar_id ?? "") : undefined}
                          onClick={() => onEventClick(item, type)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

