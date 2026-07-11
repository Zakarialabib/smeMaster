// ── Data Cache Layer ────────────────────────────────────────────────────────
//
// Phase 1 of the Data Layer Evolution: In-memory cache layer backed by
// DashMap with TTL-based freshness, background refresh, and domain-specific
// invalidation.

pub mod accounts;
pub mod cache;
pub mod contacts;
pub mod labels;
pub mod threads;

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;
use crate::orchestrator::service::{HealthStatus, Service};

use self::accounts::AccountsCache;
use self::cache::{CacheDomain, CacheStats};
use self::contacts::ContactsCache;
use self::labels::LabelsCache;
use self::threads::ThreadsCache;

/// The core data cache container holding all domain-specific caches.
pub struct DataCache {
    pub contacts: ContactsCache,
    pub accounts: AccountsCache,
    pub labels: LabelsCache,
    pub threads: ThreadsCache,
}

impl DataCache {
    /// Create a new `DataCache` with all sub-caches backed by the given pool.
    pub fn new(pool: SqlitePool) -> Self {
        log::info!(
            "[data-cache] Creating caches — contacts TTL: {:?}, accounts TTL: {:?}, labels TTL: {:?}, threads TTL: {:?}",
            CacheDomain::Contacts.ttl(),
            CacheDomain::Accounts.ttl(),
            CacheDomain::Labels.ttl(),
            CacheDomain::Threads.ttl(),
        );
        Self {
            contacts: ContactsCache::new(pool.clone()),
            accounts: AccountsCache::new(pool.clone()),
            labels: LabelsCache::new(pool.clone()),
            threads: ThreadsCache::new(pool.clone()),
        }
    }

    /// Invalidate all cached entries across all domains.
    pub fn invalidate_all(&self) {
        self.contacts.invalidate_all();
        self.accounts.invalidate_all();
        self.labels.invalidate_all();
        self.threads.invalidate_all();
        log::info!(
            "[data-cache] All caches invalidated (accounts empty: {}, contacts empty: {}, labels empty: {}, threads empty: {})",
            self.accounts.inner.is_empty(),
            self.contacts.inner.is_empty(),
            self.labels.inner.is_empty(),
            self.threads.inner.is_empty(),
        );
    }

    /// Invalidate a specific domain cache.
    pub fn invalidate(&self, domain: CacheDomain) {
        match domain {
            CacheDomain::Contacts => {
                self.contacts.invalidate_all();
                log::info!("[data-cache] Contacts cache invalidated");
            }
            CacheDomain::Accounts => {
                self.accounts.invalidate_all();
                log::info!("[data-cache] Accounts cache invalidated");
            }
            CacheDomain::Labels => {
                self.labels.invalidate_all();
                log::info!("[data-cache] Labels cache invalidated");
            }
            CacheDomain::Threads => {
                self.threads.invalidate_all();
                log::info!("[data-cache] Threads cache invalidated");
            }
        }
    }

    /// Returns `true` if all caches are operational (len >= 0).
    pub fn is_healthy(&self) -> bool {
        // All caches are always operational — they degrade gracefully on DB errors.
        true
    }

    /// Snapshot of hit/miss statistics for every domain cache.
    pub fn stats(&self) -> HashMap<&'static str, CacheStats> {
        let mut result = HashMap::new();
        result.insert("contacts", self.contacts.inner.stats());
        result.insert("accounts", self.accounts.inner.stats());
        result.insert("labels", self.labels.inner.stats());
        result.insert("threads", self.threads.inner.stats());
        result
    }
}

/// Tauri-managed service wrapping the `DataCache`.
///
/// Registered as an AlwaysOn service in the orchestrator.
pub struct DataCacheService {
    cache: Arc<DataCache>,
    pool: SqlitePool,
    app_handle: AppHandle,
}

impl DataCacheService {
    pub fn new(app_handle: AppHandle, pool: SqlitePool) -> Self {
        let cache = Arc::new(DataCache::new(pool.clone()));
        Self {
            cache,
            pool,
            app_handle,
        }
    }

    /// Access the underlying `DataCache`.
    pub fn cache(&self) -> &Arc<DataCache> {
        &self.cache
    }
}

#[async_trait]
impl Service for DataCacheService {
    fn name(&self) -> &'static str {
        "data_cache"
    }

    fn priority(&self) -> u32 {
        20 // Early in the init sequence, after database
    }

    fn is_critical(&self) -> bool {
        false // Cache is non-critical — app works without it, just slower
    }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[data-cache] Initializing data cache service");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        // Gate: skip pre-warming when the database is empty. Pre-warming an
        // empty DB wastes work and produces noisy logs on first run. The cache
        // still populates on-demand as data arrives.
        let empty = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0) == 0
            && sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM messages")
                .fetch_one(&self.pool)
                .await
                .unwrap_or(0) == 0;
        if empty {
            log::info!("[data-cache] Database is empty — skipping cache pre-warming");
            return Ok(());
        }

        log::info!("[data-cache] Pre-warming caches...");

        // Pre-warm labels cache: fetch all labels for all accounts
        match crate::db::tables::core::accounts::get_all(&self.pool).await {
            Ok(accounts) => {
                for account in &accounts {
                    match crate::db::tables::core::labels::get_by_account(&self.pool, &account.id).await
                    {
                        Ok(labels) => {
                            for label in labels {
                                let key = format!("{}:{}", account.id, label.id);
                                self.cache.labels.inner.insert(key.clone(), label);
                            }
                            log::info!(
                                "[data-cache] Pre-warmed labels for account {}",
                                account.id
                            );
                        }
                        Err(e) => {
                            log::warn!(
                                "[data-cache] Failed to pre-warm labels for account {}: {}",
                                account.id,
                                e
                            );
                        }
                    }
                }
            }
            Err(e) => {
                log::warn!("[data-cache] Failed to pre-warm labels: {}", e);
            }
        }

        // Pre-warm accounts cache: fetch all accounts
        match crate::db::tables::core::accounts::get_all(&self.pool).await {
            Ok(accounts) => {
                for account in &accounts {
                    self.cache
                        .accounts
                        .inner
                        .insert(account.id.clone(), account.clone());
                }
                log::info!(
                    "[data-cache] Pre-warmed {} accounts",
                    accounts.len()
                );

                // Pre-warm threads cache: last 50 threads per account.
                // These are the threads most likely to be shown on first paint.
                for account in &accounts {
                    let account_id = account.id.clone();
                    let pool = self.pool.clone();
                    let cache = self.cache.clone();
                    tokio::spawn(async move {
                        let filters = crate::db::commands::ThreadFilters::default();
                        match crate::db::tables::core::threads::list(
                            &pool,
                            &account_id,
                            50,
                            0,
                            Some(filters),
                        )
                        .await
                        {
                            Ok(threads) => {
                                for thread in threads {
                                    let key = format!("{}:{}", account_id, thread.id);
                                    let summary = crate::data_cache::threads::ThreadSummary {
                                        thread_id: thread.id,
                                        subject: thread.subject,
                                        last_message_date: thread.last_message_at,
                                        unread_count: if thread.is_read == 0 { 1 } else { 0 },
                                        folder: None,
                                    };
                                    cache.threads.inner.insert(key, summary);
                                }
                                log::info!(
                                    "[data-cache] Pre-warmed {} threads for account {}",
                                    cache.threads.inner.len(),
                                    account_id
                                );
                            }
                            Err(e) => {
                                log::warn!(
                                    "[data-cache] Failed to pre-warm threads for account {}: {}",
                                    account_id,
                                    e
                                );
                            }
                        }
                    });
                }
            }
            Err(e) => {
                log::warn!("[data-cache] Failed to pre-warm accounts: {}", e);
            }
        }

        // Pre-warm contacts cache: fetch most recently contacted 100 contacts.
        // This covers the autocomplete/first-paint use case without loading the entire table.
        match crate::db::tables::crm::contacts::list(&self.pool, 100, 0, Some("frequency"), None)
            .await
        {
            Ok(contacts) => {
                for contact in contacts {
                    self.cache
                        .contacts
                        .inner
                        .insert(contact.id.clone(), contact);
                }
                log::info!(
                    "[data-cache] Pre-warmed {} contacts",
                    self.cache.contacts.inner.len()
                );
            }
            Err(e) => {
                log::warn!("[data-cache] Failed to pre-warm contacts: {}", e);
            }
        }

        log::info!("[data-cache] Cache pre-warming complete");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        self.cache.invalidate_all();
        log::info!("[data-cache] All caches cleared");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        // Report cache sizes using the len() methods
        let accounts_count = self.cache.accounts.len();
        let contacts_count = self.cache.contacts.len();
        let labels_count = self.cache.labels.len();
        let threads_count = self.cache.threads.len();
        let app_data_dir = self.app_handle.path().app_data_dir().ok();

        log::info!(
            "[data-cache] Health check: {} accounts, {} contacts, {} labels, {} threads (app_data: {:?})",
            accounts_count,
            contacts_count,
            labels_count,
            threads_count,
            app_data_dir,
        );

        if self.cache.is_healthy() {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded("Data cache reports unhealthy state".to_string())
        }
    }
}

// ── Accessor methods exposed for use by commands and event processor ──────

impl DataCacheService {
    pub fn get_contacts_cache(&self) -> &ContactsCache {
        &self.cache.contacts
    }

    pub fn get_accounts_cache(&self) -> &AccountsCache {
        &self.cache.accounts
    }

    pub fn get_labels_cache(&self) -> &LabelsCache {
        &self.cache.labels
    }

    pub fn get_threads_cache(&self) -> &ThreadsCache {
        &self.cache.threads
    }
}