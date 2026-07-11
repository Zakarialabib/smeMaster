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
  };
});

import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import {
  getFiltersForAccount,
  countMailRules,
  getEnabledFiltersForAccount,
  insertFilter,
  updateFilter,
  deleteFilter,
  getFilterRuleById,
  getFilterGroups,
  upsertFilterGroup,
  deleteFilterGroup,
  getFilterConditions,
  getFilterConditionsForRule,
  upsertFilterCondition,
  deleteFilterCondition,
  getFilterLogs,
  logFilterMatch,
  getFilterStats,
  getRecentFilterLogs,
  getFilterLogStats,
  deleteFilterLogsOlderThan,
} from "./filters";

const mockInvoke = vi.mocked(invoke);

describe("filters service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFiltersForAccount", () => {
    it("calls db_list_filter_rules with accountId", async () => {
      const rules = [{ id: "r1", name: "Spam filter" }];
      mockInvoke.mockResolvedValue(rules);
      const result = await getFiltersForAccount("acc-1");
      expect(result).toEqual(rules);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_filter_rules", {
        accountId: "acc-1",
      });
    });
  });

  describe("countMailRules", () => {
    it("calls db_count_filter_rules", async () => {
      mockInvoke.mockResolvedValue(5);
      const result = await countMailRules();
      expect(result).toBe(5);
      expect(mockInvoke).toHaveBeenCalledWith("db_count_filter_rules", {});
    });
  });

  describe("getEnabledFiltersForAccount", () => {
    it("calls db_get_enabled_filter_rules with accountId", async () => {
      mockInvoke.mockResolvedValue([]);
      await getEnabledFiltersForAccount("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_enabled_filter_rules", {
        accountId: "acc-1",
      });
    });
  });

  describe("insertFilter", () => {
    it("creates a filter with generated uuid", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const id = await insertFilter({
        accountId: "acc-1",
        name: "Spam blocker",
        criteria: { from: "spam@test.com" },
        actions: { archive: true },
      });
      expect(id).toBe("mock-id");
      expect(uuidv4).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith("db_create_filter_rule", {
        rule: {
          id: "mock-id",
          accountId: "acc-1",
          name: "Spam blocker",
          isEnabled: true,
          criteriaJson: JSON.stringify({ from: "spam@test.com" }),
          actionsJson: JSON.stringify({ archive: true }),
          scoreThreshold: null,
          chainingAction: "stop",
        },
      });
    });

    it("uses provided scoreThreshold and chainingAction", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await insertFilter({
        accountId: "acc-1",
        name: "High priority",
        criteria: { subject: "urgent" },
        actions: { star: true },
        isEnabled: false,
        scoreThreshold: 0.8,
        chainingAction: "continue",
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_create_filter_rule", {
        rule: expect.objectContaining({
          isEnabled: false,
          scoreThreshold: 0.8,
          chainingAction: "continue",
        }),
      });
    });
  });

  describe("updateFilter", () => {
    it("updates name and criteria fields", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateFilter("f1", {
        name: "Updated filter",
        criteria: { subject: "new subject" },
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_update_filter", {
        id: "f1",
        fields: {
          set: {
            name: "Updated filter",
            criteria_json: JSON.stringify({ subject: "new subject" }),
          },
          unset: [],
        },
      });
    });

    it("converts isEnabled to integer", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateFilter("f1", { isEnabled: true });
      expect(mockInvoke).toHaveBeenCalledWith("db_update_filter", {
        id: "f1",
        fields: {
          set: { is_enabled: 1 },
          unset: [],
        },
      });
    });

    it("does not call invoke when no fields provided", async () => {
      await updateFilter("f1", {});
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("deleteFilter", () => {
    it("calls db_delete_filter with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteFilter("f1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_filter", { id: "f1" });
    });
  });

  describe("getFilterRuleById", () => {
    it("calls db_get_filter_rule with id", async () => {
      const rule = { id: "r1", name: "Test" };
      mockInvoke.mockResolvedValue(rule);
      const result = await getFilterRuleById("r1");
      expect(result).toEqual(rule);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_filter_rule", { id: "r1" });
    });
  });

  describe("getFilterGroups", () => {
    it("returns empty array when no groups exist", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getFilterGroups("r1");
      expect(result).toEqual([]);
    });

    it("returns group with operator from db", async () => {
      mockInvoke.mockResolvedValue([{ group_operator: "OR" }]);
      const result = await getFilterGroups("r1");
      expect(result).toEqual([
        { id: "r1", ruleId: "r1", operator: "OR" },
      ]);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_filter_group_operator", {
        ruleId: "r1",
      });
    });

    it("defaults to AND when group_operator is null", async () => {
      mockInvoke.mockResolvedValue([{ group_operator: null }]);
      const result = await getFilterGroups("r1");
      expect(result[0].operator).toBe("AND");
    });
  });

  describe("upsertFilterGroup", () => {
    it("calls db_upsert_filter_group", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await upsertFilterGroup({ id: "g1", ruleId: "r1", operator: "AND" });
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_filter_group", {
        group: { id: "g1", ruleId: "r1", operator: "AND" },
      });
    });
  });

  describe("deleteFilterGroup", () => {
    it("calls db_delete_filter_group with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteFilterGroup("g1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_filter_group", { id: "g1" });
    });
  });

  describe("getFilterConditionsForRule", () => {
    it("returns empty array when rule not found", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await getFilterConditionsForRule("nonexistent");
      expect(result).toEqual([]);
    });

    it("parses criteria_json and returns conditions", async () => {
      mockInvoke.mockResolvedValue({
        id: "r1",
        criteria_json: JSON.stringify({
          from: "test@example.com",
          subject: "Hello",
          hasAttachment: true,
        }),
      });
      const result = await getFilterConditionsForRule("r1");
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "cond-from",
        filterId: "r1",
        field: "from",
        operator: "contains",
        value: "test@example.com",
        weight: 1,
      });
      expect(result[1]).toEqual({
        id: "cond-subject",
        filterId: "r1",
        field: "subject",
        operator: "contains",
        value: "Hello",
        weight: 1,
      });
      expect(result[2]).toEqual({
        id: "cond-hasAttachment",
        filterId: "r1",
        field: "hasAttachment",
        operator: "contains",
        value: "true",
        weight: 1,
      });
    });

    it("includes custom conditions from criteria", async () => {
      mockInvoke.mockResolvedValue({
        id: "r1",
        criteria_json: JSON.stringify({
          conditions: [
            { field: "body", operator: "contains", value: "meeting", weight: 0.5 },
          ],
        }),
      });
      const result = await getFilterConditionsForRule("r1");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "cond-body-0",
        filterId: "r1",
        field: "body",
        operator: "contains",
        value: "meeting",
        weight: 0.5,
      });
    });

    it("returns empty array on JSON parse error", async () => {
      mockInvoke.mockResolvedValue({
        id: "r1",
        criteria_json: "not-valid-json",
      });
      const result = await getFilterConditionsForRule("r1");
      expect(result).toEqual([]);
    });
  });

  describe("getFilterConditions (deprecated)", () => {
    it("delegates to getFilterConditionsForRule", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await getFilterConditions("r1");
      expect(result).toEqual([]);
    });
  });

  describe("upsertFilterCondition", () => {
    it("calls db_upsert_filter_condition", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await upsertFilterCondition({ id: "c1", filterId: "f1", field: "from" });
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_filter_condition", {
        condition: { id: "c1", filterId: "f1", field: "from" },
      });
    });
  });

  describe("deleteFilterCondition", () => {
    it("calls db_delete_filter_condition with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteFilterCondition("c1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_filter_condition", { id: "c1" });
    });
  });

  describe("getFilterLogs", () => {
    it("calls db_get_filter_logs with ruleId and limit", async () => {
      mockInvoke.mockResolvedValue([]);
      await getFilterLogs("r1", 20);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_filter_logs", {
        ruleId: "r1",
        limit: 20,
      });
    });
  });

  describe("logFilterMatch", () => {
    it("logs a match with generated uuid", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await logFilterMatch("r1", "msg-1", true, 0.9, { archive: true });
      expect(uuidv4).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith("db_log_filter_match", {
        log: {
          id: "mock-id",
          ruleId: "r1",
          messageId: "msg-1",
          matched: 1,
          score: 0.9,
          appliedActions: JSON.stringify({ archive: true }),
        },
      });
    });

    it("converts matched boolean to 0", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await logFilterMatch("r1", "msg-2", false, 0.1, {});
      expect(mockInvoke).toHaveBeenCalledWith("db_log_filter_match", {
        log: expect.objectContaining({ matched: 0 }),
      });
    });
  });

  describe("getFilterStats", () => {
    it("calls db_get_filter_stats with accountId", async () => {
      mockInvoke.mockResolvedValue({ matchCount: 10 });
      await getFilterStats("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_filter_stats", {
        accountId: "acc-1",
      });
    });
  });

  describe("getRecentFilterLogs", () => {
    it("calls db_get_recent_filter_logs with accountId and default limit", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentFilterLogs("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_get_recent_filter_logs", {
        accountId: "acc-1",
        limit: 10,
      });
    });

    it("uses custom limit", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentFilterLogs("acc-1", 50);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_recent_filter_logs", {
        accountId: "acc-1",
        limit: 50,
      });
    });
  });

  describe("getFilterLogStats", () => {
    it("calls db_get_filter_log_stats and converts values to numbers", async () => {
      mockInvoke.mockResolvedValue({
        total: "100",
        matches: "80",
        noMatches: "20",
        avgScore: "0.75",
      });
      const result = await getFilterLogStats("acc-1");
      expect(result).toEqual({
        total: 100,
        matches: 80,
        noMatches: 20,
        avgScore: 0.75,
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_get_filter_log_stats", {
        accountId: "acc-1",
      });
    });

    it("defaults NaN values to 0", async () => {
      mockInvoke.mockResolvedValue({});
      const result = await getFilterLogStats("acc-1");
      expect(result).toEqual({
        total: 0,
        matches: 0,
        noMatches: 0,
        avgScore: 0,
      });
    });
  });

  describe("deleteFilterLogsOlderThan", () => {
    it("calls db_delete_filter_logs_older_than with olderThan timestamp", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteFilterLogsOlderThan("acc-1", 1234567890);
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_filter_logs_older_than", {
        olderThan: 1234567890,
      });
    });
  });
});
