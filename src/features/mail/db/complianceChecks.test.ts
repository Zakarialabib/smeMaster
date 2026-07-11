import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";
import { getRecentChecks, deleteOldChecks } from "./complianceChecks";

const mockInvoke = vi.mocked(invoke);

describe("complianceChecks service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentChecks", () => {
    it("calls executeSearchQuery with correct SQL and params", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentChecks("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: "SELECT * FROM compliance_checks WHERE account_id = $1 ORDER BY checked_at DESC LIMIT $2",
        params: ["acc-1", 10],
      });
    });

    it("uses custom limit", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentChecks("acc-1", 25);
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: expect.any(String),
        params: ["acc-1", 25],
      });
    });

    it("returns check records", async () => {
      const checks = [
        {
          id: "chk-1",
          account_id: "acc-1",
          email_draft_id: "draft-1",
          campaign_id: null,
          profile_ids: "cp-1",
          score: 0.9,
          violations_json: null,
          checked_at: 1700000000,
        },
      ];
      mockInvoke.mockResolvedValue(checks);
      const result = await getRecentChecks("acc-1");
      expect(result).toEqual(checks);
    });
  });

  describe("deleteOldChecks", () => {
    it("calls db_delete_old_compliance_checks with before timestamp", async () => {
      mockInvoke.mockResolvedValue(5);
      const result = await deleteOldChecks(1700000000000);
      expect(result).toBe(5);
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_old_compliance_checks", {
        before: 1700000000000,
      });
    });

    it("returns 0 when no rows deleted", async () => {
      mockInvoke.mockResolvedValue(0);
      const result = await deleteOldChecks(0);
      expect(result).toBe(0);
    });
  });
});
