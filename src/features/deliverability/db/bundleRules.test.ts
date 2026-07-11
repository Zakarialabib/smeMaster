import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockExecuteSearchQuery } = vi.hoisted(() => ({ mockExecuteSearchQuery: vi.fn() }));

vi.mock("@/shared/services/db/db-invoke", () => ({
  executeSearchQuery: mockExecuteSearchQuery,
}));

import { getBundleSummaries } from "./bundleRules";

describe("bundleRules service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBundleSummaries", () => {
    it("returns empty map for empty categories", async () => {
      const result = await getBundleSummaries("acc-1", []);
      expect(result.size).toBe(0);
      expect(mockExecuteSearchQuery).not.toHaveBeenCalled();
    });

    it("fetches summaries for multiple categories in 2 queries", async () => {
      // First query: counts
      mockExecuteSearchQuery.mockResolvedValueOnce([
        { category: "Promotions", count: 5 },
        { category: "Social", count: 3 },
      ]);
      // Second query: latest
      mockExecuteSearchQuery.mockResolvedValueOnce([
        { category: "Promotions", subject: "Big Sale", from_name: "Store" },
        { category: "Social", subject: "New follower", from_name: "App" },
      ]);

      const result = await getBundleSummaries("acc-1", ["Promotions", "Social"]);

      expect(result.size).toBe(2);
      expect(result.get("Promotions")).toEqual({ count: 5, latestSubject: "Big Sale", latestSender: "Store" });
      expect(result.get("Social")).toEqual({ count: 3, latestSubject: "New follower", latestSender: "App" });
      // Only 2 queries, not 2N
      expect(mockExecuteSearchQuery).toHaveBeenCalledTimes(2);
    });

    it("returns zero counts for categories with no threads", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      mockExecuteSearchQuery.mockResolvedValueOnce([]);

      const result = await getBundleSummaries("acc-1", ["Empty"]);

      expect(result.get("Empty")).toEqual({ count: 0, latestSubject: null, latestSender: null });
    });
  });
});
