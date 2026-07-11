import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  getThreads: vi.fn(),
  batchUpdateThreads: vi.fn(async () => {}),
  deleteAllThreadsForAccount: vi.fn(),
  getMutedThreadIds: vi.fn(),
}));

import { batchUpdateThreads, deleteAllThreadsForAccount as dbDeleteAllThreadsForAccount, getMutedThreadIds as dbGetMutedThreadIds } from "@shared/services/db/db-invoke";
import { muteThread, unmuteThread, getMutedThreadIds, deleteAllThreadsForAccount } from "./threads";

describe("threads service - deleteAllThreadsForAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all threads for the given account", async () => {
    await deleteAllThreadsForAccount("acc-1");

    expect(dbDeleteAllThreadsForAccount).toHaveBeenCalledWith("acc-1");
  });
});

describe("threads service - mute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("muteThread", () => {
    it("calls batchUpdateThreads with isMuted = true", async () => {
      await muteThread("acc-1", "thread-1");

      expect(batchUpdateThreads).toHaveBeenCalledWith(
        ["thread-1"],
        { isMuted: true },
      );
    });
  });

  describe("unmuteThread", () => {
    it("calls batchUpdateThreads with isMuted = false", async () => {
      await unmuteThread("acc-1", "thread-1");

      expect(batchUpdateThreads).toHaveBeenCalledWith(
        ["thread-1"],
        { isMuted: false },
      );
    });
  });

  describe("getMutedThreadIds", () => {
    it("returns a Set of muted thread IDs", async () => {
      vi.mocked(dbGetMutedThreadIds).mockResolvedValueOnce(["thread-1", "thread-3"]);

      const result = await getMutedThreadIds("acc-1");

      expect(dbGetMutedThreadIds).toHaveBeenCalledWith("acc-1");
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has("thread-1")).toBe(true);
      expect(result.has("thread-3")).toBe(true);
    });

    it("returns an empty Set when no threads are muted", async () => {
      vi.mocked(dbGetMutedThreadIds).mockResolvedValueOnce([]);

      const result = await getMutedThreadIds("acc-1");

      expect(result.size).toBe(0);
    });
  });
});
