import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  thread_id?: string;
}

/**
 * Listen for push notification events from the Rust backend.
 * Shows browser notifications when the app is in foreground.
 */
export function usePushNotifications() {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    // Token registration event
    listen<string>("push:token-registered", (event) => {
      console.log("Push token registered:", event.payload.substring(0, 16) + "...");
    }).then((fn) => unlisteners.push(fn));

    // Incoming push notification
    listen<PushNotification>("notification:received", (event) => {
      const { title, body } = event.payload;
      // Show browser notification as fallback (works in PWA/Tauri WebView)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }).then((fn) => unlisteners.push(fn));

    return () => { unlisteners.forEach((fn) => fn()); };
  }, []);
}
