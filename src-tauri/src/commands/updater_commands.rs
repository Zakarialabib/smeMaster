use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::Manager;

use crate::update_tracker::UpdateTracker;

#[tauri::command]
pub async fn verify_update_checksum(
    _app_handle: tauri::AppHandle,
    expected_sha256: String,
    file_path: String,
) -> Result<bool, String> {
    let path = Path::new(&file_path);
    let mut file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    let actual = format!("{:x}", hasher.finalize());
    Ok(actual == expected_sha256.to_lowercase())
}

#[tauri::command]
pub async fn get_rollback_version(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let tracker = UpdateTracker::new(&app_handle)?;
    // Prefer the roll-back version recorded by UpdateTracker (last successful
    // launch, or last known version if no successful launch has been recorded).
    if let Some(version) = tracker.get_rollback_version() {
        return Ok(Some(version));
    }
    // Fallback: check a known location for previous version installer
    let rollback_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("rollback");
    if !rollback_dir.exists() {
        return Ok(None);
    }
    let version_file = rollback_dir.join("version.txt");
    if version_file.exists() {
        let version = std::fs::read_to_string(&version_file).map_err(|e| e.to_string())?;
        Ok(Some(version.trim().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn needs_rollback(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let tracker = UpdateTracker::new(&app_handle)?;
    Ok(tracker.needs_rollback())
}

#[tauri::command]
pub async fn mark_successful_launch(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut tracker = UpdateTracker::new(&app_handle)?;
    tracker.mark_successful_launch();
    Ok(())
}

#[tauri::command]
pub async fn get_app_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}
