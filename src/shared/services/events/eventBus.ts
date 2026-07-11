import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ── Core event type ─────────────────────────────────────────────────────────
/**
 * All Rust `AppEvent` variants are emitted as a single Tauri event
 * `"core-event"` with a `kind` discriminant that identifies the variant.
 *
 * @example
 * ```ts
 * eventBus.register("sync:complete", (payload) => {
 *   // payload.kind === "sync:complete"
 *   // payload.last_sync, payload.is_syncing, ...
 * });
 * ```
 */
export interface CoreEvent {
    kind: string;
    [key: string]: unknown;
}

// ── Typed event name registry ─────────────────────────────────────────────
// Matches SPEC.md §7.4 — all Tauri events emitted by the Rust backend.
//
// NOTE: All these events now flow through the single `"core-event"` Tauri
// channel. The names are kept as backward-compatible aliases for handler
// registration and dispatch routing. The Rust side no longer emits these
// as individual Tauri events.
export const EventNames = {
    SyncStarted: "sync:started",
    SyncComplete: "sync:complete",
    SyncError: "sync:error",
    SyncAccountStart: "sync:account-start",
    SyncAccountComplete: "sync:account-complete",
    SyncAccountError: "sync:account-error",
    NotificationReceived: "notification:received",
    PushTokenRegistered: "push:token-registered",
    ComposerOpen: "composer:open",
    ShareReceived: "share:received",
    RustInitDb: "rust:init:db",
    RustInitSync: "rust:init:sync",
    RustInitComplete: "rust:init:complete",
    Heartbeat: "heartbeat",
    DbChange: "db:change",
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

// ── Payload type definitions ──────────────────────────────────────────────
export interface SyncStatusPayload {
    last_sync: number | null;
    is_syncing: boolean;
    last_error: string | null;
}

export interface SyncAccountStartPayload {
    host: string;
    username: string;
}

export interface SyncAccountCompletePayload {
    host: string;
    username: string;
    folders_synced: number;
}

export interface SyncAccountErrorPayload {
    host: string;
    username: string;
    error: string;
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    thread_id?: string;
}

export interface ComposerOpenPayload {
    mode?: "new" | "reply" | "replyAll" | "forward";
}

export interface SharePayload {
    text: string;
    url?: string;
    title?: string;
}

export interface DbChangePayload {
    table: string;
    op: "INSERT" | "UPDATE" | "DELETE";
    row_id: number;
    timestamp: number;
}

export interface InitCompletePayload {
    success: boolean;
    message?: string;
    timestamp: number;
}

export interface HeartbeatPayload {
    timestamp: number;
    uptime_secs: number;
    services_healthy: boolean;
}

export interface PushTokenPayload {
    token: string;
    platform: "android" | "ios";
}

// ── Event handler signature ───────────────────────────────────────────────
export type EventHandler = (payload: unknown, eventName?: string) => void;

// ── EventBus singleton ────────────────────────────────────────────────────
/**
 * Centralized event-driven reactivity bus.
 *
 * - Maintains a registry of event → handler mappings
 * - Uses Tauri's `listen("core-event")` API to subscribe to all Rust‑emitted
 *   events from the single `AppEvent` enum channel
 * - Dispatches to all registered handlers when an event arrives, routing by
 *   the `kind` discriminant
 * - **Replay buffer**: stores the most recent `CoreEvent` of each kind,
 *   accessible via `getLastEvent()` / `getAllLastEvents()`
 * - Handles errors gracefully (one handler crashing never blocks others)
 * - Provides `init()` / `destroy()` lifecycle (call from App.tsx)
 *
 * @example
 * ```ts
 * // Register before or after init()
 * const unsub = eventBus.register("sync:complete", (payload) => { … });
 *
 * // Retrieve last known event (K-9 MemorizingMessagingListener pattern)
 * const lastSync = eventBus.getLastEvent("sync:complete");
 *
 * // Auto‑cleanup on unmount
 * useEffect(() => unsub, []);
 * ```
 */
class EventBus {
    /** Per-event handler sets. */
    private handlers = new Map<string, Set<EventHandler>>();
    /** Tauri unlisten functions, collected during init(). */
    private unlisteners: UnlistenFn[] = [];
    /** Replay buffer — stores the most recent event of each kind. */
    private lastEvents = new Map<string, CoreEvent>();
    private _initialized = false;

    // ── Heartbeat monitoring ──────────────────────────────────────────────
    /** Timestamp (ms) of the last received heartbeat from Rust backend. */
    private _lastHeartbeatAt: number | null = null;
    /** Maximum acceptable gap between heartbeats (ms). Default: 60s. */
    private heartbeatTimeoutMs = 60_000;
    /** Callback fired when heartbeat is detected as stale. */
    private onHeartbeatStale?: () => void;

    /** Get the timestamp of the last received heartbeat (ms since epoch). */
    get lastHeartbeatAt(): number | null {
        return this._lastHeartbeatAt;
    }

    /**
     * Check if the event pipeline is healthy.
     * Returns `true` if a heartbeat was received within the timeout window,
     * or if no heartbeat has been received yet (grace period of 90s after init).
     */
    isPipelineHealthy(): boolean {
        if (this._lastHeartbeatAt === null) {
            // Grace period: allow 90s after init before expecting first heartbeat
            return Date.now() - this._initTime < 90_000;
        }
        return Date.now() - this._lastHeartbeatAt < this.heartbeatTimeoutMs;
    }

    /**
     * Get detailed heartbeat status for diagnostics.
     */
    getHeartbeatStatus(): {
        lastHeartbeatAt: number | null;
        secondsSinceLastHeartbeat: number | null;
        isHealthy: boolean;
        timeoutMs: number;
    } {
        const secondsSince = this._lastHeartbeatAt
            ? Math.round((Date.now() - this._lastHeartbeatAt) / 1000)
            : null;
        return {
            lastHeartbeatAt: this._lastHeartbeatAt,
            secondsSinceLastHeartbeat: secondsSince,
            isHealthy: this.isPipelineHealthy(),
            timeoutMs: this.heartbeatTimeoutMs,
        };
    }

    /**
     * Set the heartbeat stale callback. Called when no heartbeat is received
     * within the timeout window. Useful for showing a "connection lost" banner.
     */
    onHeartbeatStaleCallback(callback: () => void): void {
        this.onHeartbeatStale = callback;
    }

    /** Initialize time for grace period calculation. */
    private _initTime = Date.now();

    get initialized(): boolean {
        return this._initialized;
    }

    // ── Registration ──────────────────────────────────────────────────────

    /**
     * Register a handler for a given event kind.
     * Returns an unregister function for cleanup.
     *
     * Safe to call before or after `init()` — handlers registered *before*
     * init will receive events once listening starts; handlers registered
     * *after* init will receive future events immediately.
     */
    register(event: string, handler: EventHandler): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);

        return () => {
            this.handlers.get(event)?.delete(handler);
        };
    }

    // ── Typed convenience methods ─────────────────────────────────────────

    /**
     * Register a handler for a specific event type with type safety.
     * Returns an unsubscribe function.
     *
     * @example
     * ```ts
     * const unsub = eventBus.on("sync:complete", (payload) => {
     *   // payload is typed generically as unknown
     * });
     * // Later:
     * unsub();
     * ```
     */
    on<K extends keyof typeof EventNames>(
        eventName: (typeof EventNames)[K],
        handler: EventHandler,
    ): () => void {
        return this.register(eventName, handler);
    }

    /**
     * Register handlers for multiple event types at once.
     * More efficient than individual `on()` calls for store subscriptions.
     * Returns a single unsubscribe function that removes all of them.
     *
     * @example
     * ```ts
     * const unsub = eventBus.onMany({
     *   "sync:started": (payload) => handleSyncStarted(payload),
     *   "sync:complete": (payload) => handleSyncComplete(payload),
     * });
     * ```
     */
    onMany(eventMap: Record<string, EventHandler>): () => void {
        const unsubs = Object.entries(eventMap).map(([event, handler]) =>
            this.register(event, handler),
        );
        return () => unsubs.forEach((unsub) => unsub());
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    /**
     * Start listening for the unified `"core-event"` Tauri channel.
     *
     * Call once from App.tsx after stores are available
     * (e.g. inside a useEffect after useAppInit).
     *
     * It is safe to call init() multiple times — subsequent calls are no-ops.
     *
     * The Rust backend emits ALL events through this single channel, tagged
     * with a `kind` field that identifies the event variant.
     */
    async init(): Promise<void> {
        if (this._initialized) return;
        this._initialized = true;
        this._initTime = Date.now();

        try {
            const unlisten = await listen<CoreEvent>("core-event", (event) => {
                this.dispatch(event.payload.kind, event.payload);
            });
            this.unlisteners.push(unlisten);
        } catch (err) {
            console.warn(`[EventBus] Failed to listen to "core-event":`, err);
        }

        // Start periodic heartbeat health check (every 15s)
        this._startHeartbeatMonitor();
    }

    /** Periodic monitor that fires callback if heartbeat goes stale. */
    private _heartbeatMonitorInterval: ReturnType<typeof setInterval> | null =
        null;
    private _lastStaleAlertAt = 0;

    private _startHeartbeatMonitor(): void {
        this._heartbeatMonitorInterval = setInterval(() => {
            if (!this.isPipelineHealthy() && this.onHeartbeatStale) {
                const now = Date.now();
                // Only alert once per 60s to avoid spam
                if (now - this._lastStaleAlertAt > 60_000) {
                    this._lastStaleAlertAt = now;
                    this.onHeartbeatStale();
                }
            }
        }, 15_000);
    }

    /**
     * Tear down all listeners and clear the handler registry.
     * Call from App.tsx cleanup (effect return).
     */
    destroy(): void {
        for (const unlisten of this.unlisteners) {
            try {
                unlisten();
            } catch {
                // ignore cleanup errors
            }
        }
        this.unlisteners = [];
        this.handlers.clear();
        this.lastEvents.clear();
        this._initialized = false;

        // Clean up heartbeat monitor
        if (this._heartbeatMonitorInterval) {
            clearInterval(this._heartbeatMonitorInterval);
            this._heartbeatMonitorInterval = null;
        }
        this._lastHeartbeatAt = null;
    }

    // ── Local emission ────────────────────────────────────────────────────

    /**
     * Emit a local event to all registered handlers.
     * Useful for dispatching UI events (e.g. opening a composer) from
     * non-Tauri sources.
     *
     * @param event - The event kind string (e.g. "composer:open")
     * @param payload - Optional payload to pass to handlers
     */
    emit(event: string, payload?: unknown): void {
        this.dispatch(event, payload);
    }

    // ── Replay buffer ─────────────────────────────────────────────────────

    /**
     * Return the most recent `CoreEvent` received for a given kind (if any).
     *
     * This implements the K-9 MemorizingMessagingListener pattern: after a
     * late-registering handler subscribes, it can query the last event of its
     * kind to catch up on state it may have missed.
     */
    getLastEvent(kind: string): CoreEvent | undefined {
        return this.lastEvents.get(kind);
    }

    /**
     * Return all stored last events, keyed by event kind.
     */
    getAllLastEvents(): Map<string, CoreEvent> {
        return new Map(this.lastEvents);
    }

    // ── Internal dispatch ─────────────────────────────────────────────────

    private dispatch(event: string, payload: unknown): void {
        // Track heartbeat events
        if (event === "heartbeat" && payload && typeof payload === "object") {
            this._lastHeartbeatAt = Date.now();
        }

        // Store in replay buffer if it looks like a CoreEvent
        if (payload && typeof payload === "object" && "kind" in payload) {
            this.lastEvents.set(event, payload as CoreEvent);
        }

        // Dispatch to handlers registered for this exact event kind
        const handlers = this.handlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(payload, event);
                } catch (err) {
                    console.error(`[EventBus] Error in handler for "${event}":`, err);
                }
            }
        }

        // Legacy catch-all "*" handlers (kept for backward compatibility,
        // no longer used internally — prefer `on()` for typed registrations)
        const allHandlers = this.handlers.get("*");
        if (allHandlers && allHandlers.size > 0) {
            for (const handler of allHandlers) {
                try {
                    handler(payload, event);
                } catch (err) {
                    console.error(
                        `[EventBus] Error in catch-all handler for "${event}":`,
                        err,
                    );
                }
            }
        }
    }
}

/** Application-wide singleton instance. */
export const eventBus = new EventBus();