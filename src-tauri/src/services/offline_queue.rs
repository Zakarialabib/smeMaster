// ── Reserved: Offline Queue (Future Enhancement) ───────────────────────
//
// This is a thread-safe in-memory offline action queue intended for the
// "Sync Engine" pattern where the Rust backend owns the queue.
//
// Currently UNUSED — the actual offline queue is implemented in the
// frontend using the SQLite `pending_operations` table and
// `queueProcessor.ts`. This Rust implementation is kept as a foundation
// for future scenarios where the Rust backend needs to queue actions
// independently (e.g., background sync, automation engine).
//
// Tauri commands `db_queue_offline_action` and `db_take_offline_actions`
// are registered but not called by the frontend.
// ────────────────────────────────────────────────────────────────────────

use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineAction {
    pub id: String,
    pub domain: String,     // e.g., "tasks", "mail"
    pub action: String,     // e.g., "create", "update", "delete"
    pub payload: serde_json::Value,
    pub timestamp: i64,
}

pub struct OfflineQueue {
    pub actions: Mutex<Vec<OfflineAction>>,
}

impl OfflineQueue {
    pub fn new() -> Self {
        Self {
            actions: Mutex::new(Vec::new()),
        }
    }

    pub fn push(&self, action: OfflineAction) {
        if let Ok(mut lock) = self.actions.lock() {
            lock.push(action);
        }
    }

    pub fn take_all(&self) -> Vec<OfflineAction> {
        if let Ok(mut lock) = self.actions.lock() {
            std::mem::take(&mut *lock)
        } else {
            Vec::new()
        }
    }
}

#[tauri::command]
pub async fn db_queue_offline_action(
    queue: tauri::State<'_, OfflineQueue>,
    action: OfflineAction,
) -> Result<(), String> {
    queue.push(action);
    Ok(())
}

#[tauri::command]
pub async fn db_take_offline_actions(
    queue: tauri::State<'_, OfflineQueue>,
) -> Result<Vec<OfflineAction>, String> {
    Ok(queue.take_all())
}
