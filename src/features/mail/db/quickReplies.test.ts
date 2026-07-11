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
  getQuickReplies,
  countQuickReplies,
  countQuickRepliesCount,
  upsertQuickReply,
  deleteQuickReply,
  incrementQuickReplyUsage,
} from "./quickReplies";

const mockInvoke = vi.mocked(invoke);

describe("quickReplies service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuickReplies", () => {
    it("calls db_list_quick_replies with accountId", async () => {
      const replies = [{ id: "qr1", title: "Thanks" }];
      mockInvoke.mockResolvedValue(replies);
      const result = await getQuickReplies("acc-1");
      expect(result).toEqual(replies);
      expect(mockInvoke).toHaveBeenCalledWith("db_list_quick_replies", {
        accountId: "acc-1",
      });
    });
  });

  describe("countQuickReplies", () => {
    it("calls db_count_quick_replies", async () => {
      mockInvoke.mockResolvedValue(15);
      const result = await countQuickReplies();
      expect(result).toBe(15);
      expect(mockInvoke).toHaveBeenCalledWith("db_count_quick_replies", {});
    });
  });

  describe("countQuickRepliesCount", () => {
    it("calls db_count_quick_replies via wrapper", async () => {
      mockInvoke.mockResolvedValue(3);
      const result = await countQuickRepliesCount();
      expect(result).toBe(3);
      expect(mockInvoke).toHaveBeenCalledWith("db_count_quick_replies", {});
    });
  });

  describe("upsertQuickReply", () => {
    it("inserts a quick reply with generated uuid", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const id = await upsertQuickReply({
        accountId: "acc-1",
        title: "Thanks",
        bodyHtml: "<p>Thanks!</p>",
      });
      expect(id).toBe("mock-id");
      expect(uuidv4).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_quick_reply", {
        id: "mock-id",
        accountId: "acc-1",
        title: "Thanks",
        bodyHtml: "<p>Thanks!</p>",
        shortcut: null,
        sortOrder: 0,
      });
    });

    it("uses provided id when given", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const id = await upsertQuickReply({
        id: "custom-id",
        accountId: "acc-1",
        title: "Hello",
        bodyHtml: "<p>Hello</p>",
      });
      expect(id).toBe("custom-id");
      expect(uuidv4).not.toHaveBeenCalled();
    });

    it("passes shortcut and sortOrder when provided", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await upsertQuickReply({
        accountId: "acc-1",
        title: "Greeting",
        bodyHtml: "<p>Hi!</p>",
        shortcut: "/hi",
        sortOrder: 5,
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_quick_reply", {
        id: "mock-id",
        accountId: "acc-1",
        title: "Greeting",
        bodyHtml: "<p>Hi!</p>",
        shortcut: "/hi",
        sortOrder: 5,
      });
    });
  });

  describe("deleteQuickReply", () => {
    it("calls db_delete_quick_reply with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await deleteQuickReply("qr1");
      expect(mockInvoke).toHaveBeenCalledWith("db_delete_quick_reply", { id: "qr1" });
    });
  });

  describe("incrementQuickReplyUsage", () => {
    it("calls db_increment_quick_reply_usage with id", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await incrementQuickReplyUsage("qr1");
      expect(mockInvoke).toHaveBeenCalledWith("db_increment_quick_reply_usage", { id: "qr1" });
    });
  });
});
