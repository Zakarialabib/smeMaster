/**
 * Android Calendar Sync Module
 *
 * Provides a typed interface for reading device calendar events from the native
 * Android CalendarContract provider.
 *
 * Two access patterns are supported:
 *   1. **Rust state** (recommended) – call `get_android_calendar_events` which
 *      returns cached data previously pushed by the Kotlin CalendarBridge.
 *   2. **Direct JS bridge** (fallback) – call `window.CalendarBridge.fetchCalendarEvents()`
 *      available only when running inside the Android WebView.
 *
 * The Kotlin CalendarBridge (@TauriPlugin) reads from CalendarContract and
 * pushes results to Rust managed state. This service reads from that state.
 */

// Use invokeCommand (generic wrapper) since mobile-only commands aren't in the typed CommandRegistry
import { invokeCommand } from "@shared/services/db/invoke/command";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AndroidCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  allDay: boolean;
  location: string | null;
  calendarId: number;
}

// ── Native JS bridge (window.CalendarBridge) ──────────────────────────────

declare global {
  interface Window {
    CalendarBridge?: {
      fetchCalendarEvents: () => string;
    };
  }
}

// ── Service Functions ─────────────────────────────────────────────────────

/**
 * Fetch calendar events via Tauri IPC (reads from Rust cached state).
 *
 * The cache is populated by the Kotlin CalendarBridge when its fetchEvents()
 * @Command is triggered (from the frontend or app startup).
 *
 * Returns an empty array if:
 *   - Not running on Android
 *   - CalendarBridge hasn't populated the cache yet
 *   - Calendar permission is not granted
 */
export async function syncAndroidCalendar(): Promise<AndroidCalendarEvent[]> {
  try {
    const raw = await invokeCommand<string>("get_android_calendar_events");
    return JSON.parse(raw) as AndroidCalendarEvent[];
  } catch {
    return [];
  }
}

/**
 * Trigger the Kotlin CalendarBridge to refresh events from the device
 * ContentProvider and push them to Rust cached state.
 *
 * Call this when the user explicitly requests a refresh (e.g. pull-to-refresh).
 */
export async function refreshAndroidCalendar(): Promise<boolean> {
  try {
    // Try the JS bridge first (fast path, no IPC serialization overhead)
    if (window.CalendarBridge) {
      const raw = window.CalendarBridge.fetchCalendarEvents();
      if (raw) {
        // The Kotlin bridge also pushes to Rust state internally
        return true;
      }
    }

    // Fallback: call via Tauri IPC (command routes to Kotlin @TauriPlugin)
    await invokeCommand("plugin:calendar|fetch_events");
    return true;
  } catch (err) {
    console.error("[calendarSync] Failed to refresh calendar:", err);
    return false;
  }
}

/**
 * Check if the native calendar bridge is available on this device.
 * Returns true only on Android with the bridge injected.
 */
export function isCalendarBridgeAvailable(): boolean {
  return typeof window.CalendarBridge?.fetchCalendarEvents === "function";
}
