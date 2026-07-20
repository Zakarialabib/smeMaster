import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSyncStore } from "@/stores/shared";
import { getAllLabelUnreadCounts } from "@shared/services/db/threads";

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
    isHydrated: false,
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
    perAccount: {},
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
      expect(state.isHydrated).toBe(false);
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncAt).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.perAccount).toEqual({});
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

    it("should set perAccount status on sync:account-start", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {
        host: "example.com",
        username: "user",
      });

      expect(useSyncStore.getState().perAccount).toEqual({
        "user@example.com": {
          status: "syncing",
          lastSyncAt: null,
          error: null,
        },
      });
    });

    it("should set perAccount status on sync:account-complete", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {
        host: "example.com",
        username: "user",
      });
      useSyncStore.getState().handleEvent("sync:account-complete", {
        host: "example.com",
        username: "user",
      });

      expect(useSyncStore.getState().perAccount).toEqual({
        "user@example.com": {
          status: "idle",
          lastSyncAt: expect.any(Number),
          error: null,
        },
      });
    });

    it("should set perAccount status on sync:account-error", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {
        host: "example.com",
        username: "user",
      });
      useSyncStore.getState().handleEvent("sync:account-error", {
        host: "example.com",
        username: "user",
        error: "Sync failed",
      });

      expect(useSyncStore.getState().perAccount).toEqual({
        "user@example.com": {
          status: "error",
          lastSyncAt: null,
          error: "Sync failed",
        },
      });
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

    it("should not affect other fields when setting pending ops count", () => {
      useSyncStore.getState().setPendingOpsCount(5);
      const state = useSyncStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.isSyncingFolder).toBeNull();
      expect(state.unreadCounts).toEqual({});
    });

    it("should not affect other fields when setting syncing folder", () => {
      useSyncStore.getState().setSyncingFolder("INBOX");
      const state = useSyncStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.pendingOpsCount).toBe(0);
      expect(state.unreadCounts).toEqual({});
    });

    it("should not affect other fields when setting unread counts", () => {
      useSyncStore.getState().setUnreadCounts({ INBOX: 5 });
      const state = useSyncStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.pendingOpsCount).toBe(0);
      expect(state.isSyncingFolder).toBeNull();
    });
  });

  describe("hydration", () => {
    it("should set isHydrated to true after hydrate", async () => {
      await useSyncStore.getState().hydrate();
      expect(useSyncStore.getState().isHydrated).toBe(true);
    });

    it("should set isOnline from navigator.onLine", async () => {
      await useSyncStore.getState().hydrate();
      expect(useSyncStore.getState().isOnline).toBe(navigator.onLine);
    });
  });

  describe("edge cases", () => {
    it("should handle empty payload in handleEvent", () => {
      useSyncStore.getState().handleEvent("sync:complete", null);
      expect(useSyncStore.getState().isSyncing).toBe(false);
    });

    it("should handle undefined payload in handleEvent", () => {
      useSyncStore.getState().handleEvent("sync:complete", undefined);
      expect(useSyncStore.getState().isSyncing).toBe(false);
    });

    it("should handle sync:error with missing error in payload", () => {
      useSyncStore.getState().handleEvent("sync:error", {});
      expect(useSyncStore.getState().lastError).toBe("Sync error");
    });

    it("should handle sync:error with error in payload", () => {
      useSyncStore.getState().handleEvent("sync:error", { last_error: "Custom error" });
      expect(useSyncStore.getState().lastError).toBe("Custom error");
    });

    it("should handle sync:account-start with missing host/username", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {});
      expect(useSyncStore.getState().perAccount).toEqual({
        "@": {
          status: "syncing",
          lastSyncAt: null,
          error: null,
        },
      });
    });

    it("should handle sync:account-complete with missing host/username", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {});
      useSyncStore.getState().handleEvent("sync:account-complete", {});
      expect(useSyncStore.getState().perAccount).toEqual({
        "@": {
          status: "idle",
          lastSyncAt: expect.any(Number),
          error: null,
        },
      });
    });

    it("should handle sync:account-error with missing host/username", () => {
      useSyncStore.getState().handleEvent("sync:account-start", {});
      useSyncStore.getState().handleEvent("sync:account-error", { error: "Account error" });
      expect(useSyncStore.getState().perAccount).toEqual({
        "@": {
          status: "error",
          lastSyncAt: null,
          error: "Account error",
        },
      });
    });
  });
});