import { create } from "zustand";
import { createEventBusSubscription } from "@shared/stores/createEventBusSubscription";

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  threadId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  dismissed: boolean;
}

interface NotificationState {
  /** Ordered list of in-app notifications (newest first). */
  notifications: NotificationItem[];
  /** Max notifications to keep in memory. */
  maxItems: number;
  setMaxItems: (max: number) => void;
  /** Add a notification (pushes to front, trims to maxItems). */
  addNotification: (n: Omit<NotificationItem, "id" | "timestamp" | "dismissed">) => void;
  /** Mark a notification as dismissed. */
  dismiss: (id: number) => void;
  /** Remove a notification entirely. */
  remove: (id: number) => void;
  /** Clear all notifications. */
  clear: () => void;
  /**
   * Unified event handler called by the EventBus.
   * Routes `notification:received` events to `addNotification`.
   */
  handleEvent: (eventType: string, payload: unknown) => void;
}

let nextNotifId = 1;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  maxItems: 20,

  setMaxItems: (maxItems) => set({ maxItems }),

  addNotification: (n) => {
    const item: NotificationItem = {
      ...n,
      id: nextNotifId++,
      timestamp: Date.now(),
      dismissed: false,
    };
    set((s) => {
      const notifications = [item, ...s.notifications].slice(0, s.maxItems);
      return { notifications };
    });
  },

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n,
      ),
    })),

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),

  handleEvent: (eventType, payload) => {
    if (eventType === "notification:received") {
      const p = payload as { title: string; body: string; thread_id?: string; data?: Record<string, unknown> };
      get().addNotification({
        title: p.title,
        body: p.body,
        threadId: p.thread_id,
        data: p.data,
      });
    }
  },
}));

// ── EventBus self-subscription ────────────────────────────────────────────

/**
 * Subscribe the notification store to its owned events.
 *   - `notification:received` → adds the push notification to the store
 */
const notificationStoreEventSub = createEventBusSubscription("notificationStore", {
  "notification:received": (payload) => {
    useNotificationStore.getState().handleEvent?.("notification:received", payload);
  },
});

/**
 * Initialize the notification store's EventBus subscription. Idempotent —
 * subsequent calls return the same cleanup function. Returns a cleanup
 * function that removes all registered handlers.
 */
export function initNotificationStoreEvents(): () => void {
  return notificationStoreEventSub.init();
}

// Eagerly initialise in browser environments (module-level side-effect).
if (typeof window !== "undefined") {
  initNotificationStoreEvents();
}
