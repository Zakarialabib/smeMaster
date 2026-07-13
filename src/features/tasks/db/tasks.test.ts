import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Use importOriginal to let real db-invoke implementations run,
// which call invoke() from @tauri-apps/api/core (already mocked above)
vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";

import {
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
} from "./tasks";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tasks DB service", () => {
  describe("getTasksForAccount", () => {
    it("fetches incomplete tasks by default", async () => {
      mockInvoke.mockResolvedValue([]);
      await getTasksForAccount("acc1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_tasks_for_account", {
        companyId: "acc1",
        includeCompleted: false,
      });
    });

    it("includes completed tasks when requested", async () => {
      mockInvoke.mockResolvedValue([]);
      await getTasksForAccount("acc1", true);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_tasks_for_account", {
        companyId: "acc1",
        includeCompleted: true,
      });
    });
  });

  describe("getTaskById", () => {
    it("returns task when found", async () => {
      const task = { id: "t1", title: "Test" };
      mockInvoke.mockResolvedValue(task);
      const result = await getTaskById("t1");
      expect(result).toEqual(task);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_task", { id: "t1" });
    });

    it("returns null when not found", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await getTaskById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getTasksForThread", () => {
    it("queries by thread_account_id and thread_id", async () => {
      mockInvoke.mockResolvedValue([]);
      await getTasksForThread("acc1", "thread1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_tasks_for_thread", {
        companyId: "acc1",
        threadId: "thread1",
      });
    });
  });

  describe("getSubtasks", () => {
    it("queries by parent_id", async () => {
      mockInvoke.mockResolvedValue([]);
      await getSubtasks("parent1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_subtasks", {
        parentId: "parent1",
      });
    });
  });

  describe("insertTask", () => {
    it("inserts a task with defaults", async () => {
      mockInvoke.mockResolvedValue({ id: "new-id", title: "Buy milk" });
      const id = await insertTask({ accountId: "acc1", title: "Buy milk" });
      expect(id).toBe("new-id");
      expect(mockInvoke).toHaveBeenCalledWith(
        "db_create_task",
        expect.objectContaining({
          companyId: "acc1",
          title: "Buy milk",
        }),
      );
    });

    it("uses provided id if given", async () => {
      mockInvoke.mockResolvedValue({ id: "custom-id" });
      const id = await insertTask({ id: "custom-id", accountId: "acc1", title: "Test" });
      expect(id).toBe("custom-id");
    });
  });

  describe("updateTask", () => {
    it("updates specified fields", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateTask("t1", { title: "Updated", priority: "high" });
      expect(mockInvoke).toHaveBeenCalledWith(
        "db_update_task",
        expect.objectContaining({
          id: "t1",
          request: expect.objectContaining({
            title: "Updated",
            priority: "high",
          }),
        }),
      );
    });
  });

  describe("deleteTask", () => {
    it("deletes by id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteTask("t1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_task", { id: "t1" });
    });
  });

  describe("completeTask", () => {
    it("sets is_completed and completed_at", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await completeTask("t1");
      expect(mockInvoke).toHaveBeenCalledWith("db_complete_task", { id: "t1" });
    });
  });

  describe("uncompleteTask", () => {
    it("clears is_completed and completed_at", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await uncompleteTask("t1");
      expect(mockInvoke).toHaveBeenCalledWith("db_uncomplete_task", { id: "t1" });
    });
  });

  describe("reorderTasks", () => {
    it("updates sort_order for each task", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await reorderTasks(["t1", "t2", "t3"]);
      expect(mockInvoke).toHaveBeenCalledWith("db_reorder_tasks", {
        taskIds: ["t1", "t2", "t3"],
      });
    });
  });

  describe("getIncompleteTaskCount", () => {
    it("returns count", async () => {
      mockInvoke.mockResolvedValue(5);
      const result = await getIncompleteTaskCount("acc1");
      expect(result).toBe(5);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_incomplete_task_count", {
        companyId: "acc1",
      });
    });
  });

  describe("task tags", () => {
    it("getTaskTags queries correctly", async () => {
      mockInvoke.mockResolvedValue([]);
      await getTaskTags("acc1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_task_tags", {
        companyId: "acc1",
      });
    });

    it("upsertTaskTag inserts with color", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await upsertTaskTag("urgent", "acc1", "#ff0000");
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_task_tag", {
        tag: "urgent",
        companyId: "acc1",
        color: "#ff0000",
      });
    });

    it("deleteTaskTag removes tag", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteTaskTag("urgent", "acc1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_task_tag", {
        tag: "urgent",
        companyId: "acc1",
      });
    });
  });
});
