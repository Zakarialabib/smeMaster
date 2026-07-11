import { emit } from "@tauri-apps/api/event";
import { type Task } from "@shared/services/db/schema";
import { getTemplateById, createScheduledEmail } from "@shared/services/db/db-invoke";
import { listTasks, updateTask, insertTask } from "@features/tasks/db/tasks";

// ── Config types (stored as JSON in workflow_config_json / reminder_config_json) ──

export type WorkflowTrigger = "on_complete" | "on_due" | "on_overdue" | "none";
export type WorkflowActionType = "send_email" | "create_notification" | "create_task";

export interface WorkflowActionConfig {
  type: WorkflowActionType;
  templateId?: string;
  notificationText?: string;
  taskTitlePreset?: string;
}

export interface WorkflowConfig {
  trigger: WorkflowTrigger;
  actions: WorkflowActionConfig[];
}

export type RemindBeforeUnit = "minutes" | "hours" | "days";
export type ReminderNotificationType = "os" | "email" | "both";

export interface ReminderConfig {
  enabled: boolean;
  offsetValue: number;
  offsetUnit: RemindBeforeUnit;
  notificationType: ReminderNotificationType;
}

// ── Parsing helpers ──

function parseWorkflowConfig(task: Task): WorkflowConfig | null {
  if (!task.workflow_config_json) return null;
  try {
    return JSON.parse(task.workflow_config_json) as WorkflowConfig;
  } catch {
    return null;
  }
}

function parseReminderConfig(task: Task): ReminderConfig | null {
  if (!task.reminder_config_json) return null;
  try {
    return JSON.parse(task.reminder_config_json) as ReminderConfig;
  } catch {
    return null;
  }
}

function getReminderOffsetSeconds(config: ReminderConfig): number {
  const unitMultiplier: Record<RemindBeforeUnit, number> = {
    minutes: 60,
    hours: 3600,
    days: 86400,
  };
  return config.offsetValue * (unitMultiplier[config.offsetUnit] ?? 60);
}

// ── Workflow checking ──

export async function checkTaskWorkflows(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Fetch all incomplete tasks (from all accounts) and then filter for those with workflow config set
  const allTasks = await listTasks(null, false); // accountId null = all accounts, isCompleted false = incomplete
  const tasks = allTasks
    .filter(task => task.workflow_config_json !== null)
    .sort((a, b) => (a.due_date || 0) - (b.due_date || 0)); // sort by due_date ascending, treating null as 0

  for (const task of tasks) {
    const config = parseWorkflowConfig(task);
    if (!config || config.trigger === "none") continue;

    let shouldTrigger = false;

    switch (config.trigger) {
      case "on_overdue":
        if (task.due_date && task.due_date < now) {
          shouldTrigger = true;
        }
        break;
      case "on_due":
        if (task.due_date) {
          const dueDate = new Date(task.due_date * 1000);
          const today = new Date();
          const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (dueStart.getTime() === todayStart.getTime()) {
            shouldTrigger = true;
          }
        }
        break;
      case "on_complete":
        // This trigger is handled on explicit completion (see below)
        break;
    }

    if (!shouldTrigger) continue;

    await executeActions(task, config);

    // Clear workflow config after triggering to prevent re-triggering
    await updateTask(task.id, { workflowConfigJson: null });
  }
}

/**
 * Call this when a task is explicitly marked as completed to check
 * for "on_complete" workflows.
 */
export async function checkTaskOnCompleteWorkflow(task: Task): Promise<void> {
  const config = parseWorkflowConfig(task);
  if (!config || config.trigger !== "on_complete") return;

  await executeActions(task, config);

  // Clear workflow config after triggering
  await updateTask(task.id, { workflowConfigJson: null });
}

async function executeActions(
  task: Task,
  config: WorkflowConfig,
): Promise<void> {
  for (const action of config.actions) {
    switch (action.type) {
      case "send_email":
        await executeSendEmail(task, action);
        break;
      case "create_notification":
        await executeCreateNotification(task, action);
        break;
      case "create_task":
        await executeCreateTask(task, action);
        break;
    }
  }
}

async function executeSendEmail(
  task: Task,
  action: WorkflowActionConfig,
): Promise<void> {
  if (!action.templateId) return;

  const template = await getTemplateById(action.templateId);
  if (!template) return;

  const companyId = task.company_id;
  if (!companyId) return;

  const now = Math.floor(Date.now() / 1000);
  await createScheduledEmail({
    accountId: companyId,
    toAddresses: "",
    ccAddresses: null,
    bccAddresses: null,
    subject: template.subject ?? task.title,
    bodyHtml: template.body_html,
    replyToMessageId: null,
    threadId: task.thread_id,
    scheduledAt: now,
    signatureId: null,
    attachmentPaths: null,
    status: "pending",
  });
}

async function executeCreateNotification(
  task: Task,
  action: WorkflowActionConfig,
): Promise<void> {
  const text = action.notificationText ?? `Task "${task.title}" workflow triggered`;
  await emit("notification:received", {
    title: "Task Workflow",
    body: text,
    data: { taskId: task.id },
  });
}

async function executeCreateTask(
  task: Task,
  action: WorkflowActionConfig,
): Promise<void> {
  const title = action.taskTitlePreset ?? `Follow-up: ${task.title}`;
  const now = Math.floor(Date.now() / 1000);
  await insertTask({
    accountId: task.company_id,
    title,
    description: null,
    priority: "medium",
    dueDate: task.due_date ? task.due_date + 86400 : now + 86400,
    parentId: task.id,
    contactId: task.contact_id,
    threadId: task.thread_id,
    threadAccountId: task.thread_account_id,
    recurrenceRule: null,
    tagsJson: "[]",
    workflowConfigJson: null,
    reminderConfigJson: null,
  });
}

// ── Reminder checking ──

export async function checkTaskReminders(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Get all incomplete tasks (from all accounts)
  const allTasks = await listTasks(null, false); // accountId null = all accounts, isCompleted false = incomplete
  // Filter: must have reminder_config_json set and due_date set
  const tasks = allTasks
    .filter(task => task.reminder_config_json !== null && task.due_date !== null)
    .sort((a, b) => (a.due_date || 0) - (b.due_date || 0)); // sort by due_date ascending

  for (const task of tasks) {
    const config = parseReminderConfig(task);
    if (!config || !config.enabled) continue;

    const offsetSeconds = getReminderOffsetSeconds(config);
    const reminderTime = task.due_date! - offsetSeconds;

    // Fire reminder if the reminder time has passed and we haven't already
    // (we track this by checking a simple heuristic: reminder time <= now)
    if (reminderTime <= now) {
      await emit("notification:received", {
        title: "Task Reminder",
        body: `"${task.title}" is due soon`,
        data: { taskId: task.id },
      });

      // Clear the reminder config to avoid re-firing
      await updateTask(task.id, { reminderConfigJson: null });
    }
  }
}