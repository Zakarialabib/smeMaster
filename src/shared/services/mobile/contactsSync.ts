/**
 * Android Contacts Sync Module
 *
 * Provides a typed interface for reading device contacts from the native
 * Android ContactsContract provider.
 *
 * Two access patterns are supported:
 *   1. **Rust state** (recommended) – call `get_android_contacts` which
 *      returns cached data previously pushed by the Kotlin ContactsBridge.
 *   2. **Direct JS bridge** (fallback) – call `window.ContactsBridge.fetchContacts()`
 *      available only when running inside the Android WebView.
 *
 * The Kotlin ContactsBridge (@TauriPlugin) reads from ContactsContract and
 * pushes results to Rust managed state. This service reads from that state.
 */

/**
 * Android Contacts Sync Module
 *
 * Provides a typed interface for reading device contacts from the native
 * Android ContactsContract provider.
 *
 * Two access patterns are supported:
 *   1. **Rust state** (recommended) – call `get_android_contacts` which
 *      returns cached data previously pushed by the Kotlin ContactsBridge.
 *   2. **Direct JS bridge** (fallback) – call `window.ContactsBridge.fetchContacts()`
 *      available only when running inside the Android WebView.
 *
 * The Kotlin ContactsBridge (@TauriPlugin) reads from ContactsContract and
 * pushes results to Rust managed state. This service reads from that state.
 */

// Use invokeCommand (generic wrapper) since mobile-only commands aren't in the typed CommandRegistry
import { invokeCommand } from "@shared/services/db/invoke/command";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AndroidContactPhone {
  number: string;
  type: number;
  label?: string;
}

export interface AndroidContactEmail {
  address: string;
  type: number;
}

export interface AndroidContact {
  id: string;
  name: string;
  photoThumbnailUri: string | null;
  phones: AndroidContactPhone[];
  emails: AndroidContactEmail[];
}

// ── Native JS bridge (window.ContactsBridge) ──────────────────────────────

declare global {
  interface Window {
    ContactsBridge?: {
      fetchContacts: () => string;
    };
  }
}

// ── Service Functions ─────────────────────────────────────────────────────

/**
 * Fetch all device contacts via Tauri IPC (reads from Rust cached state).
 *
 * The cache is populated by the Kotlin ContactsBridge when its fetchContacts()
 * @Command is triggered (from the frontend or app startup).
 *
 * Returns an empty array if:
 *   - Not running on Android
 *   - ContactsBridge hasn't populated the cache yet
 *   - Contacts permission is not granted
 */
export async function syncAndroidContacts(): Promise<AndroidContact[]> {
  try {
    const raw = await invokeCommand<string>("get_android_contacts");
    return JSON.parse(raw) as AndroidContact[];
  } catch {
    return [];
  }
}

/**
 * Trigger the Kotlin ContactsBridge to refresh contacts from the device
 * ContentProvider and push them to Rust cached state.
 *
 * Call this when the user explicitly requests a refresh (e.g. pull-to-refresh).
 */
export async function refreshAndroidContacts(): Promise<boolean> {
  try {
    // Try the JS bridge first (fast path, no IPC serialization overhead)
    if (window.ContactsBridge) {
      const raw = window.ContactsBridge.fetchContacts();
      if (raw) {
        // The Kotlin bridge also pushes to Rust state internally,
        // but we return the parsed result immediately
        return true;
      }
    }

    // Fallback: call via Tauri IPC (command routes to Kotlin @TauriPlugin)
    await invokeCommand("plugin:contacts|fetch_contacts");
    return true;
  } catch (err) {
    console.error("[contactsSync] Failed to refresh contacts:", err);
    return false;
  }
}

/**
 * Check if the native contacts bridge is available on this device.
 * Returns true only on Android with the bridge injected.
 */
export function isContactsBridgeAvailable(): boolean {
  return typeof window.ContactsBridge?.fetchContacts === "function";
}
