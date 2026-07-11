import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  getFolderSyncState: vi.fn(),
  upsertFolderSyncState: vi.fn(async () => {}),
  deleteFolderSyncState: vi.fn(),
  clearFolderSyncStates: vi.fn(),
  listFolderSyncStates: vi.fn(),
}));

import {
  getFolderSyncState as dbInvokeGetFolderSyncState,
  upsertFolderSyncState as dbInvokeUpsertFolderSyncState,
  deleteFolderSyncState as dbInvokeDeleteFolderSyncState,
  listFolderSyncStates as dbInvokeListFolderSyncStates,
} from "@shared/services/db/db-invoke";
import { getFolderSyncState, upsertFolderSyncState, deleteFolderSyncState, getAllFolderSyncStates } from "./folderSyncState";
import type { FolderSyncState } from "./folderSyncState";

const mockGetFolderSyncState = vi.mocked(dbInvokeGetFolderSyncState);
const mockUpsertFolderSyncState = vi.mocked(dbInvokeUpsertFolderSyncState);

describe("folderSyncState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFolderSyncState", () => {
    it("returns null for non-existent folder sync state", async () => {
      mockGetFolderSyncState.mockResolvedValue(null);

      const result = await getFolderSyncState("acc-1", "INBOX");

      expect(result).toBeNull();
      expect(mockGetFolderSyncState).toHaveBeenCalledWith("acc-1", "INBOX");
    });

    it("returns existing folder sync state", async () => {
      const state: FolderSyncState = {
        account_id: "acc-1",
        folder_path: "INBOX",
        uidvalidity: 12345,
        last_uid: 100,
        modseq: 999,
        last_sync_at: 1700000000,
      };
      mockGetFolderSyncState.mockResolvedValue(state);

      const result = await getFolderSyncState("acc-1", "INBOX");

      expect(result).toEqual(state);
    });

    it("passes correct parameters for different folder paths", async () => {
      mockGetFolderSyncState.mockResolvedValue(null);

      await getFolderSyncState("acc-2", "Sent");

      expect(mockGetFolderSyncState).toHaveBeenCalledWith("acc-2", "Sent");
    });
  });

  describe("upsertFolderSyncState", () => {
    it("creates new state via db-invoke wrapper", async () => {
      const state: FolderSyncState = {
        account_id: "acc-1",
        folder_path: "INBOX",
        uidvalidity: 12345,
        last_uid: 100,
        modseq: 999,
        last_sync_at: 1700000000,
      };

      await upsertFolderSyncState(state);

      expect(mockUpsertFolderSyncState).toHaveBeenCalledTimes(1);
      expect(mockUpsertFolderSyncState).toHaveBeenCalledWith({
        accountId: "acc-1",
        folderPath: "INBOX",
        uidvalidity: 12345,
        lastUid: 100,
        modseq: 999,
        lastSyncAt: 1700000000,
      });
    });

    it("handles null values for optional fields", async () => {
      const state: FolderSyncState = {
        account_id: "acc-1",
        folder_path: "Drafts",
        uidvalidity: null,
        last_uid: 0,
        modseq: null,
        last_sync_at: null,
      };

      await upsertFolderSyncState(state);

      expect(mockUpsertFolderSyncState).toHaveBeenCalledWith({
        accountId: "acc-1",
        folderPath: "Drafts",
        uidvalidity: null,
        lastUid: 0,
        modseq: null,
        lastSyncAt: null,
      });
    });

    it("updates existing state on conflict (upsert)", async () => {
      const state1: FolderSyncState = {
        account_id: "acc-1",
        folder_path: "INBOX",
        uidvalidity: 12345,
        last_uid: 100,
        modseq: 999,
        last_sync_at: 1700000000,
      };
      await upsertFolderSyncState(state1);

      const state2: FolderSyncState = {
        account_id: "acc-1",
        folder_path: "INBOX",
        uidvalidity: 12345,
        last_uid: 200,
        modseq: 1500,
        last_sync_at: 1700001000,
      };
      await upsertFolderSyncState(state2);

      expect(mockUpsertFolderSyncState).toHaveBeenCalledTimes(2);
      expect(mockUpsertFolderSyncState).toHaveBeenLastCalledWith({
        accountId: "acc-1",
        folderPath: "INBOX",
        uidvalidity: 12345,
        lastUid: 200,
        modseq: 1500,
        lastSyncAt: 1700001000,
      });
    });
  });

  describe("deleteFolderSyncState", () => {
    it("deletes by account_id and folder_path via db-invoke", async () => {
      await deleteFolderSyncState("acc-1", "INBOX");

      expect(dbInvokeDeleteFolderSyncState).toHaveBeenCalledTimes(1);
      expect(dbInvokeDeleteFolderSyncState).toHaveBeenCalledWith("acc-1", "INBOX");
    });

    it("passes correct params for different folders", async () => {
      await deleteFolderSyncState("acc-2", "Sent");

      expect(dbInvokeDeleteFolderSyncState).toHaveBeenCalledWith("acc-2", "Sent");
    });
  });

  describe("getAllFolderSyncStates", () => {
    it("returns all states for an account via db-invoke", async () => {
      const states: FolderSyncState[] = [
        { account_id: "acc-1", folder_path: "Drafts", uidvalidity: 111, last_uid: 10, modseq: null, last_sync_at: 1700000000 },
        { account_id: "acc-1", folder_path: "INBOX", uidvalidity: 222, last_uid: 50, modseq: 500, last_sync_at: 1700000000 },
        { account_id: "acc-1", folder_path: "Sent", uidvalidity: 333, last_uid: 30, modseq: null, last_sync_at: 1700000000 },
      ];
      vi.mocked(dbInvokeListFolderSyncStates).mockResolvedValue(states);

      const result = await getAllFolderSyncStates("acc-1");

      expect(result).toEqual(states);
      expect(result).toHaveLength(3);
    });

    it("returns empty array when no states exist", async () => {
      vi.mocked(dbInvokeListFolderSyncStates).mockResolvedValue([]);

      const result = await getAllFolderSyncStates("acc-nonexistent");

      expect(result).toEqual([]);
    });

    it("passes account_id to listFolderSyncStates", async () => {
      vi.mocked(dbInvokeListFolderSyncStates).mockResolvedValue([]);

      await getAllFolderSyncStates("acc-1");

      expect(dbInvokeListFolderSyncStates).toHaveBeenCalledWith("acc-1");
    });
  });
});
