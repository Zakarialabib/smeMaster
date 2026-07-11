import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task } from "@shared/services/db/schema";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

vi.mock("@shared/services/db/db-invoke", () => ({
  getTemplateById: vi.fn(),
  createScheduledEmail: vi.fn(),
}));

vi.mock("@features/tasks/db/tasks", () => ({
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  insertTask: vi.fn(),
}));

const { emit } = await import("@tauri-apps/api/event");
const { getTemplateById, createScheduledEmail } = await import("@shared/services/db/db-invoke");
const { listTasks, updateTask, insertTask } = await import("@features/tasks/db/tasks");

const {
  checkTaskWorkflows,
  checkTaskOnCompleteWorkflow,
  checkTaskReminders,
} = await import("./taskWorkflowEngine");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    company_id: "acc1",
    title: "Test Task",
    description: null,
    priority: "medium",
    is_completed: 0,
    completed_at: null,
    due_date: null,
    parent_id: null,
    contact_id: null,
    thread_id: null,
    thread_account_id: null,
    sort_order: 0,
    recurrence_rule: null,
    next_recurrence_at: null,
    tags_json: "[]",
    workflow_config_json: null,
    reminder_config_json: null,
    created_at: 1700000000,
    updated_at: 1700000000,
    ...overrides,
  };
}

describe("checkTaskWorkflows", () => {
  it("does nothing when no tasks have workflow config", async () => {
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({ workflow_config_json: null }),
      makeTask({ id: "task-2", workflow_config_json: null }),
    ]);

    await checkTaskWorkflows();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("triggers on_overdue workflow when due_date is in the past", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pastDue = now - 86400;
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: pastDue,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "create_notification", notificationText: "Overdue!" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).toHaveBeenCalledWith("notification:received", {
      title: "Task Workflow",
      body: "Overdue!",
      data: { taskId: "task-1" },
    });
    expect(updateTask).toHaveBeenCalledWith("task-1", { workflowConfigJson: null });
  });

  it("does not trigger on_overdue when due_date is in the future", async () => {
    const now = Math.floor(Date.now() / 1000);
    const futureDue = now + 86400;
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: futureDue,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "create_notification", notificationText: "Overdue!" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("triggers on_due workflow when task is due today", async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueTs = Math.floor(todayStart.getTime() / 1000) + 3600; // today at 1am

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueTs,
        workflow_config_json: JSON.stringify({
          trigger: "on_due",
          actions: [{ type: "create_notification", notificationText: "Due today!" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).toHaveBeenCalledWith(
      "notification:received",
      expect.objectContaining({ body: "Due today!" }),
    );
  });

  it("does not trigger on_due when task is due tomorrow", async () => {
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dueTs = Math.floor(tomorrowStart.getTime() / 1000) + 3600;

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueTs,
        workflow_config_json: JSON.stringify({
          trigger: "on_due",
          actions: [{ type: "create_notification", notificationText: "Due today!" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).not.toHaveBeenCalled();
  });

  it("skips tasks with trigger 'none'", async () => {
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        workflow_config_json: JSON.stringify({ trigger: "none", actions: [] }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("creates follow-up task action", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "create_task", taskTitlePreset: "Follow up!" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Follow up!",
        accountId: "acc1",
      }),
    );
  });

  it("uses default task title when none specified", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        title: "Original Task",
        due_date: now - 100,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "create_task" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Follow-up: Original Task",
      }),
    );
  });

  it("sends email action with template", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "send_email", templateId: "tpl-1" }],
        }),
      }),
    ]);
    vi.mocked(getTemplateById).mockResolvedValue({
      subject: "Follow up",
      body_html: "<p>Hello</p>",
    });

    await checkTaskWorkflows();
    expect(createScheduledEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Follow up",
        bodyHtml: "<p>Hello</p>",
        accountId: "acc1",
      }),
    );
  });

  it("skips send_email when template not found", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "send_email", templateId: "nonexistent" }],
        }),
      }),
    ]);
    vi.mocked(getTemplateById).mockResolvedValue(null);

    await checkTaskWorkflows();
    expect(createScheduledEmail).not.toHaveBeenCalled();
  });

  it("skips send_email when templateId is not set", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        workflow_config_json: JSON.stringify({
          trigger: "on_overdue",
          actions: [{ type: "send_email" }],
        }),
      }),
    ]);

    await checkTaskWorkflows();
    expect(createScheduledEmail).not.toHaveBeenCalled();
  });

  it("ignores tasks with invalid workflow_config_json", async () => {
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        workflow_config_json: "not-valid-json",
      }),
    ]);

    await checkTaskWorkflows();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("checkTaskOnCompleteWorkflow", () => {
  it("triggers on_complete workflow", async () => {
    const task = makeTask({
      workflow_config_json: JSON.stringify({
        trigger: "on_complete",
        actions: [{ type: "create_notification", notificationText: "Done!" }],
      }),
    });

    await checkTaskOnCompleteWorkflow(task);
    expect(emit).toHaveBeenCalledWith(
      "notification:received",
      expect.objectContaining({ body: "Done!" }),
    );
    expect(updateTask).toHaveBeenCalledWith("task-1", { workflowConfigJson: null });
  });

  it("does nothing for non-on_complete trigger", async () => {
    const task = makeTask({
      workflow_config_json: JSON.stringify({
        trigger: "on_overdue",
        actions: [{ type: "create_notification", notificationText: "Late!" }],
      }),
    });

    await checkTaskOnCompleteWorkflow(task);
    expect(emit).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("does nothing for null workflow_config_json", async () => {
    const task = makeTask({ workflow_config_json: null });

    await checkTaskOnCompleteWorkflow(task);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("checkTaskReminders", () => {
  it("fires reminder when reminder time has passed", async () => {
    const now = Math.floor(Date.now() / 1000);
    // due in 1 hour, reminder 2 hours before → reminder time = now - 1 hour → already passed
    const dueDate = now + 3600;
    const offsetSeconds = 7200; // 2 hours

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueDate,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 2,
          offsetUnit: "hours",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).toHaveBeenCalledWith("notification:received", {
      title: "Task Reminder",
      body: '"Test Task" is due soon',
      data: { taskId: "task-1" },
    });
    expect(updateTask).toHaveBeenCalledWith("task-1", { reminderConfigJson: null });
  });

  it("does not fire reminder when reminder time is in the future", async () => {
    const now = Math.floor(Date.now() / 1000);
    // due in 10 days, reminder 1 hour before → reminder time = now + ~9.96 days → not yet
    const dueDate = now + 10 * 86400;

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueDate,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 1,
          offsetUnit: "hours",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("skips reminders with enabled=false", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        reminder_config_json: JSON.stringify({
          enabled: false,
          offsetValue: 1,
          offsetUnit: "hours",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).not.toHaveBeenCalled();
  });

  it("skips tasks without due_date", async () => {
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: null,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 1,
          offsetUnit: "hours",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).not.toHaveBeenCalled();
  });

  it("handles minutes offset correctly", async () => {
    const now = Math.floor(Date.now() / 1000);
    // due in 30 minutes, reminder 1 hour before → reminder time = now - 30 minutes → passed
    const dueDate = now + 1800;

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueDate,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 60,
          offsetUnit: "minutes",
          notificationType: "email",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).toHaveBeenCalled();
  });

  it("handles days offset correctly", async () => {
    const now = Math.floor(Date.now() / 1000);
    // due tomorrow, reminder 2 days before → reminder time = now - 1 day → passed
    const dueDate = now + 86400;

    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: dueDate,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 2,
          offsetUnit: "days",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).toHaveBeenCalled();
  });

  it("ignores invalid reminder_config_json", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        due_date: now - 100,
        reminder_config_json: "not-json",
      }),
    ]);

    await checkTaskReminders();
    expect(emit).not.toHaveBeenCalled();
  });

  it("uses default title from task when emitting", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(listTasks).mockResolvedValue([
      makeTask({
        title: "Important Task",
        due_date: now + 1800,
        reminder_config_json: JSON.stringify({
          enabled: true,
          offsetValue: 60,
          offsetUnit: "minutes",
          notificationType: "os",
        }),
      }),
    ]);

    await checkTaskReminders();
    expect(emit).toHaveBeenCalledWith(
      "notification:received",
      expect.objectContaining({
        body: '"Important Task" is due soon',
      }),
    );
  });
});
