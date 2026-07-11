import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNotificationsStore } from "@/stores/shared";

beforeEach(() => {
  useNotificationsStore.setState({
    notifications: [],
    maxItems: 20,
  });
  vi.clearAllMocks();
});

describe("notificationStore", () => {
  describe("initial state", () => {
    it("should have correct defaults", () => {
      const state = useNotificationsStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.maxItems).toBe(20);
    });
  });

  describe("setMaxItems", () => {
    it("should set max items", () => {
      useNotificationsStore.getState().setMaxItems(50);
      expect(useNotificationsStore.getState().maxItems).toBe(50);
    });

    it("should set max items to a smaller value", () => {
      useNotificationsStore.getState().setMaxItems(5);
      expect(useNotificationsStore.getState().maxItems).toBe(5);
    });
  });

  describe("addNotification", () => {
    it("should add a notification with auto-generated id and timestamp", () => {
      const before = Date.now();
      useNotificationsStore.getState().addNotification({
        title: "Test",
        body: "Body text",
      });
      const after = Date.now();

      const notifications = useNotificationsStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Test");
      expect(notifications[0].body).toBe("Body text");
      expect(notifications[0].dismissed).toBe(false);
      expect(notifications[0].id).toBeGreaterThan(0);
      expect(notifications[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(notifications[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("should add notifications to the front", () => {
      useNotificationsStore.getState().addNotification({ title: "First", body: "1" });
      useNotificationsStore.getState().addNotification({ title: "Second", body: "2" });

      const notifications = useNotificationsStore.getState().notifications;
      expect(notifications[0].title).toBe("Second");
      expect(notifications[1].title).toBe("First");
    });

    it("should include threadId when provided", () => {
      useNotificationsStore.getState().addNotification({
        title: "Test",
        body: "Body",
        threadId: "thread-123",
      });

      expect(useNotificationsStore.getState().notifications[0].threadId).toBe("thread-123");
    });

    it("should include data when provided", () => {
      useNotificationsStore.getState().addNotification({
        title: "Test",
        body: "Body",
        data: { key: "value" },
      });

      expect(useNotificationsStore.getState().notifications[0].data).toEqual({ key: "value" });
    });

    it("should trim to maxItems", () => {
      useNotificationsStore.getState().setMaxItems(3);

      useNotificationsStore.getState().addNotification({ title: "1", body: "1" });
      useNotificationsStore.getState().addNotification({ title: "2", body: "2" });
      useNotificationsStore.getState().addNotification({ title: "3", body: "3" });
      useNotificationsStore.getState().addNotification({ title: "4", body: "4" });

      const notifications = useNotificationsStore.getState().notifications;
      expect(notifications).toHaveLength(3);
      // Oldest (title "1") should be trimmed
      expect(notifications[0].title).toBe("4");
      expect(notifications[1].title).toBe("3");
      expect(notifications[2].title).toBe("2");
    });

    it("should assign unique ids to each notification", () => {
      useNotificationsStore.getState().addNotification({ title: "A", body: "a" });
      useNotificationsStore.getState().addNotification({ title: "B", body: "b" });
      useNotificationsStore.getState().addNotification({ title: "C", body: "c" });

      const ids = useNotificationsStore.getState().notifications.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("dismiss", () => {
    it("should mark a notification as dismissed", () => {
      useNotificationsStore.getState().addNotification({ title: "Test", body: "Body" });
      const id = useNotificationsStore.getState().notifications[0].id;

      useNotificationsStore.getState().dismiss(id);

      expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(true);
    });

    it("should not affect other notifications", () => {
      useNotificationsStore.getState().addNotification({ title: "A", body: "a" });
      useNotificationsStore.getState().addNotification({ title: "B", body: "b" });
      const idA = useNotificationsStore.getState().notifications[1].id;

      useNotificationsStore.getState().dismiss(idA);

      expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(false);
      expect(useNotificationsStore.getState().notifications[1].dismissed).toBe(true);
    });

    it("should handle dismissing a non-existent id gracefully", () => {
      useNotificationsStore.getState().addNotification({ title: "Test", body: "Body" });
      useNotificationsStore.getState().dismiss(999);

      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
      expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(false);
    });
  });

  describe("remove", () => {
    it("should remove a notification entirely", () => {
      useNotificationsStore.getState().addNotification({ title: "Test", body: "Body" });
      const id = useNotificationsStore.getState().notifications[0].id;

      useNotificationsStore.getState().remove(id);

      expect(useNotificationsStore.getState().notifications).toHaveLength(0);
    });

    it("should not affect other notifications", () => {
      useNotificationsStore.getState().addNotification({ title: "A", body: "a" });
      useNotificationsStore.getState().addNotification({ title: "B", body: "b" });
      const idA = useNotificationsStore.getState().notifications[1].id;

      useNotificationsStore.getState().remove(idA);

      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
      expect(useNotificationsStore.getState().notifications[0].title).toBe("B");
    });

    it("should handle removing a non-existent id gracefully", () => {
      useNotificationsStore.getState().addNotification({ title: "Test", body: "Body" });
      useNotificationsStore.getState().remove(999);

      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
    });
  });

  describe("clear", () => {
    it("should clear all notifications", () => {
      useNotificationsStore.getState().addNotification({ title: "A", body: "a" });
      useNotificationsStore.getState().addNotification({ title: "B", body: "b" });

      useNotificationsStore.getState().clear();

      expect(useNotificationsStore.getState().notifications).toEqual([]);
    });

    it("should handle clearing when already empty", () => {
      expect(() => {
        useNotificationsStore.getState().clear();
      }).not.toThrow();
      expect(useNotificationsStore.getState().notifications).toEqual([]);
    });
  });

  describe("handleEvent", () => {
    it("should add a notification on notification:received event", () => {
      useNotificationsStore.getState().handleEvent("notification:received", {
        title: "Event Title",
        body: "Event Body",
      });

      const notifications = useNotificationsStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Event Title");
      expect(notifications[0].body).toBe("Event Body");
    });

    it("should include thread_id as threadId", () => {
      useNotificationsStore.getState().handleEvent("notification:received", {
        title: "Test",
        body: "Body",
        thread_id: "thread-abc",
      });

      expect(useNotificationsStore.getState().notifications[0].threadId).toBe("thread-abc");
    });

    it("should include data from event payload", () => {
      useNotificationsStore.getState().handleEvent("notification:received", {
        title: "Test",
        body: "Body",
        data: { action: "open" },
      });

      expect(useNotificationsStore.getState().notifications[0].data).toEqual({ action: "open" });
    });

    it("should ignore non-notification events", () => {
      useNotificationsStore.getState().handleEvent("sync:started", {});

      expect(useNotificationsStore.getState().notifications).toHaveLength(0);
    });

    it("should ignore events without matching type", () => {
      useNotificationsStore.getState().handleEvent("unknown:event", {
        title: "Test",
        body: "Body",
      });

      expect(useNotificationsStore.getState().notifications).toHaveLength(0);
    });
  });
});
