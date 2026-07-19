import { sendNotification } from "@tauri-apps/plugin-notification";
import { useNotificationStore } from "@shared/stores/notificationStore";
import { useToastStore } from "@shared/stores/toastStore";

/**
 * Show an in-app toast AND send a native OS notification.
 * Safely handles environments where the Tauri notification plugin is unavailable.
 */
export function notify(title: string, body: string): void {
  // In-app notification center entry
  useNotificationStore.getState().addNotification({ title, body });

  // Visible toast via the globally-mounted ToastContainer (reads useToastStore)
  try {
    useToastStore.getState().addToast({
      message: title ? `${title} — ${body}` : body,
      type: "info",
      duration: 3000,
    });
  } catch {
    // Rendered store unavailable (should not happen)
  }

  // Native OS notification via Tauri plugin (silently ignored in browser dev mode)
  try {
    sendNotification({ title, body });
  } catch {
    // Plugin not available (e.g., browser dev mode or Android web view without plugin)
  }
}
