use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Types of changes that can be synced between paired devices
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChangeKind {
    EmailFlagRead(String),       // thread_id
    EmailArchived(String),       // thread_id
    EmailMoved { thread_id: String, from_folder: String, to_folder: String },
    VaultFileAdded(String),      // vault_path
    VaultFileDeleted(String),    // vault_path
    SettingChanged { key: String, value: String },
    ContactAdded(String),        // contact_id
    ContactUpdated(String),      // contact_id
    /// Generic entity change (from ChangeEntry-based API)
    GenericEntityChange { entity_type: String, entity_id: String, action: String },
}

/// A single change entry in the sync log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncedChange {
    pub id: String,              // unique change ID (uuid)
    pub device_id: String,       // originating device
    pub timestamp: u64,          // unix millis
    pub kind: ChangeKind,
    pub payload: String,         // JSON payload
    /// Whether this change has been acknowledged by the target device.
    /// Prevents re-push of already-processed changes.
    #[serde(default)]
    pub acknowledged: bool,
}

/// A generic, entity-oriented change entry used by the device_push_changes,
/// device_pull_changes, and device_ack_changes APIs.
///
/// Unlike `SyncedChange` which uses the `ChangeKind` enum, this struct
/// uses free-form string fields so the frontend can sync any entity type.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEntry {
    pub id: String,
    pub entity_type: String, // "thread", "contact", "account", etc.
    pub entity_id: String,
    pub action: String,      // "create", "update", "delete"
    pub timestamp: i64,
    pub data: serde_json::Value,
}

/// Sync log holds pending changes and tracks last sync per device
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncLog {
    pub changes: Vec<SyncedChange>,
    pub last_sync_per_device: HashMap<String, u64>,  // device_id -> last_sync_timestamp
}

impl SyncLog {
    /// Appends a new change to the log and returns it.
    pub fn add_change(&mut self, device_id: &str, kind: ChangeKind, payload: &str) -> SyncedChange {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let change = SyncedChange {
            id: uuid::Uuid::new_v4().to_string(),
            device_id: device_id.to_string(),
            timestamp: now,
            kind,
            payload: payload.to_string(),
            acknowledged: false,
        };
        self.changes.push(change.clone());
        change
    }

    /// Returns all changes with timestamp > the given value.
    pub fn get_changes_since(&self, timestamp: u64) -> Vec<&SyncedChange> {
        self.changes.iter().filter(|c| c.timestamp > timestamp).collect()
    }

    /// Marks all changes up to `up_to_timestamp` as synced for the given device.
    pub fn ack_sync(&mut self, device_id: &str, up_to_timestamp: u64) {
        self.last_sync_per_device.insert(device_id.to_string(), up_to_timestamp);
    }

    /// Removes changes older than the given timestamp (only those already synced).
    pub fn prune(&mut self, older_than: u64) {
        self.changes.retain(|c| c.timestamp > older_than);
    }
}
