import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import type { Thread } from "@features/mail/stores/threadStore";
import type { ThreadViewProps } from "./ThreadViewTypes";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function threadDate(thread: Thread): Date {
  return new Date(thread.lastMessageAt * 1000);
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function ThreadCalendarView({
  threads,
  selectedThreadId,
  onThreadClick,
}: ThreadViewProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const threadsByDate = useMemo(() => {
    const map = new Map<string, Thread[]>();
    threads.forEach((thread) => {
      const key = dateKey(threadDate(thread));
      const dayThreads = map.get(key) ?? [];
      dayThreads.push(thread);
      map.set(key, dayThreads);
    });
    return map;
  }, [threads]);

  const cells = useMemo(() => {
    const monthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const startDay = monthStart.getDay();
    const prevMonthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      0,
    );
    const result: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    for (let index = startDay - 1; index >= 0; index -= 1) {
      result.push({
        date: new Date(
          prevMonthEnd.getFullYear(),
          prevMonthEnd.getMonth(),
          prevMonthEnd.getDate() - index,
        ),
        isCurrentMonth: false,
      });
    }

    const monthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    );
    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      result.push({
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
        isCurrentMonth: true,
      });
    }

    while (result.length < 42) {
      const previous = result[result.length - 1]!.date;
      result.push({
        date: new Date(
          previous.getFullYear(),
          previous.getMonth(),
          previous.getDate() + 1,
        ),
        isCurrentMonth: false,
      });
    }

    return result;
  }, [currentMonth]);

  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-primary bg-bg-primary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="min-w-[9rem] text-center text-sm font-semibold text-text-primary">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
          }
          className="rounded-md border border-border-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-border-primary bg-bg-secondary/30">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase text-text-tertiary"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 overflow-y-auto">
        {cells.map((cell) => {
          const dayThreads = threadsByDate.get(dateKey(cell.date)) ?? [];
          const isToday = isSameDay(cell.date, today);

          return (
            <div
              key={dateKey(cell.date)}
              className={`min-h-[7.5rem] border-b border-r border-border-secondary p-2 ${
                cell.isCurrentMonth ? "bg-bg-primary" : "bg-bg-secondary/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? "bg-accent text-white"
                      : cell.isCurrentMonth
                        ? "text-text-secondary"
                        : "text-text-tertiary"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {dayThreads.length > 0 && (
                  <span className="text-[0.625rem] text-text-tertiary">
                    {dayThreads.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayThreads.slice(0, 3).map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => onThreadClick(thread)}
                    className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[0.6875rem] transition-colors hover:bg-bg-hover ${
                      thread.id === selectedThreadId
                        ? "bg-accent/10 text-accent"
                        : thread.isRead
                          ? "text-text-secondary"
                          : "font-semibold text-text-primary"
                    }`}
                  >
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">
                      {thread.subject ?? "(No subject)"}
                    </span>
                  </button>
                ))}
                {dayThreads.length > 3 && (
                  <div className="px-1.5 text-[0.625rem] text-text-tertiary">
                    +{dayThreads.length - 3} more
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


