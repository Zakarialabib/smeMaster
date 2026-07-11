// ── CalDAV Background Sync Loop ─────────────────────────────────────────────
//
// Follows the same pattern as `BackgroundSync` (IMAP sync) but is specific to
// CalDAV calendars. Runs as an async background task that periodically calls
// `crate::db::calendar::operations::sync_all_calendars()`.
//
// The loop:
//   1. Reads all provider="caldav" calendars + their account credentials from DB
//   2. For each calendar, sends a CalDAV REPORT to the server
//   3. Parses returned iCalendar data and upserts into calendar_events
//   4. Updates the calendar's sync_token
//
// The task is started via `CaldavSync::start()` and cancelled via
// `CaldavSync::stop()`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::error::SerializedError;

/// Public status of the CalDAV background sync loop.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaldavSyncStatus {
    pub last_sync: Option<i64>,
    pub is_syncing: bool,
    pub last_error: Option<String>,
    pub calendars_synced: usize,
    pub calendars_error: usize,
}

/// Manages the periodic CalDAV sync background task.
pub struct CaldavSync {
    running: Arc<AtomicBool>,
    interval_mins: Arc<std::sync::Mutex<u64>>,
    last_sync: Arc<std::sync::Mutex<Option<i64>>>,
    last_error: Arc<std::sync::Mutex<Option<String>>>,
    last_stats: Arc<std::sync::Mutex<(usize, usize)>>, // (ok, error)
}

impl CaldavSync {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            interval_mins: Arc::new(std::sync::Mutex::new(30)),
            last_sync: Arc::new(std::sync::Mutex::new(None)),
            last_error: Arc::new(std::sync::Mutex::new(None)),
            last_stats: Arc::new(std::sync::Mutex::new((0, 0))),
        }
    }

    /// Start the background sync loop. If already running, updates the interval.
    pub fn start(&self, pool: SqlitePool, interval_mins: u64) {
        *self.interval_mins.lock().unwrap() = interval_mins;

        if self.running.swap(true, Ordering::SeqCst) {
            log::info!(
                "[caldav_sync] loop already running — interval updated to {interval_mins} min"
            );
            return;
        }

        let running = self.running.clone();
        let interval = self.interval_mins.clone();
        let last_sync = self.last_sync.clone();
        let last_error = self.last_error.clone();
        let last_stats = self.last_stats.clone();

        tokio::spawn(async move {
            log::info!("[caldav_sync] background loop started (interval={interval_mins} min)");

            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                let effective_interval = *interval.lock().unwrap();

                log::info!("[caldav_sync] sync tick — starting calendar sync");
                match Self::run_sync(&pool).await {
                    Ok(stats) => {
                        let now = Utc::now().timestamp();
                        *last_sync.lock().unwrap() = Some(now);
                        *last_error.lock().unwrap() = None;
                        *last_stats.lock().unwrap() = stats;
                        log::info!(
                            "[caldav_sync] tick completed: {} ok, {} error",
                            stats.0,
                            stats.1,
                        );
                    }
                    Err(e) => {
                        *last_error.lock().unwrap() = Some(e.to_string());
                        log::error!("[caldav_sync] tick failed: {e}");
                    }
                }

                // Wait for the configured interval before next tick
                tokio::time::sleep(std::time::Duration::from_secs(effective_interval * 60)).await;
            }

            log::info!("[caldav_sync] background loop stopped");
        });
    }

    /// Stop the background sync loop.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[caldav_sync] stop requested");
    }

    /// Return the current status snapshot.
    pub fn status(&self) -> CaldavSyncStatus {
        let (ok, err_count) = *self.last_stats.lock().unwrap();
        CaldavSyncStatus {
            last_sync: *self.last_sync.lock().unwrap(),
            is_syncing: self.running.load(Ordering::SeqCst),
            last_error: self.last_error.lock().unwrap().clone(),
            calendars_synced: ok,
            calendars_error: err_count,
        }
    }

    /// Execute one full sync cycle via `sync_all_calendars`.
    async fn run_sync(pool: &SqlitePool) -> Result<(usize, usize), SerializedError> {
        let summary = crate::db::calendar::operations::sync_all_calendars(pool).await?;
        Ok((summary.synced_ok, summary.synced_error))
    }
}

// ─── Tauri commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_caldav_background_sync(
    app: AppHandle,
    interval_mins: Option<u64>,
) -> Result<CaldavSyncStatus, SerializedError> {
    let pool = app.state::<SqlitePool>().inner().clone();
    let state = app.state::<CaldavSync>().inner();
    let interval = interval_mins.unwrap_or(30);
    state.start(pool, interval);
    Ok(state.status())
}

#[tauri::command]
pub async fn stop_caldav_background_sync(
    app: AppHandle,
) -> Result<CaldavSyncStatus, SerializedError> {
    let state = app.state::<CaldavSync>().inner();
    state.stop();
    Ok(state.status())
}

#[tauri::command]
pub async fn get_caldav_sync_status(
    app: AppHandle,
) -> Result<CaldavSyncStatus, SerializedError> {
    let state = app.state::<CaldavSync>().inner();
    Ok(state.status())
}

/// Trigger a single CalDAV sync cycle immediately (one-shot, non-background).
#[tauri::command]
pub async fn trigger_caldav_sync_now(
    app: AppHandle,
) -> Result<CaldavSyncStatus, SerializedError> {
    let pool = app.state::<SqlitePool>().inner().clone();
    let state = app.state::<CaldavSync>().inner();

    match crate::db::calendar::operations::sync_all_calendars(&pool).await {
        Ok(summary) => {
            log::info!(
                "[caldav_sync] one-shot sync done: {} ok, {} error",
                summary.synced_ok,
                summary.synced_error,
            );
            // Poke status into state so the next status call returns fresh data
            Ok(CaldavSyncStatus {
                last_sync: Some(Utc::now().timestamp()),
                is_syncing: state.status().is_syncing,
                last_error: None,
                calendars_synced: summary.synced_ok,
                calendars_error: summary.synced_error,
            })
        }
        Err(e) => {
            log::error!("[caldav_sync] one-shot sync failed: {e}");
            Ok(CaldavSyncStatus {
                last_sync: None,
                is_syncing: state.status().is_syncing,
                last_error: Some(e.to_string()),
                calendars_synced: 0,
                calendars_error: 0,
            })
        }
    }
}
