/// Register all command handlers with the Tauri builder.
///
/// NOTE: This module's #[tauri::command] functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// Each module's `register()` is now a no-op pass-through because
/// Tauri v2 keeps only the LAST `invoke_handler(...)` call — calling
/// it here would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

pub mod pairing;
pub mod sync_types;
pub mod sync_persistence;
pub mod sync_commands;

use tauri::{Builder, Manager, Wry};
use pairing::{PairingEntry, load_pairings, save_pairing, remove_pairing};

#[tauri::command]
pub fn get_pairings(app: tauri::AppHandle) -> Vec<PairingEntry> {
    let base_dir = app.path().app_data_dir().ok();
    match base_dir {
        Some(dir) => load_pairings(&dir),
        None => vec![],
    }
}

#[tauri::command]
pub fn save_device_pairing(app: tauri::AppHandle, entry: PairingEntry) -> Result<(), String> {
    let base_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    save_pairing(&base_dir, &entry)
}

#[tauri::command]
pub fn remove_device_pairing(app: tauri::AppHandle, device_id: String) -> Result<(), String> {
    let base_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    remove_pairing(&base_dir, &device_id)
}
