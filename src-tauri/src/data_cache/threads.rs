// ── Threads Cache ───────────────────────────────────────────────────────────

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::data_cache::cache::{Cache, SharedLoader};

/// TTL for threads cache: 2 minutes.
const THREADS_TTL: Duration = Duration::from_secs(120);
/// Maximum number of thread summaries in the cache.
const THREADS_MAX_ENTRIES: usize = 1000;

/// A lightweight summary of a thread, suitable for caching.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadSummary {
    pub thread_id: String,
    pub subject: Option<String>,
    pub last_message_date: Option<i64>,
    pub unread_count: i64,
    pub folder: Option<String>,
}

/// Composite key for a thread: `"{account_id}:{thread_id}"`.
fn thread_key(account_id: &str, thread_id: &str) -> String {
    format!("{}:{}", account_id, thread_id)
}

/// A cache for `ThreadSummary` records, keyed by composite `"{account_id}:{thread_id}"`.
pub struct ThreadsCache {
    pub(crate) inner: Cache<String, ThreadSummary>,
}

impl ThreadsCache {
    /// Create a new `ThreadsCache` backed by the given pool.
    pub fn new(pool: SqlitePool) -> Self {
        let loader = make_loader(pool);
        Self {
            inner: Cache::new("threads", THREADS_TTL, THREADS_MAX_ENTRIES, loader),
        }
    }

    /// Retrieve a thread summary by account ID and thread ID.
    /// Returns `None` on cache miss or DB error.
    pub async fn get(&self, account_id: &str, thread_id: &str) -> Option<ThreadSummary> {
        self.inner.get(&thread_key(account_id, thread_id)).await
    }

    /// Remove a specific thread summary from the cache.
    pub fn invalidate(&self, account_id: &str, thread_id: &str) {
        self.inner.invalidate(&thread_key(account_id, thread_id));
    }

    /// Clear all thread summaries from the cache.
    pub fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.inner.len()
    }
}

fn make_loader(pool: SqlitePool) -> SharedLoader<String, ThreadSummary> {
    Arc::new(move |key: String| -> Pin<Box<dyn std::future::Future<Output = Option<ThreadSummary>> + Send>> {
        let pool = pool.clone();
        Box::pin(async move {
            // Key format: "{account_id}:{thread_id}"
            if let Some((account_id, thread_id)) = key.split_once(':') {
                // Fetch the thread with unread count and folder info
                // We query threads + messages to build a lightweight summary
                let row = sqlx::query_as::<_, (String, Option<String>, Option<i64>, i64, Option<String>)>(
                    r#"
                    SELECT
                        t.id,
                        t.subject,
                        t.last_message_at,
                        COALESCE((SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.account_id = t.account_id AND m.is_read = 0), 0) AS unread_count,
                        (SELECT m.imap_folder FROM messages m WHERE m.thread_id = t.id AND m.account_id = t.account_id ORDER BY m.date DESC LIMIT 1) AS folder
                    FROM threads t
                    WHERE t.account_id = ?1 AND t.id = ?2
                    "#,
                )
                .bind(account_id)
                .bind(&thread_id)
                .fetch_optional(&pool)
                .await
                .ok()??;

                Some(ThreadSummary {
                    thread_id: row.0,
                    subject: row.1,
                    last_message_date: row.2,
                    unread_count: row.3,
                    folder: row.4,
                })
            } else {
                None
            }
        })
    })
}