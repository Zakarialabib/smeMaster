use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use super::connect::{connect, ImapSession};
use super::types::ImapConfig;
use crate::error::SerializedError;

// ── PooledSession ───────────────────────────────────────────────────────────

struct PooledSession {
    session: ImapSession,
    last_used: Instant,
}

// ── AccountSessionPool ──────────────────────────────────────────────────────

pub struct AccountSessionPool {
    max_size: usize,
    sessions: Mutex<Vec<PooledSession>>,
}

impl AccountSessionPool {
    pub fn new(max_size: usize) -> Self {
        Self {
            max_size: max_size.max(1),
            sessions: Mutex::new(Vec::new()),
        }
    }

    /// Acquire a session from the pool, or create a new connection.
    ///
    /// Before returning a pooled session, a quick `NOOP` is sent to verify
    /// the connection is still alive. Dead sessions are discarded silently.
    pub async fn acquire(&self, config: &ImapConfig) -> Result<ImapSession, SerializedError> {
        let mut pool = self.sessions.lock().await;
        while let Some(mut pooled) = pool.pop() {
            // Quick liveness check – NOOP is safe even if no folder is selected
            if is_session_alive(&mut pooled.session).await {
                log::trace!("[session-pool] reusing pooled session (passed liveness check)");
                return Ok(pooled.session);
            }
            log::debug!("[session-pool] pooled session is dead, discarding");
        }
        drop(pool);

        log::trace!("[session-pool] pool empty, creating new connection");
        connect(config).await
    }

    /// Return a session to the pool for reuse.
    pub async fn release(&self, session: ImapSession) {
        let mut pool = self.sessions.lock().await;
        if pool.len() < self.max_size {
            pool.push(PooledSession {
                session,
                last_used: Instant::now(),
            });
            log::trace!(
                "[session-pool] session returned to pool ({} / {})",
                pool.len(),
                self.max_size
            );
        } else {
            log::trace!("[session-pool] pool full, discarding session");
        }
    }

    /// Remove idle sessions older than the given duration.
    pub async fn cleanup(&self, idle_timeout: Duration) {
        let mut pool = self.sessions.lock().await;
        let before = pool.len();
        pool.retain(|p| p.last_used.elapsed() < idle_timeout);
        let removed = before - pool.len();
        if removed > 0 {
            log::info!(
                "[session-pool] cleaned up {removed} idle sessions ({} remaining)",
                pool.len()
            );
        }
    }

    /// Get current pool size.
    #[allow(dead_code)]
    pub async fn size(&self) -> usize {
        self.sessions.lock().await.len()
    }

    /// Get the maximum pool size.
    #[allow(dead_code)]
    pub fn max_size(&self) -> usize {
        self.max_size
    }
}

// ── SessionPoolManager ──────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct PoolStats {
    pub size: usize,
    pub max_size: usize,
}

pub struct SessionPoolManager {
    pools: Mutex<HashMap<String, Arc<AccountSessionPool>>>,
}

impl SessionPoolManager {
    pub fn new() -> Self {
        Self {
            pools: Mutex::new(HashMap::new()),
        }
    }

    pub async fn get_or_create(&self, account_id: &str, max_size: usize) -> Arc<AccountSessionPool> {
        let mut pools = self.pools.lock().await;
        pools
            .entry(account_id.to_string())
            .or_insert_with(|| Arc::new(AccountSessionPool::new(max_size)))
            .clone()
    }

    #[allow(dead_code)]
    pub async fn remove(&self, account_id: &str) {
        let mut pools = self.pools.lock().await;
        pools.remove(account_id);
        log::info!("[session-pool] removed pool for account '{account_id}'");
    }

    pub async fn cleanup_all(&self, idle_timeout: Duration) {
        let pools = {
            let locked = self.pools.lock().await;
            locked.values().cloned().collect::<Vec<_>>()
        };
        for pool in &pools {
            pool.cleanup(idle_timeout).await;
        }
    }

    #[allow(dead_code)]
    pub async fn get_stats(&self) -> HashMap<String, PoolStats> {
        let mut stats = HashMap::new();
        let pools = {
            let locked = self.pools.lock().await;
            locked
                .iter()
                .map(|(k, v)| (k.clone(), Arc::clone(v)))
                .collect::<Vec<_>>()
        };
        for (account_id, pool) in &pools {
            stats.insert(
                account_id.clone(),
                PoolStats {
                    size: pool.size().await,
                    max_size: pool.max_size(),
                },
            );
        }
        stats
    }
}

impl Default for SessionPoolManager {
    fn default() -> Self {
        Self::new()
    }
}

// ── IDLE support ────────────────────────────────────────────────────────────

pub struct IdleState {
    running: Arc<AtomicBool>,
}

impl IdleState {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn flag(&self) -> Arc<AtomicBool> {
        self.running.clone()
    }
}

pub struct IdleManager {
    account_id: String,
    state: Arc<IdleState>,
}

impl IdleManager {
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            state: Arc::new(IdleState::new()),
        }
    }

    pub fn state(&self) -> Arc<IdleState> {
        self.state.clone()
    }

    #[allow(dead_code)]
    pub fn account_id(&self) -> &str {
        &self.account_id
    }

    pub fn start_idle_loop<F>(&self, config: ImapConfig, on_new_mail: F)
    where
        F: Fn() + Send + Sync + 'static,
    {
        let running = self.state.flag();
        let account_id = self.account_id.clone();

        tokio::spawn(async move {
            'outer: loop {
                if !running.load(Ordering::SeqCst) {
                    log::info!("[idle:{account_id}] IDLE loop stopped");
                    break 'outer;
                }

                let mut session = match connect(&config).await {
                    Ok(s) => s,
                    Err(e) => {
                        log::error!("[idle:{account_id}] Failed to connect: {e}");
                        tokio::time::sleep(Duration::from_secs(10)).await;
                        continue;
                    }
                };

                if let Err(e) = session.select("INBOX").await {
                    log::error!("[idle:{account_id}] Failed to select INBOX: {e}");
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    continue;
                }

                let mut idle = session.idle();

                const IDLE_TIMEOUT: Duration = Duration::from_secs(28 * 60);
                let (idle_result, _stop_source) = idle.wait_with_timeout(IDLE_TIMEOUT);
                match idle_result.await {
                    Ok(async_imap::extensions::idle::IdleResponse::NewData(_)) => {
                        log::info!("[idle:{account_id}] New mail notification received");
                        on_new_mail();
                    }
                    _ => {
                        log::debug!(
                            "[idle:{account_id}] IDLE wait completed (timeout or other)"
                        );
                    }
                }

                if let Err(e) = idle.done().await {
                    log::warn!("[idle:{account_id}] IDLE done error: {e}");
                }

                if running.load(Ordering::SeqCst) {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        });
    }
}

// ── Liveness helper ─────────────────────────────────────────────────────────

/// Quick check to see if a pooled session is still usable.
/// Sends a NOOP command with a 5‑second timeout.
/// The `&mut` is required because `noop()` needs a mutable session.
async fn is_session_alive(session: &mut ImapSession) -> bool {
    match tokio::time::timeout(Duration::from_secs(5), session.noop()).await {
        Ok(Ok(_)) => true,
        _ => false,
    }
}

// ── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ---------------------------------------------------------------
    // AccountSessionPool – basic structural tests
    // ---------------------------------------------------------------

    #[test]
    fn test_pool_new_respects_min_size() {
        let pool = AccountSessionPool::new(0); // will become 1
        assert_eq!(pool.max_size(), 1);
    }

    #[test]
    fn test_pool_new_with_max_size() {
        let pool = AccountSessionPool::new(3);
        assert_eq!(pool.max_size(), 3);
    }

    #[tokio::test]
    async fn test_pool_initial_size_is_zero() {
        let pool = AccountSessionPool::new(2);
        assert_eq!(pool.size().await, 0);
    }

    // ---------------------------------------------------------------
    // SessionPoolManager – create & stats
    // ---------------------------------------------------------------

    #[tokio::test]
    async fn test_manager_get_or_create_pool() {
        let manager = SessionPoolManager::new();
        let pool = manager.get_or_create("test-account", 5).await;
        assert_eq!(pool.max_size(), 5);
    }

    #[tokio::test]
    async fn test_manager_same_account_returns_same_pool() {
        let manager = SessionPoolManager::new();
        let pool1 = manager.get_or_create("account-a", 3).await;
        let pool2 = manager.get_or_create("account-a", 7).await;
        // Should return the existing pool, ignoring the new max_size
        assert_eq!(pool1.max_size(), 3);
        assert_eq!(pool2.max_size(), 3);
    }

    #[tokio::test]
    async fn test_manager_remove_pool() {
        let manager = SessionPoolManager::new();
        let _ = manager.get_or_create("remove-me", 1).await;
        manager.remove("remove-me").await;
        let stats = manager.get_stats().await;
        assert!(!stats.contains_key("remove-me"));
    }

    #[tokio::test]
    async fn test_manager_stats_shows_pool_info() {
        let manager = SessionPoolManager::new();
        let _ = manager.get_or_create("stats-acc", 4).await;
        let stats = manager.get_stats().await;
        assert_eq!(stats.get("stats-acc").unwrap().max_size, 4);
        assert_eq!(stats.get("stats-acc").unwrap().size, 0);
    }

    // ---------------------------------------------------------------
    // IdleState
    // ---------------------------------------------------------------

    #[test]
    fn test_idle_state_starts_running() {
        let state = IdleState::new();
        assert!(state.is_running());
    }

    #[test]
    fn test_idle_state_stop_then_not_running() {
        let state = IdleState::new();
        state.stop();
        assert!(!state.is_running());
    }

    #[test]
    fn test_idle_state_flag_shares_state() {
        let state = IdleState::new();
        let flag = state.flag();
        assert!(flag.load(Ordering::SeqCst));
        state.stop();
        assert!(!flag.load(Ordering::SeqCst));
    }

    // ---------------------------------------------------------------
    // IdleManager
    // ---------------------------------------------------------------

    #[test]
    fn test_idle_manager_creation() {
        let mgr = IdleManager::new("test@example.com".to_string());
        assert_eq!(mgr.account_id(), "test@example.com");
        assert!(mgr.state().is_running());
    }

    #[test]
    fn test_idle_manager_stop_via_state() {
        let mgr = IdleManager::new("test@example.com".to_string());
        let state = mgr.state();
        state.stop();
        assert!(!mgr.state().is_running());
    }
}