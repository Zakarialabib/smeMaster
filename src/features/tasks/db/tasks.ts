import { getTaskById, listTasks as dbListTasks, getTaskTagByTag as dbGetTaskTagByTag, tasksCountByContact as dbTasksCountByContact } from "@shared/services/db/db-invoke";
import {
  getTasksForAccount as dbGetTasksForAccount,
  getTasksWithContacts as dbGetTasksWithContacts,
  getTasksWithContactsPaginated as dbGetTasksWithContactsPaginated,
  countTasks as dbCountTasks,
  getTasksForThread as dbGetTasksForThread,
  getSubtasks as dbGetSubtasks,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  completeTask as dbCompleteTask,
  uncompleteTask as dbUncompleteTask,
  reorderTasks as dbReorderTasks,
  getIncompleteTaskCount as dbGetIncompleteTaskCount,
  getTasksForContact as dbGetTasksForContact,
  getTasksDueForReminder as dbGetTasksDueForReminder,
  getTasksWithWorkflow as dbGetTasksWithWorkflow,
  getTaskTags as dbGetTaskTags,
  upsertTaskTag as dbUpsertTaskTag,
  deleteTaskTag as dbDeleteTaskTag,
} from "@shared/services/db/db-invoke";
import type { ContactTaskCount } from "@shared/services/db/db-invoke";
import type { Task } from "@shared/services/db/schema";
import type { TaskTag } from "@shared/services/db/db-invoke";
import { logEntityEngagement } from "@features/contacts/services/engagement";
import { useTaskStore } from "../stores/taskStore";

export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export type DbTask = Task;

export type DbTaskTag = TaskTag;

export interface TaskWithContact extends DbTask {
  contact_name: string | null;
  contact_avatar: string | null;
  contact_email: string | null;
}

export async function getTasksForAccount(
  companyId: string | null,
  includeCompleted = false,
): Promise<DbTask[]> {
  return dbGetTasksForAccount(companyId, includeCompleted);
}

export async function getTasksForAccountWithContacts(
  companyId: string | null,
  includeCompleted = false,
): Promise<TaskWithContact[]> {
  return dbGetTasksWithContacts(companyId, includeCompleted);
}

/**
 * Get tasks with contact details for an account, paginated.
 * @param accountId - The account ID (null for all accounts)
 * @param includeCompleted - Whether to include completed tasks
 * @param limit - Maximum number of tasks
 * @param offset - Number of tasks to skip
 */
export async function getTasksForAccountWithContactsPaginated(
  companyId: string | null,
  includeCompleted: boolean,
  limit: number,
  offset: number,
): Promise<TaskWithContact[]> {
  return dbGetTasksWithContactsPaginated(companyId, includeCompleted, limit, offset);
}

/**
 * Count tasks for an account, optionally filtered by completion status.
 * @param accountId - The account ID (null for all accounts)
 * @param includeCompleted - Whether to include completed tasks in count
 */
export async function countTasksForAccount(
  companyId: string | null,
  includeCompleted: boolean,
): Promise<number> {
  const rows = await dbCountTasks(companyId, includeCompleted);
  return rows[0]?.count ?? 0;
}

export async function getTasksForThread(
  companyId: string,
  threadId: string,
): Promise<DbTask[]> {
  return dbGetTasksForThread(companyId, threadId);
}

export async function getSubtasks(parentId: string): Promise<DbTask[]> {
  return dbGetSubtasks(parentId);
}

export async function insertTask(task: {
  id?: string;
  accountId: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: number | null;
  parentId?: string | null;
  contactId?: string | null;
  threadId?: string | null;
  threadAccountId?: string | null;
  sortOrder?: number;
  recurrenceRule?: string | null;
  tagsJson?: string;
  workflowConfigJson?: string | null;
  reminderConfigJson?: string | null;
}): Promise<string> {
  const created = await dbCreateTask({
    companyId: task.accountId ?? undefined,
    title: task.title,
    description: task.description ?? null,
    priority: task.priority ?? "none",
    dueDate: task.dueDate ?? null,
    parentId: task.parentId ?? null,
    contactId: task.contactId ?? null,
    threadId: task.threadId ?? null,
    threadAccountId: task.threadAccountId ?? null,
    recurrenceRule: task.recurrenceRule ?? null,
    tagsJson: task.tagsJson ?? "[]",
    workflowConfigJson: task.workflowConfigJson ?? null,
    reminderConfigJson: task.reminderConfigJson ?? null,
  });
  return created.id;
}

export async function updateTask(
  id: string,
  updates: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    isCompleted?: boolean;
    dueDate?: number | null;
    contactId?: string | null;
    sortOrder?: number;
    recurrenceRule?: string | null;
    nextRecurrenceAt?: number | null;
    tagsJson?: string;
    workflowConfigJson?: string | null;
    reminderConfigJson?: string | null;
  },
): Promise<void> {
  // Optimistic UI update
  const storeUpdates: Partial<DbTask> = {};
  if (updates.title !== undefined) storeUpdates.title = updates.title;
  if (updates.description !== undefined) storeUpdates.description = updates.description;
  if (updates.priority !== undefined) storeUpdates.priority = updates.priority;
  if (updates.isCompleted !== undefined) storeUpdates.is_completed = Number(updates.isCompleted) as 0 | 1;
  if (updates.dueDate !== undefined) storeUpdates.due_date = updates.dueDate;
  if (updates.sortOrder !== undefined) storeUpdates.sort_order = updates.sortOrder;
  if (updates.tagsJson !== undefined) storeUpdates.tags_json = updates.tagsJson;
  useTaskStore.getState().updateTaskInStore(id, storeUpdates);

  await dbUpdateTask(id, {
    title: updates.title ?? null,
    description: updates.description ?? null,
    priority: updates.priority ?? null,
    isCompleted: updates.isCompleted ?? null,
    dueDate: updates.dueDate ?? null,
    sortOrder: updates.sortOrder ?? null,
    recurrenceRule: updates.recurrenceRule ?? null,
    tagsJson: updates.tagsJson ?? null,
    workflowConfigJson: updates.workflowConfigJson ?? null,
    reminderConfigJson: updates.reminderConfigJson ?? null,
  });
}

export async function deleteTask(id: string): Promise<void> {
  useTaskStore.getState().removeTask(id);
  await dbDeleteTask(id);
}

export async function completeTask(id: string): Promise<void> {
  useTaskStore.getState().updateTaskInStore(id, { is_completed: 1 });
  await dbCompleteTask(id);

  // Fire-and-forget engagement log; failure should not block completion.
  logEntityEngagement("task", id, "task_completed", 5).catch(() => {});
}

export async function uncompleteTask(id: string): Promise<void> {
  useTaskStore.getState().updateTaskInStore(id, { is_completed: 0 });
  await dbUncompleteTask(id);
}

export async function reorderTasks(
  taskIds: string[],
): Promise<void> {
  await dbReorderTasks(taskIds);
}

export async function getIncompleteTaskCount(
  companyId: string | null,
): Promise<number> {
  return dbGetIncompleteTaskCount(companyId);
}

export async function getTasksForContact(
  contactId: string,
  includeCompleted = false,
): Promise<DbTask[]> {
  return dbGetTasksForContact(contactId, includeCompleted);
}

export async function getTasksDueForReminder(): Promise<DbTask[]> {
  return dbGetTasksDueForReminder();
}

export async function getTasksWithWorkflow(): Promise<DbTask[]> {
  return dbGetTasksWithWorkflow();
}

export async function getTaskTags(
  companyId: string | null,
): Promise<DbTaskTag[]> {
  return dbGetTaskTags(companyId);
}

export async function upsertTaskTag(
  tag: string,
  companyId: string | null,
  color?: string | null,
): Promise<void> {
  await dbUpsertTaskTag(tag, companyId, color ?? null);
}

export async function deleteTaskTag(
  tag: string,
  companyId: string | null,
): Promise<void> {
  await dbDeleteTaskTag(tag, companyId);
}

export async function getTaskTagByTag(tag: string): Promise<TaskTag | null> {
  return dbGetTaskTagByTag(tag);
}

export async function tasksCountByContact(): Promise<ContactTaskCount[]> {
  return dbTasksCountByContact();
}

// Re-export for convenience
export type { ContactTaskCount };
export { getTaskById  };
export { dbListTasks as listTasks };
