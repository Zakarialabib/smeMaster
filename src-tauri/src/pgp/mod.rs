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

pub mod cache;
pub mod crypto;
pub mod keyring;

use tauri::{Builder, Wry};
use crate::error::SerializedError;

#[tauri::command]
pub async fn decrypt_message(
    ciphertext_b64: String,
    private_key_armored: String,
    passphrase: String,
) -> Result<String, SerializedError> {
    tokio::task::spawn_blocking(move || {
        crypto::decrypt_message(&ciphertext_b64, &private_key_armored, &passphrase)
    })
    .await
    .map_err(|e| SerializedError::new(crate::error::ERR_INTERNAL, format!("Task panicked: {e}")))?
}

#[tauri::command]
pub fn pgp_cache_passphrase(account_id: String, passphrase: String) -> Result<(), SerializedError> {
    cache::store(&account_id, &passphrase);
    Ok(())
}

#[tauri::command]
pub fn pgp_get_cached_passphrase(account_id: String) -> Result<Option<String>, SerializedError> {
    Ok(cache::get(&account_id))
}

#[tauri::command]
pub fn pgp_clear_passphrase_cache(account_id: String) -> Result<(), SerializedError> {
    cache::clear(&account_id);
    Ok(())
}
