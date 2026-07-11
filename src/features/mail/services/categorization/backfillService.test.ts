import { describe, it, expect, vi, beforeEach } from "vitest";
import { backfillUncategorizedThreads } from "./backfillService";

vi.mock("@features/mail/db/threadCategories", () => ({
  getUncategorizedInboxThreadIds: vi.fn(),
  setThreadCategory: vi.fn(() => Promise.resolve()),
}));

vi.mock("@shared/services/db/threads", () => ({
  getThreadLabelIds: vi.fn(() => Promise.resolve(["INBOX"])),
}));

vi.mock("@shared/services/db/messages", () => ({
  getMessagesForThread: vi.fn(() => Promise.resolve([
    {
      id: "msg1",
      account_id: "acc1",
      thread_id: "t1",
      from_address: "noreply@example.com",
      from_name: null,
      to_addresses: null,
      cc_addresses: null,
      bcc_addresses: null,
      reply_to: null,
      subject: "Test",
      snippet: null,
      date: 1000,
      is_read: 0,
      is_starred: 0,
      body_html: null,
      body_text: null,
      body_cached: 0,
      raw_size: null,
      internal_date: null,
      list_unsubscribe: null,
      list_unsubscribe_post: null,
    },
  ])),
}));

import { getUncategorizedInboxThreadIds, setThreadCategory } from "@features/mail/db/threadCategories";
import { getThreadLabelIds } from "@shared/services/db/threads";
import { getMessagesForThread } from "@shared/services/db/messages";

describe("backfillUncategorizedThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply safe defaults after reset (resetAllMocks clears everything)
    vi.mocked(setThreadCategory).mockResolvedValue(undefined);
    vi.mocked(getThreadLabelIds).mockResolvedValue(["INBOX"]);
    vi.mocked(getMessagesForThread).mockResolvedValue([]);
    vi.mocked(getUncategorizedInboxThreadIds).mockResolvedValue([]);
  });

  it("categorizes uncategorized threads using rule engine", async () => {
    vi.mocked(getUncategorizedInboxThreadIds).mockResolvedValueOnce([
      { id: "t1", subject: "Test Subject", snippet: "Test snippet", fromAddress: "noreply@example.com" },
      { id: "t2", subject: "Social Update", snippet: "Social snippet", fromAddress: "notifications@facebookmail.com" },
    ]);
    // Second call returns empty (no more batches)
    vi.mocked(getUncategorizedInboxThreadIds).mockResolvedValueOnce([]);

    vi.mocked(getThreadLabelIds)
      .mockResolvedValueOnce(["INBOX"])
      .mockResolvedValueOnce(["INBOX"]);

    vi.mocked(getMessagesForThread)
      .mockResolvedValueOnce([{
        id: "msg1",
        account_id: "acc1",
        thread_id: "t1",
        from_address: "noreply@example.com",
        from_name: null,
        to_addresses: null,
        cc_addresses: null,
        bcc_addresses: null,
        reply_to: null,
        subject: "Test",
        snippet: null,
        date: 1000,
        is_read: 0,
        is_starred: 0,
        body_html: null,
        body_text: null,
        body_cached: 0,
        raw_size: null,
        internal_date: null,
        list_unsubscribe: null,
        list_unsubscribe_post: null,
      }])
      .mockResolvedValueOnce([{
        id: "msg2",
        account_id: "acc1",
        thread_id: "t2",
        from_address: "notifications@facebookmail.com",
        from_name: null,
        to_addresses: null,
        cc_addresses: null,
        bcc_addresses: null,
        reply_to: null,
        subject: "Social Update",
        snippet: null,
        date: 2000,
        is_read: 0,
        is_starred: 0,
        body_html: null,
        body_text: null,
        body_cached: 0,
        raw_size: null,
        internal_date: null,
        list_unsubscribe: null,
        list_unsubscribe_post: null,
      }]);

    const count = await backfillUncategorizedThreads("acc1");

    expect(count).toBe(2);
    expect(setThreadCategory).toHaveBeenCalledTimes(2);
    // noreply@ â†’ Updates (UPDATE_PREFIXES)
    expect(setThreadCategory).toHaveBeenCalledWith("acc1", "t1", "Updates", false);
    // facebookmail.com â†’ Social (SOCIAL_DOMAINS)
    expect(setThreadCategory).toHaveBeenCalledWith("acc1", "t2", "Social", false);
  });

  it("skips already-categorized threads (returns 0 for empty batch)", async () => {
    vi.mocked(getUncategorizedInboxThreadIds).mockResolvedValueOnce([]);

    const count = await backfillUncategorizedThreads("acc1");

    expect(count).toBe(0);
    expect(setThreadCategory).not.toHaveBeenCalled();
  });

  it("processes multiple batches when first batch is full", async () => {
    // Create a batch of exactly batchSize items to trigger another batch
    const batchSize = 3;
    const threads = Array.from({ length: batchSize }, (_, i) => ({
      id: `t${i}`,
      subject: `Subject ${i}`,
      snippet: `Snippet ${i}`,
      fromAddress: "user@example.com",
    }));

    const mockGetUncategorized = vi.mocked(getUncategorizedInboxThreadIds);
    mockGetUncategorized.mockResolvedValueOnce(threads);
    mockGetUncategorized.mockResolvedValueOnce([]);

    vi.mocked(getThreadLabelIds).mockResolvedValue(["INBOX"]);

    // Mock messages for each thread â€” from regular user (Primary)
    vi.mocked(getMessagesForThread).mockResolvedValue([{
      id: "msg-batch",
      account_id: "acc1",
      thread_id: "t0",
      from_address: "user@example.com",
      from_name: null,
      to_addresses: null,
      cc_addresses: null,
      bcc_addresses: null,
      reply_to: null,
      subject: "Test",
      snippet: null,
      date: 1000,
      is_read: 0,
      is_starred: 0,
      body_html: null,
      body_text: null,
      body_cached: 0,
      raw_size: null,
      internal_date: null,
      list_unsubscribe: null,
      list_unsubscribe_post: null,
    }]);

    const count = await backfillUncategorizedThreads("acc1", batchSize);

    // Verify the batch loop ran
    expect(mockGetUncategorized).toHaveBeenCalledTimes(2);
    expect(count).toBe(batchSize);
    expect(setThreadCategory).toHaveBeenCalledTimes(batchSize);
    // All from user@example.com -> Primary (default)
    for (let i = 0; i < batchSize; i++) {
      expect(setThreadCategory).toHaveBeenCalledWith("acc1", `t${i}`, "Primary", false);
    }
  });
});

