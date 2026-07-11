import { useCallback, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { DbTask } from "@features/tasks/db/tasks";
import { TaskKanbanCard } from "./TaskKanbanCard";

/**
 * Priority column configuration.
 * @spec §7.1
 */
const COLUMN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgent", color: "text-red-500", bg: "bg-red-500/10" },
  high: { label: "High", color: "text-orange-500", bg: "bg-orange-500/10" },
  medium: { label: "Medium", color: "text-amber-500", bg: "bg-amber-500/10" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10" },
  none: { label: "No Priority", color: "text-text-tertiary", bg: "bg-bg-tertiary" },
};

/**
 * Props for TaskKanbanColumn component.
 * @spec §3.4
 */
export interface TaskKanbanColumnProps {
  /** Column identifier (matches priority value or custom grouping) */
  columnId: string;
  /** Tasks to display in this column */
  tasks: DbTask[];
  /** Handler for opening task detail panel */
  onOpenDetail: (id: string) => void;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for adding a new task to this column */
  onAddTask?: (columnId: string) => void;
  /** Map of task IDs to contact info */
  contactMap?: Map<string, { name: string | null; avatar: string | null; email: string | null }>;
  /** Map of task IDs to their subtasks */
  subtaskMap?: Record<string, DbTask[]>;
  /** Handler for contact click */
  onContactClick?: (contactId: string) => void;
}

/**
 * TaskKanbanColumn - Individual column for Kanban view.
 *
 * Features:
 * - Column header with label and task count
 * - Drop zone for drag-and-drop reordering
 * - Vertical scroll for task cards
 * - "+" add button at bottom
 *
 * @spec §3.4
 */
export function TaskKanbanColumn({
  columnId,
  tasks,
  onOpenDetail,
  onToggleComplete,
  onAddTask,
  contactMap = new Map(),
  subtaskMap = {},
  onContactClick,
}: TaskKanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId] ?? {
    label: columnId.charAt(0).toUpperCase() + columnId.slice(1),
    color: "text-text-secondary",
    bg: "bg-bg-tertiary",
  };

  const { setNodeRef, isOver } = useDroppable({
    id: `kanban-column-${columnId}`,
    data: { columnId },
  });

  const handleAddClick = useCallback(() => {
    onAddTask?.(columnId);
  }, [onAddTask, columnId]);

  // Sort tasks by sort_order if available
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col bg-bg-secondary border border-border-primary rounded-lg
        w-[var(--task-kanban-column-width,_280px)] shrink-0
        transition-all duration-150
        ${isOver ? "ring-2 ring-accent" : ""}
      `}
      role="region"
      aria-label={`${config.label} column with ${tasks.length} tasks`}
    >
      {/* Column Header */}
      <div
        className={`
          flex items-center justify-between px-3 py-2 border-b border-border-primary
          ${config.bg}
        `}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task Cards - Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {sortedTasks.map((task) => {
          const contactInfo = contactMap.get(task.id);
          const subtasks = subtaskMap[task.id] ?? [];
          const completedSubtasks = subtasks.filter((s) => s.is_completed).length;

          return (
            <TaskKanbanCard
              key={task.id}
              task={task}
              onOpenDetail={onOpenDetail}
              onToggleComplete={onToggleComplete}
              contactName={contactInfo?.name ?? undefined}
              contactAvatar={contactInfo?.avatar ?? undefined}
              contactId={task.contact_id}
              onContactClick={onContactClick}
              subtaskCount={subtasks.length}
              completedSubtaskCount={completedSubtasks}
            />
          );
        })}

        {/* Empty state placeholder */}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-text-tertiary/50 text-xs">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add Task Button */}
      <div className="p-2 border-t border-border-primary">
        <button
          onClick={handleAddClick}
          className={`
            flex items-center justify-center gap-1.5 w-full px-3 py-2
            text-xs font-medium rounded-md border border-dashed
            border-border-primary text-text-tertiary
            hover:bg-bg-tertiary hover:text-text-primary
            transition-colors
            focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
          `}
          aria-label={`Add task to ${config.label} column`}
        >
          <Plus size={14} />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}
