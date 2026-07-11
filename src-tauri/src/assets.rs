use std::path::PathBuf;
use tauri::{Builder, Manager, Wry};

use crate::bail;
use crate::error::{SerializedError, ERR_FILE_IO};

/// Register command handlers with the Tauri builder.
///
/// NOTE: This module's `#[tauri::command]` functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// This `register()` is now a no-op pass-through because Tauri v2 keeps
/// only the LAST `invoke_handler(...)` call — calling it here would
/// REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

/// Returns the directory where downloaded attachments are cached.
pub fn get_attachment_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    #[cfg(target_os = "android")]
    {
        app.path()
            .app_cache_dir()
            .unwrap_or_else(|_| PathBuf::from("/data/data/com.smemaster.app/cache"))
            .join("attachments")
    }
    #[cfg(not(target_os = "android"))]
    {
        app.path()
            .app_cache_dir()
            .unwrap_or_else(|_| PathBuf::from("./cache"))
            .join("attachments")
    }
}

/// Returns the directory where thumbnails are cached.
/// Sits alongside the attachment cache under a common parent.
#[allow(dead_code)]
pub fn get_thumbnail_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut p = get_attachment_cache_dir(app);
    p.pop(); // go up to the shared parent
    p.join("thumbnails")
}

fn ensure_dirs(path: &PathBuf) -> Result<(), SerializedError> {
    if let Err(e) = std::fs::create_dir_all(path) {
        bail!(ERR_FILE_IO, "Failed to create cache dir: {}", e);
    }
    Ok(())
}

fn dir_size(path: &PathBuf) -> u64 {
    fn visit(dir: &std::path::Path, acc: &mut u64) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit(&path, acc);
                } else if let Ok(meta) = entry.metadata() {
                    *acc += meta.len();
                }
            }
        }
    }
    let mut total = 0;
    visit(path, &mut total);
    total
}

/// Returns the total size (in bytes) of the attachment cache directory.
#[tauri::command]
pub fn get_cache_size(app: tauri::AppHandle) -> Result<u64, SerializedError> {
    let dir = get_attachment_cache_dir(&app);
    if !dir.exists() {
        return Ok(0);
    }
    Ok(dir_size(&dir))
}

/// Removes **all** cached files from the attachment cache directory.
/// The directory itself is recreated so the app never has a missing cache root.
#[tauri::command]
pub fn clear_cache(app: tauri::AppHandle) -> Result<(), SerializedError> {
    let dir = get_attachment_cache_dir(&app);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(SerializedError::from)?;
    }
    ensure_dirs(&dir)?;
    log::info!("[assets] attachment cache cleared");
    Ok(())
}

/// Returns the full file-system path for a cached attachment.
///
/// The file is **not** guaranteed to exist — the caller should first check
/// `get_cache_size` or probe `std::path::Path::exists`. This simply returns
/// where it *would* be stored so the frontend can stream / display it.
#[tauri::command]
pub fn get_attachment_cache_path(
    app: tauri::AppHandle,
    attachment_id: String,
    extension: String,
) -> Result<String, SerializedError> {
    let dir = get_attachment_cache_dir(&app);
    ensure_dirs(&dir)?;
    let path = dir.join(format!("{}.{}", attachment_id, extension));
    Ok(path.to_string_lossy().to_string())
}
