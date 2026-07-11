import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  /** Auto-dismiss duration in ms. 0 = sticky. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, "id">) => void;
  removeToast: (id: number) => void;
  clear: () => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (t) => {
    const id = nextToastId++;
    const item: ToastItem = { ...t, id };
    set((s) => ({ toasts: [...s.toasts, item] }));

    // Auto-dismiss
    if (t.duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((to) => to.id !== id) }));
      }, t.duration);
    }
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/** Convenience helpers */
export const toast = {
  success: (message: string, duration = 2500) =>
    useToastStore.getState().addToast({ message, type: "success", duration }),
  error: (message: string, duration = 4000) =>
    useToastStore.getState().addToast({ message, type: "error", duration }),
  info: (message: string, duration = 2000) =>
    useToastStore.getState().addToast({ message, type: "info", duration }),
};
