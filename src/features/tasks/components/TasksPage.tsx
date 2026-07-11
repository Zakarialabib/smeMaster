import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckSquare,
  Search,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  Plus,
  Calendar,
  ListTodo,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useTaskStore } from "@features/tasks/stores/taskStore";
import { useTaskViewPrefs } from "@features/tasks/hooks/useTaskViewPrefs";
import {
  getTasksForAccountWithContactsPaginated,
  countTasksForAccount,
  insertTask,
  completeTask,
  uncompleteTask,
  deleteTask as dbDeleteTask,
  updateTask as dbUpdateTask,
  getSubtasks,
  getIncompleteTaskCount,
  type DbTask,
  type TaskWithContact,
  type TaskPriority,
} from "@features/tasks/db/tasks";
import { handleRecurringTaskCompletion } from "@features/tasks/services/taskManager";
import { safeDbOperation } from "@features/tasks/services/errorHandler";
import { useMobile } from "@shared/hooks/useMobile";
import { usePagination } from "@shared/hooks/usePagination";
import { PaginationControls } from "@shared/components/ui/PaginationControls";
import { useGestureActions } from "@shared/hooks/useGestureActions";
import { TaskItem } from "./TaskItem";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { TaskCreateModal } from "./TaskCreateModal";
import { SmartFilterBar } from "./SmartFilterBar";
import { ViewToggle } from "./ViewToggle";
import { TaskKanbanView } from "./TaskKanbanView";
import { TaskAgendaView } from "./TaskAgendaView";
import { TaskCalendarView } from "./TaskCalendarView";
import { TaskMobileDetailSheet } from "./TaskMobileDetailSheet";
import { AiTaskSuggestionBanner } from "./AiTaskSuggestionBanner";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { notify } from "@shared/services/notifications/toastHelper";
import { EmptyStateTask } from "./EmptyStateTask";
import { SwipeableRow } from "@shared/components/ui/SwipeableRow";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import type { SwipeActions } from "@shared/hooks/useSwipeGesture";
import { useNavigate } from "@tanstack/react-router";
import { SkeletonPage, GlassPanel } from "@shared/components/ui";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const PRIORITY_BADGE: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  urgent: { label: "Urgent", bg: "bg-red-500/15", text: "text-red-500" },
  high: { label: "High", bg: "bg-orange-500/15", text: "text-orange-500" },
  medium: { label: "Medium", bg: "bg-amber-500/15", text: "text-amber-500" },
  low: { label: "Low", bg: "bg-blue-500/15", text: "text-blue-400" },
none: { label: "", bg: "", text: "" },
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

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

export function TasksPage() {
  const isMobile = useMobile();
  const [showFilters, setShowFilters] = useState(false);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.isActive);
  const accountId = activeAccount?.id ?? null;

  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useTaskStore((s) => s.setSelectedTaskId);
  const searchQuery = useTaskStore((s) => s.searchQuery);
  const setSearchQuery = useTaskStore((s) => s.setSearchQuery);

  // View preferences (localStorage persisted)
  const viewMode = useTaskViewPrefs((s) => s.viewMode);
  const setViewMode = useTaskViewPrefs((s) => s.setViewMode);
  const density = useTaskViewPrefs((s) => s.density);
  const setDensity = useTaskViewPrefs((s) => s.setDensity);
  const sortField = useTaskViewPrefs((s) => s.sortField);
  const sortDirection = useTaskViewPrefs((s) => s.sortDirection);
  const setSort = useTaskViewPrefs((s) => s.setSort);
  const dateFilter = useTaskViewPrefs((s) => s.dateFilter);
  const setDateFilter = useTaskViewPrefs((s) => s.setDateFilter);
  const groupBy = useTaskViewPrefs((s) => s.groupBy);
  const setGroupBy = useTaskViewPrefs((s) => s.setGroupBy);
  const filterStatus = useTaskViewPrefs((s) => s.filterStatus);
  const setFilterStatus = useTaskViewPrefs((s) => s.setFilterStatus);
  const filterPriority = useTaskViewPrefs((s) => s.filterPriority);
  const setFilterPriority = useTaskViewPrefs((s) => s.setFilterPriority);

  const [subtaskMap, setSubtaskMap] = useState<Record<string, DbTask[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const aiEnabled = useFeatureFlagStore((s) => s.getFeatureAccess("ai_assistant", 0) !== "locked");
  const [contactMap, setContactMap] = useState<Map<string, { name: string | null; avatar: string | null; email: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mobile-specific state
  const [showMobileQuickAdd, setShowMobileQuickAdd] = useState(false);
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [mobileDetailTaskId, setMobileDetailTaskId] = useState<string | null>(null);

  // Swipe gesture actions
  const swipeTaskRef = useRef<DbTask | null>(null);

  const { executeAction } = useGestureActions({
    context: 'tasks',
    customActions: [
      {
        id: 'complete',
        label: 'Complete',
        icon: null,
        direction: 'left',
        color: 'bg-emerald-500',
        onAction: () => {
          const task = swipeTaskRef.current;
          if (task) handleToggleComplete(task.id, !task.is_completed);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: null,
        direction: 'long-left',
        destructive: true,
        color: 'bg-red-500',
        onAction: () => {
          const task = swipeTaskRef.current;
          if (task) handleDelete(task.id);
        },
      },
    ],
  });

  // Paginated task loading
  const includeCompleted = filterStatus !== "incomplete";
  const paginationOptions = useMemo(() => ({
    fetchFn: async ({ limit, offset }: { limit: number; offset: number }) => {
      const loaded: TaskWithContact[] = await getTasksForAccountWithContactsPaginated(
        accountId, includeCompleted, limit, offset,
      );
      const total = await countTasksForAccount(accountId, includeCompleted);
      // Build contact map from the rich result before casting
      const map = new Map<string, { name: string | null; avatar: string | null; email: string | null }>();
      for (const t of loaded) {
        if (t.contact_name) {
          map.set(t.id, { name: t.contact_name, avatar: t.contact_avatar, email: t.contact_email });
        }
      }
      setContactMap(map);
      return { items: loaded as unknown as DbTask[], total };
    },
    pageSize: 50,
    deps: [accountId, includeCompleted],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [accountId, includeCompleted]);

  const {
    items: paginatedTasks,
    total: totalTasks,
    currentPage: taskPage,
    totalPages: taskTotalPages,
    loading: tasksLoading,
    error: paginationError,
    goToPage: goToTaskPage,
    reset: resetTasks,
    setPageSize: setTaskPageSize,
  } = usePagination(paginationOptions);

  // Sync paginated tasks to store
  useEffect(() => {
    setTasks(paginatedTasks);
  }, [paginatedTasks, setTasks]);

  // Sync loading and error states
  useEffect(() => {
    setLoading(tasksLoading);
  }, [tasksLoading]);

  useEffect(() => {
    if (paginationError) {
      // Show user-friendly message instead of raw IPC errors
      const friendly = paginationError.includes("Cannot read properties of undefined")
        || paginationError.includes("invoke")
        ? "Could not connect to the database. Some features may be unavailable in browser preview mode."
        : paginationError;
      setError(friendly);
    }
  }, [paginationError]);

  // Refresh incomplete count whenever paginated tasks change
  useEffect(() => {
    if (accountId) {
      getIncompleteTaskCount(accountId).then((count) => {
        useTaskStore.getState().setIncompleteCount(count);
      }).catch(() => {});
    }
  }, [accountId, paginatedTasks]);

  // Load subtasks
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const map: Record<string, DbTask[]> = {};
      for (const task of tasks) {
        const subs = await getSubtasks(task.id);
        if (subs.length > 0) map[task.id] = subs;
      }
      if (!cancelled) setSubtaskMap(map);
    }
    load();
    return () => { cancelled = true; };
  }, [tasks]);

  // Filter + search + sort
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterStatus === "completed") {
      result = result.filter((t) => t.is_completed);
    } else if (filterStatus === "incomplete") {
      result = result.filter((t) => !t.is_completed);
    }

    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }

    // Date quick filter (from SmartFilterBar)
    if (dateFilter === "today") {
      result = result.filter((t) => t.due_date && getDayDiff(t.due_date) === 0);
    } else if (dateFilter === "thisWeek") {
      result = result.filter((t) => {
        if (!t.due_date) return false;
        const diff = getDayDiff(t.due_date);
        return diff >= 0 && diff <= 7;
      });
    } else if (dateFilter === "overdue") {
      result = result.filter((t) => t.due_date && getDayDiff(t.due_date) < 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
      );
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "priority": {
          const aP = PRIORITY_ORDER[a.priority as TaskPriority] ?? 99;
          const bP = PRIORITY_ORDER[b.priority as TaskPriority] ?? 99;
          comparison = aP - bP;
          break;
        }
        case "dueDate": {
          if (!a.due_date && !b.due_date) comparison = 0;
          else if (!a.due_date) comparison = 1;
          else if (!b.due_date) comparison = -1;
          else comparison = a.due_date - b.due_date;
          break;
        }
        case "title": {
          comparison = a.title.localeCompare(b.title);
          break;
        }
        case "created": {
          comparison = (a.created_at || 0) - (b.created_at || 0);
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [tasks, filterStatus, filterPriority, searchQuery, dateFilter, sortField, sortDirection]);

  // Grouping
  const groupedTasks = useMemo(() => {
    if (groupBy === "none") return [{ label: "", tasks: filteredTasks }];

    const groups = new Map<string, DbTask[]>();

    for (const task of filteredTasks) {
      let key: string;
      switch (groupBy) {
        case "priority":
          key = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
          break;
        case "dueDate":
          if (!task.due_date) key = "No due date";
          else {
            const d = new Date(task.due_date * 1000);
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dueStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diff = Math.floor((dueStart.getTime() - todayStart.getTime()) / 86400000);
            if (diff < 0) key = "Overdue";
            else if (diff === 0) key = "Today";
            else if (diff === 1) key = "Tomorrow";
            else if (diff <= 7) key = "This week";
            else key = "Later";
          }
          break;
        case "tag": {
          const tags: string[] = (() => { try { return JSON.parse(task.tags_json); } catch { return []; } })();
          key = tags[0] ?? "Untagged";
          break;
        }
        default:
          key = "";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }

    // Sort groups by priority order if grouping by priority
    const entries = [...groups.entries()];
    if (groupBy === "priority") {
      entries.sort((a, b) => {
        const aP = PRIORITY_ORDER[a[0].toLowerCase() as TaskPriority] ?? 99;
        const bP = PRIORITY_ORDER[b[0].toLowerCase() as TaskPriority] ?? 99;
        return aP - bP;
      });
    }

    return entries.map(([label, tasks]) => ({ label, tasks }));
  }, [filteredTasks, groupBy]);

  const handleAddTask = useCallback(async (title: string) => {
    if (!accountId) return;
    const result = await safeDbOperation(
      () => insertTask({ accountId, title }),
      { operationLabel: "create task" },
    );
    if (result.success) {
      notify("Task created", `"${title}" has been added.`);
      await resetTasks();
    } else {
      notify("Failed to create task", result.error);
    }
  }, [accountId, resetTasks]);

  const handleModalCreate = useCallback(async (_taskId: string) => {
    await resetTasks();
    setShowCreateModal(false);
  }, [resetTasks]);

  const handleToggleComplete = useCallback(async (id: string, completed: boolean) => {
    // Optimistic UI — update store immediately
    useTaskStore.getState().updateTaskInStore(id, { is_completed: completed ? 1 : 0 });
    const result = await safeDbOperation(
      async () => {
        if (completed) {
          const task = tasks.find((t) => t.id === id);
          if (task?.recurrence_rule) {
            await handleRecurringTaskCompletion(id);
          } else {
            await completeTask(id);
          }
        } else {
          await uncompleteTask(id);
        }
      },
      { operationLabel: completed ? "complete task" : "uncomplete task" },
    );
    if (result.success) {
      if (completed) notify("Task completed", "Way to go!");
      await resetTasks();
    } else {
      // Rollback optimistic update
      useTaskStore.getState().updateTaskInStore(id, { is_completed: completed ? 0 : 1 });
      notify("Failed to update task", result.error);
    }
  }, [tasks, resetTasks]);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic UI — remove from store immediately
    useTaskStore.getState().removeTask(id);
    const result = await safeDbOperation(
      () => dbDeleteTask(id),
      { operationLabel: "delete task" },
    );
    if (result.success) {
      await resetTasks();
    } else {
      // Rollback via full reload
      notify("Failed to delete task", result.error);
      await resetTasks();
    }
  }, [resetTasks]);

  const handleTogglePriority = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newPriority: TaskPriority = task.priority === "high" ? "none" : "high";
    // Optimistic UI
    useTaskStore.getState().updateTaskInStore(id, { priority: newPriority });
    const result = await safeDbOperation(
      () => dbUpdateTask(id, { priority: newPriority }),
      { operationLabel: "update task priority" },
    );
    if (result.success) {
      await resetTasks();
    } else {
      // Rollback
      useTaskStore.getState().updateTaskInStore(id, { priority: task.priority });
      notify("Failed to update priority", result.error);
    }
  }, [tasks, resetTasks]);

  const handleOpenDetail = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, [setSelectedTaskId]);

  const handleContactClick = useCallback((contactId: string) => {
    navigate({ to: "/people/$contactId", params: { contactId } });
  }, [navigate]);

  const handleTaskUpdated = useCallback(() => {
    setSelectedTaskId(null);
    resetTasks();
  }, [resetTasks, setSelectedTaskId]);

  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null);
  }, [setSelectedTaskId]);

  const getSwipeActions = useCallback((task: DbTask): SwipeActions => ({
    left: {
      primary: {
        label: task.is_completed ? "Undo" : "Complete",
        icon: "check-circle-2",
        color: "bg-emerald-500",
        onAction: () => {
          swipeTaskRef.current = task;
          executeAction("left");
        },
      },
      secondary: {
        label: "Delete",
        icon: "trash-2",
        color: "bg-red-500",
        onAction: () => {
          swipeTaskRef.current = task;
          executeAction("long-left");
        },
        destructive: true,
      },
    },
    right: {
      primary: {
        label: task.priority === "high" ? "Unflag" : "Flag",
        icon: "star",
        color: "bg-amber-500",
        onAction: () => handleTogglePriority(task.id),
      },
    },
  }), [executeAction, handleTogglePriority]);

  const handleBulkComplete = useCallback(async () => {
    let completedCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      const result = await safeDbOperation(
        () => completeTask(id),
        { operationLabel: "complete task" },
      );
      if (result.success) completedCount++;
      else failCount++;
    }
    setSelectedIds(new Set());
    if (completedCount > 0) {
      notify("Tasks completed", `${completedCount} task(s) marked done.`);
    }
    if (failCount > 0) {
      notify("Some tasks failed", `${failCount} task(s) could not be completed.`);
    }
    await resetTasks();
  }, [selectedIds, resetTasks]);

  const handleBulkDelete = useCallback(async () => {
    let deletedCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      const result = await safeDbOperation(
        () => dbDeleteTask(id),
        { operationLabel: "delete task" },
      );
      if (result.success) deletedCount++;
      else failCount++;
    }
    setSelectedIds(new Set());
    if (deletedCount > 0) {
      notify("Tasks deleted", `${deletedCount} task(s) removed.`);
    }
    if (failCount > 0) {
      notify("Some deletions failed", `${failCount} task(s) could not be deleted.`);
    }
    await resetTasks();
  }, [selectedIds, resetTasks]);

  const handleMobileCardTap = useCallback((taskId: string) => {
    setMobileExpandedId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const handleMobileAddTask = useCallback(async (title: string) => {
    await handleAddTask(title);
    setShowMobileQuickAdd(false);
  }, [handleAddTask]);

  const handleMobileOpenDetail = useCallback((id: string) => {
    setMobileDetailTaskId(id);
    setShowMobileDetail(true);
  }, []);

  const handleMobileCloseDetail = useCallback(() => {
    setShowMobileDetail(false);
    setMobileDetailTaskId(null);
  }, []);

  const handleTaskMove = useCallback(async (taskId: string, newDate: Date) => {
    const dueDate = Math.floor(newDate.getTime() / 1000);
    const result = await safeDbOperation(
      () => dbUpdateTask(taskId, { dueDate }),
      { operationLabel: "reschedule task" },
    );
    if (result.success) {
      await resetTasks();
    } else {
      notify("Failed to reschedule task", result.error);
    }
  }, [resetTasks]);

  const handleKanbanTaskMove = useCallback(async (taskId: string, newColumn: string) => {
    if (newColumn === "completed") {
      await handleToggleComplete(taskId, true);
    } else {
      await handleToggleComplete(taskId, false);
    }
  }, [handleToggleComplete]);

  const handleKanbanTaskReorder = useCallback(async (_taskId: string, _columnId: string, _newIndex: number) => {
    await resetTasks();
  }, [resetTasks]);

  const handleKanbanAddTask = useCallback((_columnId?: string) => {
    setShowCreateModal(true);
  }, []);

  const renderMobileCard = useCallback((task: DbTask) => {
    const subtasks = subtaskMap[task.id];
    const subtaskCount = subtasks?.length ?? 0;
    const completedSubtasks = subtasks?.filter((s) => s.is_completed).length ?? 0;
    const isExpanded = mobileExpandedId === task.id;
    const priorityBadge = PRIORITY_BADGE[task.priority as TaskPriority];
    const tags: string[] = (() => { try { return JSON.parse(task.tags_json); } catch { return []; } })();

    return (
      <div key={task.id} className="mb-2.5 last:mb-0">
        <SwipeableRow
          actions={getSwipeActions(task)}
          threshold={70}
          maxSwipe={150}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={`Task: ${task.title}`}
            onClick={() => handleMobileCardTap(task.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleMobileCardTap(task.id); }}
            className={`relative rounded-2xl px-4 py-3.5 cursor-pointer active:scale-[0.97] transition-all duration-150 select-none shadow-sm ${
              task.is_completed
                ? "bg-white/5 dark:bg-white/5 border border-white/10 opacity-60"
                : "bg-white/10 dark:bg-white/8 backdrop-blur-[12px] border border-white/15 dark:border-white/8"
            } ${isExpanded ? "ring-1 ring-accent/40" : ""}`}
          >
            {/* Top row: priority dot + title + checkbox */}
            <div className="flex items-start gap-3">
              {/* Checkbox / completion toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleComplete(task.id, !task.is_completed); }}
                className="mt-0.5 shrink-0"
                aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
              >
                {task.is_completed ? (
                  <CheckCircle2 size={20} className="text-success" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    PRIORITY_DOT[task.priority as TaskPriority]
                  }`} />
                )}
              </button>

              {/* Title and metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {task.priority !== "none" && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority as TaskPriority]}`} />
                  )}
                  <span className={`text-[15px] font-medium truncate leading-snug ${
                    task.is_completed ? "line-through text-text-tertiary" : "text-text-primary"
                  }`}>
                    {task.title}
                  </span>
                </div>

                {/* Badge row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {task.due_date && (
                    <span className={`inline-flex items-center gap-1 text-[0.6rem] font-medium px-2 py-0.5 rounded-full ${getDueDateStyle(task.due_date)}`}>
                      <Calendar size={9} />
                      {formatDueDate(task.due_date)}
                    </span>
                  )}
                  {priorityBadge.label && (
                    <span className={`inline-flex items-center text-[0.6rem] font-medium px-2 py-0.5 rounded-full ${priorityBadge.bg} ${priorityBadge.text}`}>
                      {priorityBadge.label}
                    </span>
                  )}
                  {subtaskCount > 0 && (
                    <span className="text-[0.6rem] text-text-tertiary bg-white/10 px-2 py-0.5 rounded-full">
                      {completedSubtasks}/{subtaskCount}
                    </span>
                  )}
                  {task.recurrence_rule && (
                    <span className="text-[0.6rem] text-text-tertiary" aria-label="Recurring">â†»</span>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-[fadeIn_150ms_ease-out]">
                {task.description && (
                  <p className="text-xs text-text-secondary leading-relaxed">{task.description}</p>
                )}

                {subtaskCount > 0 && (
                  <div className="space-y-1">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-tertiary">
                      Subtasks ({completedSubtasks}/{subtaskCount})
                    </p>
                    {subtasks!.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 py-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleComplete(sub.id, !sub.is_completed); }}
                          className="shrink-0"
                        >
                          {sub.is_completed ? (
                            <CheckCircle2 size={14} className="text-success" />
                          ) : (
                            <div className="w-[14px] h-[14px] rounded-full border-2 border-text-tertiary/40" />
                          )}
                        </button>
                        <span className={`text-xs truncate ${sub.is_completed ? "line-through text-text-tertiary" : "text-text-primary"}`}>
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span key={tag} className="text-[0.55rem] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {task.thread_id && (
                  <p className="text-[0.55rem] text-accent/60 flex items-center gap-1">
                    <span>ðŸ”—</span> Linked to email thread
                  </p>
                )}
              </div>
            )}
          </div>
        </SwipeableRow>
      </div>
    );
  }, [subtaskMap, mobileExpandedId, getSwipeActions, handleToggleComplete, handleMobileCardTap]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-primary/50">
      {/* Header â€” compact for mobile, spacious for desktop */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-border-primary shrink-0 bg-bg-primary/60 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <CheckSquare size={16} className="text-accent shrink-0 sm:size-[18]" />
          <h1 className="text-sm sm:text-base font-semibold text-text-primary whitespace-nowrap">Tasks</h1>
          {filteredTasks.length > 0 && (
            <span className="text-[0.625rem] sm:text-xs text-text-tertiary bg-bg-tertiary px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
              {filteredTasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-24 sm:w-48 pl-7 pr-2.5 py-1.5 bg-bg-tertiary border border-border-primary rounded-lg text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* Desktop: Columns + ViewToggle + filter controls */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <ViewToggle
                viewMode={viewMode}
                density={density}
                onViewModeChange={setViewMode}
                onDensityChange={setDensity}
                taskCount={filteredTasks.length}
              />
            </div>
          )}

          {/* Mobile filter toggle */}
          {isMobile && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-1.5 rounded-lg border ${showFilters ? "bg-accent/10 border-accent text-accent" : "border-border-primary text-text-tertiary"}`}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal size={14} />
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestion Banner â€” only show when AI feature is enabled */}
      {aiEnabled && (
        <AiTaskSuggestionBanner
          suggestionCount={0}
          onReview={() => {}}
          onDismiss={() => {}}
        />
      )}

      {/* SmartFilterBar (desktop + mobile) â€” replaces raw <select> filters */}
      <SmartFilterBar
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortBy={sortField === "title" ? "alphabetical" : (sortField as any)}
        onSortChange={(s) => {
          const newField = s === "alphabetical" ? "title" : (s as any);
          const newDir = newField === sortField ? (sortDirection === "asc" ? "desc" : "asc") : "asc";
          setSort(newField, newDir);
        }}
        dateFilter={dateFilter}
        onDateFilterChange={(f) => setDateFilter(f as any)}
      />

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 bg-accent/5 border-b border-accent/20 shrink-0">
          <span className="text-xs text-text-secondary">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkComplete}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
          >
            <CheckCircle2 size={13} />
            Complete
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 text-xs text-danger hover:opacity-80"
          >
            <Trash2 size={13} />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-text-tertiary hover:text-text-primary ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Desktop: Quick add (always visible) + Create button */}
      {!isMobile && (
        <div className="border-b border-border-primary px-2 shrink-0">
          <div className="flex items-center gap-1">
            <TaskQuickAdd
              onQuickAdd={handleAddTask}
              onModalCreate={handleModalCreate}
              accountId={accountId}
              placeholder="Add a task..."
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 mr-1 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors shrink-0"
              aria-label="Create task with full details"
            >
              <ListTodo size={13} />
              New task
            </button>
          </div>
        </div>
      )}

      {/* Mobile: Quick add (shown via FAB) */}
      {isMobile && showMobileQuickAdd && (
        <div className="border-b border-border-primary px-3 py-2 bg-bg-primary/60 shrink-0 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-secondary shrink-0">
              <Plus size={14} className="text-accent" />
            </span>
            <input
              type="text"
              placeholder="Quick add task..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) handleMobileAddTask(value);
                  (e.target as HTMLInputElement).value = "";
                }
                if (e.key === "Escape") {
                  setShowMobileQuickAdd(false);
                }
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  if (!e.target.value.trim()) setShowMobileQuickAdd(false);
                }, 200);
              }}
            />
            <button
              onClick={() => { setShowCreateModal(true); setShowMobileQuickAdd(false); }}
              className="flex items-center gap-1 px-2 py-1 text-[0.6875rem] font-medium text-accent hover:text-accent-hover bg-accent/10 rounded-md transition-colors shrink-0"
              aria-label="Open full task form"
            >
              Details
            </button>
          </div>
        </div>
      )}

      {/* Task list â€” view mode switching */}
      {isMobile ? (
        <>
          {viewMode === "agenda" ? (
            <TaskAgendaView
              tasks={filteredTasks}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={handleMobileOpenDetail}
              onDelete={handleDelete}
            />
          ) : (
            <PullToRefresh
              onRefresh={resetTasks}
              refreshing={loading}
              className="flex-1 overflow-hidden"
            >
              <div
                className="h-full overflow-y-auto px-3 py-3 pb-24"
                aria-busy={loading && filteredTasks.length === 0}
                aria-live="polite"
                aria-label="Tasks list"
              >
                {loading && tasks.length === 0 ? (
                  <div className="space-y-3 px-3 pt-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="rounded-2xl bg-white/8 dark:bg-white/5 p-4 animate-pulse border border-white/10">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-white/15 shrink-0" />
                          <div className="flex-1 space-y-2.5">
                            <div className="h-4 w-3/4 rounded-full bg-white/15" />
                            <div className="h-3 w-1/2 rounded-full bg-white/8" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="mx-3 mt-3 p-4 rounded-2xl bg-danger/10 border border-danger/20 backdrop-blur-[12px]">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">Unable to load tasks</p>
                        <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{error}</p>
                      </div>
                      <button
                        onClick={resetTasks}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-accent rounded-full active:scale-95 transition-transform"
                      >
                        <RefreshCw size={12} />
                        Retry
                      </button>
                    </div>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <EmptyStateTask
                    variant={searchQuery ? "search-empty" : "no-tasks"}
                    viewMode="list"
                    onAction={() => setShowMobileQuickAdd(true)}
                  />
                ) : (
                  <div className="space-y-1">
                    {groupedTasks.map((group) => (
                      <div key={group.label || "__ungrouped"}>
                        {group.label && (
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 px-1 pt-1">
                            {group.label}
                          </h3>
                        )}
                        {group.tasks.map((task) => renderMobileCard(task))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PullToRefresh>
          )}
        </>
      ) : (
        /* Desktop view switching */
        <div
          className="flex-1 overflow-y-auto"
          aria-busy={loading && filteredTasks.length === 0}
          aria-live="polite"
          aria-label="Tasks list"
        >
          {loading ? (
            <SkeletonPage />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <AlertCircle size={40} className="text-danger-text opacity-60" />
              <p className="text-sm font-medium text-text-primary">Failed to load tasks</p>
              <p className="text-xs text-text-tertiary text-center max-w-sm">{error}</p>
              <button
                onClick={resetTasks}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyStateTask
              variant={searchQuery ? "search-empty" : viewMode === "kanban" ? "view-empty" : "no-tasks"}
              viewMode={viewMode}
              onAction={() => {}}
            />
          ) : viewMode === "kanban" ? (
            <TaskKanbanView
              tasks={filteredTasks}
              columnsBy="status"
              onTaskMove={handleKanbanTaskMove}
              onTaskReorder={handleKanbanTaskReorder}
              onOpenDetail={handleOpenDetail}
              onToggleComplete={handleToggleComplete}
              onAddTask={handleKanbanAddTask}
              subtaskMap={subtaskMap}
              contactMap={contactMap}
            />
          ) : viewMode === "calendar" ? (
            <TaskCalendarView
              tasks={filteredTasks}
              onTaskClick={handleOpenDetail}
              onTaskMove={handleTaskMove}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDelete}
            />
          ) : viewMode === "agenda" ? (
            <TaskAgendaView
              tasks={filteredTasks}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={handleOpenDetail}
              onDelete={handleDelete}
            />
          ) : (
            /* Default: List view */
            <GlassPanel variant="card" className="m-3">
            <div className="py-2 px-3">
              {groupedTasks.map((group) => (
                <div key={group.label || "__ungrouped"}>
                  {group.label && (
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 px-3">
                      {group.label}
                    </h3>
                  )}
                  <div className="space-y-0.5">
                    {group.tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        subtasks={subtaskMap[task.id]}
                        onToggleComplete={handleToggleComplete}
                        onSelect={setSelectedTaskId}
                        onDelete={handleDelete}
                        onOpenDetail={handleOpenDetail}
                        onContactClick={handleContactClick}
                        contactName={contactMap.get(task.id)?.name ?? undefined}
                        contactId={task.contact_id}
                        isSelected={selectedTaskId === task.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls
        currentPage={taskPage}
        totalPages={taskTotalPages}
        pageSize={50}
        totalItems={totalTasks}
        onPageChange={goToTaskPage}
        onPageSizeChange={setTaskPageSize}
      />

      {/* Task Detail Panel (desktop) */}
      {selectedTaskId && !isMobile && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          accountId={accountId}
          onClose={handleCloseDetail}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Mobile Detail Sheet */}
      {isMobile && showMobileDetail && mobileDetailTaskId && (
        <TaskMobileDetailSheet
          taskId={mobileDetailTaskId}
          isOpen={showMobileDetail}
          onClose={handleMobileCloseDetail}
          onTaskUpdated={resetTasks}
          task={tasks.find((t) => t.id === mobileDetailTaskId) ?? null}
          onDelete={handleDelete}
        />
      )}

      {/* Task Create Modal */}
      {showCreateModal && (
        <TaskCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleModalCreate}
          accountId={accountId}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => setShowMobileQuickAdd((v) => !v)}
          className={`fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-accent/30 transition-all duration-200 active:scale-85 ${
            showMobileQuickAdd
              ? "bg-accent rotate-45"
              : "bg-accent"
          }`}
          aria-label={showMobileQuickAdd ? "Close quick add" : "Add task"}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}
    </div>
  );
}
