use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Wry,
};
use crate::events::{AppEvent, EventBus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushNotification {
    pub title: String,
    pub body: String,
    pub data: Option<serde_json::Value>,
    pub thread_id: Option<String>,
}

/// Register FCM token with the backend. Called from Kotlin FCMService.
#[tauri::command]
pub async fn register_fcm_token(
    app: tauri::AppHandle,
    token: String,
) -> Result<(), String> {
    log::info!("FCM token registered: {}...", &token[..token.len().min(16)]);
    if let Some(bus) = app.try_state::<EventBus>() {
        bus.emit(AppEvent::PushTokenRegistered { token });
        Ok(())
    } else {
        Err("EventBus not available".to_string())
    }
}

/// Handle incoming push notification. Called from Kotlin FCMService.
/// Forwards the notification to the frontend via EventBus.
#[tauri::command]
pub async fn handle_incoming_push(
    app: tauri::AppHandle,
    notification: PushNotification,
) -> Result<(), String> {
    log::info!("Incoming push: {}", notification.title);
    if let Some(bus) = app.try_state::<EventBus>() {
        bus.emit(AppEvent::NotificationReceived {
            title: notification.title,
            body: notification.body,
            data: notification.data.map(|d| d.to_string()),
        });
        Ok(())
    } else {
        Err("EventBus not available".to_string())
    }
}

/// Get push notification status.
#[tauri::command]
pub async fn get_push_status() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "supported": cfg!(any(target_os = "android", target_os = "ios")),
        "platform": std::env::consts::OS,
    }))
}

/// Registers the notifications module as a Tauri v2 plugin.
/// Makes commands accessible from Kotlin via PluginManager.runCommand()
/// when running on Android. The plugin name is "notifications".
pub fn init() -> TauriPlugin<Wry> {
    Builder::<Wry>::new("notifications")
        .invoke_handler(tauri::generate_handler![
            register_fcm_token,
            handle_incoming_push,
            get_push_status,
        ])
        .build()
}
