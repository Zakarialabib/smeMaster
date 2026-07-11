import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", () => ({
  listSmartFolders: vi.fn(),
  upsertSmartFolder: vi.fn(),
  updateSmartFolder: vi.fn(),
  deleteSmartFolder: vi.fn(),
  updateSmartFolderSortOrder: vi.fn(),
}));

import {
  getSmartFolders,
  getSmartFolderById,
  insertSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  updateSmartFolderSortOrder,
} from "./smartFolders";

describe("smartFolders service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSmartFolders", () => {
    it("returns global folders when no accountId", async () => {
      const { listSmartFolders } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSmartFolders);
      fn.mockResolvedValueOnce([{ id: "sf-1", account_id: null }] as never);

      const result = await getSmartFolders();

      expect(fn).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
    });

    it("returns global + account folders when accountId provided", async () => {
      const { listSmartFolders } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSmartFolders);

      await getSmartFolders("acc-1");

      expect(fn).toHaveBeenCalledWith("acc-1");
    });

    it("returns data sorted by sort_order (Rust handles ordering)", async () => {
      const { listSmartFolders } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSmartFolders);
      fn.mockResolvedValueOnce([
        { id: "sf-1", account_id: "acc-1", sort_order: 1 },
        { id: "sf-2", account_id: "acc-1", sort_order: 0 },
      ] as never);

      const result = await getSmartFolders("acc-1");

      expect(fn).toHaveBeenCalledWith("acc-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("getSmartFolderById", () => {
    it("returns the folder when found", async () => {
      const { listSmartFolders } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSmartFolders);
      const mockFolder = {
        id: "sf-1",
        account_id: null,
        name: "Unread",
        query: "is:unread",
        icon: "MailOpen",
        color: null,
        sort_order: 0,
        is_default: 1,
        created_at: 1234567890,
      };
      fn.mockResolvedValueOnce([mockFolder] as never);

      const result = await getSmartFolderById("sf-1");

      expect(result).toEqual(mockFolder);
      expect(fn).toHaveBeenCalledWith();
    });

    it("returns null when not found", async () => {
      const { listSmartFolders } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(listSmartFolders);
      fn.mockResolvedValueOnce([] as never);

      const result = await getSmartFolderById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("insertSmartFolder", () => {
    it("inserts with all fields", async () => {
      const { upsertSmartFolder } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(upsertSmartFolder);
      fn.mockResolvedValueOnce({ id: "new-id" } as never);

      const id = await insertSmartFolder({
        name: "Test Folder",
        query: "is:unread",
        accountId: "acc-1",
        icon: "Star",
        color: "#ff0000",
      });

      expect(id).toBe("new-id");
      expect(fn).toHaveBeenCalledWith({
        accountId: "acc-1",
        name: "Test Folder",
        query: "is:unread",
        icon: "Star",
        color: "#ff0000",
      });
    });

    it("inserts with defaults for optional fields", async () => {
      const { upsertSmartFolder } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(upsertSmartFolder);
      fn.mockResolvedValueOnce({ id: "new-id" } as never);

      await insertSmartFolder({
        name: "Test",
        query: "from:boss",
      });

      expect(fn).toHaveBeenCalledWith({
        accountId: null,
        name: "Test",
        query: "from:boss",
        icon: "Search",
        color: null,
      });
    });
  });

  describe("updateSmartFolder", () => {
    it("delegates to dbUpdateSmartFolder with set/unset", async () => {
      const { updateSmartFolder: dbUpdateSmartFolder } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbUpdateSmartFolder);

      await updateSmartFolder("sf-1", { name: "New Name" });

      expect(fn).toHaveBeenCalledWith("sf-1", {
        set: { name: "New Name" },
        unset: [],
      });
    });

    it("does nothing when no updates provided", async () => {
      const { updateSmartFolder: dbUpdateSmartFolder } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbUpdateSmartFolder);

      await updateSmartFolder("sf-1", {});

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("deleteSmartFolder", () => {
    it("deletes by id", async () => {
      const { deleteSmartFolder: dbDeleteSmartFolder } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbDeleteSmartFolder);

      await deleteSmartFolder("sf-1");

      expect(fn).toHaveBeenCalledWith("sf-1");
    });
  });

  describe("updateSmartFolderSortOrder", () => {
    it("delegates to dbUpdateSmartFolderSortOrder with orders array", async () => {
      const { updateSmartFolderSortOrder: dbUpdateSmartFolderSortOrder } =
        await import("@/shared/services/db/db-invoke");
      const fn = vi.mocked(dbUpdateSmartFolderSortOrder);

      await updateSmartFolderSortOrder([
        { id: "sf-1", sortOrder: 2 },
        { id: "sf-2", sortOrder: 0 },
      ]);

      expect(fn).toHaveBeenCalledWith([
        { id: "sf-1", sortOrder: 2 },
        { id: "sf-2", sortOrder: 0 },
      ]);
    });
  });
});
