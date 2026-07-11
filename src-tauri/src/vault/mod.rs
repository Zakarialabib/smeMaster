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

pub mod ops;

use tauri::{Builder, Wry};

#[cfg(target_os = "android")]
use tauri_plugin_biometric::BiometricExt;

use crate::error::SerializedError;

/// Require biometric authentication before accessing vault operations.
/// On non-mobile platforms, this is a no-op (always succeeds).
pub async fn require_biometric(app: &tauri::AppHandle, reason: &str) -> Result<(), SerializedError> {
    #[cfg(target_os = "android")]
    {
        app.biometric()
            .authenticate(reason.to_string(), Default::default())
            .map_err(|e| SerializedError::new(crate::error::ERR_AUTH_FAILED, format!("Biometric required: {}", e)))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, reason);
        Ok(())
    }
}
