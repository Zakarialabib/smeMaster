use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};
use crate::events::{AppEvent, EventBus};

// ═════════════════════════════════════════════════════════════════════════════
// Share Module – Pending share from other apps
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharePayload {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

pub struct PendingShare {
    inner: Mutex<Option<SharePayload>>,
}

#[tauri::command]
pub fn get_pending_share(
    state: tauri::State<'_, PendingShare>,
) -> Result<Option<SharePayload>, String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(guard.take())
}

#[tauri::command]
pub fn set_pending_share<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, PendingShare>,
    text: String,
    url: Option<String>,
    title: Option<String>,
) -> Result<(), String> {
    let payload = SharePayload { text, url, title };
    *state.inner.lock().map_err(|e| e.to_string())? = Some(payload.clone());

    if let Some(bus) = app.try_state::<EventBus>() {
        bus.emit(AppEvent::ShareReceived {
            uri: payload.url.unwrap_or_default(),
            text: Some(payload.text),
        });
        Ok(())
    } else {
        Err("EventBus not available".to_string())
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Contacts Cache – populated by Kotlin ContactsBridge, read by frontend
// ═════════════════════════════════════════════════════════════════════════════

/// Shared state holding the last-fetched contacts JSON string.
pub struct ContactsState(pub Mutex<Option<String>>);

/// Shared state holding the last-fetched calendar events JSON string.
pub struct CalendarState(pub Mutex<Option<String>>);

/// Read cached contacts (JSON array string). Returns "[]" if empty.
#[tauri::command]
pub async fn get_android_contacts(
    state: tauri::State<'_, ContactsState>,
) -> Result<String, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone().unwrap_or_else(|| "[]".into()))
}

/// Read cached calendar events (JSON array string). Returns "[]" if empty.
#[tauri::command]
pub async fn get_android_calendar_events(
    state: tauri::State<'_, CalendarState>,
) -> Result<String, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone().unwrap_or_else(|| "[]".into()))
}

/// Store contacts JSON in the shared state (called from Kotlin via PluginManager).
#[tauri::command]
pub fn set_contacts_cache(
    state: tauri::State<'_, ContactsState>,
    contacts: String,
) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = Some(contacts);
    Ok(())
}

/// Store calendar events JSON in the shared state (called from Kotlin via PluginManager).
#[tauri::command]
pub fn set_calendar_cache(
    state: tauri::State<'_, CalendarState>,
    events: String,
) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = Some(events);
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// Plugin Registration
// ═════════════════════════════════════════════════════════════════════════════

/// Registers the "share" plugin (pending share from other apps).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("share")
        .invoke_handler(tauri::generate_handler![get_pending_share, set_pending_share])
        .setup(|app, _api| {
            app.manage(PendingShare {
                inner: Mutex::new(None),
            });
            Ok(())
        })
        .build()
}

/// Registers the "android" plugin (contacts/calendar cache setters called from Kotlin).
pub fn init_android<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("android")
        .invoke_handler(tauri::generate_handler![set_contacts_cache, set_calendar_cache])
        .setup(|app, _api| {
            app.manage(ContactsState(Mutex::new(None)));
            app.manage(CalendarState(Mutex::new(None)));
            Ok(())
        })
        .build()
}
