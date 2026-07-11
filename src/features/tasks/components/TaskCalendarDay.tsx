/**
 * TaskCalendarDay - Individual day cell in the calendar month grid.
 *
 * Shows day number and up to 3 priority-colored dots for tasks on that day.
 * Supports click to open day agenda, and drag-over for task rescheduling.
 *
 * @spec §3.5
 */
import { useMemo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";

/**
 * Priority colors for calendar dots (spec §7.1)
 */
const PRIORITY_DOT_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

/**
 * Props for TaskCalendarDay component.
 */
export interface TaskCalendarDayProps {
  /** Date this cell represents */
  date: Date;
  /** Day of month (1-31) */
  day: number;
  /** Whether this day is in the current month */
  isCurrentMonth: boolean;
  /** Whether this day is today */
  isToday: boolean;
  /** Tasks due on this day */
  tasks: DbTask[];
  /** Handler for clicking on a day */
  onDayClick: (date: Date) => void;
  /** Handler for clicking on a specific task */
  onTaskClick: (taskId: string) => void;
  /** Whether this calendar view supports dragging */
  droppable?: boolean;
}

/**
 * Sort tasks by priority urgency for display.
 */
function sortByPriority(tasks: DbTask[]): DbTask[] {
  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  return [...tasks].sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
}

/**
 * TaskCalendarDay - A single day cell in the calendar month grid.
 *
 * Features:
 * - Day number display with today highlight
 * - Max 3 priority dots visible, "+N" overflow indicator
 * - Droppable for task drag-to-reschedule
 * - Different background for current month vs adjacent month
 *
 * @spec §3.5
 */
export function TaskCalendarDay({
  date,
  day,
  isCurrentMonth,
  isToday,
  tasks,
  onDayClick,
  onTaskClick,
  droppable = true,
}: TaskCalendarDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `calendar-day-${date.getTime()}`,
    data: { date: date.toISOString() },
    disabled: !droppable,
  });

  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks]);
  const visibleTasks = sortedTasks.slice(0, 3);
  const overflowCount = sortedTasks.length - 3;

  const handleDayClick = useCallback(() => {
    onDayClick(date);
  }, [date, onDayClick]);

  const handleTaskClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onTaskClick(taskId);
    },
    [onTaskClick],
  );

  return (
    <div
      ref={setNodeRef}
      onClick={handleDayClick}
      className={`
        relative flex flex-col p-1.5 cursor-pointer transition-all min-h-[var(--task-calendar-day-height,_100px)]
        ${
          isOver
            ? "ring-2 ring-accent bg-accent/10"
            : isToday
              ? "bg-accent/5"
              : isCurrentMonth
                ? "bg-bg-primary hover:bg-bg-hover"
                : "bg-bg-secondary/50 text-text-tertiary/60"
        }
        border-r border-b border-border-secondary
      `}
      role="gridcell"
      aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — ${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
      aria-current={isToday ? "date" : undefined}
    >
      {/* Day number */}
      <span
        className={`
          text-xs font-medium leading-none mb-1
          ${isToday ? "text-accent font-bold" : isCurrentMonth ? "text-text-primary" : "text-text-tertiary/50"}
        `}
      >
        {isToday ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white -mt-0.5 -ml-0.5">
            {day}
          </span>
        ) : (
          day
        )}
      </span>

      {/* Task dots */}
      <div className="flex flex-col gap-0.5 mt-auto">
        {visibleTasks.map((task) => (
          <button
            key={task.id}
            onClick={(e) => handleTaskClick(e, task.id)}
            className={`
              flex items-center gap-1 px-1 py-0.5 rounded-sm text-left
              hover:bg-bg-tertiary transition-colors
              ${task.is_completed ? "opacity-50" : ""}
            `}
            title={`${task.title}${task.due_date ? ` — ${new Date(task.due_date * 1000).toLocaleDateString()}` : ""}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT_COLORS[task.priority as TaskPriority] || "bg-text-tertiary/30"}`}
            />
            <span className="text-[0.625rem] text-text-secondary truncate leading-tight">
              {task.title}
            </span>
          </button>
        ))}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <span className="text-[0.625rem] text-accent font-medium px-1">
            +{overflowCount} more
          </span>
        )}
      </div>

      {/* Today indicator dot at bottom */}
      {isToday && tasks.length === 0 && (
        <div className="mt-auto flex justify-center">
          <span className="w-1 h-1 rounded-full bg-accent" />
        </div>
      )}
    </div>
  );
}

