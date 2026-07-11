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
import {
  getThreadCategory,
  getThreadCategoryWithManual,
  getRecentRuleCategorizedThreadIds,
  getCategoriesForThreads,
  setThreadCategory,
  setThreadCategoriesBatch,
  updateThreadCategory,
  getUserOverrides,
  getCategoryUnreadCounts,
  getUncategorizedInboxThreadIds,
  ALL_CATEGORIES,
} from "./threadCategories";

const mockInvoke = vi.mocked(invoke);

describe("threadCategories service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ALL_CATEGORIES", () => {
    it("contains all five categories", () => {
      expect(ALL_CATEGORIES).toEqual([
        "Primary",
        "Updates",
        "Promotions",
        "Social",
        "Newsletters",
      ]);
    });
  });

  describe("getThreadCategory", () => {
    it("returns category when found", async () => {
      mockInvoke.mockResolvedValue([{ category: "Promotions" }]);
      const result = await getThreadCategory("acc-1", "thread-1");
      expect(result).toBe("Promotions");
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: "SELECT category FROM thread_categories WHERE account_id = $1 AND thread_id = $2",
        params: ["acc-1", "thread-1"],
      });
    });

    it("returns null when no category found", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getThreadCategory("acc-1", "thread-1");
      expect(result).toBeNull();
    });
  });

  describe("getThreadCategoryWithManual", () => {
    it("returns category with isManual true when is_manual = 1", async () => {
      mockInvoke.mockResolvedValue([{ category: "Primary", is_manual: 1 }]);
      const result = await getThreadCategoryWithManual("acc-1", "thread-1");
      expect(result).toEqual({ category: "Primary", isManual: true });
    });

    it("returns category with isManual false when is_manual = 0", async () => {
      mockInvoke.mockResolvedValue([{ category: "Social", is_manual: 0 }]);
      const result = await getThreadCategoryWithManual("acc-1", "thread-1");
      expect(result).toEqual({ category: "Social", isManual: false });
    });

    it("returns null when no row found", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getThreadCategoryWithManual("acc-1", "thread-1");
      expect(result).toBeNull();
    });
  });

  describe("getRecentRuleCategorizedThreadIds", () => {
    it("calls executeSearchQuery with correct SQL and params", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentRuleCategorizedThreadIds("acc-1", 10);
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: expect.stringContaining("FROM threads t"),
        params: ["acc-1", 10],
      });
    });

    it("uses default limit of 20", async () => {
      mockInvoke.mockResolvedValue([]);
      await getRecentRuleCategorizedThreadIds("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: expect.any(String),
        params: ["acc-1", 20],
      });
    });
  });

  describe("getCategoriesForThreads", () => {
    it("returns empty map for empty threadIds", async () => {
      const result = await getCategoriesForThreads("acc-1", []);
      expect(result.size).toBe(0);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("queries categories for thread ids", async () => {
      mockInvoke.mockResolvedValue([
        { thread_id: "t1", category: "Primary" },
        { thread_id: "t2", category: "Promotions" },
      ]);
      const result = await getCategoriesForThreads("acc-1", ["t1", "t2"]);
      expect(result.size).toBe(2);
      expect(result.get("t1")).toBe("Primary");
      expect(result.get("t2")).toBe("Promotions");
    });
  });

  describe("setThreadCategory", () => {
    it("calls db_upsert_thread_category", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setThreadCategory("acc-1", "thread-1", "Promotions");
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_thread_category", {
        cat: {
          accountId: "acc-1",
          threadId: "thread-1",
          category: "Promotions",
          isManual: false,
        },
      });
    });

    it("passes isManual when true", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setThreadCategory("acc-1", "thread-1", "Social", true);
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_thread_category", {
        cat: expect.objectContaining({ isManual: true }),
      });
    });
  });

  describe("setThreadCategoriesBatch", () => {
    it("calls db_set_thread_categories_batch with entries", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const categories = new Map([
        ["t1", "Primary"],
        ["t2", "Promotions"],
      ]);
      await setThreadCategoriesBatch("acc-1", categories);
      expect(mockInvoke).toHaveBeenCalledWith("db_set_thread_categories_batch", {
        entries: [
          { accountId: "acc-1", threadId: "t1", category: "Primary" },
          { accountId: "acc-1", threadId: "t2", category: "Promotions" },
        ],
      });
    });
  });

  describe("updateThreadCategory", () => {
    it("calls db_upsert_thread_category with isUserOverride", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateThreadCategory("acc-1", "thread-1", "Social", true);
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_thread_category", {
        cat: {
          accountId: "acc-1",
          threadId: "thread-1",
          category: "Social",
          isUserOverride: true,
        },
      });
    });

    it("defaults isUserOverride to false", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateThreadCategory("acc-1", "thread-1", "Social");
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_thread_category", {
        cat: expect.objectContaining({ isUserOverride: false }),
      });
    });
  });

  describe("getUserOverrides", () => {
    it("returns mapped user overrides", async () => {
      mockInvoke.mockResolvedValue([
        { thread_id: "t1", category: "Social" },
        { thread_id: "t2", category: "Promotions" },
      ]);
      const result = await getUserOverrides("acc-1");
      expect(result).toEqual([
        { threadId: "t1", category: "Social" },
        { threadId: "t2", category: "Promotions" },
      ]);
    });

    it("returns empty array when no overrides", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getUserOverrides("acc-1");
      expect(result).toEqual([]);
    });
  });

  describe("getCategoryUnreadCounts", () => {
    it("returns map of category to unread count", async () => {
      mockInvoke.mockResolvedValue([
        { category: "Primary", count: 5 },
        { category: "Promotions", count: 12 },
      ]);
      const result = await getCategoryUnreadCounts("acc-1");
      expect(result.get("Primary")).toBe(5);
      expect(result.get("Promotions")).toBe(12);
    });

    it("defaults null category to Primary", async () => {
      mockInvoke.mockResolvedValue([
        { category: null, count: 3 },
      ]);
      const result = await getCategoryUnreadCounts("acc-1");
      expect(result.get("Primary")).toBe(3);
    });

    it("returns empty map when no results", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getCategoryUnreadCounts("acc-1");
      expect(result.size).toBe(0);
    });
  });

  describe("getUncategorizedInboxThreadIds", () => {
    it("calls executeSearchQuery with correct SQL", async () => {
      mockInvoke.mockResolvedValue([]);
      await getUncategorizedInboxThreadIds("acc-1", 15);
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: expect.stringContaining("tc.thread_id IS NULL"),
        params: ["acc-1", 15],
      });
    });

    it("uses default limit of 20", async () => {
      mockInvoke.mockResolvedValue([]);
      await getUncategorizedInboxThreadIds("acc-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_execute_search_query", {
        sql: expect.any(String),
        params: ["acc-1", 20],
      });
    });
  });
});
