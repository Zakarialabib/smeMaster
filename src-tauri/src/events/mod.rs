pub mod emit;
pub mod processor;

use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

/// All possible application events flowing from Rust → Frontend (and Kotlin → Rust → Frontend).
///
/// Uses a tagged `kind` discriminator so the frontend can dispatch on `event.payload.kind`.
/// Inspired by Delta Chat's `EventType` enum + `async_broadcast` pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum AppEvent {
    // ── Init lifecycle ───────────────────────────────────────────
    #[serde(rename = "init:complete")]
    InitComplete,
    #[serde(rename = "init:ready")]
    Ready,
    #[serde(rename = "init:progress")]
    InitProgress {
        phase: String,
        message: String,
        percentage: u8,
    },

    // ── Sync lifecycle ───────────────────────────────────────────
    #[serde(rename = "sync:started")]
    SyncStarted { account_id: String },
    #[serde(rename = "sync:progress")]
    SyncProgress {
        account_id: String,
        synced: usize,
        total: usize,
    },
    #[serde(rename = "sync:complete")]
    SyncComplete {
        account_id: String,
        new_count: usize,
    },
    #[serde(rename = "sync:error")]
    SyncError { account_id: String, error: String },
    #[serde(rename = "sync:account-start")]
    SyncAccountStart { account_id: String, host: String },
    #[serde(rename = "sync:account-complete")]
    SyncAccountComplete {
        account_id: String,
        new_count: usize,
    },
    #[serde(rename = "sync:account-error")]
    SyncAccountError { account_id: String, error: String },

    // ── Push notifications ──────────────────────────────────────
    #[serde(rename = "push:token-registered")]
    PushTokenRegistered { token: String },
    #[serde(rename = "notification:received")]
    NotificationReceived {
        title: String,
        body: String,
        data: Option<String>,
    },

    // ── Widget / external intents ────────────────────────────────
    #[serde(rename = "composer:open")]
    ComposerOpen { mode: String },
    #[serde(rename = "share:received")]
    ShareReceived { uri: String, text: Option<String> },

    // ── Kotlin native events (Phase 2 bridge) ───────────────────
    #[serde(rename = "connectivity:changed")]
    ConnectivityChanged { online: bool },
    #[serde(rename = "app:foregrounded")]
    AppForegrounded,
    #[serde(rename = "app:backgrounded")]
    AppBackgrounded,
    #[serde(rename = "widget:unread-update")]
    WidgetUnreadUpdate { account_id: String, unread: usize },

    // ── Catch-all for untyped / future events ────────────────────
    #[serde(rename = "unknown")]
    Unknown {
        event: String,
        payload: serde_json::Value,
    },

    // ── State machine / lifecycle ────────────────────────────────
    #[serde(rename = "system:ready")]
    SystemReady,

    // ── Domain Events ───────────────────────────────────────────
    #[serde(rename = "email:received")]
    EmailReceived {
        account_id: String,
        message_id: String,
        from_address: String,
        date: i64,
    },
    #[serde(rename = "contact:updated")]
    ContactUpdated {
        contact_id: String,
    },
    #[serde(rename = "task:completed")]
    TaskCompleted {
        task_id: String,
    },

    // ── CRDT Sync Engine events ──────────────────────────────────
    #[serde(rename = "sync:device-started")]
    DeviceSyncStarted { device_id: String },
    #[serde(rename = "sync:device-progress")]
    DeviceSyncProgress { device_id: String, doc_id: String, progress: u8 },
    #[serde(rename = "sync:device-complete")]
    DeviceSyncComplete { device_id: String, docs_synced: usize },
    #[serde(rename = "sync:device-error")]
    DeviceSyncError { device_id: String, error: String },
    #[serde(rename = "sync:document-conflict")]
    SyncDocumentConflict { doc_id: String, resolution: String },
    #[serde(rename = "cache:invalidate")]
    CacheInvalidate { domain: String },

    // ── Health monitoring ────────────────────────────────────────
    #[serde(rename = "heartbeat")]
    Heartbeat { timestamp: u64 },
}

/// Events that should be forwarded to the native Kotlin `EventRelayBridge`
/// via the JS relay layer. Each entry matches the `#[serde(rename = "...")]`
/// discriminator of the corresponding `AppEvent` variant.
///
/// This constant is a protocol definition / source of truth. It is read by
/// developers and the JS relay layer (nativeEventForwarder.ts), not by the
/// Rust runtime. The `#[allow(dead_code)]` is intentional.
#[allow(dead_code)]
pub const NATIVE_FORWARDED_EVENTS: &[&str] = &[
    "sync:started",
    "sync:complete",
    "sync:error",
    "push:token-registered",
    "app:foregrounded",
    "app:backgrounded",
    "connectivity:changed",
    "widget:unread-update",
    "email:received",
    "contact:updated",
    "task:completed",
];

/// Central typed event bus, modeled after Delta Chat's `async_broadcast` EventEmitter.
///
/// - A `broadcast::channel` allows multiple consumers (bridge task, Rust watchers,
///   future Kotlin listeners) without blocking the producer.
/// - Capacity defaults to 10 000 and uses `set_overflow(true)` so slow consumers
///   never stall the event producers.
/// - The bridge task (spawned in lib.rs) subscribes to this bus and re-emits
///   events to the WebView via `app.emit("core-event", ...)`.
/// - Direct `app.emit("sync:*", ...)` calls have been fully migrated to this bus.
#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<AppEvent>,
}

impl EventBus {
    /// Create a new EventBus with the given channel capacity.
    /// Delta Chat uses 10 000 — we follow the same pattern.
    pub fn new(capacity: usize) -> (Self, broadcast::Receiver<AppEvent>) {
        let (sender, rx) = broadcast::channel(capacity);
        (Self { sender }, rx)
    }

    /// Emit an event to all subscribers (non-blocking).
    /// If all receivers are lagging, the event is silently dropped
    /// (broadcast channel behaviour — no back-pressure on producers).
    pub fn emit(&self, event: AppEvent) {
        match self.sender.send(event) {
            Ok(receivers) => {
                log::trace!("[eventbus] sent to {receivers} receivers");
            }
            Err(_) => {
                log::warn!("[eventbus] no receivers for event (all lagged/closed)");
            }
        }
    }

    /// Emit an event AND flag it as native-forwarded.
    /// Call this instead of `emit()` when the event should reach the
    /// Kotlin `EventRelayBridge` via the JS relay layer.
    pub fn emit_native(&self, event: AppEvent) {
        // Log that this event is being forwarded to native
        if log::log_enabled!(log::Level::Debug) {
            let kind = serde_json::to_value(&event)
                .ok()
                .and_then(|v| {
                    v.get("kind")
                        .and_then(|k| k.as_str().map(|s| s.to_string()))
                })
                .unwrap_or_default();
            log::debug!("[eventbus] native-forwarded event: {kind}");
        }
        self.emit(event);
    }

    /// Get a new receiver for additional subscribers (e.g. Rust watchers).
    #[allow(dead_code)]
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.sender.subscribe()
    }

    /// Get the sender for moving into async tasks.
    #[allow(dead_code)]
    pub fn sender(&self) -> broadcast::Sender<AppEvent> {
        self.sender.clone()
    }
}
