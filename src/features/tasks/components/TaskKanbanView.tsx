import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { DbTask } from "@features/tasks/db/tasks";
import { TaskKanbanColumn } from "./TaskKanbanColumn";

/**
 * Column grouping options for Kanban view.
 * @spec §3.4
 */
export type KanbanColumnsBy = "status" | "priority" | "dueDate";

/**
 * Kanban column data structure.
 * @spec §6.2
 */
export interface KanbanColumn {
  id: string;
  label: string;
  tasks: DbTask[];
  count: number;
}

/**
 * Props for TaskKanbanView component.
 * @spec §3.4
 */
export interface TaskKanbanViewProps {
  /** Tasks to display (already filtered) */
  tasks: DbTask[];
  /** How to group tasks into columns */
  columnsBy: KanbanColumnsBy;
  /** Handler for moving task to a different column */
  onTaskMove: (taskId: string, newColumn: string) => void;
  /** Handler for reordering tasks within a column */
  onTaskReorder: (taskId: string, columnId: string, newIndex: number) => void;
  /** Handler for opening task detail panel */
  onOpenDetail: (id: string) => void;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for adding a new task */
  onAddTask?: (columnId?: string) => void;
  /** Map of task IDs to contact info */
  contactMap?: Map<string, { name: string | null; avatar: string | null; email: string | null }>;
  /** Map of task IDs to their subtasks */
  subtaskMap?: Record<string, DbTask[]>;
  /** Handler for contact click */
  onContactClick?: (contactId: string) => void;
}

/**
 * Priority order for column sorting.
 */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/**
 * Get column label based on grouping type.
 */
function getColumnLabel(columnId: string, columnsBy: KanbanColumnsBy): string {
  if (columnsBy === "priority") {
    const priorityLabels: Record<string, string> = {
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
      none: "No Priority",
    };
    return priorityLabels[columnId] ?? columnId;
  }

  if (columnsBy === "dueDate") {
    const dueDateLabels: Record<string, string> = {
      overdue: "Overdue",
      today: "Today",
      tomorrow: "Tomorrow",
      thisWeek: "This Week",
      later: "Later",
      noDate: "No Due Date",
    };
    return dueDateLabels[columnId] ?? columnId;
  }

  // Default for status
  return columnId.charAt(0).toUpperCase() + columnId.slice(1);
}

/**
 * Group tasks into Kanban columns based on grouping type.
 */
function groupTasksIntoColumns(
  tasks: DbTask[],
  columnsBy: KanbanColumnsBy,
): KanbanColumn[] {
  const groups = new Map<string, DbTask[]>();

  for (const task of tasks) {
    let columnId: string;

    if (columnsBy === "priority") {
      columnId = task.priority;
    } else if (columnsBy === "dueDate") {
      if (!task.due_date) {
        columnId = "noDate";
      } else {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.due_date * 1000);
        const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const diffDays = Math.floor((dueStart.getTime() - todayStart.getTime()) / 86400000);

        if (diffDays < 0) columnId = "overdue";
        else if (diffDays === 0) columnId = "today";
        else if (diffDays === 1) columnId = "tomorrow";
        else if (diffDays <= 7) columnId = "thisWeek";
        else columnId = "later";
      }
    } else {
      // Status grouping (default)
      columnId = task.is_completed ? "completed" : "active";
    }

    if (!groups.has(columnId)) {
      groups.set(columnId, []);
    }
    groups.get(columnId)!.push(task);
  }

  // Convert to array and sort by priority order if grouping by priority
  let columns = [...groups.entries()].map(([id, tasks]) => ({
    id,
    label: getColumnLabel(id, columnsBy),
    tasks,
    count: tasks.length,
  }));

  if (columnsBy === "priority") {
    columns = columns.sort((a, b) => {
      const aOrder = PRIORITY_ORDER[a.id] ?? 99;
      const bOrder = PRIORITY_ORDER[b.id] ?? 99;
      return aOrder - bOrder;
    });
  } else if (columnsBy === "dueDate") {
    const dueDateOrder: Record<string, number> = {
      overdue: 0,
      today: 1,
      tomorrow: 2,
      thisWeek: 3,
      later: 4,
      noDate: 5,
    };
    columns = columns.sort((a, b) => {
      const aOrder = dueDateOrder[a.id] ?? 99;
      const bOrder = dueDateOrder[b.id] ?? 99;
      return aOrder - bOrder;
    });
  }

  return columns;
}

/**
 * TaskKanbanView - Main Kanban view with drag-drop support.
 *
 * Features:
 * - Horizontal scrollable columns
 * - DndContext for drag-drop between columns
 * - Column grouping by status, priority, or due date
 * - Drag overlay for smooth UX
 * - Responsive design
 *
 * @spec §3.4
 */
export function TaskKanbanView({
  tasks,
  columnsBy,
  onTaskMove,
  onTaskReorder,
  onOpenDetail,
  onToggleComplete,
  onAddTask,
  contactMap = new Map(),
  subtaskMap = {},
  onContactClick,
}: TaskKanbanViewProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const columns = useMemo(() => {
    return groupTasksIntoColumns(tasks, columnsBy);
  }, [tasks, columnsBy]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string;
    setActiveTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTaskId(null);

      if (!over) return;

      const taskId = active.id as string;
      const targetColumnId = over.id as string;

      // Determine if we're dropping on a column or a specific task
      if (targetColumnId.startsWith("kanban-column-")) {
        const columnId = targetColumnId.replace("kanban-column-", "");
        onTaskMove(taskId, columnId);
      } else if (targetColumnId.startsWith("kanban-task-")) {
        // Dropping on a task - find its column and calculate new index
        const targetTaskId = targetColumnId.replace("kanban-task-", "");
        const targetTask = tasks.find((t) => t.id === targetTaskId);
        if (targetTask) {
          const columnId = targetTask.priority; // Use current column
          const columnTasks = tasks.filter((t) => t.priority === columnId);
          const newIndex = columnTasks.findIndex((t) => t.id === targetTaskId);
          onTaskReorder(taskId, columnId, newIndex);
        }
      }
    },
    [tasks, onTaskMove, onTaskReorder],
  );

  // Find active task for overlay
  const activeTask = useMemo(() => {
    return tasks.find((t) => t.id === activeTaskId);
  }, [tasks, activeTaskId]);

  return (
    <div className="flex flex-col h-full">
      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 p-3 h-full min-w-fit">
            {columns.map((column) => (
              <TaskKanbanColumn
                key={column.id}
                columnId={column.id}
                tasks={column.tasks}
                onOpenDetail={onOpenDetail}
                onToggleComplete={onToggleComplete}
                onAddTask={onAddTask}
                contactMap={contactMap}
                subtaskMap={subtaskMap}
                onContactClick={onContactClick}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 shadow-lg opacity-90 w-[var(--task-kanban-column-width,_280px)]">
                <span className="text-sm font-medium text-text-primary">
                  {activeTask.title}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <Plus size={24} className="text-text-tertiary/40" />
          </div>
          <p className="text-sm text-text-secondary mb-1">No tasks</p>
          <p className="text-xs text-text-tertiary">
            Add a task above or switch to List view
          </p>
        </div>
      )}
    </div>
  );
}
