// ── Contacts Cache ──────────────────────────────────────────────────────────

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;

use crate::data_cache::cache::{Cache, SharedLoader};
use crate::db::contacts::schema::Contact;

/// TTL for contacts cache: 5 minutes.
const CONTACTS_TTL: Duration = Duration::from_secs(300);
/// Maximum number of contacts in the cache.
const CONTACTS_MAX_ENTRIES: usize = 5000;

/// A cache for individual `Contact` records, keyed by contact ID.
pub struct ContactsCache {
    pub(crate) inner: Cache<String, Contact>,
}

impl ContactsCache {
    /// Create a new `ContactsCache` backed by the given pool.
    pub fn new(pool: SqlitePool) -> Self {
        let loader = make_loader(pool);
        Self {
            inner: Cache::new("contacts", CONTACTS_TTL, CONTACTS_MAX_ENTRIES, loader),
        }
    }

    /// Retrieve a contact by ID. Returns `None` on cache miss or DB error.
    pub async fn get(&self, contact_id: &str) -> Option<Contact> {
        self.inner.get(&contact_id.to_string()).await
    }

    /// Remove a specific contact from the cache.
    pub fn invalidate(&self, contact_id: &str) {
        self.inner.invalidate(&contact_id.to_string());
    }

    /// Clear all contacts from the cache.
    pub fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

fn make_loader(pool: SqlitePool) -> SharedLoader<String, Contact> {
    Arc::new(move |contact_id: String| -> Pin<Box<dyn std::future::Future<Output = Option<Contact>> + Send>> {
        let pool = pool.clone();
        Box::pin(async move {
            crate::db::tables::crm::contacts::get_by_id(&pool, &contact_id)
                .await
                .ok()
        })
    })
}