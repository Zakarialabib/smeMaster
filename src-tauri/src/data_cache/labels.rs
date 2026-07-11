// ── Labels Cache ────────────────────────────────────────────────────────────

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;

use crate::data_cache::cache::{Cache, SharedLoader};
use crate::db::mail::schema::Label;

/// TTL for labels cache: 10 minutes.
const LABELS_TTL: Duration = Duration::from_secs(600);
/// Maximum number of labels in the cache.
const LABELS_MAX_ENTRIES: usize = 200;

/// Composite key for a label: `"{account_id}:{id}"`.
fn label_key(account_id: &str, id: &str) -> String {
    format!("{}:{}", account_id, id)
}

/// A cache for `Label` records, keyed by composite `"{account_id}:{id}"`.
pub struct LabelsCache {
    pub(crate) inner: Cache<String, Label>,
}

impl LabelsCache {
    /// Create a new `LabelsCache` backed by the given pool.
    pub fn new(pool: SqlitePool) -> Self {
        let loader = make_loader(pool);
        Self {
            inner: Cache::new("labels", LABELS_TTL, LABELS_MAX_ENTRIES, loader),
        }
    }

    /// Retrieve a label by account ID and label ID.
    /// Returns `None` on cache miss or DB error.
    pub async fn get(&self, account_id: &str, id: &str) -> Option<Label> {
        self.inner.get(&label_key(account_id, id)).await
    }

    /// Remove a specific label from the cache.
    pub fn invalidate(&self, account_id: &str, id: &str) {
        self.inner.invalidate(&label_key(account_id, id));
    }

    /// Clear all labels from the cache.
    pub fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

fn make_loader(pool: SqlitePool) -> SharedLoader<String, Label> {
    Arc::new(move |key: String| -> Pin<Box<dyn std::future::Future<Output = Option<Label>> + Send>> {
        let pool = pool.clone();
        Box::pin(async move {
            // Key format: "{account_id}:{id}"
            if let Some((account_id, id)) = key.split_once(':') {
                crate::db::tables::core::labels::get_by_id(&pool, account_id, id)
                    .await
                    .ok()
            } else {
                None
            }
        })
    })
}