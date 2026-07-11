import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
    getLocalDraft: vi.fn(),
    upsertLocalDraft: vi.fn(),
    deleteLocalDraft: vi.fn(),
    executeSearchQuery: vi.fn(),
    markDraftSynced: vi.fn(),
  };
});

import {
  upsertLocalDraft,
  getLocalDraft,
  getUnsyncedDrafts,
  markDraftSynced,
  deleteLocalDraft,
} from "./localDrafts";

describe("localDrafts DB service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertLocalDraft", () => {
    it("inserts or updates a draft with mapped fields", async () => {
      const { upsertLocalDraft: dbUpsertLocalDraft } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbUpsertLocalDraft);

      await upsertLocalDraft({
        id: "draft-1",
        account_id: "acct-1",
        to_addresses: "user@example.com",
        subject: "Test",
        body_html: "<p>Hello</p>",
      });

      expect(fn).toHaveBeenCalledWith({
        id: "draft-1",
        accountId: "acct-1",
        toAddresses: "user@example.com",
        ccAddresses: null,
        bccAddresses: null,
        subject: "Test",
        bodyHtml: "<p>Hello</p>",
        replyToMessageId: null,
        threadId: null,
        fromEmail: null,
        signatureId: null,
        remoteDraftId: null,
        attachments: null,
      });
    });

    it("passes null for undefined optional fields", async () => {
      const { upsertLocalDraft: dbUpsertLocalDraft } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbUpsertLocalDraft);

      await upsertLocalDraft({ id: "draft-2", account_id: "acct-1" });

      expect(fn).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "draft-2",
          accountId: "acct-1",
          toAddresses: null,
          ccAddresses: null,
          bccAddresses: null,
          subject: null,
          bodyHtml: null,
          replyToMessageId: null,
          threadId: null,
          fromEmail: null,
          signatureId: null,
          remoteDraftId: null,
          attachments: null,
        }),
      );
    });
  });

  describe("getLocalDraft", () => {
    it("returns draft by id", async () => {
      const { getLocalDraft: dbGetLocalDraft } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbGetLocalDraft);
      const draft = { id: "draft-1", account_id: "acct-1", subject: "Test" };
      fn.mockResolvedValueOnce(draft as never);

      const result = await getLocalDraft("draft-1");

      expect(result).toEqual(draft);
      expect(fn).toHaveBeenCalledWith("draft-1");
    });

    it("returns null when not found", async () => {
      const { getLocalDraft: dbGetLocalDraft } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbGetLocalDraft);
      fn.mockResolvedValueOnce(null as never);

      const result = await getLocalDraft("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getUnsyncedDrafts", () => {
    it("queries by account_id and pending status", async () => {
      const { executeSearchQuery } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(executeSearchQuery);

      await getUnsyncedDrafts("acct-1");

      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending'"),
        ["acct-1"],
      );
    });
  });

  describe("markDraftSynced", () => {
    it("updates sync status and remote draft id", async () => {
      const { markDraftSynced: dbMarkDraftSynced } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbMarkDraftSynced);

      await markDraftSynced("draft-1", "remote-123");

      expect(fn).toHaveBeenCalledWith("draft-1", "remote-123");
    });
  });

  describe("deleteLocalDraft", () => {
    it("deletes by id", async () => {
      const { deleteLocalDraft: dbDeleteLocalDraft } = await import(
        "@/shared/services/db/db-invoke"
      );
      const fn = vi.mocked(dbDeleteLocalDraft);

      await deleteLocalDraft("draft-1");

      expect(fn).toHaveBeenCalledWith("draft-1");
    });
  });
});
