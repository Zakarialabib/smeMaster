/**
 * TaskCalendarView - Full month calendar view with task dots and drag-to-reschedule.
 *
 * Layout:
 * - Navigation header: [← June 2026 →] [Today] [Month ▼]
 * - Day-of-week header row
 * - Month grid with priority-colored dots for tasks
 * - Day click opens DayAgendaDrawer
 *
 * @spec §3.5
 */
import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DndContext, DragOverlay, type DragEndEvent } from "@dnd-kit/core";
import type { DbTask } from "@features/tasks/db/tasks";
import { TaskCalendarDay } from "./TaskCalendarDay";
import { DayAgendaDrawer } from "./DayAgendaDrawer";
import { FOCUS_RING } from "@shared/styles/ui-tokens";

/**
 * Days of the week labels
 */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month names
 */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Props for TaskCalendarView component.
 */
export interface TaskCalendarViewProps {
  /** Tasks to display on the calendar */
  tasks: DbTask[];
  /** Handler for clicking on a task */
  onTaskClick: (taskId: string) => void;
  /** Handler for clicking on a date (e.g., to add a task) */
  onDateClick?: (date: Date) => void;
  /** Handler for moving a task to a different date (drag-to-reschedule) */
  onTaskMove: (taskId: string, newDate: Date) => void;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for deleting a task */
  onDelete?: (id: string) => void;
}

/**
 * Get start of month for a given date.
 */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of month for a given date.
 */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Check if two dates are the same day.
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * TaskCalendarView - Month grid calendar with priority-colored task dots.
 *
 * Features:
 * - Month navigation (prev/next/today)
 * - Day-of-week header
 * - Task dots with priority colors (max 3 per day, "+N" overflow)
 * - Drag-to-reschedule using @dnd-kit/core
 * - Day click opens DayAgendaDrawer
 * - Drag overlay for visual feedback
 *
 * @spec §3.5
 */
export function TaskCalendarView({
  tasks,
  onTaskClick,
  onDateClick: _onDateClick,
  onTaskMove,
  onToggleComplete,
  onDelete,
}: TaskCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleToday = useCallback(() => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(null);
  }, [today]);

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = monthStart.getDay(); // 0=Sun

    const cells: Array<{ date: Date; day: number; isCurrentMonth: boolean; isToday: boolean }> = [];

    // Previous month overflow
    const prevMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i);
      cells.push({ date, day: date.getDate(), isCurrentMonth: false, isToday: isSameDay(date, today) });
    }

    // Current month
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      cells.push({ date, day: d, isCurrentMonth: true, isToday: isSameDay(date, today) });
    }

    // Next month overflow (fill to 42 cells — 6 weeks)
    while (cells.length < 42) {
      const last = cells[cells.length - 1]!.date;
      const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date, day: date.getDate(), isCurrentMonth: false, isToday: isSameDay(date, today) });
    }

    return cells;
  }, [currentMonth, today]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DbTask[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const date = new Date(task.due_date * 1000);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  // Selected date tasks
  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return tasksByDate.get(key) ?? [];
  }, [selectedDate, tasksByDate]);

  const handleDayClick = useCallback(
    (date: Date) => {
      setSelectedDate(date);
    },
    [],
  );

  const handleCloseDrawer = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedTaskId(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const targetId = over.id as string;

      // Extract date from the droppable target ID
      if (targetId.startsWith("calendar-day-")) {
        const timestamp = parseInt(targetId.replace("calendar-day-", ""), 10);
        if (!isNaN(timestamp)) {
          const newDate = new Date(timestamp);
          onTaskMove(taskId, newDate);
        }
      }
    },
    [onTaskMove],
  );

  // Get dragged task for overlay
  const draggedTask = useMemo(() => {
    if (!draggedTaskId) return null;
    return tasks.find((t) => t.id === draggedTaskId) ?? null;
  }, [tasks, draggedTaskId]);

  const monthYearLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-primary/30">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className={`p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors ${FOCUS_RING}`}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold text-text-primary min-w-[140px] text-center">
            {monthYearLabel}
          </h2>
          <button
            onClick={handleNextMonth}
            className={`p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors ${FOCUS_RING}`}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={handleToday}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors ${FOCUS_RING}`}
        >
          Today
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border-primary bg-bg-secondary/30">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-tertiary text-center"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <DndContext onDragStart={(e) => setDraggedTaskId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div
          className="grid grid-cols-7 flex-1 overflow-y-auto"
          role="grid"
          aria-label="Calendar"
        >
          {calendarGrid.map((cell) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayTasks = tasksByDate.get(key) ?? [];

            return (
              <TaskCalendarDay
                key={key}
                date={cell.date}
                day={cell.day}
                isCurrentMonth={cell.isCurrentMonth}
                isToday={cell.isToday}
                tasks={dayTasks}
                onDayClick={handleDayClick}
                onTaskClick={onTaskClick}
              />
            );
          })}
        </div>

        <DragOverlay>
          {draggedTask && (
            <div className="bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 shadow-lg opacity-90">
              <span className="text-sm font-medium text-text-primary">{draggedTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Day Agenda Drawer */}
      <DayAgendaDrawer
        isOpen={selectedDate !== null}
        date={selectedDate ?? new Date()}
        tasks={selectedDateTasks}
        onClose={handleCloseDrawer}
        onToggleComplete={onToggleComplete}
        onTaskClick={onTaskClick}
        onDelete={onDelete ?? (() => {})}
      />
    </div>
  );
}

