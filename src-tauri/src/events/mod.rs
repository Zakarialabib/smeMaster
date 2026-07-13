pub mod emit;
pub mod heartbeat;
pub mod processor;
pub(crate) mod automation;

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
    #[serde(rename = "init:progress")]
    InitProgress {
        phase: String,
        message: String,
        percentage: u8,
    },

    // ── Sync lifecycle ───────────────────────────────────────────
    #[serde(rename = "sync:started")]
    SyncStarted { account_id: String },
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
    #[serde(rename = "email:opened")]
    EmailOpened {
        account_id: String,
        message_id: String,
        contact_id: String,
        timestamp: i64,
    },
    #[serde(rename = "link:clicked")]
    LinkClicked {
        account_id: String,
        message_id: String,
        contact_id: String,
        url: String,
        timestamp: i64,
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
    #[serde(rename = "sync:device-complete")]
    DeviceSyncComplete { device_id: String, docs_synced: usize },
    #[serde(rename = "sync:document-conflict")]
    SyncDocumentConflict { doc_id: String, resolution: String },
    #[serde(rename = "cache:invalidate")]
    CacheInvalidate { domain: String },

    // ── Health monitoring ────────────────────────────────────────
    #[serde(rename = "heartbeat")]
    Heartbeat { timestamp: u64 },


    // ── Service health status change ────────────────────────────
    #[serde(rename = "service:health-changed")]
    HealthStatusChanged {
        service: String,
        status: String,
        message: String,
        at_ms: i64,
    },


    // ── State machine transition ────────────────────────────────
    #[serde(rename = "system:state-changed")]
    SystemStateChanged {
        from: String,
        to: String,
        reason: String,
        at_ms: i64,
    },
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emit_reaches_subscriber() {
        let (bus, _rx) = EventBus::new(16);
        let mut sub = bus.subscribe();
        bus.emit(AppEvent::SystemReady);
        assert!(matches!(sub.try_recv(), Ok(AppEvent::SystemReady)));
    }

    #[test]
    fn late_subscriber_misses_prior_event() {
        let (bus, _rx) = EventBus::new(16);
        bus.emit(AppEvent::InitComplete);
        let mut sub = bus.subscribe();
        assert!(matches!(
            sub.try_recv(),
            Err(broadcast::error::TryRecvError::Empty)
        ));
    }

    #[test]
    fn system_state_changed_carries_transition() {
        let (bus, _rx) = EventBus::new(16);
        let mut sub = bus.subscribe();
        bus.emit(AppEvent::SystemStateChanged {
            from: "Booting".into(),
            to: "Ready".into(),
            reason: "init-complete".into(),
            at_ms: 42,
        });
        match sub.try_recv() {
            Ok(AppEvent::SystemStateChanged { from, to, reason, at_ms }) => {
                assert_eq!(from, "Booting");
                assert_eq!(to, "Ready");
                assert_eq!(reason, "init-complete");
                assert_eq!(at_ms, 42);
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn app_event_roundtrips_through_serde_kind() {
        // The frontend decodes `core-event` payloads by `kind`, so the tag
        // form must survive (de)serialization.
        let json = r#"{"kind":"system:state-changed","from":"A","to":"B","reason":"r","at_ms":7}"#;
        let evt: AppEvent = serde_json::from_str(json).expect("deserialize");
        assert!(matches!(
            evt,
            AppEvent::SystemStateChanged { ref from, ref to, .. }
                if from == "A" && to == "B"
        ));

        let back = serde_json::to_string(&evt).expect("serialize");
        assert!(back.contains("\"kind\":\"system:state-changed\""));
    }

    #[test]
    fn heartbeat_carries_timestamp() {
        let (bus, _rx) = EventBus::new(16);
        let mut sub = bus.subscribe();
        bus.emit(AppEvent::Heartbeat { timestamp: 123_456 });
        match sub.try_recv() {
            Ok(AppEvent::Heartbeat { timestamp }) => assert_eq!(timestamp, 123_456),
            other => panic!("unexpected event: {other:?}"),
        }
    }
}
