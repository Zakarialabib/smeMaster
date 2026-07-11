import { create } from "zustand";

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  threadId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  dismissed: boolean;
}

interface NotificationsState {
  notifications: NotificationItem[];
  maxItems: number;

  setMaxItems: (max: number) => void;
  addNotification: (n: Omit<NotificationItem, "id" | "timestamp" | "dismissed">) => void;
  dismiss: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  handleEvent: (eventType: string, payload: unknown) => void;
}

let nextNotifId = 1;

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  maxItems: 20,

  setMaxItems: (maxItems) => set({ maxItems }),

  addNotification: (n) => {
    const item: NotificationItem = {
      ...n, id: nextNotifId++, timestamp: Date.now(), dismissed: false,
    };
    set((s) => ({ notifications: [item, ...s.notifications].slice(0, s.maxItems) }));
  },

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, dismissed: true } : n)),
    })),

  remove: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clear: () => set({ notifications: [] }),

  handleEvent: (eventType, payload) => {
    if (eventType === "notification:received") {
      const p = payload as { title: string; body: string; thread_id?: string; data?: Record<string, unknown> };
      get().addNotification({ title: p.title, body: p.body, threadId: p.thread_id, data: p.data });
    }
  },
}));
