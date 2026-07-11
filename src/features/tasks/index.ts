export type {
  DbTask,
  DbTaskTag,
  TaskPriority,
} from "./db/tasks";

export type {
  TaskGroupBy,
  TaskFilterStatus,
  TaskViewMode,
  TaskDensity,
  TaskSortField,
  TaskDateFilter,
  TaskFilterPriority,
  TaskViewPrefs,
} from "./hooks/useTaskViewPrefs";

export { useTaskStore } from "./stores/taskStore";
export { useTaskViewPrefs } from "./hooks/useTaskViewPrefs";

export type {
  RecurrenceRule,
} from "./services/taskManager";

export {
  parseRecurrenceRule,
  calculateNextOccurrence,
  handleRecurringTaskCompletion,
} from "./services/taskManager";

export {
  safeDbOperation,
  type DbResult,
  type SafeDbOptions,
} from "./services/errorHandler";

export {
  getTasksForAccount,
  getTaskById,
  getTasksForThread,
  getSubtasks,
  insertTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  reorderTasks,
  getIncompleteTaskCount,
  getTaskTags,
  upsertTaskTag,
  deleteTaskTag,
} from "./db/tasks";
