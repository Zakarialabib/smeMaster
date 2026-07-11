/**
 * EventBus typed manifest — single source of truth mapping each event to its
 * owning store, description, and payload type name.
 *
 * This file is the central registry. Every store that self-subscribes via
 * `subscribeFromManifest` uses this manifest to filter which events it
 * registers handlers for.
 *
 * See design doc: `docs/superpowers/specs/2026-06-04-app-shell-init-refactor-design.md` §3.3
 */
import { eventBus, type EventHandler } from "./eventBus";
// NOTE: The `as EventName` cast in `subscribeFromManifest` relies on all
// manifest keys being valid EventName values (from eventBus.ts).  If a new
// key is added to EVENT_BUS_MAP that has no matching string in EventNames,
// TypeScript will catch the type mismatch in the cast.

// ── Event owner identifiers ────────────────────────────────────────────────

export type EventOwner =
  | "syncStore"
  | "threadStore"
  | "composerStore"
  | "notificationStore"
  | "actionStatus"
  | "shell";

// ── Event entry shape ──────────────────────────────────────────────────────

export interface EventEntry {
  owner: EventOwner;
  description: string;
  /** TS-only type name for documentation purposes (no Zod). */
  payload: string;
}

// ── Typed manifest ─────────────────────────────────────────────────────────
// Payload type names match actual interfaces in `eventBus.ts`.

export const EVENT_BUS_MAP = {
  "sync:started": {
    owner: "syncStore",
    description: "A sync run started",
    payload: "SyncStatusPayload",
  },
  "sync:complete": {
    owner: "threadStore",
    description: "Sync finished for an account",
    payload: "SyncStatusPayload",
  },
  "sync:account-start": {
    owner: "threadStore",
    description: "Single account sync started",
    payload: "SyncAccountStartPayload",
  },
  "sync:account-complete": {
    owner: "threadStore",
    description: "Single account sync done",
    payload: "SyncAccountCompletePayload",
  },
  "sync:account-error": {
    owner: "threadStore",
    description: "Single account sync failed",
    payload: "SyncAccountErrorPayload",
  },
  "sync:error": {
    owner: "syncStore",
    description: "Sync run error",
    payload: "SyncStatusPayload",
  },
  "rust:init:db": {
    owner: "syncStore",
    description: "Rust database initialization complete",
    payload: "InitCompletePayload",
  },
  "rust:init:sync": {
    owner: "syncStore",
    description: "Rust sync subsystem initialization complete",
    payload: "InitCompletePayload",
  },
  "rust:init:complete": {
    owner: "syncStore",
    description: "Rust orchestrator init done",
    payload: "InitCompletePayload",
  },
  "heartbeat": {
    owner: "shell",
    description: "Periodic heartbeat from Rust backend",
    payload: "HeartbeatPayload",
  },
  "db:change": {
    owner: "shell",
    description: "Database change notification",
    payload: "DbChangePayload",
  },
  "push:token-registered": {
    owner: "notificationStore",
    description: "FCM push token registered",
    payload: "PushTokenPayload",
  },
  "share:received": {
    owner: "shell",
    description: "Share intent received from another app",
    payload: "SharePayload",
  },
  "composer:open": {
    owner: "composerStore",
    description: "Open a compose window",
    payload: "ComposerOpenPayload",
  },
  "notification:received": {
    owner: "notificationStore",
    description: "Push notification arrived",
    payload: "PushNotificationPayload",
  },
  // actionStatus events are owned by initActionStatusEventBridge — out of scope
} as const;

export type EventName = keyof typeof EVENT_BUS_MAP;

// ── Subscription helper ────────────────────────────────────────────────────

/**
 * Subscribe to all events owned by a specific store according to the
 * `EVENT_BUS_MAP`.  Only handlers whose manifest `owner` matches the given
 * `owner` are registered — events handled by a different store's manifest
 * entry are silently skipped.
 *
 * @param owner  The `EventOwner` to filter by (e.g. `"syncStore"`).
 * @param handlers  A map of event-name → handler.  Only entries whose event
 *                  is owned by `owner` in the manifest will be registered.
 * @returns A single cleanup function suitable for `useEffect` returns.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   return subscribeFromManifest("syncStore", {
 *     "sync:started":   (p) => setStatus("syncing"),
 *     "sync:complete":  (p) => setStatus("idle"),
 *     "sync:error":     (p) => setError(p),
 *     "rust:init:complete": () => setReady(true),
 *   });
 * }, []);
 * ```
 */
export function subscribeFromManifest(
  owner: EventOwner,
  handlers: Record<string, EventHandler>,
): () => void {
  const unsubs: (() => void)[] = [];

  for (const [eventName, handler] of Object.entries(handlers)) {
    if (EVENT_BUS_MAP[eventName as EventName]?.owner === owner) {
      unsubs.push(eventBus.on(eventName as EventName, handler));
    }
  }

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}