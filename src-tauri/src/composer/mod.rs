use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Wry,
};
use crate::events::{AppEvent, EventBus};

/// Opens the email composer via widget shortcut.
/// Called from Kotlin MainActivity.handleQuickCompose().
#[tauri::command]
pub async fn open_composer(
    app: tauri::AppHandle,
    mode: Option<String>,
) -> Result<(), String> {
    let mode = mode.unwrap_or_else(|| "new".to_string());
    log::info!("[composer] opening composer in mode: {mode}");

    if let Some(bus) = app.try_state::<EventBus>() {
        bus.emit(AppEvent::ComposerOpen { mode });
        Ok(())
    } else {
        Err("EventBus not available".to_string())
    }
}

/// Registers the composer module as a Tauri v2 plugin.
/// Makes commands accessible from Kotlin via PluginManager.runCommand()
/// when running on Android. The plugin name is "composer".
pub fn init() -> TauriPlugin<Wry> {
    Builder::<Wry>::new("composer")
        .invoke_handler(tauri::generate_handler![open_composer])
        .build()
}
