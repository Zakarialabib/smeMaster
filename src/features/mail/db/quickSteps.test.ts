import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-id"),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
    listQuickSteps: vi.fn(),
  };
});

import { invoke } from "@tauri-apps/api/core";
import {
  getQuickStepsForAccount,
  getEnabledQuickStepsForAccount,
  insertQuickStep,
  updateQuickStep,
  deleteQuickStep,
  reorderQuickSteps,
} from "./quickSteps";

const mockInvoke = vi.mocked(invoke);

describe("quickSteps DB service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuickStepsForAccount", () => {
    it("calls listQuickSteps from db-invoke", async () => {
      const { listQuickSteps } = await import("@/shared/services/db/db-invoke");
      const mockList = vi.mocked(listQuickSteps);
      mockList.mockResolvedValueOnce([{ id: "qs-1", account_id: "acct-1" } as never]);

      const result = await getQuickStepsForAccount("acct-1");

      expect(mockList).toHaveBeenCalledWith("acct-1");
      expect(result).toEqual([{ id: "qs-1", account_id: "acct-1" }]);
    });
  });

  describe("getEnabledQuickStepsForAccount", () => {
    it("queries only enabled quick steps", async () => {
      await getEnabledQuickStepsForAccount("acct-1");

      expect(mockInvoke).toHaveBeenCalledWith("db_get_enabled_quick_steps", { accountId: "acct-1" });
    });
  });

  describe("insertQuickStep", () => {
    it("inserts a quick step with serialized actions JSON", async () => {
      const actions = [{ type: "archive" as const }, { type: "markRead" as const }];

      const id = await insertQuickStep({
        accountId: "acct-1",
        name: "Test Step",
        actions,
      });

      expect(id).toBe("mock-id");
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_quick_step", {
        id: "mock-id",
        accountId: "acct-1",
        name: "Test Step",
        description: null,
        shortcut: null,
        actionsJson: JSON.stringify(actions),
        icon: null,
        isEnabled: true,
        continueOnError: false,
        sortOrder: 0,
      });
    });

    it("passes optional fields when provided", async () => {
      await insertQuickStep({
        accountId: "acct-1",
        name: "Custom Step",
        description: "A test description",
        shortcut: "Ctrl+1",
        actions: [{ type: "star" as const }],
        icon: "Star",
        isEnabled: false,
        continueOnError: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_quick_step", {
        id: "mock-id",
        accountId: "acct-1",
        name: "Custom Step",
        description: "A test description",
        shortcut: "Ctrl+1",
        actionsJson: JSON.stringify([{ type: "star" }]),
        icon: "Star",
        isEnabled: false,
        continueOnError: true,
        sortOrder: 0,
      });
    });
  });

  describe("updateQuickStep", () => {
    it("calls invoke with mapped fields", async () => {
      const actions = [{ type: "trash" as const }];

      await updateQuickStep("qs-1", {
        name: "New Name",
        actions,
        isEnabled: true,
        continueOnError: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith("db_update_quick_step", {
        id: "qs-1",
        fields: {
          set: {
            name: "New Name",
            actions_json: JSON.stringify(actions),
            is_enabled: 1,
            continue_on_error: 0,
          },
          unset: [],
        },
      });
    });

    it("does not call invoke when no fields to update", async () => {
      await updateQuickStep("qs-1", {});
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("deleteQuickStep", () => {
    it("deletes by id", async () => {
      await deleteQuickStep("qs-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_quick_step", { id: "qs-1" });
    });
  });

  describe("reorderQuickSteps", () => {
    it("calls invoke with orderedIds array", async () => {
      await reorderQuickSteps("acct-1", ["qs-b", "qs-a", "qs-c"]);

      expect(mockInvoke).toHaveBeenCalledWith("db_reorder_quick_steps", {
        accountId: "acct-1",
        orderedIds: ["qs-b", "qs-a", "qs-c"],
      });
    });
  });
});

