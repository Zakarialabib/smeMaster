// ── IMAP IDLE Tauri Commands ─────────────────────────────────────────────────
//
// Manages persistent IMAP IDLE connections for push mail notifications.
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager};

use tokio::sync::Mutex;

use crate::bail;
use crate::error::{SerializedError, ERR_NOT_FOUND};
use crate::imap::session::IdleManager;
use crate::imap::types::ImapConfig;

/// Holds running IdleManager instances keyed by account_id.
pub struct IdleRegistry {
    managers: Mutex<HashMap<String, Arc<IdleManager>>>,
}

impl IdleRegistry {
    pub fn new() -> Self {
        Self {
            managers: Mutex::new(HashMap::new()),
        }
    }
}

/// Start an IMAP IDLE loop for the given account.
///
/// The IDLE loop runs in a background task and:
/// - Maintains a persistent connection to the IMAP server
/// - Receives push notifications for new mail
/// - Reconnects on timeout (every 28 min per IMAP spec) and errors
/// - Calls the provided callback when new mail arrives
#[tauri::command]
pub async fn start_idle(
    app: tauri::AppHandle,
    account_id: String,
    config: ImapConfig,
) -> Result<(), SerializedError> {
    // Clone config for the background task
    let idle_config = config.clone();

    // Create the IdleManager (uses dedicated connections, not the pool)
    let idle_manager = Arc::new(IdleManager::new(account_id.clone()));

    // Store in registry so it can be stopped later
    let registry = app.state::<IdleRegistry>().inner();
    registry
        .managers
        .lock()
        .await
        .insert(account_id.clone(), idle_manager.clone());

    // Emit event via app.emit when new mail is detected
    let app_handle = app.clone();
    let acct_id_inner = account_id.clone();
    let on_new_mail = move || {
        let _ = app_handle.emit("idle:new-mail", &serde_json::json!({
            "account_id": &acct_id_inner,
        }));
        log::info!("[idle:{acct_id_inner}] Emitted idle:new-mail event");
    };

    // Start the IDLE loop in background
    idle_manager.start_idle_loop(idle_config, on_new_mail);

    log::info!("[idle] Started IDLE monitoring for account '{account_id}'");
    Ok(())
}

/// Stop an IMAP IDLE loop for the given account.
#[tauri::command]
pub async fn stop_idle(app: tauri::AppHandle, account_id: String) -> Result<(), SerializedError> {
    let registry = app.state::<IdleRegistry>().inner();
    let mut managers = registry.managers.lock().await;

    if let Some(manager) = managers.remove(&account_id) {
        manager.state().stop();
        log::info!("[idle] Stopped IDLE monitoring for account '{account_id}'");
        Ok(())
    } else {
        bail!(ERR_NOT_FOUND, "No active IDLE session for account '{}'", account_id);
    }
}
