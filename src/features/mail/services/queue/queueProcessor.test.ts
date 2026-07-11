import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock modules (must be hoisted before imports)
vi.mock("@shared/stores/syncStore", () => ({
  useSyncStore: {
    getState: vi.fn(() => ({ isOnline: true, setPendingOpsCount: vi.fn() })),
  },
}));

vi.mock("@shared/stores/queueProgressStore", () => ({
  useQueueProgressStore: {
    getState: vi.fn(() => ({
      startBatch: vi.fn(),
      setProgress: vi.fn(),
    })),
  },
}));

vi.mock("@features/settings/db/pendingOperations", () => ({
  getPendingOperations: vi.fn(() => Promise.resolve([])),
  updateOperationStatus: vi.fn(() => Promise.resolve()),
  deleteOperation: vi.fn(() => Promise.resolve()),
  incrementRetry: vi.fn(() => Promise.resolve()),
  getPendingOpsCount: vi.fn(() => Promise.resolve(0)),
  compactQueue: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@features/mail/services/emailActions", () => ({
  executeQueuedAction: vi.fn(() => Promise.resolve()),
}));

vi.mock("@shared/utils/networkErrors", () => ({
  classifyError: vi.fn(() => ({
    type: "permanent",
    isRetryable: false,
    message: "error",
  })),
}));

vi.mock("@shared/services/backgroundCheckers", () => ({
  createBackgroundChecker: vi.fn((_name: string, fn: () => Promise<void>) => ({
    start: () => fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("@features/settings/db/settings", () => ({
  getQueueSchedule: vi.fn(() =>
    Promise.resolve({ preset: "normal", intervalMs: 30000 }),
  ),
}));

const mockSetPendingOpsCount = vi.fn();

import { useSyncStore } from "@shared/stores/syncStore";
import {
  getPendingOperations,
  updateOperationStatus,
  deleteOperation,
  incrementRetry,
  compactQueue,
} from "@features/settings/db/pendingOperations";
import { executeQueuedAction } from "@features/mail/services/emailActions";
import { classifyError } from "@shared/utils/networkErrors";
import {
  startQueueProcessor,
  stopQueueProcessor,
  triggerQueueFlush,
} from "./queueProcessor";
describe("queueProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSyncStore.getState).mockReturnValue({
      isOnline: true,
      setPendingOpsCount: mockSetPendingOpsCount,
    } as never);
    vi.mocked(getPendingOperations).mockResolvedValue([]);
  });
  it("skips processing when offline", async () => {
    vi.mocked(useSyncStore.getState).mockReturnValue({
      isOnline: false,
      setPendingOpsCount: mockSetPendingOpsCount,
    } as never);
    await triggerQueueFlush();
    expect(getPendingOperations).not.toHaveBeenCalled();
  });
  it("compacts queue before processing", async () => {
    await triggerQueueFlush();
    expect(compactQueue).toHaveBeenCalled();
  });
  it("processes pending operations successfully", async () => {
    vi.mocked(getPendingOperations).mockResolvedValueOnce([
      {
        id: "op-1",
        account_id: "acct-1",
        operation_type: "archive",
        resource_id: "t1",
        params: '{"threadId":"t1","messageIds":[]}',
        status: "pending",
        retry_count: 0,
        max_retries: 10,
        next_retry_at: null,
        created_at: 1000,
        error_message: null,
      },
    ]);
    await triggerQueueFlush();
    expect(updateOperationStatus).toHaveBeenCalledWith("op-1", "executing");
    expect(executeQueuedAction).toHaveBeenCalledWith("acct-1", "archive", {
      threadId: "t1",
      messageIds: [],
    });
    expect(deleteOperation).toHaveBeenCalledWith("op-1");
  });
  it("retries on retryable errors", async () => {
    vi.mocked(getPendingOperations).mockResolvedValueOnce([
      {
        id: "op-1",
        account_id: "acct-1",
        operation_type: "star",
        resource_id: "t1",
        params: '{"threadId":"t1","messageIds":[],"starred":true}',
        status: "pending",
        retry_count: 0,
        max_retries: 10,
        next_retry_at: null,
        created_at: 1000,
        error_message: null,
      },
    ]);
    vi.mocked(executeQueuedAction).mockRejectedValueOnce(
      new Error("Failed to fetch"),
    );
    vi.mocked(classifyError).mockReturnValueOnce({
      type: "network",
      isRetryable: true,
      message: "Failed to fetch",
    });
    await triggerQueueFlush();
    expect(updateOperationStatus).toHaveBeenCalledWith(
      "op-1",
      "pending",
      "Failed to fetch",
    );
    expect(incrementRetry).toHaveBeenCalledWith("op-1");
    expect(deleteOperation).not.toHaveBeenCalled();
  });
  it("marks as failed on permanent errors", async () => {
    vi.mocked(getPendingOperations).mockResolvedValueOnce([
      {
        id: "op-1",
        account_id: "acct-1",
        operation_type: "archive",
        resource_id: "t1",
        params: '{"threadId":"t1","messageIds":[]}',
        status: "pending",
        retry_count: 0,
        max_retries: 10,
        next_retry_at: null,
        created_at: 1000,
        error_message: null,
      },
    ]);
    vi.mocked(executeQueuedAction).mockRejectedValueOnce(
      new Error("Bad request"),
    );
    vi.mocked(classifyError).mockReturnValueOnce({
      type: "permanent",
      isRetryable: false,
      message: "Bad request",
    });
    await triggerQueueFlush();
    expect(updateOperationStatus).toHaveBeenCalledWith(
      "op-1",
      "failed",
      "Bad request",
    );
  });
  it("updates pending count after processing", async () => {
    await triggerQueueFlush();
    expect(mockSetPendingOpsCount).toHaveBeenCalledWith(0);
  });
  it("start and stop work without errors", async () => {
    await startQueueProcessor();
    stopQueueProcessor();
  });
});
