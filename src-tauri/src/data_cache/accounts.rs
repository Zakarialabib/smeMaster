// ── Accounts Cache ──────────────────────────────────────────────────────────

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;

use crate::data_cache::cache::{Cache, SharedLoader};
use crate::db::core::schema::Account;

/// TTL for accounts cache: 10 minutes.
const ACCOUNTS_TTL: Duration = Duration::from_secs(600);
/// Maximum number of accounts in the cache.
const ACCOUNTS_MAX_ENTRIES: usize = 50;

/// A cache for `Account` records, keyed by account ID.
pub struct AccountsCache {
    pub(crate) inner: Cache<String, Account>,
}

impl AccountsCache {
    /// Create a new `AccountsCache` backed by the given pool.
    pub fn new(pool: SqlitePool) -> Self {
        let loader = make_loader(pool);
        Self {
            inner: Cache::new("accounts", ACCOUNTS_TTL, ACCOUNTS_MAX_ENTRIES, loader),
        }
    }

    /// Retrieve an account by ID. Returns `None` on cache miss or DB error.
    pub async fn get(&self, account_id: &str) -> Option<Account> {
        self.inner.get(&account_id.to_string()).await
    }

    /// Remove a specific account from the cache.
    pub fn invalidate(&self, account_id: &str) {
        self.inner.invalidate(&account_id.to_string());
    }

    /// Clear all accounts from the cache.
    pub fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

fn make_loader(pool: SqlitePool) -> SharedLoader<String, Account> {
    Arc::new(move |account_id: String| -> Pin<Box<dyn std::future::Future<Output = Option<Account>> + Send>> {
        let pool = pool.clone();
        Box::pin(async move {
            crate::db::tables::core::accounts::get_by_id(&pool, &account_id)
                .await
                .ok()
        })
    })
}