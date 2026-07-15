// ── Generic Cache layer ─────────────────────────────────────────────────────
//
// Provides a TTL-aware, dashmap-backed cache with background refresh and
// domain-specific invalidation.

use std::future::Future;
use std::hash::Hash;
use std::pin::Pin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;

/// Aggregate cache statistics: hits, misses, hit rate %, current size, and domain name.
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct CacheStats {
    pub name: &'static str,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate_pct: f64,
    pub size: usize,
}

/// The domain of a cache — used for targeted invalidation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CacheDomain {
    Contacts,
    Accounts,
    Labels,
    Threads,
}

impl CacheDomain {
    pub fn ttl(&self) -> Duration {
        match self {
            CacheDomain::Contacts => Duration::from_secs(300),   // 5 min
            CacheDomain::Accounts => Duration::from_secs(600),   // 10 min
            CacheDomain::Labels => Duration::from_secs(600),     // 10 min
            CacheDomain::Threads => Duration::from_secs(120),    // 2 min
        }
    }
}

/// A single entry in the cache.
#[derive(Debug, Clone)]
pub struct CacheEntry<V> {
    pub value: V,
    pub loaded_at: Instant,
    pub ttl: Duration,
}

impl<V> CacheEntry<V> {
    /// Returns `true` if the entry is still fresh (not yet expired).
    pub fn is_fresh(&self) -> bool {
        self.loaded_at.elapsed() < self.ttl
    }
}

/// Shared loader function signature: takes a key, returns an optional value.
pub type SharedLoader<K, V> =
    Arc<dyn Fn(K) -> Pin<Box<dyn Future<Output = Option<V>> + Send>> + Send + Sync>;

/// A generic TTL-aware cache backed by `DashMap`.
///
/// - Returns cached value if fresh.
/// - If stale, returns the stale value and spawns a background refresh.
/// - If missing, calls the loader synchronously (awaits it).
pub struct Cache<K, V> {
    map: Arc<DashMap<K, CacheEntry<V>>>,
    ttl: Duration,
    max_entries: usize,
    loader: SharedLoader<K, V>,
    name: &'static str,
    pub hits: AtomicU64,
    pub misses: AtomicU64,
    last_benchmark_ms: std::sync::atomic::AtomicU64,
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    pub fn new(
        name: &'static str,
        ttl: Duration,
        max_entries: usize,
        loader: SharedLoader<K, V>,
    ) -> Self {
        log::debug!(
            "[cache:{}] new Cache(ttl={:?} ({}s), max_entries={})",
            name,
            ttl,
            ttl.as_secs(),
            max_entries,
        );
        Self {
            map: Arc::new(DashMap::with_capacity(max_entries.min(1024))),
            ttl,
            max_entries,
            loader,
            name,
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
            last_benchmark_ms: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Returns the cache's domain name (for logging/stats).
    #[allow(dead_code)]
    pub fn name(&self) -> &'static str {
        self.name
    }

    /// Get a value by key.
    ///
    /// - **Fresh hit**: returns the cached value immediately.
    /// - **Stale hit**: returns the stale value and spawns a background refresh.
    /// - **Miss**: awaits the loader, stores the result, returns it.
    pub async fn get(&self, key: &K) -> Option<V> {
        // Fast path: fresh entry
        if let Some(entry) = self.map.get(key) {
            if entry.is_fresh() {
                self.hits.fetch_add(1, Ordering::Relaxed);
                return Some(entry.value.clone());
            }
            self.hits.fetch_add(1, Ordering::Relaxed);
            // Stale — spawn background refresh in a fire-and-forget task
            let stale = entry.value.clone();
            let key_clone = key.clone();
            let map = self.map.clone();
            let loader = self.loader.clone();
            let ttl = self.ttl;
            tokio::spawn(async move {
                if let Some(fresh) = (loader)(key_clone.clone()).await {
                    map.insert(
                        key_clone,
                        CacheEntry {
                            value: fresh,
                            loaded_at: Instant::now(),
                            ttl,
                        },
                    );
                }
            });
            return Some(stale);
        }

        // Miss — load synchronously
        self.misses.fetch_add(1, Ordering::Relaxed);
        let value = (self.loader)(key.clone()).await;
        if let Some(ref v) = value {
            self.insert(key.clone(), v.clone());
        }
        value
    }

    /// Insert a value into the cache.
    pub fn insert(&self, key: K, value: V) {
        if self.map.len() >= self.max_entries {
            // Evict oldest entry by removing the first one we find
            if let Some(entry) = self.map.iter().next() {
                let oldest_key = entry.key().clone();
                self.map.remove(&oldest_key);
            }
        }
        // A direct write is not a hit, but it also isn't a typical miss
        // (we already have the value). Track it as a miss for symmetry with
        // the read path so the hit-rate reflects cache reads vs. writes.
        self.misses.fetch_add(1, Ordering::Relaxed);
        self.map.insert(
            key,
            CacheEntry {
                value,
                loaded_at: Instant::now(),
                ttl: self.ttl,
            },
        );
    }

    /// Remove a specific key from the cache.
    pub fn invalidate(&self, key: &K) {
        self.map.remove(key);
    }

    /// Clear all entries.
    pub fn invalidate_all(&self) {
        self.map.clear();
    }

    /// Number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.map.len()
    }

    /// Returns `true` if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    /// Snapshot of the cache's hit/miss statistics.
    pub fn stats(&self) -> CacheStats {
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        let total = hits + misses;
        let hit_rate_pct = if total == 0 {
            0.0
        } else {
            (hits as f64 / total as f64) * 100.0
        };
        CacheStats {
            name: self.name,
            hits,
            misses,
            hit_rate_pct,
            size: self.map.len(),
        }
    }
}

/// Benchmark helper — only implemented for `String`-keyed caches (all four
/// domain caches use `String` composite keys).
impl<K, V> Cache<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + From<String> + 'static,
    V: Clone + Send + Sync + 'static,
{
    /// Run a tiny synthetic benchmark against this cache's loader and store
    /// the duration in ms. Intended for the Settings Cache tab so users can
    /// see whether the DB/cache path is healthy without leaving Settings.
    pub async fn benchmark(&self) -> f64 {
        // Warm-up to avoid one-off startup noise.
        let key: K = format!("{}:benchmark", self.name).into();
        let _ = self.get(&key).await;

        let start = Instant::now();
        let _ = self.get(&key).await;
        let ms = start.elapsed().as_secs_f64() * 1000.0;

        self.last_benchmark_ms
            .store((ms * 1000.0) as u64, std::sync::atomic::Ordering::Relaxed);
        ms
    }
}
