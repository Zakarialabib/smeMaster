import { useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, Circle, Calendar, Trash2, ChevronRight } from "lucide-react";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { useColumnConfigStore } from "@shared/stores/columnConfigStore";

/**
 * Density options for task list rows.
 * @spec §3.3
 */
export type TaskDensity = "compact" | "normal" | "comfortable";

/**
 * Row height in pixels for each density level (used by the virtualizer).
 */
const DENSITY_PX: Record<TaskDensity, number> = {
  compact: 40,
  normal: 52,
  comfortable: 64,
};

/**
 * Row height class mapping for each density level.
 * @spec §3.3
 */
const DENSITY_HEIGHTS: Record<TaskDensity, string> = {
  compact: "h-10",
  normal: "h-13",
  comfortable: "h-16",
};

/**
 * Padding mapping for each density level.
 */
const DENSITY_PADDING: Record<TaskDensity, string> = {
  compact: "py-1.5",
  normal: "py-2",
  comfortable: "py-3",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

function getTags(tagsJson: string): string[] {
  try {
    return JSON.parse(tagsJson) as string[];
  } catch {
    return [];
  }
}

function getDayDiff(timestamp: number): number {
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const dueStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((dueStart.getTime() - todayStart.getTime()) / 86400000);
}

function formatDueDate(timestamp: number): string {
  const diff = getDayDiff(timestamp);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${diff}d`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDueDateStyle(timestamp: number): string {
  const diff = getDayDiff(timestamp);
  if (diff < 0) return "text-red-500 bg-red-500/10";
  if (diff <= 1) return "text-amber-500 bg-amber-500/10";
  return "text-text-tertiary bg-bg-tertiary";
}

/**
 * Grouped task data structure.
 */
interface TaskGroup {
  label: string;
  tasks: DbTask[];
}

/**
 * Props for TaskListView component.
 * @spec §3.3
 */
export interface TaskListViewProps {
  /** Tasks to display (already filtered and grouped) */
  tasks: DbTask[];
  /** Grouped tasks for rendering with headers */
  groupedTasks: TaskGroup[];
  /** Current density setting */
  density: TaskDensity;
  /** Set of selected task IDs for checkbox selection */
  selectedIds: Set<string>;
  /** Handler for toggling task completion */
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Handler for selecting a task (single click) */
  onSelect: (id: string) => void;
  /** Handler for shift-range selection */
  onShiftSelect?: (id: string, shiftKey: boolean) => void;
  /** Handler for deleting a task */
  onDelete?: (id: string) => void;
  /** Handler for opening task detail panel */
  onOpenDetail?: (id: string) => void;
  /** Map of task IDs to their subtasks */
  subtaskMap?: Record<string, DbTask[]>;
  /** Map of task IDs to contact info */
  contactMap?: Map<string, { name: string | null; avatar: string | null; email: string | null }>;
}

/**
 * Internal type for the virtualized row list — either a group header or a task row.
 */
type VirtualRow =
  | { type: "group-header"; label: string; key: string }
  | { type: "task"; task: DbTask; key: string };

/**
 * Estimate the pixel height of a group header row.
 */
const GROUP_HEADER_HEIGHT = 32;

/**
 * TaskListView - Desktop list view with density controls, checkbox selection,
 * and virtualized rendering via @tanstack/react-virtual.
 *
 * Features:
 * - Density support: compact (40px), normal (52px), comfortable (64px) row heights
 * - Checkbox selection with shift-range selection support
 * - Grouped rows with inline actions
 * - Virtualized rendering with measureElement for accurate sizing
 * - Row layout: [Checkbox] [PriorityDot] [Avatar] [Title + Tags] [DueDate] [Subtasks] [Actions]
 *
 * @spec §3.3
 */
export function TaskListView({
  tasks,
  groupedTasks,
  density,
  selectedIds,
  onToggleComplete,
  onSelect,
  onShiftSelect,
  onDelete,
  onOpenDetail,
  subtaskMap = {},
  contactMap = new Map(),
}: TaskListViewProps) {
  const heightClass = DENSITY_HEIGHTS[density];
  const paddingClass = DENSITY_PADDING[density];
  const estimatedRowHeight = DENSITY_PX[density];

  const taskColumns = useColumnConfigStore((s) => s.columnVisibility.tasks);
  const visibleColumns = useMemo(
    () => new Set(taskColumns.filter((c) => c.visible).map((c) => c.id)),
    [taskColumns],
  );

  const handleRowClick = useCallback(
    (task: DbTask, event: React.MouseEvent) => {
      const shiftKey = event.shiftKey;
      if (onShiftSelect) {
        onShiftSelect(task.id, shiftKey);
      } else {
        onSelect(task.id);
      }
      onOpenDetail?.(task.id);
    },
    [onShiftSelect, onSelect, onOpenDetail],
  );

  const handleToggleComplete = useCallback(
    (task: DbTask) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleComplete(task.id, !task.is_completed);
    },
    [onToggleComplete],
  );

  const handleDelete = useCallback(
    (task: DbTask) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(task.id);
    },
    [onDelete],
  );

  /**
   * Flatten groupedTasks into a VirtualRow array so the virtualizer can
   * treat group headers and task rows uniformly.
   */
  const virtualRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];
    for (const group of groupedTasks) {
      if (group.label) {
        rows.push({
          type: "group-header",
          label: group.label,
          key: `header-${group.label}`,
        });
      }
      for (const task of group.tasks) {
        rows.push({ type: "task", task, key: task.id });
      }
    }
    return rows;
  }, [groupedTasks]);

  /**
   * Parent ref for the virtualized scroll container.
   */
  const parentRef = useRef<HTMLDivElement>(null);

  /**
   * @tanstack/react-virtual virtualizer.
   * - estimateSize uses the density-based height for task rows and a smaller
   *   height for group headers.
   * - measureElement reads the actual DOM offsetHeight for precise sizing
   *   after the first render.
   */
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return estimatedRowHeight;
      return row.type === "group-header" ? GROUP_HEADER_HEIGHT : estimatedRowHeight;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 8,
    getItemKey: (index) => virtualRows[index]!.key,
  });

  const renderTaskRow = useCallback(
    (task: DbTask, isSubtask = false) => {
      const isSelected = selectedIds.has(task.id);
      const tags = getTags(task.tags_json);

      const subtasks = subtaskMap[task.id] ?? [];
      const completedSubtasks = subtasks.filter((s) => s.is_completed).length;
      const hasSubtasks = subtasks.length > 0;
      const hasRecurrence = !!task.recurrence_rule;
      const contactInfo = contactMap.get(task.id);

      return (
        <div
          key={task.id}
          onClick={(e) => handleRowClick(task, e)}
          className={`
            group flex items-center gap-2 px-3 rounded-lg cursor-pointer transition-all duration-150 ease-out
            ${isSelected ? "bg-accent/8 border border-accent/20 shadow-sm" : "hover:bg-bg-hover border border-transparent hover:border-border-primary/40"}
            ${task.is_completed ? "opacity-55" : ""}
            ${heightClass} ${paddingClass}
          `}
          role="row"
          aria-selected={isSelected}
        >
          {/* Checkbox */}
          {visibleColumns.has("checkbox") && (
            <button
              onClick={handleToggleComplete(task)}
              className="shrink-0"
              aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
            >
              {task.is_completed ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <Circle size={16} className="text-text-tertiary" />
              )}
            </button>
          )}

          {/* Priority Dot */}
          {visibleColumns.has("priority") && task.priority !== "none" && (
            <span
              className={`
                w-1.5 h-1.5 rounded-full shrink-0
                ${PRIORITY_DOT[task.priority as TaskPriority]}
              `}
              aria-label={`${task.priority} priority`}
            />
          )}

          {/* Avatar (contact or priority indicator) */}
          <div className="shrink-0">
            {contactInfo?.name ? (
              <span
                className="
                  w-5 h-5 rounded-full bg-accent/10 text-accent
                  flex items-center justify-center text-[0.625rem] font-semibold
                "
                title={`Linked to ${contactInfo.name}`}
              >
                {contactInfo.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          {/* Title + Tags */}
          <div className="flex-1 min-w-0">
            {visibleColumns.has("title") && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`
                    text-sm truncate
                    ${task.is_completed ? "line-through text-text-tertiary" : "text-text-primary"}
                  `}
                >
                  {task.title}
                </span>
              </div>
            )}

            {!isSubtask && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {visibleColumns.has("dueDate") && task.due_date && (
                  <span
                    className={`
                      inline-flex items-center gap-1 text-[0.6875rem] px-1.5 py-0.5 rounded
                      ${getDueDateStyle(task.due_date)}
                    `}
                  >
                    <Calendar size={10} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {hasRecurrence && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[0.6875rem] text-text-tertiary"
                    aria-label="Recurring"
                  >
                    ↻
                  </span>
                )}
                {visibleColumns.has("subtasks") && hasSubtasks && (
                  <span className="text-[0.6875rem] text-text-tertiary">
                    {completedSubtasks}/{subtasks.length}
                  </span>
                )}
                {visibleColumns.has("tags") && tags.map((tag) => (
                  <span
                    key={tag}
                    className="
                      text-[0.625rem] px-1.5 py-0.5 rounded-full
                      bg-accent/10 text-accent
                    "
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions (visible on hover) */}
          {visibleColumns.has("actions") && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasSubtasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Subtask expansion handled at parent level
                }}
                className="p-0.5 text-text-tertiary hover:text-text-primary"
                aria-label="Toggle subtasks"
              >
                <ChevronRight size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete(task)}
                className="p-0.5 text-text-tertiary hover:text-danger transition-colors"
                aria-label="Delete task"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          )}
        </div>
      );
    },
    [
      heightClass,
      paddingClass,
      selectedIds,
      visibleColumns,
      handleRowClick,
      handleToggleComplete,
      handleDelete,
      subtaskMap,
      contactMap,
      onDelete,
    ],
  );

  // ── Empty state ─────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Circle}
        title="No tasks"
        subtitle="Add a task above or press 't' on any email thread"
      />
    );
  }

  // ── Virtualized list ────────────────────────────────────────────────
  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      role="table"
      aria-label="Tasks list"
    >
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = virtualRows[virtualItem.index];
          if (!row) return null;

          if (row.type === "group-header") {
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="animate-[fadeSlideIn_200ms_ease-out]"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                  animationDelay: `${virtualItem.index * 20}ms`,
                }}
              >
                <h3
                  className="
                    text-xs font-semibold uppercase tracking-wider
                    text-text-tertiary px-3 py-2
                  "
                  role="presentation"
                >
                  {row.label}
                </h3>
              </div>
            );
          }

          // row.type === "task"
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="animate-[fadeSlideIn_200ms_ease-out]"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
                animationDelay: `${virtualItem.index * 20}ms`,
              }}
            >
              {renderTaskRow(row.task)}
            </div>
          );
        })}
      </div>
    </div>
  );
}