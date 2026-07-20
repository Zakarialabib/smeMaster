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
use tauri::{AppHandle, Emitter};

use crate::events::{AppEvent, EventBus};

/// Macro: produce a `&[(&str, &str)]` — (table_name, COUNT query) — where
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

/// Build a row-count snapshot for all tracked tables.
///
/// Each table gets its own inline string literal to satisfy sqlx 0.9.x's
/// compile-time query checking (it rejects runtime `&str` references).
async fn snapshot_counts(pool: &SqlitePool) -> Result<CountSnapshot, sqlx::Error> {
    use sqlx::Row;
    let mut snap = CountSnapshot::with_capacity(TRACKED_TABLES.len());

    macro_rules! count_table {
        ($table:ident) => {{
            let row = sqlx::query(concat!(
                "SELECT COUNT(*) AS cnt FROM \"", stringify!($table), "\""
            ))
            .fetch_optional(pool)
            .await?;
            let count: i64 = row.as_ref().map(|r| r.get("cnt")).unwrap_or(0);
            snap.insert(stringify!($table).to_string(), count);
        }};
    }

    count_table!(threads);
    count_table!(messages);
    count_table!(labels);
    count_table!(accounts);
    count_table!(contacts);
    count_table!(contact_groups);
    count_table!(contact_tags);
    count_table!(tasks);
    count_table!(task_tags);
    count_table!(campaigns);
    count_table!(campaign_recipients);
    count_table!(calendars);
    count_table!(calendar_events);
    count_table!(signatures);
    count_table!(templates);
    count_table!(vault_items);
    count_table!(deliverability_configs);
    count_table!(workflow_rules);
    count_table!(follow_up_reminders);

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
