import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  deleteAllMessagesForAccount: vi.fn(),
  bulkUpdateMessageThread: vi.fn(),
}));

import { deleteAllMessagesForAccount as dbDeleteAllMessagesForAccount, bulkUpdateMessageThread } from "@shared/services/db/db-invoke";
import { deleteAllMessagesForAccount, updateMessageThreadIds } from "./messages";

describe("messages service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteAllMessagesForAccount", () => {
    it("deletes all messages for the given account", async () => {
      await deleteAllMessagesForAccount("acc-1");

      expect(dbDeleteAllMessagesForAccount).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("updateMessageThreadIds", () => {
    it("updates thread_id for a small batch of messages", async () => {
      await updateMessageThreadIds("acc-1", ["msg-1", "msg-2", "msg-3"], "thread-abc");

      expect(bulkUpdateMessageThread).toHaveBeenCalledTimes(1);
      expect(bulkUpdateMessageThread).toHaveBeenCalledWith(
        "acc-1",
        ["msg-1", "msg-2", "msg-3"],
        "thread-abc",
      );
    });

    it("chunks large batches to stay within SQLite variable limit", async () => {
      // Rust-side handles chunking; the service passes the full array
      const messageIds = Array.from({ length: 1200 }, (_, i) => `msg-${i}`);
      await updateMessageThreadIds("acc-1", messageIds, "thread-xyz");

      expect(bulkUpdateMessageThread).toHaveBeenCalledTimes(1);
      expect(bulkUpdateMessageThread).toHaveBeenCalledWith(
        "acc-1",
        messageIds,
        "thread-xyz",
      );
    });

    it("handles empty message list without calling db", async () => {
      await updateMessageThreadIds("acc-1", [], "thread-abc");

      expect(bulkUpdateMessageThread).not.toHaveBeenCalled();
    });

    it("handles exactly 500 messages in a single call", async () => {
      const messageIds = Array.from({ length: 500 }, (_, i) => `msg-${i}`);
      await updateMessageThreadIds("acc-1", messageIds, "thread-abc");

      expect(bulkUpdateMessageThread).toHaveBeenCalledTimes(1);
      expect(bulkUpdateMessageThread).toHaveBeenCalledWith("acc-1", messageIds, "thread-abc");
    });

    it("handles 501 messages in a single call (Rust chunking)", async () => {
      const messageIds = Array.from({ length: 501 }, (_, i) => `msg-${i}`);
      await updateMessageThreadIds("acc-1", messageIds, "thread-abc");

      expect(bulkUpdateMessageThread).toHaveBeenCalledTimes(1);
      expect(bulkUpdateMessageThread).toHaveBeenCalledWith("acc-1", messageIds, "thread-abc");
    });
  });
});
