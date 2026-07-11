import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockExecuteSearchQuery, mockInsertSuppression } = vi.hoisted(() => ({
  mockExecuteSearchQuery: vi.fn(),
  mockInsertSuppression: vi.fn(),
}));

vi.mock("@shared/services/db/db-invoke", () => ({
  executeSearchQuery: mockExecuteSearchQuery,
  insertSuppression: mockInsertSuppression,
}));

describe("suppressionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isSuppressed", () => {
    it("returns false when email is not suppressed", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ count: 0 }]);

      const { isSuppressed } = await import("@features/deliverability/services/suppressionList");
      const result = await isSuppressed("acc-1", "test@example.com");
      expect(result).toBe(false);
    });

    it("returns true when email is suppressed", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ count: 1 }]);

      const { isSuppressed } = await import("@features/deliverability/services/suppressionList");
      const result = await isSuppressed("acc-1", "test@example.com");
      expect(result).toBe(true);
    });
  });

  describe("addToSuppression", () => {
    it("adds email to suppression list", async () => {
      const { addToSuppression } = await import("@features/deliverability/services/suppressionList");
      await addToSuppression("acc-1", "test@example.com", "hard_bounce");

      expect(mockInsertSuppression).toHaveBeenCalled();
      expect(mockInsertSuppression).toHaveBeenCalledWith(
        expect.any(String),
        "acc-1",
        "test@example.com",
        "hard_bounce",
      );
    });
  });
});
