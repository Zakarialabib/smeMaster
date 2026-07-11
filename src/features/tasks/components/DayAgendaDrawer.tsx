/**
 * DayAgendaDrawer - Slide-out drawer showing tasks for a specific day.
 *
 * Opens when a day is clicked in the calendar view.
 * Lists all tasks for that day with completion, priority, and action options.
 *
 * @spec §3.5
 */
import { useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CSSTransition } from "react-transition-group";
import { X, Calendar, CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";

/**
 * Priority colors for display
 */
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-blue-400",
  none: "text-text-tertiary",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/**
 * Props for DayAgendaDrawer component.
 */
export interface DayAgendaDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** The selected date */
  date: Date;
  /** Tasks for this day */
  tasks: DbTask[];
  /** Handler for closing the drawer */
  onClose: () => void;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for opening task detail */
  onTaskClick: (id: string) => void;
  /** Handler for deleting a task */
  onDelete: (id: string) => void;
}

/**
 * DayAgendaDrawer - A slide-out panel showing all tasks for a specific day.
 *
 * Features:
 * - Slides in from the right (desktop) or bottom (mobile)
 * - Lists all tasks with completion checkbox, priority, and due time
 * - Empty state when no tasks for that day
 * - Close button and backdrop click to dismiss
 *
 * @spec §3.5
 */
export function DayAgendaDrawer({
  isOpen,
  date,
  tasks,
  onClose,
  onToggleComplete,
  onTaskClick,
  onDelete,
}: DayAgendaDrawerProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleComplete = useCallback(
    (task: DbTask) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleComplete(task.id, !task.is_completed);
    },
    [onToggleComplete],
  );

  const handleTaskClick = useCallback(
    (taskId: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onTaskClick(taskId);
    },
    [onTaskClick],
  );

  const handleDelete = useCallback(
    (taskId: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(taskId);
    },
    [onDelete],
  );

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return createPortal(
    <CSSTransition
      in={isOpen}
      timeout={200}
      classNames="slide-up"
      unmountOnExit
      nodeRef={nodeRef}
    >
      <div
        ref={nodeRef}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Drawer panel */}
        <div className="relative w-full sm:max-w-md bg-bg-primary border border-border-primary rounded-t-xl sm:rounded-xl shadow-xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">{formattedDate}</h3>
              <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tasks list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar size={28} className="text-text-tertiary/30 mb-2" />
                <p className="text-sm text-text-secondary">No tasks for this day</p>
                <p className="text-xs text-text-tertiary mt-1">Click to add a task</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={handleTaskClick(task.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                    transition-colors hover:bg-bg-hover
                    ${task.is_completed ? "opacity-60" : ""}
                  `}
                >
                  {/* Completion checkbox */}
                  <button
                    onClick={handleToggleComplete(task)}
                    className="shrink-0"
                    aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {task.is_completed ? (
                      <CheckCircle2 size={18} className="text-success" />
                    ) : (
                      <Circle size={18} className="text-text-tertiary" />
                    )}
                  </button>

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${
                        task.is_completed
                          ? "line-through text-text-tertiary"
                          : "text-text-primary"
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.priority && task.priority !== "none" && (
                        <span
                          className={`text-[0.625rem] font-medium ${PRIORITY_COLORS[task.priority as TaskPriority] || "text-text-tertiary"}`}
                        >
                          {PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="text-[0.625rem] text-text-tertiary">
                          {new Date(task.due_date * 1000).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={handleDelete(task.id)}
                    className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </CSSTransition>,
    document.body,
  );
}

