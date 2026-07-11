import { memo, useMemo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Calendar, CheckCircle2, Circle } from "lucide-react";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";
import { Badge } from "@shared/components/ui/Badge";

/**
 * Priority dot colors for task cards.
 * @spec §7.1
 */
const PRIORITY_DOT_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

/**
 * Due date badge styling.
 * @spec §7.2
 */
function getDueDateStyle(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff < 0) return "text-red-500 bg-red-500/10";
  if (diff < 86400) return "text-amber-500 bg-amber-500/10";
  return "text-text-tertiary bg-bg-tertiary";
}

/**
 * Format due date for display.
 */
function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Props for TaskKanbanCard component.
 * @spec §3.4
 */
export interface TaskKanbanCardProps {
  /** Task data to display */
  task: DbTask;
  /** Handler for opening task detail panel */
  onOpenDetail: (id: string) => void;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Contact info for avatar display */
  contactName?: string | null;
  contactAvatar?: string | null;
  contactId?: string | null;
  /** Handler for contact click */
  onContactClick?: (contactId: string) => void;
  /** Subtask count for display */
  subtaskCount?: number;
  /** Completed subtask count */
  completedSubtaskCount?: number;
}

/**
 * TaskKanbanCard - Individual task card for Kanban view.
 *
 * Features:
 * - Drag handle on left edge (6px grip indicator)
 * - Priority dot indicator
 * - Due date badge with color coding
 * - Tag pills
 * - Subtask count
 * - Contact avatar
 *
 * @spec §3.4
 */
export const TaskKanbanCard = memo(function TaskKanbanCard({
  task,
  onOpenDetail,
  onToggleComplete,
  contactName,
  contactAvatar,
  contactId,
  onContactClick,
  subtaskCount = 0,
  completedSubtaskCount = 0,
}: TaskKanbanCardProps) {
  const tags: string[] = useMemo(() => {
    try {
      return JSON.parse(task.tags_json) as string[];
    } catch {
      return [];
    }
  }, [task.tags_json]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `kanban-task-${task.id}`,
    data: { taskId: task.id },
  });

  const handleToggleComplete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleComplete(task.id, !task.is_completed);
    },
    [task.id, task.is_completed, onToggleComplete],
  );

  const handleCardClick = useCallback(() => {
    onOpenDetail(task.id);
  }, [task.id, onOpenDetail]);

  const handleContactClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (contactId) {
        onContactClick?.(contactId);
      }
    },
    [contactId, onContactClick],
  );

  const initial = (contactName?.[0] ?? "?").toUpperCase();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`
        group bg-bg-secondary border border-border-primary rounded-lg p-3 cursor-pointer
        transition-all duration-150 hover-lift
        ${isDragging ? "opacity-50 scale-105" : ""}
        ${task.is_completed ? "opacity-60" : ""}
      `}
      role="article"
      aria-label={`Task: ${task.title}`}
    >
      {/* Drag handle - 6px grip indicator on left edge */}
      <div
        className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40" />
      </div>

      {/* Content with left padding for drag handle */}
      <div className="pl-3">
        {/* Priority dot + Title row */}
        <div className="flex items-start gap-1.5 mb-2">
          {task.priority !== "none" && (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${PRIORITY_DOT_COLORS[task.priority as TaskPriority]}`}
              aria-label={`${task.priority} priority`}
            />
          )}
          <span
            className={`text-sm font-medium flex-1 min-w-0 truncate ${
              task.is_completed ? "line-through text-text-tertiary" : "text-text-primary"
            }`}
          >
            {task.title}
          </span>
        </div>

        {/* Due date badge */}
        {task.due_date && (
          <div className="flex items-center gap-1 mb-2">
            <Calendar size={12} className="shrink-0" />
            <span
              className={`
                inline-flex items-center gap-1 text-[0.6875rem] px-1.5 py-0.5 rounded
                ${getDueDateStyle(task.due_date)}
              `}
            >
              {formatDueDate(task.due_date)}
            </span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="info" size="sm" className="text-[0.625rem]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer: Subtasks + Contact + Complete checkbox */}
        <div className="flex items-center justify-between mt-1">
          {/* Subtask count */}
          {subtaskCount > 0 && (
            <span className="text-[0.6875rem] text-text-tertiary">
              {completedSubtaskCount}/{subtaskCount}
            </span>
          )}

          {/* Contact avatar or spacer */}
          <div className="flex-1 flex justify-end">
            {contactName && contactId ? (
              <button
                onClick={handleContactClick}
                className="flex items-center gap-1 text-[0.6875rem] text-text-secondary hover:text-accent transition-colors"
                title={`Linked to ${contactName}`}
              >
                {contactAvatar ? (
                  <img
                    src={contactAvatar}
                    alt={contactName}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[0.5rem] font-semibold shrink-0">
                    {initial}
                  </span>
                )}
                <span className="max-w-[80px] truncate hidden sm:inline">{contactName}</span>
              </button>
            ) : (
              <span className="w-4 h-4" aria-hidden="true" />
            )}
          </div>

          {/* Complete checkbox */}
          <button
            onClick={handleToggleComplete}
            className="shrink-0 ml-1"
            aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
          >
            {task.is_completed ? (
              <CheckCircle2 size={14} className="text-success" />
            ) : (
              <Circle size={14} className="text-text-tertiary" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
