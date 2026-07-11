// ── QueueService (pending_operations processor) ──────────────────────────────
//
// Background service that processes the `pending_operations` table. Handles
// retry scheduling with exponential backoff (1s, 2s, 4s, 8s, max 60s) and
// emits events to the frontend for operations that need business-logic
// execution.
//
// This replaces the frontend `queueProcessor.ts` for retry lifecycle
// management. The actual operation execution is delegated to the frontend
// via `core-event` bus messages — the Rust tier handles scheduling,
// backoff calculation, and status tracking.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::Utc;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};

use crate::db::workflows::schema::PendingOperation;
use crate::events::AppEvent;
use crate::events::EventBus;

/// Default poll interval for retryable operations (seconds).
const QUEUE_POLL_INTERVAL_SECS: u64 = 30;

/// Exponential backoff base (seconds).
const BACKOFF_BASE_SECS: i64 = 1;

/// Maximum backoff (seconds).
const BACKOFF_MAX_SECS: i64 = 60;

/// Maximum retries before an operation is permanently failed.
const DEFAULT_MAX_RETRIES: i64 = 5;

/// Background queue processor.
pub struct QueueService {
    running: Arc<AtomicBool>,
    interval_secs: Arc<tokio::sync::Mutex<u64>>,
}

impl QueueService {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            interval_secs: Arc::new(tokio::sync::Mutex::new(QUEUE_POLL_INTERVAL_SECS)),
        }
    }

    /// Start the queue processor loop. Idempotent.
    pub fn start(&self, app: AppHandle) {
        if self.running.swap(true, Ordering::SeqCst) {
            log::info!("[queue_service] already running — skipping duplicate start");
            return;
        }

        let running = self.running.clone();
        let interval = self.interval_secs.clone();

        tokio::spawn(async move {
            log::info!(
                "[queue_service] started (poll interval={QUEUE_POLL_INTERVAL_SECS}s)"
            );

            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                if let Err(e) = Self::process_retryable(&app).await {
                    log::error!("[queue_service] processing tick failed: {e}");
                }

                let secs = *interval.lock().await;
                tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
            }

            log::info!("[queue_service] stopped");
        });
    }

    /// Stop the queue processor.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[queue_service] stop requested");
    }

    /// Single processing tick: query retryable operations, update their
    /// retry state with exponential backoff, and emit events to the frontend.
    async fn process_retryable(app: &AppHandle) -> Result<(), String> {
        let pool = app
            .try_state::<SqlitePool>()
            .ok_or_else(|| "SqlitePool not available".to_string())?;

        let now = Utc::now().timestamp();

        // Phase 1: Process operations that are past their retry_at time.
        let retryable = sqlx::query_as::<_, PendingOperation>(
            r#"
            SELECT * FROM pending_operations
            WHERE status = 'failed'
              AND retry_count < max_retries
              AND next_retry_at IS NOT NULL
              AND next_retry_at <= ?1
            ORDER BY next_retry_at ASC
            LIMIT 50
            "#,
        )
        .bind(now)
        .fetch_all(&*pool)
        .await
        .map_err(|e| format!("Failed to query retryable operations: {e}"))?;

        if retryable.is_empty() {
            // Phase 2: Also look for 'pending' operations that might never have
            // been picked up (e.g., if the frontend was offline).
            let pending = sqlx::query_as::<_, PendingOperation>(
                r#"
                SELECT * FROM pending_operations
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 20
                "#,
            )
            .fetch_all(&*pool)
            .await
            .map_err(|e| format!("Failed to query pending operations: {e}"))?;

            if pending.is_empty() {
                return Ok(());
            }

            Self::process_batch(app, pool.inner().clone(), &pending, now).await
        } else {
            Self::process_batch(app, pool.inner().clone(), &retryable, now).await
        }
    }

    /// Process a batch of operations: emit events and update retry state.
    async fn process_batch(
        app: &AppHandle,
        pool: SqlitePool,
        ops: &[PendingOperation],
        now: i64,
    ) -> Result<(), String> {
        let event_bus = app.try_state::<EventBus>();

        for op in ops {
            // Emit an event to the frontend so it can attempt execution.
            Self::emit_retry_event(app, &event_bus, op);

            // Calculate next retry with exponential backoff.
            let retry_count = op.retry_count + 1;
            let backoff_secs = calculate_backoff(retry_count);
            let next_retry_at = now + backoff_secs;

            // Update the operation's retry state.
            let rows = sqlx::query(
                r#"
                UPDATE pending_operations
                SET retry_count = ?1,
                    next_retry_at = ?2,
                    status = CASE
                        WHEN ?1 >= max_retries THEN 'failed_permanent'
                        ELSE 'pending'
                    END
                WHERE id = ?3
                "#,
            )
            .bind(retry_count)
            .bind(next_retry_at)
            .bind(&op.id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to update operation {}: {e}", op.id))?;

            if rows.rows_affected() == 0 {
                log::warn!("[queue_service] operation {} not found for update", op.id);
                continue;
            }

            if retry_count >= op.max_retries.max(DEFAULT_MAX_RETRIES) {
                log::warn!(
                    "[queue_service] operation {} ({}) permanently failed after {retry_count} retries",
                    op.id,
                    op.operation_type,
                );
            } else {
                log::info!(
                    "[queue_service] operation {} ({}) scheduled retry #{retry_count} in {backoff_secs}s",
                    op.id,
                    op.operation_type,
                );
            }
        }

        Ok(())
    }

    /// Emit an event to the EventBus (and optionally directly via app.emit)
    /// so the frontend can pick up the retry.
    fn emit_retry_event(app: &AppHandle, event_bus: &Option<tauri::State<'_, EventBus>>, op: &PendingOperation) {
        // Build a structured payload for the frontend.
        let payload = serde_json::json!({
            "operationId": op.id,
            "accountId": op.company_id,
            "operationType": op.operation_type,
            "resourceId": op.resource_id,
            "params": op.params,
            "retryCount": op.retry_count + 1,
        });

        // Emit via EventBus if available.
        if let Some(bus) = event_bus {
            bus.emit(AppEvent::Unknown {
                event: "queue:retry".to_string(),
                payload: payload.clone(),
            });
        }

        // Also emit directly via Tauri event system for frontend listeners.
        let _ = app.emit("queue:retry", payload);
    }
}

impl Drop for QueueService {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Calculate exponential backoff: 2^retry seconds, clamped to BACKOFF_MAX_SECS.
fn calculate_backoff(retry_count: i64) -> i64 {
    if retry_count <= 0 {
        return BACKOFF_BASE_SECS;
    }
    // Exponential: 2^(retry_count-1) seconds
    let mut backoff = BACKOFF_BASE_SECS;
    for _ in 1..retry_count {
        backoff = (backoff * 2).min(BACKOFF_MAX_SECS);
    }
    backoff.max(BACKOFF_BASE_SECS).min(BACKOFF_MAX_SECS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_backoff_first_retry() {
        assert_eq!(calculate_backoff(1), 1);
    }

    #[test]
    fn test_calculate_backoff_second_retry() {
        assert_eq!(calculate_backoff(2), 2);
    }

    #[test]
    fn test_calculate_backoff_third_retry() {
        assert_eq!(calculate_backoff(3), 4);
    }

    #[test]
    fn test_calculate_backoff_fourth_retry() {
        assert_eq!(calculate_backoff(4), 8);
    }

    #[test]
    fn test_calculate_backoff_fifth_retry() {
        assert_eq!(calculate_backoff(5), 16);
    }

    #[test]
    fn test_calculate_backoff_caps_at_max() {
        // 2^6 = 64, capped at 60
        assert_eq!(calculate_backoff(7), 60);
    }

    #[test]
    fn test_calculate_backoff_zero_retry() {
        assert_eq!(calculate_backoff(0), 1);
    }

    #[test]
    fn test_calculate_backoff_negative_retry() {
        assert_eq!(calculate_backoff(-1), 1);
    }
}
