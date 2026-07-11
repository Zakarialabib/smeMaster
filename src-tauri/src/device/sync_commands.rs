use std::collections::HashSet;

use tauri::Manager;

use crate::error::{SerializedError, ERR_INTERNAL};

use super::sync_persistence::{load_sync_log, save_sync_log};
use super::sync_types::{ChangeKind, SyncedChange};

/// Helper that loads the sync log, applies a mutation, saves it atomically.
async fn with_sync_log<F, R>(app: &tauri::AppHandle, f: F) -> Result<R, SerializedError>
where
    F: FnOnce(&mut super::sync_types::SyncLog) -> Result<R, SerializedError>,
{
    let base_dir = app.path().app_data_dir().map_err(|e| SerializedError::new(ERR_INTERNAL, e.to_string()))?;
    let mut log = load_sync_log(&base_dir).await?;
    let result = f(&mut log)?;
    save_sync_log(&base_dir, &log).await?;
    Ok(result)
}

/// Appends incoming changes from a paired device to the local sync log.
///
/// Ignores duplicates by change ID.
/// When `use_sync_engine` is true, delegates to the CRDT sync engine.
#[allow(unused_variables)]
#[tauri::command]
pub async fn push_changes(
    app: tauri::AppHandle,
    device_id: String,
    changes: Vec<SyncedChange>,
    use_sync_engine: Option<bool>,
) -> Result<(), SerializedError> {
    if use_sync_engine.unwrap_or(true) {
        // Delegate to SyncEngineService
        if let Some(engine) = app.try_state::<std::sync::Arc<crate::sync_engine::SyncEngineService>>() {
            for change in &changes {
                let key = format!("change:{}", change.id);
                let value = serde_json::to_string(change).unwrap_or_default();
                let _ = engine.engine().set_value("device_changes", &key, &value).await;
            }
            log::info!("[sync-commands] push_changes delegated to sync engine ({} changes)", changes.len());
            return Ok(());
        }
        log::warn!("[sync-commands] SyncEngineService not available, falling back to JSON log");
    }
    with_sync_log(&app, |log| {
        let existing_ids: HashSet<String> = log.changes.iter().map(|c| c.id.clone()).collect();
        for change in changes {
            if !existing_ids.contains(&change.id) {
                log.changes.push(change);
            }
        }
        Ok(())
    })
    .await
}

/// Returns all pending changes for the requesting device since last sync.
///
/// Changes originating from the requesting device are excluded (they are
/// already known locally).
#[tauri::command]
pub async fn pull_changes(
    app: tauri::AppHandle,
    device_id: String,
    since_timestamp: u64,
) -> Result<Vec<SyncedChange>, SerializedError> {
    let base_dir = app.path().app_data_dir().map_err(|e| SerializedError::new(ERR_INTERNAL, e.to_string()))?;
    let log = load_sync_log(&base_dir).await?;
    let changes: Vec<SyncedChange> = log
        .changes
        .iter()
        .filter(|c| c.timestamp > since_timestamp && c.device_id != device_id)
        .cloned()
        .collect();
    Ok(changes)
}

/// Marks all changes up to `up_to_timestamp` as synced for the given device.
#[tauri::command]
pub async fn ack_sync(
    app: tauri::AppHandle,
    device_id: String,
    up_to_timestamp: u64,
) -> Result<(), SerializedError> {
    with_sync_log(&app, |log| {
        log.ack_sync(&device_id, up_to_timestamp);
        Ok(())
    })
    .await
}

/// Returns sync log history — recent changes with optional limit.
#[tauri::command]
pub async fn sync_log_get_history(
    app: tauri::AppHandle,
    limit: Option<usize>,
) -> Result<Vec<SyncedChange>, SerializedError> {
    let base_dir = app.path().app_data_dir().map_err(|e| SerializedError::new(ERR_INTERNAL, e.to_string()))?;
    let log = load_sync_log(&base_dir).await?;
    let mut all = log.changes;
    all.reverse();
    if let Some(l) = limit {
        all.truncate(l);
    }
    Ok(all)
}

/// Records a local change that needs to be synced to paired devices.
///
/// Returns the newly created `SyncedChange` with its assigned ID and timestamp.
#[tauri::command]
pub async fn record_change(
    app: tauri::AppHandle,
    device_id: String,
    kind: ChangeKind,
    payload: String,
) -> Result<SyncedChange, SerializedError> {
    with_sync_log(&app, |log| {
        let change = log.add_change(&device_id, kind, &payload);
        Ok(change)
    })
    .await
}

/// Sync log maintenance — prunes old changes and returns stats.
///
/// Used by the settings dashboard for telemetry and log cleanup.
#[tauri::command]
pub async fn sync_log_maintenance(
    app: tauri::AppHandle,
    older_than_secs: Option<u64>,
) -> Result<serde_json::Value, SerializedError> {
    with_sync_log(&app, |log| {
        // Default: prune changes older than 7 days
        let older_than = older_than_secs.unwrap_or(7 * 24 * 60 * 60);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cutoff = now.saturating_sub(older_than) * 1000; // convert to millis

        // Get changes that will be pruned (for telemetry)
        let to_prune = log.get_changes_since(cutoff);
        let pruned_count = to_prune.len();

        // Prune old changes
        log.prune(cutoff);

        let remaining_count = log.changes.len();

        Ok(serde_json::json!({
            "pruned_count": pruned_count,
            "remaining_count": remaining_count,
        }))
    })
    .await
}
