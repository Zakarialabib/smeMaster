/// Tauri Plugin: `native_events`
///
/// Single generic endpoint for Kotlin → Rust → React event forwarding.
/// Kotlin calls `PluginManager.runCommand(cbId, "native_events", "native_event_occurred", json)`
/// and this plugin parses the event, maps it to `AppEvent`, and pushes it onto the `EventBus`.
///
/// This replaces scattered `PluginManager.runCommand()` calls with a single typed bridge
/// and enables Kotlin-native events (network changes, lifecycle, widget updates)
/// to flow through the same pipeline as Rust events.
///
/// ## Kotlin usage:
/// ```kotlin
/// NativeEventBridge.emit("connectivity_changed", """{"online": true}""")
/// NativeEventBridge.emit("app_foregrounded", "{}")
/// NativeEventBridge.emit("widget_unread_update", """{"account_id": "a1", "unread": 5}""")
/// ```
#[cfg(mobile)]
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager,
};

#[cfg(mobile)]
use crate::events::{AppEvent, EventBus};

#[cfg(mobile)]
#[tauri::command]
fn native_event_occurred(
    app: tauri::AppHandle,
    event: String,
    payload: String,
) -> Result<(), String> {
    let bus = app.state::<EventBus>();
    let parsed: serde_json::Value =
        serde_json::from_str(&payload).map_err(|e| format!("Invalid payload JSON: {e}"))?;

    // Map string event names to typed AppEvent variants
    let app_event = match event.as_str() {
        "connectivity_changed" => {
            let online = parsed
                .get("online")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            AppEvent::ConnectivityChanged { online }
        }
        "app_foregrounded" => AppEvent::AppForegrounded,
        "app_backgrounded" => AppEvent::AppBackgrounded,
        "widget_unread_update" => {
            let account_id = parsed
                .get("account_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let unread = parsed.get("unread").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            AppEvent::WidgetUnreadUpdate { account_id, unread }
        }
        "push_token_received" => AppEvent::PushTokenRegistered {
            token: parsed
                .get("token")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        },
        "share_received" => AppEvent::ShareReceived {
            uri: parsed
                .get("uri")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            text: parsed
                .get("text")
                .and_then(|v| v.as_str())
                .map(String::from),
        },
        _ => {
            log::warn!("[native_events] Unknown native event: {event}");
            AppEvent::Unknown {
                event,
                payload: parsed,
            }
        }
    };

    bus.emit(app_event);
    Ok(())
}

/// Register the native_events plugin
#[cfg(mobile)]
pub fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("native_events")
        .invoke_handler(tauri::generate_handler![native_event_occurred])
        .build()
}
