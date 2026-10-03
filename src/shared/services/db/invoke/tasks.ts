import { invokeCommand } from './command';

import type { ScheduledEmail, Task } from '../schema';

import type {
  ContactTaskCount,
  CountRow,
  CreateScheduledEmailRequest,
  CreateTaskRequest,
  TaskTag,
  TaskWithContact,
  UpdateTaskRequest,
} from './core';

export async function listTasks(
  companyId?: string | null,
  isCompleted?: boolean | null,
): Promise<Task[]> {
  return invokeCommand<Task[]>('db_list_tasks', {
    companyId: companyId ?? null,
    isCompleted: isCompleted ?? null,
  });
}

export async function listTaskTags(): Promise<TaskTag[]> {
  return invokeCommand<TaskTag[]>('db_list_task_tags');
}

export async function getTaskById(id: string): Promise<Task | null> {
  return invokeCommand<Task | null>('db_get_task', { id });
}

export async function createTask(task: CreateTaskRequest): Promise<Task> {
  return invokeCommand<Task>('db_create_task', {
    companyId: task.companyId ?? undefined,
    title: task.title,
    description: task.description ?? undefined,
    priority: task.priority,
    dueDate: task.dueDate ?? undefined,
    parentId: task.parentId ?? undefined,
    contactId: task.contactId ?? undefined,
    threadId: task.threadId ?? undefined,
    threadAccountId: task.threadAccountId ?? undefined,
    recurrenceRule: task.recurrenceRule ?? undefined,
    tagsJson: task.tagsJson ?? undefined,
    workflowConfigJson: task.workflowConfigJson ?? undefined,
    reminderConfigJson: task.reminderConfigJson ?? undefined,
  });
}

export async function updateTask(id: string, request: UpdateTaskRequest): Promise<void> {
  return invokeCommand<void>('db_update_task', { id, request });
}

export async function createScheduledEmail(
  scheduledEmail: CreateScheduledEmailRequest,
): Promise<ScheduledEmail> {
  return invokeCommand<ScheduledEmail>('db_create_scheduled_email', { scheduledEmail });
}

export async function getTasksForAccount(
  companyId: string | null,
  includeCompleted: boolean,
): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_tasks_for_account', { companyId, includeCompleted });
}

export async function getTasksWithContacts(
  companyId: string | null,
  includeCompleted: boolean,
): Promise<TaskWithContact[]> {
  return invokeCommand<TaskWithContact[]>('db_get_tasks_with_contacts', {
    companyId,
    includeCompleted,
  });
}

export async function getTasksWithContactsPaginated(
  companyId: string | null,
  includeCompleted: boolean,
  limit: number,
  offset: number,
): Promise<TaskWithContact[]> {
  return invokeCommand<TaskWithContact[]>('db_get_tasks_with_contacts_paginated', {
    companyId,
    includeCompleted,
    limit,
    offset,
  });
}

export async function filterTasks(
  companyId: string | null,
  options: {
    includeCompleted?: boolean;
    priority?: string | null;
    dateFilter?: string | null;
    search?: string | null;
    sortField?: string;
    sortDirection?: string;
    limit: number;
    offset: number;
  },
): Promise<TaskWithContact[]> {
  return invokeCommand<TaskWithContact[]>('db_filter_tasks', {
    companyId,
    includeCompleted: options.includeCompleted ?? false,
    priority: options.priority ?? null,
    dateFilter: options.dateFilter ?? null,
    search: options.search ?? null,
    sortField: options.sortField ?? 'sort_order',
    sortDirection: options.sortDirection ?? 'asc',
    limit: options.limit,
    offset: options.offset,
  });
}

export async function countTasks(
  companyId: string | null,
  includeCompleted: boolean,
): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_tasks', { companyId, includeCompleted });
}

export async function getTasksForThread(companyId: string, threadId: string): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_tasks_for_thread', { companyId, threadId });
}

export async function getSubtasks(parentId: string): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_subtasks', { parentId });
}

export async function deleteTask(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_task', { id });
}

export async function completeTask(id: string): Promise<void> {
  return invokeCommand<void>('db_complete_task', { id });
}

export async function uncompleteTask(id: string): Promise<void> {
  return invokeCommand<void>('db_uncomplete_task', { id });
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  return invokeCommand<void>('db_reorder_tasks', { taskIds });
}

export async function getIncompleteTaskCount(companyId: string | null): Promise<number> {
  return invokeCommand<number>('db_get_incomplete_task_count', { companyId });
}

export async function getTasksForContact(
  contactId: string,
  includeCompleted: boolean,
): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_tasks_for_contact', { contactId, includeCompleted });
}

export async function getTasksDueForReminder(): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_tasks_due_for_reminder');
}

export async function getTasksWithWorkflow(): Promise<Task[]> {
  return invokeCommand<Task[]>('db_get_tasks_with_workflow');
}

export async function getTaskTags(companyId: string | null): Promise<TaskTag[]> {
  return invokeCommand<TaskTag[]>('db_get_task_tags', { companyId });
}

export async function upsertTaskTag(
  tag: string,
  companyId: string | null,
  color?: string | null,
): Promise<void> {
  return invokeCommand<void>('db_upsert_task_tag', {
    tag,
    companyId,
    color: color ?? null,
  });
}

export async function deleteTaskTag(tag: string, companyId: string | null): Promise<void> {
  return invokeCommand<void>('db_delete_task_tag', { tag, companyId });
}

export async function getTaskTagByTag(tag: string): Promise<TaskTag | null> {
  return invokeCommand<TaskTag | null>('db_get_task_tag_by_tag', { tag });
}

export async function tasksCountByContact(): Promise<ContactTaskCount[]> {
  return invokeCommand<ContactTaskCount[]>('db_tasks_count_by_contact');
}
