// ═════════════════════════════════════════════════════════════════════════════
// Auto-Launch Module — Start SMEMaster on system startup
// ═════════════════════════════════════════════════════════════════════════════
//
// Uses the cross-platform `auto-launch` crate which supports:
// - Windows: Registry-based startup (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
// - macOS: LaunchAgent plist
// - Linux: XDG autostart .desktop file

use std::env;

/// Get the path to the current executable for auto-launch registration.
fn get_app_path(_app: &tauri::AppHandle) -> Option<String> {
    env::current_exe().ok().map(|p| p.to_string_lossy().to_string())
}

/// Check whether auto-launch is currently enabled.
pub async fn is_enabled(app: &tauri::AppHandle) -> Result<bool, String> {
    let app_path = get_app_path(app).ok_or_else(|| "Could not determine app path".to_string())?;
    let launcher = auto_launch::AutoLaunchBuilder::new()
        .set_app_name("SMEMaster")
        .set_app_path(&app_path)
        .build()
        .map_err(|e| format!("Failed to build auto-launch config: {}", e))?;
    launcher.is_enabled().map_err(|e| format!("Failed to check auto-launch status: {}", e))
}

/// Enable auto-launch — register the app to start on login.
pub async fn enable(app: &tauri::AppHandle) -> Result<(), String> {
    let app_path = get_app_path(app).ok_or_else(|| "Could not determine app path".to_string())?;
    let launcher = auto_launch::AutoLaunchBuilder::new()
        .set_app_name("SMEMaster")
        .set_app_path(&app_path)
        .build()
        .map_err(|e| format!("Failed to build auto-launch config: {}", e))?;
    launcher.enable().map_err(|e| format!("Failed to enable auto-launch: {}", e))
}

/// Disable auto-launch — remove the startup registration.
pub async fn disable(app: &tauri::AppHandle) -> Result<(), String> {
    let app_path = get_app_path(app).ok_or_else(|| "Could not determine app path".to_string())?;
    let launcher = auto_launch::AutoLaunchBuilder::new()
        .set_app_name("SMEMaster")
        .set_app_path(&app_path)
        .build()
        .map_err(|e| format!("Failed to build auto-launch config: {}", e))?;
    launcher.disable().map_err(|e| format!("Failed to disable auto-launch: {}", e))
}
