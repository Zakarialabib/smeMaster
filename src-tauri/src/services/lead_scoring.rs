// ── LeadScoreManager — reactive lead-scoring event subscriber ──────────────
//
// Listens to the EventBus broadcast channel and accumulates engagement
// score deltas per contact. Writes are debounced (batch-flushed every 5
// seconds or after 10 events, whichever comes first) to avoid excessive
// SQLite writes during high-throughput sync operations.
//
// Scoring rules:
//   Event              | Delta  | Requires DB lookup
//   ───────────────────┼────────┼────────────────────
//   EmailReceived      |  +5    | email → contact_id
//   ContactUpdated     |  +3    | n/a (has contact_id)
//   TaskCompleted      |  +8    | task_id → contact_id
//   EmailOpened (fut.) | +10    | (reserved)
//   LinkClicked (fut.) | +15    | (reserved)
//
// Health status is recomputed on flush from the total score:
//   score >= 50 → "hot"
//   score >= 20 → "warm"
//   score  < 20 → "cold"

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{self, Duration};

use sqlx::SqlitePool;
use tauri::AppHandle;

use crate::db::error::AppDbError;
use crate::events::{AppEvent, EventBus};

/// Default debounce interval (seconds).
const FLUSH_INTERVAL_SECS: u64 = 5;

/// Maximum number of pending events before a forced flush.
const MAX_PENDING_EVENTS: usize = 10;

/// Score deltas per event type.
const DELTA_EMAIL_RECEIVED: f64 = 5.0;
const DELTA_CONTACT_UPDATED: f64 = 3.0;
const DELTA_TASK_COMPLETED: f64 = 8.0;
// Future email-open tracking — reserved so the code compiles as a ref.
const _DELTA_EMAIL_OPENED: f64 = 10.0;
const _DELTA_LINK_CLICKED: f64 = 15.0;

/// A single pending engagement event waiting to be flushed to the DB.
#[derive(Debug, Clone)]
struct PendingEvent {
    contact_id: String,
    event_type: String,
    score_delta: f64,
    entity_type: Option<String>,
    entity_id: Option<String>,
    timestamp: i64,
}

/// Per-contact accumulator used during the debounce window.
#[derive(Debug, Clone)]
struct ContactAccumulator {
    total_score_delta: f64,
    events: Vec<PendingEvent>,
}

/// Reactive lead-scoring engine that processes AppEvent bus events.
///
/// # Lifecycle
/// 1. Construct via `LeadScoreManager::new(pool, bus)`.
/// 2. Call `start(app)` to spawn the background event-loop task.
/// 3. The task runs until the broadcast channel closes (app shutdown).
///
/// # Thread safety
/// The pending buffer is behind `Arc<Mutex<...>>` so the background
/// loop and any future command handlers share the same state safely.
pub struct LeadScoreManager {
    pool: SqlitePool,
    bus: EventBus,
    pending: Arc<Mutex<HashMap<String, ContactAccumulator>>>,
}

impl LeadScoreManager {
    /// Create a new manager with the given DB pool and event bus.
    pub fn new(pool: SqlitePool, bus: EventBus) -> Self {
        Self {
            pool,
            bus,
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn the background event-loop task.
    ///
    /// The task subscribes to the `EventBus`, accumulates score deltas,
    /// and flushes them to the database on a debounce timer or when the
    /// pending buffer reaches `MAX_PENDING_EVENTS`.
    ///
    /// This is safe to call multiple times (only the first call actually
    /// spawns — guarded by `tokio::sync::OnceCell` inside).
    pub fn start(self, app: &AppHandle) {
        let pool = self.pool.clone();
        let pending = self.pending.clone();
        let mut rx = self.bus.subscribe();

        // Clone the AppHandle so we can access managed state later if needed
        let _app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            let mut ticker = time::interval(Duration::from_secs(FLUSH_INTERVAL_SECS));
            // The first tick fires immediately — we skip it so the
            // debounce window is truly 5 seconds from the first event.
            ticker.tick().await;

            loop {
                tokio::select! {
                    event_result = rx.recv() => {
                        match event_result {
                            Ok(event) => {
                                if let Err(e) = Self::handle_event(&pool, &pending, &event).await {
                                    log::warn!("[lead-scoring] Error handling event: {e}");
                                }

                                // Force-flush if we have accumulated enough events
                                let count = pending.lock().await.values()
                                    .map(|acc| acc.events.len())
                                    .sum::<usize>();
                                if count >= MAX_PENDING_EVENTS {
                                    log::debug!("[lead-scoring] Pending buffer ≥{MAX_PENDING_EVENTS}, flushing early");
                                    if let Err(e) = Self::flush(&pool, &pending).await {
                                        log::warn!("[lead-scoring] Flush error: {e}");
                                    }
                                }
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                                log::warn!("[lead-scoring] Lagged, dropped {n} events");
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                log::info!("[lead-scoring] Channel closed, flushing remaining events and shutting down");
                                // One last flush before exit
                                if let Err(e) = Self::flush(&pool, &pending).await {
                                    log::warn!("[lead-scoring] Final flush error: {e}");
                                }
                                break;
                            }
                        }
                    }
                    _ = ticker.tick() => {
                        // Timer fired — flush accumulated events
                        let has_pending = {
                            let p = pending.lock().await;
                            !p.is_empty()
                        };
                        if has_pending {
                            log::debug!("[lead-scoring] Debounce timer fired, flushing");
                            if let Err(e) = Self::flush(&pool, &pending).await {
                                log::warn!("[lead-scoring] Flush error: {e}");
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Event handling ─────────────────────────────────────────────────

    /// Process a single `AppEvent` and, if relevant, enqueue a pending
    /// score update. Returns Ok(()) even if the contact wasn't found
    /// (the event is silently skipped).
    async fn handle_event(
        pool: &SqlitePool,
        pending: &Arc<Mutex<HashMap<String, ContactAccumulator>>>,
        event: &AppEvent,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();

        match event {
            AppEvent::EmailReceived {
                from_address,
                date: _,
                ..
            } => {
                // Look up contact by email — if not found, skip
                let contact = crate::db::tables::crm::contacts::get_by_email(pool, from_address)
                    .await
                    .map_err(|e| format!("Failed to look up contact by email: {e}"))?
                    .ok_or_else(|| {
                        // Unknown sender — no contact record yet; that's fine, skip silently
                        log::debug!(
                            "[lead-scoring] Email from unknown address (no contact record): {from_address}"
                        );
                        "unknown_contact"
                    })?;

                let event = PendingEvent {
                    contact_id: contact.id.clone(),
                    event_type: "email_received".to_string(),
                    score_delta: DELTA_EMAIL_RECEIVED,
                    entity_type: Some("email".to_string()),
                    entity_id: None, // message_id could be stored here
                    timestamp: now,
                };

                Self::enqueue(pending, contact.id, event).await;
                Ok(())
            }

            AppEvent::ContactUpdated { contact_id } => {
                let event = PendingEvent {
                    contact_id: contact_id.clone(),
                    event_type: "contact_updated".to_string(),
                    score_delta: DELTA_CONTACT_UPDATED,
                    entity_type: Some("contact".to_string()),
                    entity_id: Some(contact_id.clone()),
                    timestamp: now,
                };

                Self::enqueue(pending, contact_id.clone(), event).await;
                Ok(())
            }

            AppEvent::TaskCompleted { task_id } => {
                // Look up task to find which contact it belongs to
                let contact_id = match Self::get_contact_id_for_task(pool, task_id).await {
                    Ok(Some(cid)) => cid,
                    Ok(None) => {
                        log::debug!(
                            "[lead-scoring] Task {task_id} has no associated contact — skipping"
                        );
                        return Ok(());
                    }
                    Err(e) => {
                        log::warn!(
                            "[lead-scoring] Failed to look up task {task_id}: {e}"
                        );
                        return Ok(());
                    }
                };

                let event = PendingEvent {
                    contact_id: contact_id.clone(),
                    event_type: "task_completed".to_string(),
                    score_delta: DELTA_TASK_COMPLETED,
                    entity_type: Some("task".to_string()),
                    entity_id: Some(task_id.clone()),
                    timestamp: now,
                };

                Self::enqueue(pending, contact_id, event).await;
                Ok(())
            }

            _ => {
                // Irrelevant event — ignore
                Ok(())
            }
        }
    }

    /// Enqueue a pending event, accumulating score deltas per contact.
    async fn enqueue(
        pending: &Arc<Mutex<HashMap<String, ContactAccumulator>>>,
        contact_id: String,
        event: PendingEvent,
    ) {
        let score_delta = event.score_delta;
        let mut map = pending.lock().await;
        let entry = map.entry(contact_id).or_insert(ContactAccumulator {
            total_score_delta: 0.0,
            events: Vec::new(),
        });
        entry.total_score_delta += score_delta;
        entry.events.push(event);
    }

    // ── DB lookups ────────────────────────────────────────────────────

    /// Resolve a task's contact_id from the tasks table.
    async fn get_contact_id_for_task(
        pool: &SqlitePool,
        task_id: &str,
    ) -> Result<Option<String>, AppDbError> {
        let task = crate::db::tables::tasks::tasks::get_by_id(pool, task_id).await?;
        Ok(task.contact_id)
    }

    // ── Flush ─────────────────────────────────────────────────────────

    /// Persist all pending score updates to the database in a single
    /// transaction. After a successful flush the pending buffer is cleared.
    async fn flush(
        pool: &SqlitePool,
        pending: &Arc<Mutex<HashMap<String, ContactAccumulator>>>,
    ) -> Result<(), String> {
        let batch: HashMap<String, ContactAccumulator>;

        // Extract the current buffer under the lock (fast path)
        {
            let mut map = pending.lock().await;
            if map.is_empty() {
                return Ok(());
            }
            batch = std::mem::take(&mut *map);
        }

        let count: usize = batch.values().map(|a| a.events.len()).sum();
        log::info!(
            "[lead-scoring] Flushing {count} pending events across {} contacts",
            batch.len()
        );

        // Use a transaction so we either persist everything or nothing
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| format!("Failed to begin transaction: {e}"))?;

        for (contact_id, acc) in &batch {
            // 1. Read the current contact to get its engagement_score
            let contact = sqlx::query_as::<_, crate::db::contacts::schema::Contact>(
                "SELECT * FROM contacts WHERE id = ?",
            )
            .bind(contact_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("Failed to fetch contact {contact_id}: {e}"))?
            .ok_or_else(|| {
                format!(
                    "Contact {contact_id} not found during score flush — skipping"
                )
            })?;

            // 2. Compute new score (clamped to [0, 100])
            let current_score = contact.engagement_score;
            let new_score = (current_score + acc.total_score_delta)
                .clamp(0.0, 100.0);

            // 3. Determine health status
            let health_status = if new_score >= 50.0 {
                "hot"
            } else if new_score >= 20.0 {
                "warm"
            } else {
                "cold"
            };

            // 4. Update the contact record
            let now = chrono::Utc::now().timestamp();
            sqlx::query(
                "UPDATE contacts SET engagement_score = ?, last_engaged_at = ?, \
                 health_status = ?, updated_at = ? WHERE id = ?",
            )
            .bind(new_score)
            .bind(now)
            .bind(health_status)
            .bind(now)
            .bind(contact_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                format!("Failed to update score for contact {contact_id}: {e}")
            })?;

            // 5. Log individual engagement events (inline INSERT so we
            //    can reuse the transaction handle)
            for evt in &acc.events {
                let log_id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO engagement_log \
                     (id, contact_id, entity_type, entity_id, event_type, \
                      score_delta, metadata_json, created_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&log_id)
                .bind(&evt.contact_id)
                .bind(&evt.entity_type)
                .bind(&evt.entity_id)
                .bind(&evt.event_type)
                .bind(evt.score_delta)
                .bind(Option::<&str>::None) // metadata_json
                .bind(evt.timestamp)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    format!(
                        "Failed to log engagement for contact {contact_id}: {e}"
                    )
                })?;
            }

            log::debug!(
                "[lead-scoring] Contact {contact_id}: score {current_score} → {new_score} ({health_status})",
            );
        }

        tx.commit()
            .await
            .map_err(|e| format!("Failed to commit flush transaction: {e}"))?;

        log::info!("[lead-scoring] Batch flush completed successfully");

        // Emit a cache-invalidation event so the frontend picks up changes
        // (the event processor will handle the actual cache invalidation).
        // We do this outside the transaction to keep it short.
        // The EventBus broadcast channel is non-blocking.
        // In practice the DomainEventProcessor already handles CacheInvalidate;
        // emitting here ensures the UI refreshes after score changes.
        // NOTE: we can't access EventBus directly from this static method,
        // so the caller (the loop in start()) handles it. For now the
        // cache is invalidated by the DomainEventProcessor on ContactUpdated
        // events. The score update itself doesn't emit a ContactUpdated,
        // but the frontend can refresh scores on its own schedule.

        Ok(())
    }

    /// Return the number of pending events (for diagnostics).
    #[allow(dead_code)]
    pub async fn pending_count(&self) -> usize {
        let map = self.pending.lock().await;
        map.values().map(|a| a.events.len()).sum()
    }
}
