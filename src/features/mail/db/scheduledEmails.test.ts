import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-id"),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import {
  getScheduledEmailsForAccount,
  getPendingScheduledEmails,
  insertScheduledEmail,
  updateScheduledEmailStatus,
  deleteScheduledEmail,
} from "./scheduledEmails";

const mockInvoke = vi.mocked(invoke);

describe("scheduledEmails service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getScheduledEmailsForAccount", () => {
    it("calls db_list_scheduled_emails with accountId", async () => {
      const emails = [{ id: "se1", subject: "Test" }];
      mockInvoke.mockResolvedValue(emails);
      const result = await getScheduledEmailsForAccount("acc-1");
      expect(result).toEqual(emails);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_scheduled_emails", {
        accountId: "acc-1",
      });
    });
  });

  describe("getPendingScheduledEmails", () => {
    it("calls db_get_pending_scheduled_emails", async () => {
      mockInvoke.mockResolvedValue([]);
      await getPendingScheduledEmails();
      expect(mockInvoke).toHaveBeenCalledWith("db_get_pending_scheduled_emails", {});
    });
  });

  describe("insertScheduledEmail", () => {
    it("inserts a scheduled email with generated uuid", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const id = await insertScheduledEmail({
        accountId: "acc-1",
        toAddresses: "user@test.com",
        ccAddresses: null,
        bccAddresses: null,
        subject: "Hello",
        bodyHtml: "<p>Hello</p>",
        replyToMessageId: null,
        threadId: null,
        scheduledAt: 1234567890,
        signatureId: null,
      });
      expect(id).toBe("mock-id");
      expect(uuidv4).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith("db_create_scheduled_email", {
        scheduledEmail: {
          accountId: "acc-1",
          toAddresses: "user@test.com",
          ccAddresses: null,
          bccAddresses: null,
          subject: "Hello",
          bodyHtml: "<p>Hello</p>",
          replyToMessageId: null,
          threadId: null,
          scheduledAt: 1234567890,
          signatureId: null,
          attachmentPaths: null,
          status: "pending",
        },
      });
    });

    it("passes attachmentPaths when provided", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await insertScheduledEmail({
        accountId: "acc-1",
        toAddresses: "user@test.com",
        ccAddresses: null,
        bccAddresses: null,
        subject: null,
        bodyHtml: "<p>Hi</p>",
        replyToMessageId: null,
        threadId: null,
        scheduledAt: 999999,
        signatureId: null,
        attachmentPaths: "/path/to/file.pdf",
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_create_scheduled_email", {
        scheduledEmail: expect.objectContaining({
          attachmentPaths: "/path/to/file.pdf",
        }),
      });
    });
  });

  describe("updateScheduledEmailStatus", () => {
    it("calls db_update_scheduled_email_status", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateScheduledEmailStatus("se1", "sent");
      expect(mockInvoke).toHaveBeenCalledWith("db_update_scheduled_email_status", {
        id: "se1",
        status: "sent",
      });
    });
  });

  describe("deleteScheduledEmail", () => {
    it("calls db_delete_scheduled_email with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteScheduledEmail("se1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_scheduled_email", { id: "se1" });
    });
  });
});
