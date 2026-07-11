import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  getAttachmentsForAccount: vi.fn(),
  getAttachmentSenders: vi.fn(),
  upsertAttachment: vi.fn(),
  getAttachmentsForMessage: vi.fn(),
}));

import { getAttachmentsForAccount as dbGetAttachmentsForAccount, getAttachmentSenders as dbGetAttachmentSenders, upsertAttachment as dbUpsertAttachment, getAttachmentsForMessage as dbGetAttachmentsForMessage } from "@shared/services/db/db-invoke";
import { getAttachmentsForAccount, getAttachmentSenders, upsertAttachment, getAttachmentsForMessage } from "./attachments";
import type { AttachmentWithContext, AttachmentSender } from "@shared/services/db/db-invoke";

describe("attachments DB service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAttachmentsForAccount", () => {
    it("queries with default limit and offset", async () => {
      const mockData = [
        { id: "att-1", filename: "test.pdf", from_address: "alice@example.com", date: 1000 },
      ] as unknown as AttachmentWithContext[];
      vi.mocked(dbGetAttachmentsForAccount).mockResolvedValueOnce(mockData);

      const result = await getAttachmentsForAccount("acc-1");

      expect(dbGetAttachmentsForAccount).toHaveBeenCalledTimes(1);
      expect(dbGetAttachmentsForAccount).toHaveBeenCalledWith("acc-1", 200, 0);
      expect(result).toEqual(mockData);
    });

    it("supports custom limit and offset", async () => {
      vi.mocked(dbGetAttachmentsForAccount).mockResolvedValueOnce([]);

      await getAttachmentsForAccount("acc-1", 50, 100);

      expect(dbGetAttachmentsForAccount).toHaveBeenCalledWith("acc-1", 50, 100);
    });
  });

  describe("getAttachmentSenders", () => {
    it("queries distinct senders with counts", async () => {
      const mockSenders = [
        { from_address: "alice@example.com", from_name: "Alice", count: 5 },
      ] as unknown as AttachmentSender[];
      vi.mocked(dbGetAttachmentSenders).mockResolvedValueOnce(mockSenders);

      const result = await getAttachmentSenders("acc-1");

      expect(dbGetAttachmentSenders).toHaveBeenCalledTimes(1);
      expect(dbGetAttachmentSenders).toHaveBeenCalledWith("acc-1");
      expect(result).toEqual(mockSenders);
    });
  });

  describe("upsertAttachment", () => {
    it("delegates to db-invoke wrapper with correct params", async () => {
      await upsertAttachment({
        id: "att-1",
        messageId: "msg-1",
        accountId: "acc-1",
        filename: "test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        gmailAttachmentId: "gid-1",
        contentId: null,
        isInline: false,
      });

      expect(dbUpsertAttachment).toHaveBeenCalledTimes(1);
      expect(dbUpsertAttachment).toHaveBeenCalledWith({
        id: "att-1",
        message_id: "msg-1",
        account_id: "acc-1",
        filename: "test.pdf",
        mime_type: "application/pdf",
        size: 1024,
        gmail_attachment_id: "gid-1",
        content_id: null,
        is_inline: 0,
        local_path: null,
      });
    });
  });

  describe("getAttachmentsForMessage", () => {
    it("queries attachments for a specific message", async () => {
      vi.mocked(dbGetAttachmentsForMessage).mockResolvedValueOnce([]);

      await getAttachmentsForMessage("acc-1", "msg-1");

      expect(dbGetAttachmentsForMessage).toHaveBeenCalledWith("msg-1");
    });
  });
});
