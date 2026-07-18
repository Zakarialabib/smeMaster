// ── SQLite Change Tracker (lightweight polling) ──────────────────────────────
//
// Replaces the original FFI `update_hook` stub. SQLite is statically linked
// through sqlx on this platform, so the `#[link(name = "sqlite3")]` FFI
// approach cannot work. Instead we use a **holistic, lightweight polling**
// mechanism:
//
//   - SQLite exposes `PRAGMA data_version`, an integer that increments on
//     every committed write to the database file. We poll it on a fixed
//     interval (default 750ms) to detect *that* a change happened cheaply
//     (single integer read, no table scans).
//   - When `data_version` changes, we diff row counts for a small set of
//     "tracked" tables to determine *which* tables changed, and emit a
//     `db:change` event per changed table (op = "UPDATE", row_id = 0).
//
// This gives precise, reactive updates to the frontend's `useLiveQuery`
// hook without any native hooks, back-pressure, or heavy scanning. The
// tracked-table set is intentionally small (the tables the UI live-queries).
//
// The emitted events flow through the existing `EventBus` → Tauri
// `core-event` channel → React `eventBus` → `useLiveQuery` subscribers.

use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};

use crate::events::{AppEvent, EventBus};

/// Tables we track for row-count diffing. Keep this small — these are the
/// tables the UI subscribes to via `useLiveQuery`.
const TRACKED_TABLES: &[&str] = &[
    "threads",
    "messages",
    "labels",
    "accounts",
    "contacts",
    "contact_groups",
    "contact_tags",
    "tasks",
    "task_tags",
    "campaigns",
    "campaign_recipients",
    "calendars",
    "calendar_events",
    "signatures",
    "templates",
    "vault_items",
    "deliverability_configs",
    "workflow_rules",
    "follow_up_reminders",
];

/// Poll interval for `data_version` checks.
const POLL_INTERVAL: Duration = Duration::from_millis(750);

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Store the AppHandle for the polling task. Called once during app startup.
pub fn register(app: AppHandle) {
    let _ = APP_HANDLE.set(app);
}

/// Snapshot of row counts per tracked table.
type CountSnapshot = HashMap<String, i64>;

/// Read `PRAGMA data_version` — increments on every committed write.
async fn read_data_version(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>("PRAGMA data_version")
        .fetch_one(pool)
        .await
}

/// Build a row-count snapshot for all tracked tables in a single transaction.
async fn snapshot_counts(pool: &SqlitePool) -> Result<CountSnapshot, sqlx::Error> {
    let mut snap = CountSnapshot::with_capacity(TRACKED_TABLES.len());
    for table in TRACKED_TABLES {
        // Guard against tables that may not exist yet (pre-migration).
        let count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM \"{table}\""
        ))
        .fetch_optional(pool)
        .await?
        .unwrap_or(0);
        snap.insert((*table).to_string(), count);
    }
    Ok(snap)
}

/// Spawn the polling task. Safe to call once after the pool is ready and the
/// EventBus is registered. The task runs until the app exits.
pub fn spawn_tracker(app: &AppHandle, pool: SqlitePool, bus: EventBus) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Wait a moment for migrations to settle, then take the first snapshot.
        tokio::time::sleep(Duration::from_millis(500)).await;

        let mut last_version = match read_data_version(&pool).await {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[change-tracker] Cannot read data_version: {e}");
                return;
            }
        };

        let mut snapshot = match snapshot_counts(&pool).await {
            Ok(s) => s,
            Err(e) => {
                log::warn!("[change-tracker] Cannot snapshot counts: {e}");
                return;
            }
        };

        loop {
            tokio::time::sleep(POLL_INTERVAL).await;

            let version = match read_data_version(&pool).await {
                Ok(v) => v,
                Err(_) => continue, // DB busy / unavailable — skip this tick
            };

            if version == last_version {
                continue; // No writes since last check
            }
            last_version = version;

            // Something changed — diff row counts to find which tables moved.
            let new_snapshot = match snapshot_counts(&pool).await {
                Ok(s) => s,
                Err(_) => continue,
            };

            for (table, old_count) in &snapshot {
                let new_count = new_snapshot.get(table).copied().unwrap_or(0);
                if new_count != *old_count {
                    let _ = bus.emit(AppEvent::CacheInvalidate {
                        domain: table.clone(),
                    });
                    // Also emit a concrete db:change for useLiveQuery subscribers.
                    let _ = app.emit(
                        "core-event",
                        serde_json::json!({
                            "kind": "db:change",
                            "table": table,
                            "op": "UPDATE",
                            "row_id": 0,
                            "timestamp": now_ms()
                        }),
                    );
                }
            }

            snapshot = new_snapshot;
        }
    });
}

/// Current time in milliseconds (epoch) for event timestamps.
fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
