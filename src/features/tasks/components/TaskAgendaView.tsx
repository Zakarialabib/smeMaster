/**
 * TaskAgendaView - Mobile-optimized time-grouped agenda list.
 *
 * Groups tasks by: Overdue, Today, Tomorrow, This Week, Later, No Date.
 * Each group has a section header with count and task rows.
 * Supports swipe actions: Complete (left), Delete (left secondary), Reschedule (right).
 *
 * @spec §3.6
 */
import { useMemo, useCallback, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DbTask } from "@features/tasks/db/tasks";
import { SwipeableRow } from "@shared/components/ui/SwipeableRow";
import type { SwipeActions } from "@shared/hooks/useSwipeGesture";
import { triggerHaptic } from "@shared/hooks/useHaptics";

/**
 * Time-based group labels
 */
type AgendaGroupKey = "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "noDate";

interface AgendaGroup {
  key: AgendaGroupKey;
  label: string;
  icon: string;
  tasks: DbTask[];
}

/**
 * Get the number of days between two dates.
 */
function daysBetween(a: Date, b: Date): number {
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((aStart.getTime() - bStart.getTime()) / 86400000);
}

/**
 * Group tasks into agenda time groups.
 */
function groupTasksByDate(tasks: DbTask[]): AgendaGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const groups: Record<AgendaGroupKey, DbTask[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDate: [],
  };

  for (const task of tasks) {
    if (!task.due_date) {
      groups.noDate.push(task);
      continue;
    }

    const dueDate = new Date(task.due_date * 1000);
    const diff = daysBetween(dueDate, todayStart);

    if (diff < 0) {
      groups.overdue.push(task);
    } else if (diff === 0) {
      groups.today.push(task);
    } else if (diff === 1) {
      groups.tomorrow.push(task);
    } else if (diff <= 7) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  const groupOrder: AgendaGroupKey[] = ["overdue", "today", "tomorrow", "thisWeek", "later", "noDate"];
  const groupLabels: Record<AgendaGroupKey, string> = {
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeek: "This Week",
    later: "Later",
    noDate: "No Date",
  };
  const groupIcons: Record<AgendaGroupKey, string> = {
    overdue: "alert-triangle",
    today: "calendar",
    tomorrow: "calendar",
    thisWeek: "calendar",
    later: "calendar",
    noDate: "inbox",
  };

  return groupOrder
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      label: groupLabels[key],
      icon: groupIcons[key],
      tasks: groups[key].sort((a, b) => {
        // Sort by priority within group
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
      }),
    }));
}

/**
 * Props for TaskAgendaView component.
 */
export interface TaskAgendaViewProps {
  /** Tasks to display (already filtered) */
  tasks: DbTask[];
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for opening task detail */
  onOpenDetail: (id: string) => void;
  /** Handler for deleting a task */
  onDelete?: (id: string) => void;
  /** Handler for rescheduling a task to a new date */
  onReschedule?: (id: string, newDate: Date) => void;
  /** Custom swipe actions configuration (overrides default) */
  swipeActions?: (task: DbTask) => SwipeActions;
  /** Whether to show collapsed groups initially */
  startCollapsed?: boolean;
}

/**
 * TaskAgendaView - Time-grouped agenda list optimized for mobile.
 *
 * Features:
 * - Six time groups: Overdue, Today, Tomorrow, This Week, Later, No Date
 * - Section headers with task count and collapse/expand
 * - Swipe actions: Complete (left-primary), Delete (left-secondary), Reschedule (right-primary)
 * - Overdue tasks have red accent and alert icon
 * - Priority ordering within groups
 *
 * @spec §3.6
 */
export function TaskAgendaView({
  tasks,
  onToggleComplete,
  onOpenDetail,
  onDelete,
  onReschedule,
  swipeActions: customSwipeActions,
  startCollapsed = false,
}: TaskAgendaViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (startCollapsed) return new Set<string>(["thisWeek", "later", "noDate"]);
    return new Set<string>();
  });
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);

  const groups = useMemo(() => groupTasksByDate(tasks), [tasks]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const defaultSwipeActions = useCallback(
    (task: DbTask): SwipeActions => ({
      left: {
        primary: {
          label: task.is_completed ? "Undo" : "Complete",
          icon: task.is_completed ? "mail" : "check-circle-2",
          color: "bg-success",
          onAction: () => {
            triggerHaptic("light");
            onToggleComplete(task.id, !task.is_completed);
          },
        },
        secondary: {
          label: "Delete",
          icon: "trash-2",
          color: "bg-danger",
          destructive: true,
          onAction: () => {
            triggerHaptic("medium");
            onDelete?.(task.id);
          },
        },
      },
      right: {
        primary: {
          label: "Reschedule",
          icon: "clock",
          color: "bg-blue-500",
          onAction: () => {
            triggerHaptic("light");
            setRescheduleTaskId(task.id);
          },
        },
      },
    }),
    [onToggleComplete, onDelete],
  );

  const getSwipeActions = customSwipeActions ?? defaultSwipeActions;

  const handleToggleComplete = useCallback(
    (task: DbTask) => (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic("light");
      onToggleComplete(task.id, !task.is_completed);
    },
    [onToggleComplete],
  );

  const handleOpenDetail = useCallback(
    (taskId: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenDetail(taskId);
    },
    [onOpenDetail],
  );

  const handleDelete = useCallback(
    (task: DbTask) => (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic("medium");
      onDelete?.(task.id);
    },
    [onDelete],
  );

  // Quick reschedule options
  const quickDates = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [
      { label: "Today", date: new Date(today) },
      { label: "Tomorrow", date: new Date(today.getTime() + 86400000) },
      { label: "Next Week", date: new Date(today.getTime() + 7 * 86400000) },
    ];
  }, []);

  const handleQuickReschedule = useCallback(
    (date: Date) => {
      if (rescheduleTaskId && onReschedule) {
        onReschedule(rescheduleTaskId, date);
      }
      setRescheduleTaskId(null);
    },
    [rescheduleTaskId, onReschedule],
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
        <Circle size={28} className="text-text-tertiary/30 mb-3" />
        <p className="text-sm text-text-secondary mb-1">No tasks in agenda</p>
        <p className="text-xs text-text-tertiary">Add a task or change your filters</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.key);
        const isOverdueGroup = group.key === "overdue";

        return (
          <div key={group.key} className="border-b border-border-secondary last:border-b-0">
            {/* Section header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className={`
                flex items-center gap-2 w-full px-4 py-2.5
                ${isOverdueGroup ? "bg-red-500/5" : "bg-bg-secondary/30"}
                hover:bg-bg-hover transition-colors
              `}
              aria-expanded={!isCollapsed}
              aria-label={`${group.label} — ${group.tasks.length} tasks`}
            >
              {isOverdueGroup && (
                <AlertTriangle size={14} className="text-danger shrink-0" />
              )}
              {!isOverdueGroup && <Calendar size={14} className="text-accent shrink-0" />}
              <span
                className={`text-xs font-semibold uppercase tracking-wider flex-1 text-left ${
                  isOverdueGroup ? "text-danger" : "text-text-tertiary"
                }`}
              >
                {group.label}
              </span>
              <span
                className={`text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium ${
                  isOverdueGroup
                    ? "bg-danger/10 text-danger"
                    : "bg-bg-tertiary text-text-tertiary"
                }`}
              >
                {group.tasks.length}
              </span>
              {isCollapsed ? (
                <ChevronDown size={14} className="text-text-tertiary" />
              ) : (
                <ChevronUp size={14} className="text-text-tertiary" />
              )}
            </button>

            {/* Task list */}
            {!isCollapsed && (
              <div className="divide-y divide-border-secondary">
                {group.tasks.map((task) => (
                  <SwipeableRow
                    key={task.id}
                    actions={getSwipeActions(task)}
                    className="bg-bg-primary"
                  >
                    <div
                      onClick={handleOpenDetail(task.id)}
                      className={`
                        flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover transition-colors
                        ${task.is_completed ? "opacity-60" : ""}
                        ${isOverdueGroup && !task.is_completed ? "border-l-2 border-danger" : ""}
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
                        <div className="flex items-center gap-2">
                          {isOverdueGroup && !task.is_completed && (
                            <AlertTriangle size={12} className="text-danger shrink-0" />
                          )}
                          <p
                            className={`text-sm truncate ${
                              task.is_completed
                                ? "line-through text-text-tertiary"
                                : "text-text-primary"
                            }`}
                          >
                            {task.title}
                          </p>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {task.priority && task.priority !== "none" && (
                            <span
                              className={`text-[0.625rem] font-medium ${
                                task.priority === "urgent"
                                  ? "text-red-500"
                                  : task.priority === "high"
                                    ? "text-orange-500"
                                    : task.priority === "medium"
                                      ? "text-amber-500"
                                      : "text-blue-400"
                              }`}
                            >
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-[0.625rem] text-text-tertiary">
                              {group.key === "overdue"
                                ? `${Math.abs(daysBetween(new Date(task.due_date * 1000), new Date()))}d ago`
                                : group.key === "today"
                                  ? new Date(task.due_date * 1000).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : new Date(task.due_date * 1000).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete button (visible on hover/long-press) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(task)(e);
                        }}
                        className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Quick reschedule popover */}
      {rescheduleTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setRescheduleTaskId(null)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative bg-bg-primary border border-border-primary rounded-t-xl sm:rounded-xl shadow-xl p-4 w-full sm:max-w-xs mx-4 mb-0 sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-text-primary mb-3">Reschedule to</h4>
            <div className="flex flex-col gap-2">
              {quickDates.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleQuickReschedule(option.date)}
                  className="w-full px-3 py-2.5 text-sm text-left text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setRescheduleTaskId(null)}
                className="w-full px-3 py-2.5 text-sm text-left text-text-tertiary hover:bg-bg-hover rounded-md transition-colors"
              >
                Pick a date...
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

