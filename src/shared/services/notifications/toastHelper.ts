import { sendNotification } from "@tauri-apps/plugin-notification";
import { useNotificationStore as useNotificationsStore } from "@shared/stores/notificationStore";

/**
 * Show an in-app toast AND send a native OS notification.
 * Safely handles environments where the Tauri notification plugin is unavailable.
 */
export function notify(title: string, body: string): void {
  // In-app toast via Zustand store
  useNotificationsStore.getState().addNotification({ title, body });

  // Native OS notification via Tauri plugin (silently ignored in browser dev mode)
  try {
    sendNotification({ title, body });
  } catch {
    // Plugin not available (e.g., browser dev mode or Android web view without plugin)
  }
}
