import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  freshTestDb,
  runMigrations,
  getTestAccountId,
  seedAccount,
  createDbInvokeHandlers,
  MockTauriDb,
} from "./setup";
let db: MockTauriDb;
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

const mockProvider = {
  accountId: getTestAccountId(),
  type: "gmail_api" as const,
  archive: vi.fn(),
  trash: vi.fn(),
  permanentDelete: vi.fn(),
  markRead: vi.fn(),
  star: vi.fn(),
  spam: vi.fn(),
  moveToFolder: vi.fn(),
  addLabel: vi.fn(),
  removeLabel: vi.fn(),
  sendMessage: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
  initialSync: vi.fn(),
  deltaSync: vi.fn(),
  fetchMessage: vi.fn(),
  fetchAttachment: vi.fn(),
  fetchRawMessage: vi.fn(),
  testConnection: vi.fn(),
  getProfile: vi.fn(),
};
vi.mock("@shared/stores/syncStore", () => ({
  useSyncStore: {
    getState: vi.fn(() => ({ isOnline: false, setPendingOpsCount: vi.fn() })),
  },
}));
vi.mock("@features/mail/stores/threadStore", () => ({
  useThreadStore: {
    getState: vi.fn(() => ({
      updateThread: vi.fn(),
      removeThread: vi.fn(),
      stashThread: vi.fn(),
      unstashThread: vi.fn(),
      markThreadPending: vi.fn(),
      unmarkThreadPending: vi.fn(),
      stashedThreads: new Map(),
      threads: [{ id: "t1" }, { id: "t2" }],
    })),
  },
}));
vi.mock("@features/mail/services/email/providerFactory", () => ({
  getEmailProvider: vi.fn(() => Promise.resolve(mockProvider)),
}));
vi.mock("@/router/navigate", () => ({
  navigateToThread: vi.fn(),
  getSelectedThreadId: vi.fn(() => null),
}));
vi.mock("@shared/utils/networkErrors", () => ({
  classifyError: vi.fn(() => ({ isRetryable: false, message: "Error" })),
}));
vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) =>
    Promise.resolve(val.replace("enc:", "")),
  ),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));
describe("Integration: Offline Queue", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useSyncStore } = await import("@shared/stores/syncStore");
    vi.mocked(useSyncStore.getState).mockReturnValue({
      isOnline: false,
      setPendingOpsCount: vi.fn(),
    } as never);
    db = freshTestDb();
    await runMigrations();
    await seedAccount();

    const handlers = createDbInvokeHandlers(db);
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => handlers.handler(cmd, args));
  });
  afterEach(() => {
    db?.close();
  });
  describe("Test #7: Offline queue — archive thread", () => {
    it("creates pending_operation when offline and does NOT call provider", async () => {
      const { archiveThread } =
        await import("@features/mail/services/emailActions");
      const result = await archiveThread(getTestAccountId(), "t1", ["m1"]);
      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
      expect(mockProvider.archive).not.toHaveBeenCalled();
      const pendingOps = await db!.select<
        {
          operation_type: string;
          resource_id: string;
          status: string;
          params: string;
        }[]
      >(
        "SELECT operation_type, resource_id, status, params FROM pending_operations WHERE account_id = $1",
        [getTestAccountId()],
      );
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0]!.operation_type).toBe("archive");
      expect(pendingOps[0]!.resource_id).toBe("t1");
      expect(pendingOps[0]!.status).toBe("pending");
    });
    it("processes pending operations via triggerQueueFlush", async () => {
      const { archiveThread } =
        await import("@features/mail/services/emailActions");
      await archiveThread(getTestAccountId(), "t1", ["m1"]);
      let pendingOps = await db!.select<{ id: string }[]>(
        "SELECT id FROM pending_operations WHERE account_id = $1 AND status = 'pending'",
        [getTestAccountId()],
      );
      expect(pendingOps).toHaveLength(1);
      const op = pendingOps[0]!;
      const { useSyncStore } = await import("@shared/stores/syncStore");
      vi.mocked(useSyncStore.getState).mockReturnValue({
        isOnline: true,
        setPendingOpsCount: vi.fn(),
      } as never);
      const { triggerQueueFlush } =
        await import("@features/mail/services/queue/queueProcessor");
      await triggerQueueFlush();
      const remaining = await db!.select<{ id: string }[]>(
        "SELECT id FROM pending_operations WHERE id = $1",
        [op.id],
      );
      expect(remaining).toHaveLength(0);
    });
    it("compacts redundant operations before processing", async () => {
      const { starThread } =
        await import("@features/mail/services/emailActions");
      await starThread(getTestAccountId(), "t1", ["m1"], true);
      await starThread(getTestAccountId(), "t1", ["m1"], false);
      let pendingOps = await db!.select<{ id: string }[]>(
        "SELECT id FROM pending_operations WHERE account_id = $1 AND status = 'pending'",
        [getTestAccountId()],
      );
      expect(pendingOps).toHaveLength(2);
      const { compactQueue } =
        await import("@features/settings/db/pendingOperations");
      const removed = await compactQueue(getTestAccountId());
      expect(removed).toBe(2);
      pendingOps = await db!.select<{ id: string }[]>(
        "SELECT id FROM pending_operations WHERE account_id = $1 AND status = 'pending'",
        [getTestAccountId()],
      );
      expect(pendingOps).toHaveLength(0);
    });
  });
});
