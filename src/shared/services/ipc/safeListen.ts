/**
 * Environment-safe wrapper around Tauri's `listen()`.
 *
 * Outside a compiled Tauri shell (browser dev server / web build)
 * `window.__TAURI_INTERNALS__` is absent, so the raw `listen()` rejects with
 * the cryptic `Cannot read properties of undefined (reading
 * 'transformCallback')` TypeError — the event-system twin of the `invoke`
 * problem documented in `environment.ts`.
 *
 * This wrapper short-circuits to a no-op unlisten when no native backend can
 * exist, so hooks, stores, and effects can register listeners unconditionally
 * without try/catch boilerplate. Mirrors the IPC layer's
 * `isTauriEnvironment()` short-circuit in `invoke.ts`.
 *
 * In a Tauri environment it is a pass-through to the real `listen()`.
 */
import {
  listen,
  type EventCallback,
  type EventName,
  type Options,
  type UnlistenFn,
} from "@tauri-apps/api/event";
import { isTauriEnvironment } from "./environment";

/**
 * Subscribe to a Tauri event, or no-op outside Tauri.
 *
 * @param event   Event name to listen to (e.g. `"sync:started"`).
 * @param handler Callback invoked with the typed event payload.
 * @param options Optional Tauri listener options (target filtering).
 * @returns Promise resolving to an unlisten function. Always resolves —
 *          never rejects with `transformCallback` outside Tauri.
 */
export async function safeListen<T>(
  event: EventName,
  handler: EventCallback<T>,
  options?: Options,
): Promise<UnlistenFn> {
  if (!isTauriEnvironment()) {
    return () => {
      /* no-op: no native emitter exists in this environment */
    };
  }
  return listen<T>(event, handler, options);
}
