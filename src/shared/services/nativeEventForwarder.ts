/**
 * Native Event Forwarder — React → Kotlin event relay.
 *
 * Listens to specific Rust events via Tauri IPC and forwards them to
 * the Kotlin `EventRelayBridge` (@JavascriptInterface).
 *
 * Only instantiated on Android where `window.EventRelayBridge` exists.
 * On desktop, all calls are silently ignored.
 *
 * @module nativeEventForwarder
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getEventRelayBridge } from "./nativeBridges";

/** Events from Rust that should reach the Kotlin EventRelayBridge. */
const FORWARDED_EVENTS = [
  "sync:started",
  "sync:complete",
  "sync:error",
  "push:token-registered",
  "app:foregrounded",
  "app:backgrounded",
  "connectivity:changed",
  "widget:unread-update",
] as const;

const unlisteners: Array<UnlistenFn> = [];

/**
 * Start listening to Rust events and forwarding them to the Kotlin bridge.
 * Call once during app initialization (e.g., in useAppInit).
 * Safe to call on desktop — no-op if EventRelayBridge is unavailable.
 */
export function startNativeEventForwarder(): void {
  // Guard: only forward if the Kotlin bridge exists
  if (!getEventRelayBridge()) {
    console.debug("[NativeEventForwarder] EventRelayBridge not available — skipping (desktop?)");
    return;
  }

  FORWARDED_EVENTS.forEach((eventName) => {
    listen<unknown>(eventName, (event) => {
      try {
        const payload = event.payload !== undefined
          ? JSON.stringify(event.payload)
          : "{}";
        getEventRelayBridge()?.onEvent(eventName, payload);
      } catch (err) {
        console.error(`[NativeEventForwarder] Error forwarding "${eventName}":`, err);
      }
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });
  });

  console.debug(`[NativeEventForwarder] Listening for ${FORWARDED_EVENTS.length} events`);
}

/**
 * Stop all event forwarding. Call on app teardown if needed.
 */
export function stopNativeEventForwarder(): void {
  unlisteners.forEach((fn) => fn());
  unlisteners.length = 0;
  console.debug("[NativeEventForwarder] Stopped");
}
