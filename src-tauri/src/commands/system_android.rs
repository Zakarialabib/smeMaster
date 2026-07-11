// ═════════════════════════════════════════════════════════════════════════════
// System Commands – Android-specific (biometric, splash screen)
// ═════════════════════════════════════════════════════════════════════════════
//
// This module is only compiled when target_os = "android". Each function
// assumes it runs on Android — no #[cfg] gates needed at the function level.

use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_biometric::BiometricExt;

// ─────────────────────────────────────────────────────────────────────────────
// BiometricStatusLocal – returned by check_biometric
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BiometricStatusLocal {
    pub is_available: bool,
    pub biometry_type: u32,
    pub error: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometric helpers – real Android implementation
// ─────────────────────────────────────────────────────────────────────────────

/// Check whether biometric authentication is available on this device.
#[tauri::command]
pub async fn check_biometric(app: tauri::AppHandle) -> Result<BiometricStatusLocal, String> {
    let status = app.biometric().status().map_err(|e| e.to_string())?;
    Ok(BiometricStatusLocal {
        is_available: status.is_available,
        biometry_type: status.biometry_type as u32,
        error: status.error,
    })
}

/// Authenticate the user via biometric (fingerprint / face).
#[tauri::command]
pub async fn authenticate_biometric(app: tauri::AppHandle, reason: String) -> Result<(), String> {
    app.biometric()
        .authenticate(reason, Default::default())
        .map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Splash screen – emit the close event for the WebView
// ─────────────────────────────────────────────────────────────────────────────

/// Close the splash screen by emitting the close-splashscreen event
/// to the WebView (Android native splash → Tauri event bridge).
#[tauri::command]
pub fn close_splashscreen(_app: tauri::AppHandle) -> Result<(), String> {
    let _ = _app.emit("close-splashscreen", ());
    Ok(())
}
