// ── Shared command request types ────────────────────────────────────────────
//
// These types are used across multiple command-handler modules.
// Extracted here to avoid circular dependencies between command modules.

use serde::Deserialize;
use std::collections::HashMap;

/// Generic key-value field update used by many "update entity" commands.
/// `set` contains fields to update, `unset` contains field names to NULL.
#[derive(Debug, Deserialize)]
pub struct UpdateFields {
    pub set: HashMap<String, serde_json::Value>,
    pub unset: Vec<String>,
}

/// Filters for querying threads (inbox, label, starred, etc).
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadFilters {
    pub label_id: Option<String>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub is_important: Option<bool>,
    pub is_snoozed: Option<bool>,
    pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
    pub folder: Option<String>,
}

/// Batch update payload for one or more threads.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadBatchUpdate {
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub is_important: Option<bool>,
    pub is_snoozed: Option<bool>,
    pub is_pinned: Option<bool>,
    pub is_muted: Option<bool>,
    pub add_label_ids: Option<Vec<String>>,
    pub remove_label_ids: Option<Vec<String>>,
}

/// A single label sort-order entry.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelSortOrderUpdate {
    pub id: String,
    pub sort_order: i64,
}
