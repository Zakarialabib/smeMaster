import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSyncStore } from "@/stores/shared";

vi.mock("@shared/services/db/threads", () => ({
  getAllLabelUnreadCounts: vi.fn(),
}));

import { getAllLabelUnreadCounts } from "@shared/services/db/threads";

beforeEach(() => {
  useSyncStore.setState({
    isOnline: true,
    pendingOpsCount: 0,
    isSyncingFolder: null,
    unreadCounts: {},
  });
  vi.clearAllMocks();
});

describe("syncStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useSyncStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.pendingOpsCount).toBe(0);
      expect(state.isSyncingFolder).toBeNull();
      expect(state.unreadCounts).toEqual({});
    });
  });

  describe("setOnline", () => {
    it("should set online status to true", () => {
      useSyncStore.getState().setOnline(true);
      expect(useSyncStore.getState().isOnline).toBe(true);
    });

    it("should set online status to false", () => {
      useSyncStore.getState().setOnline(false);
      expect(useSyncStore.getState().isOnline).toBe(false);
    });

    it("should toggle online status", () => {
      useSyncStore.getState().setOnline(false);
      expect(useSyncStore.getState().isOnline).toBe(false);
      useSyncStore.getState().setOnline(true);
      expect(useSyncStore.getState().isOnline).toBe(true);
    });
  });

  describe("setPendingOpsCount", () => {
    it("should set pending ops count", () => {
      useSyncStore.getState().setPendingOpsCount(5);
      expect(useSyncStore.getState().pendingOpsCount).toBe(5);
    });

    it("should set pending ops count to zero", () => {
      useSyncStore.getState().setPendingOpsCount(10);
      useSyncStore.getState().setPendingOpsCount(0);
      expect(useSyncStore.getState().pendingOpsCount).toBe(0);
    });
  });

  describe("setSyncingFolder", () => {
    it("should set syncing folder", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      expect(useSyncStore.getState().isSyncingFolder).toBe("INBOX");
    });

    it("should clear syncing folder", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      useSyncStore.getState().setSyncingFolder(null);
      expect(useSyncStore.getState().isSyncingFolder).toBeNull();
    });
  });

  describe("setUnreadCounts", () => {
    it("should set unread counts", () => {
      const counts = { INBOX: 5, SENT: 2, DRAFTS: 1 };
      useSyncStore.getState().setUnreadCounts(counts);
      expect(useSyncStore.getState().unreadCounts).toEqual(counts);
    });

    it("should replace existing unread counts", () => {
      useSyncStore.getState().setUnreadCounts({ INBOX: 5 });
      useSyncStore.getState().setUnreadCounts({ SENT: 3 });
      expect(useSyncStore.getState().unreadCounts).toEqual({ SENT: 3 });
    });

    it("should set to empty object", () => {
      useSyncStore.getState().setUnreadCounts({ INBOX: 5 });
      useSyncStore.getState().setUnreadCounts({});
      expect(useSyncStore.getState().unreadCounts).toEqual({});
    });
  });

  describe("refreshUnreadCounts", () => {
    it("should fetch and update unread counts", async () => {
      const mockCounts = { INBOX: 10, SENT: 0 };
      vi.mocked(getAllLabelUnreadCounts).mockResolvedValue(mockCounts);

      await useSyncStore.getState().refreshUnreadCounts("account-1");

      expect(getAllLabelUnreadCounts).toHaveBeenCalledWith("account-1");
      expect(useSyncStore.getState().unreadCounts).toEqual(mockCounts);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(getAllLabelUnreadCounts).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await useSyncStore.getState().refreshUnreadCounts("account-1");

      expect(consoleSpy).toHaveBeenCalled();
      expect(useSyncStore.getState().unreadCounts).toEqual({});
      consoleSpy.mockRestore();
    });
  });

  describe("handleEvent", () => {
    it("should set syncing folder on sync:started", () => {
      useSyncStore.getState().handleEvent("sync:started", {});

      expect(useSyncStore.getState().isSyncingFolder).toBe("__all__");
    });

    it("should clear syncing folder on sync:complete", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      useSyncStore.getState().handleEvent("sync:complete", {});

      expect(useSyncStore.getState().isSyncingFolder).toBeNull();
    });

    it("should clear syncing folder on sync:error", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      useSyncStore.getState().handleEvent("sync:error", {});

      expect(useSyncStore.getState().isSyncingFolder).toBeNull();
    });

    it("should set online on rust:init:complete", () => {
      useSyncStore.getState().setOnline(false);
      useSyncStore.getState().handleEvent("rust:init:complete", {});

      expect(useSyncStore.getState().isOnline).toBe(true);
    });

    it("should not affect state on unknown event types", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      useSyncStore.getState().setOnline(false);

      useSyncStore.getState().handleEvent("unknown:event", {});

      expect(useSyncStore.getState().isSyncingFolder).toBe("INBOX");
      expect(useSyncStore.getState().isOnline).toBe(false);
    });

    it("should handle sync:started when already syncing", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      useSyncStore.getState().handleEvent("sync:started", {});

      expect(useSyncStore.getState().isSyncingFolder).toBe("__all__");
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when setting online", () => {
      useSyncStore.getState().setOnline(false);
      const state = useSyncStore.getState();
      expect(state.pendingOpsCount).toBe(0);
      expect(state.isSyncingFolder).toBeNull();
      expect(state.unreadCounts).toEqual({});
    });
  });
});
