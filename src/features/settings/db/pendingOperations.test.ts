import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockExecuteSearchQuery, mockUpsertPendingOperation, mockDeletePendingOperation, mockUpdateOperationStatus, mockIncrementRetry, mockDeletePendingOpsByIds, mockClearFailedOperations, mockRetryFailedOperations } = vi.hoisted(() => ({
  mockExecuteSearchQuery: vi.fn(),
  mockUpsertPendingOperation: vi.fn(async () => "mock-id"),
  mockDeletePendingOperation: vi.fn(async () => {}),
  mockUpdateOperationStatus: vi.fn(async () => {}),
  mockIncrementRetry: vi.fn(async () => {}),
  mockDeletePendingOpsByIds: vi.fn(async () => {}),
  mockClearFailedOperations: vi.fn(async () => {}),
  mockRetryFailedOperations: vi.fn(async () => {}),
}));

vi.mock("@/shared/services/db/db-invoke", () => ({
  upsertPendingOperation: mockUpsertPendingOperation,
  deletePendingOperation: mockDeletePendingOperation,
  executeSearchQuery: mockExecuteSearchQuery,
  updateOperationStatus: mockUpdateOperationStatus,
  incrementRetry: mockIncrementRetry,
  deletePendingOpsByIds: mockDeletePendingOpsByIds,
  clearFailedOperations: mockClearFailedOperations,
  retryFailedOperations: mockRetryFailedOperations,
}));

import {
  enqueuePendingOperation,
  getPendingOperations,
  updateOperationStatus,
  deleteOperation,
  incrementRetry,
  getPendingOpsCount,
  getFailedOpsCount,
  getPendingOpsForResource,
  compactQueue,
  clearFailedOperations,
  retryFailedOperations,
} from "./pendingOperations";

describe("pendingOperations DB service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueuePendingOperation", () => {
    it("inserts a new operation via db-invoke", async () => {
      const id = await enqueuePendingOperation("acct-1", "archive", "thread-1", { messageIds: ["m1"] });
      expect(id).toBe("mock-id");
      expect(mockUpsertPendingOperation).toHaveBeenCalledWith({
        companyId: "acct-1",
        operationType: "archive",
        resourceId: "thread-1",
        params: { messageIds: ["m1"] },
        campaignId: null,
        holdUntil: null,
      });
    });
  });

  describe("getPendingOperations", () => {
    it("fetches pending ops for a specific account", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      await getPendingOperations("acct-1");
      expect(mockExecuteSearchQuery).toHaveBeenCalledWith(
        expect.stringContaining("account_id = $1"),
        expect.arrayContaining(["acct-1"]),
      );
    });

    it("fetches all pending ops when no account specified", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      await getPendingOperations();
      expect(mockExecuteSearchQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'"),
        expect.any(Array),
      );
    });
  });

  describe("updateOperationStatus", () => {
    it("updates the status and error message", async () => {
      await updateOperationStatus("op-1", "failed", "Network timeout");
      expect(mockUpdateOperationStatus).toHaveBeenCalledWith("op-1", "failed", "Network timeout");
    });

    it("sets error_message to undefined when not provided", async () => {
      await updateOperationStatus("op-1", "pending");
      expect(mockUpdateOperationStatus).toHaveBeenCalledWith("op-1", "pending", undefined);
    });
  });

  describe("deleteOperation", () => {
    it("deletes by id via db-invoke", async () => {
      await deleteOperation("op-1");
      expect(mockDeletePendingOperation).toHaveBeenCalledWith("op-1");
    });
  });

  describe("incrementRetry", () => {
    it("increments retry count with exponential backoff", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ retry_count: 0, max_retries: 10 }]);
      await incrementRetry("op-1");
      expect(mockIncrementRetry).toHaveBeenCalledWith(
        "op-1",
        1,
        false,
        expect.any(Number),
      );
    });

    it("marks as failed when max retries reached", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ retry_count: 9, max_retries: 10 }]);
      await incrementRetry("op-1");
      expect(mockIncrementRetry).toHaveBeenCalledWith("op-1", 10, true, undefined);
    });

    it("does nothing if operation not found", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      await incrementRetry("nonexistent");
      expect(mockIncrementRetry).not.toHaveBeenCalled();
    });
  });

  describe("getPendingOpsCount", () => {
    it("returns count for specific account", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ count: 5 }]);
      const count = await getPendingOpsCount("acct-1");
      expect(count).toBe(5);
    });

    it("returns global count", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ count: 12 }]);
      const count = await getPendingOpsCount();
      expect(count).toBe(12);
    });
  });

  describe("getFailedOpsCount", () => {
    it("returns count of failed operations", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([{ count: 3 }]);
      const count = await getFailedOpsCount();
      expect(count).toBe(3);
    });
  });

  describe("getPendingOpsForResource", () => {
    it("queries by account and resource", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      await getPendingOpsForResource("acct-1", "thread-1");
      expect(mockExecuteSearchQuery).toHaveBeenCalledWith(
        expect.stringContaining("resource_id = $2"),
        ["acct-1", "thread-1"],
      );
    });
  });

  describe("compactQueue", () => {
    it("removes cancelling star toggle pairs", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([
        { id: "op-1", account_id: "a1", resource_id: "t1", operation_type: "star", params: '{"starred":true}', status: "pending", created_at: 1 },
        { id: "op-2", account_id: "a1", resource_id: "t1", operation_type: "star", params: '{"starred":false}', status: "pending", created_at: 2 },
      ]);
      const removed = await compactQueue();
      expect(removed).toBe(2);
      expect(mockDeletePendingOpsByIds).toHaveBeenCalledWith(
        expect.arrayContaining(["op-1", "op-2"]),
      );
    });

    it("removes cancelling addLabel+removeLabel pairs", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([
        { id: "op-1", account_id: "a1", resource_id: "t1", operation_type: "addLabel", params: '{"labelId":"L1"}', status: "pending", created_at: 1 },
        { id: "op-2", account_id: "a1", resource_id: "t1", operation_type: "removeLabel", params: '{"labelId":"L1"}', status: "pending", created_at: 2 },
      ]);
      const removed = await compactQueue();
      expect(removed).toBe(2);
    });

    it("collapses sequential moves keeping only the latest", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([
        { id: "op-1", account_id: "a1", resource_id: "t1", operation_type: "moveToFolder", params: '{"folderPath":"Folder1"}', status: "pending", created_at: 1 },
        { id: "op-2", account_id: "a1", resource_id: "t1", operation_type: "moveToFolder", params: '{"folderPath":"Folder2"}', status: "pending", created_at: 2 },
      ]);
      const removed = await compactQueue();
      expect(removed).toBe(1);
      expect(mockDeletePendingOpsByIds).toHaveBeenCalledWith(["op-1"]);
    });

    it("returns 0 when nothing to compact", async () => {
      mockExecuteSearchQuery.mockResolvedValueOnce([]);
      const removed = await compactQueue();
      expect(removed).toBe(0);
      expect(mockDeletePendingOpsByIds).not.toHaveBeenCalled();
    });
  });

  describe("clearFailedOperations", () => {
    it("clears all failed ops", async () => {
      await clearFailedOperations();
      expect(mockClearFailedOperations).toHaveBeenCalledWith(undefined);
    });

    it("clears failed ops for specific account", async () => {
      await clearFailedOperations("acct-1");
      expect(mockClearFailedOperations).toHaveBeenCalledWith("acct-1");
    });
  });

  describe("retryFailedOperations", () => {
    it("resets failed ops to pending", async () => {
      await retryFailedOperations();
      expect(mockRetryFailedOperations).toHaveBeenCalledWith(undefined);
    });
  });
});
