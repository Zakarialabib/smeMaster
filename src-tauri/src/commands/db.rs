// ── Database Tauri Commands ────────────────────────────────────────────────
//
// Thin Tauri command wrappers that delegate to crate::db::tables::* query functions.
// Each command takes State<'_, SqlitePool> as first parameter and returns
// Result<T, SerializedError>.
use std::collections::HashMap;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use sqlx::{Column, Sqlite, SqlitePool, Row, query::Query};
use sqlx::sqlite::SqliteArguments;
use std::sync::OnceLock;
use std::time::Instant;
use crate::db::error::AppDbError;
use crate::error::{SerializedError, ERR_DB, ERR_FILE_IO, ERR_INTERNAL, ERR_INVALID_INPUT};
use crate::services::background_services::{BackgroundServices, ServiceOwnership};

/// Global app start time, set once on first access.
static APP_START: OnceLock<Instant> = OnceLock::new();

/// Set the application start time explicitly. Called once at app startup so the
/// uptime counter doesn't reset on the first invocation of `db_health_stats`.
pub fn set_app_start_time() {
    let _ = APP_START.set(Instant::now());
    log::info!("[startup] App start time recorded");
}

/// Register all database command handlers with the Tauri builder.
/// Keeps only admin/utility commands that are NOT in domain-specific modules.
// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

type CmdResult<T> = Result<T, SerializedError>;

/// Bind a JSON value to a sqlx query with type-aware conversion.
/// Supports null, bool→i64, number (i64/f64), string, and JSON-serialized array/object.
/// Convert JSON object keys from camelCase to snake_case.
/// This bridges the frontend's convention with the database's convention.
fn keys_camel_to_snake(obj: &serde_json::Map<String, serde_json::Value>) -> serde_json::Map<String, serde_json::Value> {
    let mut out = serde_json::Map::with_capacity(obj.len());
    for (k, v) in obj {
        let snake = camel_to_snake(k);
        out.insert(snake, v.clone());
    }
    out
}

/// Single word: CamelCase -> snake_case
fn camel_to_snake(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + 4);
    for (i, ch) in input.char_indices() {
        if ch.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            for lower in ch.to_lowercase() {
                result.push(lower);
            }
        } else {
            result.push(ch);
        }
    }
    result
}

fn bind_json_value<'q>(
    mut q: Query<'q, Sqlite, SqliteArguments>,
    val: &'q serde_json::Value,
) -> Query<'q, Sqlite, SqliteArguments> {
    match val {
        serde_json::Value::Null => { q = q.bind(None::<String>); }
        serde_json::Value::Bool(b) => { q = q.bind(if *b { 1_i64 } else { 0_i64 }); }
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                q = q.bind(i);
            } else if let Some(f) = n.as_f64() {
                q = q.bind(f);
            } else {
                q = q.bind(n.to_string());
            }
        }
        serde_json::Value::String(s) => { q = q.bind(s.clone()); }
        serde_json::Value::Array(a) => { q = q.bind(serde_json::to_string(a).unwrap_or_default()); }
        serde_json::Value::Object(o) => { q = q.bind(serde_json::to_string(o).unwrap_or_default()); }
    }
    q
}

#[derive(Debug, Serialize)]
pub struct UnifiedSearchResult {
    pub table_name: String,
    pub id: String,
    pub label: String,
    pub snippet: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Execute a SELECT query with parameter binding
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_execute_search_query(
    pool: State<'_, SqlitePool>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> CmdResult<Vec<serde_json::Value>> {
    // Validate SQL is SELECT-only (no INSERT/UPDATE/DELETE/DROP/ALTER)
    let trimmed = sql.trim().to_uppercase();
    if !trimmed.starts_with("SELECT") && !trimmed.starts_with("WITH") {
        return Err(SerializedError::from(AppDbError::Validation(
            "Only SELECT queries are allowed".to_string(),
        )));
    }

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql.as_str()));
    for p in &params {
        q = bind_json_value(q, p);
    }
    let rows = q.fetch_all(&*pool).await.map_err(AppDbError::Database)?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let mut map = serde_json::Map::new();
            for column in row.columns() {
                let name = column.name().to_string();
                let name_ref: &str = &name;
                // Try to extract value, preferring string then integer then float
                if let Ok(Some(val)) = row.try_get::<Option<String>, _>(name_ref) {
                    map.insert(name, serde_json::Value::String(val));
                } else if let Ok(Some(val)) = row.try_get::<Option<i64>, _>(name_ref) {
                    map.insert(name, serde_json::Value::Number(val.into()));
                } else if let Ok(Some(val)) = row.try_get::<Option<f64>, _>(name_ref) {
                    if let Some(n) = serde_json::Number::from_f64(val) {
                        map.insert(name, serde_json::Value::Number(n));
                    } else {
                        map.insert(name, serde_json::Value::Null);
                    }
                } else if let Ok(Some(val)) = row.try_get::<Option<bool>, _>(name_ref) {
                    map.insert(name, serde_json::Value::Bool(val));
                } else {
                    map.insert(name, serde_json::Value::Null);
                }
            }
            serde_json::Value::Object(map)
        })
        .collect();

    Ok(result)
}

// ── Generic INSERT OR IGNORE (for seedDb, dev-only) ──

#[cfg(debug_assertions)]
#[tauri::command]
pub async fn db_execute_insert(
    pool: State<'_, SqlitePool>,
    table: String,
    record: serde_json::Value,
) -> CmdResult<()> {
    // Validate table name is alphanumeric (prevent SQL injection)
    if !table.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(SerializedError::from(AppDbError::Validation("Invalid table name".into())));
    }

    let raw_obj = record.as_object()
        .ok_or_else(|| SerializedError::from(AppDbError::Validation("Record must be a JSON object".into())))?;

    // Convert camelCase keys -> snake_case for DB columns
    let obj = keys_camel_to_snake(raw_obj);

    let keys: Vec<&String> = obj.keys().collect();
    if keys.is_empty() {
        return Err(SerializedError::from(AppDbError::Validation("Record must have at least one field".into())));
    }

    let columns: Vec<String> = keys.iter().map(|k| format!("\"{}\"", k)).collect();
    let placeholders: Vec<String> = (0..keys.len()).map(|_| "?".to_string()).collect();

    let sql = format!(
        "INSERT OR IGNORE INTO \"{}\" ({}) VALUES ({})",
        table,
        columns.join(", "),
        placeholders.join(", "),
    );

    let values: Vec<serde_json::Value> = keys.iter().map(|k| obj[k.as_str()].clone()).collect();

    let mut query = sqlx::query(sqlx::AssertSqlSafe(sql.as_str()));
    for val in &values {
        query = bind_json_value(query, val);
    }
    query.execute(&*pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

// ── Unified Search ──

#[tauri::command]
pub async fn db_unified_search(
    pool: State<'_, SqlitePool>,
    query: String,
    account_id: Option<String>,
    limit: Option<i64>,
) -> CmdResult<Vec<UnifiedSearchResult>> {
    let _ = account_id;
    let limit = limit.unwrap_or(20);
    let pattern = format!("%{}%", query);
    let mut results: Vec<UnifiedSearchResult> = Vec::new();

    // Search contacts
    if let Ok(contacts) = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT id, name, primary_email FROM contacts WHERE name LIKE ?1 OR primary_email LIKE ?1 LIMIT ?2"
    ).bind(&pattern).bind(limit).fetch_all(&*pool).await {
        for (id, name, email) in contacts {
            results.push(UnifiedSearchResult {
                table_name: "contacts".to_string(), id, label: name.unwrap_or_default(), snippet: email,
            });
        }
    }

    // Search messages
    if let Ok(msgs) = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT id, subject FROM messages WHERE subject LIKE ?1 LIMIT ?2"
    ).bind(&pattern).bind(limit).fetch_all(&*pool).await {
        for (id, subject) in msgs {
            results.push(UnifiedSearchResult {
                table_name: "messages".to_string(), id, label: subject.unwrap_or_default(), snippet: None,
            });
        }
    }

    results.truncate(limit as usize);
    Ok(results)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN / MISC
// ═══════════════════════════════════════════════════════════════════════════════

// db_run_v56_cleanup was removed. All tables it attempted to drop are
// actively used in Rust code — the cleanup was a bug, not a feature.

/// Re-seed demo data (idempotent — calls crate::db::seed::seed_all).
/// The frontend can call this after db_reset_app to populate the fresh DB.
#[tauri::command]
pub async fn db_reseed_demo(pool: State<'_, SqlitePool>) -> CmdResult<serde_json::Value> {
    let count = crate::db::seed::seed_all(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Re-seed failed: {e}")))?;
    log::info!("[db_reseed] Demo data re-seeded: {count} rows");
    Ok(serde_json::json!({ "seeded": count }))
}

/// Full reset + re-seed: drops all tables, re-runs migrations, then seeds.
/// The existing db_reset_app only drops + migrates; this variant also seeds.
#[tauri::command]
pub async fn db_reset_and_reseed(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
) -> CmdResult<serde_json::Value> {
    // 1. Drop all tables
    crate::db::migrations::drop_all_tables(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to drop tables: {e}")))?;

    // 2. Drop schema version tracking
    sqlx::query("DROP TABLE IF EXISTS _schema_version")
        .execute(&*pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to drop _schema_version: {e}")))?;

    // 3. Re-run all migrations
    crate::db::migrations::run_migrations(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to re-run migrations: {e}")))?;

    // 4. Re-seed demo data
    let count = crate::db::seed::seed_all(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Re-seed failed: {e}")))?;

    // 5. Emit event so frontend can react
    let _ = app.emit("app:reset-complete", ());

    log::info!("[db_reset_and_reseed] App fully reset and re-seeded: {count} rows");
    Ok(serde_json::json!({ "seeded": count }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA WIPE: Delete all data (for Gate 4 data safety)
// ═══════════════════════════════════════════════════════════════════════════════

/// Permanently delete all user data from the database, encryption keys,
/// backups, and cache directories. The app will re-create the database
/// schema on next restart via migrations.
#[tauri::command]
pub async fn db_wipe_all_data(
    app_handle: AppHandle,
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Cannot get app data dir: {e}")))?;

    // ── 1. Drop all database tables ──────────────────────────────────────
    crate::db::migrations::drop_all_tables(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to drop tables: {e}")))?;
    log::info!("[db_wipe] All database tables dropped");

    // ── 2. Remove encryption key file ────────────────────────────────────
    let key_path = app_data_dir.join("smemaster.key");
    if key_path.exists() {
        tokio::fs::remove_file(&key_path)
            .await
            .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to remove key file: {e}")))?;
        log::info!("[db_wipe] Encryption key file removed");
    }

    // ── 3. Remove backup files ───────────────────────────────────────────
    let backups_dir = app_data_dir.join("backups");
    if backups_dir.exists() {
        let mut read_dir = tokio::fs::read_dir(&backups_dir)
            .await
            .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read backups dir: {e}")))?;
        let mut removed = 0u32;
        while let Some(entry) = read_dir
            .next_entry()
            .await
            .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read backup entry: {e}")))? {
            let path = entry.path();
            if entry.file_type().await.map(|ft| ft.is_file()).unwrap_or(false) {
                tokio::fs::remove_file(&path)
                    .await
                    .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to remove backup {path:?}: {e}")))?;
                removed += 1;
            }
        }
        log::info!("[db_wipe] Removed {removed} backup files");
    }

    // ── 4. Clear attachment cache ────────────────────────────────────────
    crate::assets::clear_cache(app_handle.clone())?;
    log::info!("[db_wipe] Attachment cache cleared");

    // ── 5. Clear app cache directory ─────────────────────────────────────
    if let Ok(cache_dir) = app_handle.path().app_cache_dir() {
        if cache_dir.exists() {
            let mut read_dir = tokio::fs::read_dir(&cache_dir)
                .await
                .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read cache dir: {e}")))?;
            let mut removed = 0u32;
            while let Some(entry) = read_dir
                .next_entry()
                .await
                .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read cache entry: {e}")))? {
                let path = entry.path();
                if path.is_dir() {
                    let _ = tokio::fs::remove_dir_all(&path).await;
                } else {
                    let _ = tokio::fs::remove_file(&path).await;
                }
                removed += 1;
            }
            log::info!("[db_wipe] Removed {removed} cache entries");
        }
    }

    // Nota: onboarding flag lives in app_config.is_initialized which is
    // dropped along with all tables above — no file-based flag to clean up.

    log::info!("[db_wipe] All user data wiped successfully");
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING: Reset the onboarding-is-initialized flag
// ═══════════════════════════════════════════════════════════════════════════════

/// Reset the onboarding "is_initialized" flag so the setup wizard is shown
/// on the next launch. This does not affect user data.
#[tauri::command]
pub async fn db_reset_onboarding(
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM app_config WHERE key = 'is_initialized'")
        .execute(pool.inner())
        .await
        .map_err(|e| SerializedError::from(format!("DB error: {e}")))?;

    log::info!("[onboarding] Reset onboarding flag — next launch will show setup wizard");
    Ok(())
}

/// Fully reset the app database: drop all tables, clear the schema version
/// tracking, and re-run all migrations from scratch.
///
/// After this command completes:
/// - All user data is permanently removed
/// - All tables are freshly created
/// - The `is_initialized` flag is absent (onboarding wizard will show)
///
/// This is more aggressive than `db_reset_onboarding` — it destroys ALL data,
/// not just the onboarding flag.
#[allow(dead_code)] // Tauri IPC command — used from frontend via invoke
#[tauri::command]
pub async fn db_reset_app(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    // 1. Drop all user tables (including _schema_version after our change)
    crate::db::migrations::drop_all_tables(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to drop tables: {e}")))?;

    // 2. Ensure _schema_version is also dropped (safety net)
    sqlx::query("DROP TABLE IF EXISTS _schema_version")
        .execute(&*pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to drop _schema_version: {e}")))?;

    // 3. Re-run all migrations from scratch (creates tables fresh)
    crate::db::migrations::run_migrations(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to re-run migrations: {e}")))?;

    // 4. Emit event so frontend can react (e.g., navigate to onboarding)
    let _ = app.emit("app:reset-complete", ());

    log::info!(
        "[db_reset] App fully reset — all tables recreated from scratch, \
         onboarding will show on next relevant navigation"
    );
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND SERVICES: Idempotent lifecycle ownership handover
// ═══════════════════════════════════════════════════════════════════════════════

/// Claim ownership of background services from React.
///
/// Called by the frontend's `useBackgroundServices` hook to confirm that Rust
/// owns the lifecycle of all background services. Idempotent — subsequent
/// calls return `already_running: true`.
///
/// The same idempotent start happens earlier in Tauri's `setup` hook as a
/// safety net, so by the time React calls this, the services are already
/// running on the Rust side.
#[tauri::command]
pub async fn db_init_background_services(
    app: AppHandle,
) -> Result<ServiceOwnership, String> {
    BackgroundServices::ensure_started(&app).await
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH DASHBOARD: DB stats + uptime
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbHealthStats {
    pub db_size_bytes: u64,
    pub wal_size_bytes: u64,
    pub uptime_secs: u64,
    pub pool_size: u32,
    pub pool_active_connections: u32,
    pub pool_max_connections: u32,
    pub cache: HashMap<String, crate::data_cache::cache::CacheStats>,
}

async fn compute_health_stats(
    app: &AppHandle,
    pool: &SqlitePool,
    data_cache: &std::sync::Arc<crate::data_cache::DataCacheService>,
) -> Result<DbHealthStats, SerializedError> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Cannot get app data dir: {e}")))?;

    let db_path = app_data_dir.join("smemaster.db");
    let wal_path = app_data_dir.join("smemaster.db-wal");

    let db_size = tokio::fs::metadata(&db_path).await
        .map(|m| m.len())
        .unwrap_or(0);

    let wal_size = if tokio::fs::try_exists(&wal_path).await.unwrap_or(false) {
        tokio::fs::metadata(&wal_path).await
            .map(|m| m.len())
            .unwrap_or(0)
    } else {
        0
    };

    let uptime_secs = APP_START.get_or_init(|| Instant::now()).elapsed().as_secs();

    // Verify DB is reachable
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("DB unreachable: {e}")))?;

    // Collect connection-pool telemetry. sqlx exposes total size and idle
    // count; active count is derived. Queue depth is not directly available,
    // so we surface max as a reference for saturation math in the UI.
    let pool_size = pool.size() as u32;
    let pool_idle = pool.num_idle() as u32;
    let pool_active_connections = pool_size.saturating_sub(pool_idle);
    let pool_max_connections = crate::db::MAX_POOL_SIZE;

    // Collect cache stats. The service may not be registered if data_cache
    // failed to start — fall back to an empty map so the rest of the
    // response still renders.
    let cache: HashMap<String, crate::data_cache::cache::CacheStats> = data_cache
        .cache()
        .stats()
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();

    Ok(DbHealthStats {
        db_size_bytes: db_size,
        wal_size_bytes: wal_size,
        uptime_secs,
        pool_size,
        pool_active_connections,
        pool_max_connections,
        cache,
    })
}

/// Returns database health statistics including file sizes, app uptime, and
/// per-domain cache hit/miss metrics.
#[tauri::command]
pub async fn db_health_stats(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    data_cache: State<'_, std::sync::Arc<crate::data_cache::DataCacheService>>,
) -> CmdResult<DbHealthStats> {
    compute_health_stats(&app, &pool, &data_cache).await
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS: Per-account sync summary
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSyncStatus {
    pub account_id: String,
    pub email: String,
    pub provider: String,
    pub status: String,
    pub last_sync_at: Option<i64>,
    pub last_error: Option<String>,
    pub folder_count: u32,
    pub message_count: u32,
}

async fn compute_sync_status(pool: &SqlitePool) -> Result<Vec<AccountSyncStatus>, SerializedError> {
    // Inspect schema once to decide which columns exist. This keeps the
    // command robust across migrations where sync_status / last_sync_error
    // may not yet be present.
    let columns: Vec<String> = sqlx::query_scalar::<_, String>("PRAGMA table_info(accounts)")
        .fetch_all(pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to inspect accounts schema: {e}")))?;
    let has_sync_status = columns.iter().any(|c| c == "sync_status");
    let has_last_sync_error = columns.iter().any(|c| c == "last_sync_error");

    // Build a SELECT clause that gracefully handles missing columns.
    let status_expr = if has_sync_status { "a.sync_status" } else { "NULL" };
    let error_expr = if has_last_sync_error { "a.last_sync_error" } else { "NULL" };
    let sql = format!(
        "SELECT a.id, a.email, a.provider, {status_expr}, a.last_sync_at, {error_expr} \
         FROM accounts a ORDER BY a.email",
    );

    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        Option<i64>,
        Option<String>,
    )> = sqlx::query_as(sqlx::AssertSqlSafe(sql.as_str()))
        .fetch_all(pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to query accounts: {e}")))?;

    let mut result = Vec::with_capacity(rows.len());
    for (account_id, email, provider, status, last_sync_at, last_error) in rows {
        let folder_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM folders WHERE account_id = ?")
            .bind(&account_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        let message_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages WHERE account_id = ?")
            .bind(&account_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        result.push(AccountSyncStatus {
            account_id,
            email,
            provider,
            status: status.unwrap_or_else(|| "unknown".to_string()),
            last_sync_at,
            last_error,
            folder_count: folder_count.max(0) as u32,
            message_count: message_count.max(0) as u32,
        });
    }

    Ok(result)
}

/// Returns per-account sync status including folder/message counts.
///
/// The `accounts` table may or may not have `sync_status` / `last_sync_error`
/// columns depending on schema version; the query tolerates both — missing
/// columns are reported as `null` / "unknown" so this command works against
/// any version of the schema.
#[tauri::command]
pub async fn db_sync_status(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<AccountSyncStatus>> {
    compute_sync_status(&pool).await
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP STATE: Everything the frontend needs for first paint
// ═══════════════════════════════════════════════════════════════════════════════

/// Everything the frontend needs to render the first screen without chattiness.
/// Replaces multiple startup invocations (list accounts, labels, threads, sync status)
/// with a single round-trip.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbBootstrapState {
    pub accounts: Vec<crate::db::core::schema::Account>,
    pub labels: Vec<crate::db::mail::schema::Label>,
    pub recent_threads: Vec<crate::db::mail::schema::Thread>,
    pub unread_counts: HashMap<String, i64>,
    pub sync_status: Vec<AccountSyncStatus>,
}

/// Returns a single payload containing all data needed for the first paint.
///
/// The data cache service is pre-warmed on startup, so the hot paths here
/// are already cached. We still run the queries directly because the cache
/// is non-critical and may not have started.
#[tauri::command]
pub async fn db_bootstrap_state(
    pool: State<'_, SqlitePool>,
) -> CmdResult<DbBootstrapState> {
    let accounts = crate::db::tables::core::accounts::get_all(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to load accounts: {e}")))?;

    let mut labels = Vec::new();
    let mut recent_threads = Vec::new();
    let mut unread_counts: HashMap<String, i64> = HashMap::new();

    for account in &accounts {
        // Labels for this account
        match crate::db::tables::core::labels::get_by_account(&pool, &account.id).await {
            Ok(mut account_labels) => labels.append(&mut account_labels),
            Err(e) => log::warn!("[bootstrap] Failed to load labels for {}: {}", account.id, e),
        }

        // Last 50 threads for this account
        let filters = crate::db::commands::ThreadFilters::default();
        match crate::db::tables::core::threads::list(&pool, &account.id, 50, 0, Some(filters)).await {
            Ok(mut threads) => recent_threads.append(&mut threads),
            Err(e) => log::warn!("[bootstrap] Failed to load threads for {}: {}", account.id, e),
        }

        // Unread count for this account
        let unread: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM messages WHERE account_id = ? AND is_read = 0"
        )
        .bind(&account.id)
        .fetch_one(&*pool)
        .await
        .unwrap_or(0);
        unread_counts.insert(account.id.clone(), unread);
    }

    let sync_status = compute_sync_status(&pool).await?;

    Ok(DbBootstrapState {
        accounts,
        labels,
        recent_threads,
        unread_counts,
        sync_status,
    })
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS SNAPSHOT: One IPC call for the 30s polling loop
// ═══════════════════════════════════════════════════════════════════════════════

/// A single snapshot of everything the health/observability UI polls.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatusSnapshot {
    pub health: DbHealthStats,
    pub sync_status: Vec<AccountSyncStatus>,
    pub subsystems: Vec<crate::orchestrator::subsystem_lifecycle::SubsystemStatusSnapshot>,
}

/// Returns a combined status snapshot for the 30s polling loop.
///
/// This replaces three separate IPC calls (`db_health_stats`, `db_sync_status`,
/// `get_subsystem_status`) with one round-trip, reducing chattiness and keeping
/// the observability panel in sync.
#[tauri::command]
pub async fn db_status_snapshot(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    data_cache: State<'_, std::sync::Arc<crate::data_cache::DataCacheService>>,
    registry: State<'_, std::sync::Arc<crate::orchestrator::SubsystemRegistry>>,
) -> CmdResult<DbStatusSnapshot> {
    let health = compute_health_stats(&app, &pool, &data_cache).await?;
    let sync_status = compute_sync_status(&pool).await?;
    let subsystems = registry.get_all_status();

    Ok(DbStatusSnapshot {
        health,
        sync_status,
        subsystems,
    })
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE AVAILABILITY: Explicit "available offline" set
// ═══════════════════════════════════════════════════════════════════════════════

/// A single offline-availability entry.
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct OfflineAvailabilityEntry {
    pub id: String,
    pub account_id: String,
    pub folder_id: Option<String>,
    pub contact_id: Option<String>,
    pub reason: String,
    pub enabled: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Set or update an offline-availability entry.
#[tauri::command]
pub async fn db_set_offline_available(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    folder_id: Option<String>,
    contact_id: Option<String>,
    reason: String,
    enabled: bool,
) -> CmdResult<()> {
    sqlx::query(
        "INSERT INTO offline_availability (id, account_id, folder_id, contact_id, reason, enabled, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, unixepoch()) \
         ON CONFLICT(id) DO UPDATE SET \
         folder_id = excluded.folder_id, \
         contact_id = excluded.contact_id, \
         reason = excluded.reason, \
         enabled = excluded.enabled, \
         updated_at = unixepoch()"
    )
    .bind(&id)
    .bind(&account_id)
    .bind(&folder_id)
    .bind(&contact_id)
    .bind(&reason)
    .bind(if enabled { 1 } else { 0 })
    .execute(&*pool)
    .await
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to set offline availability: {e}")))?;
    Ok(())
}

/// Remove an offline-availability entry.
#[tauri::command]
pub async fn db_remove_offline_available(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM offline_availability WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to remove offline availability: {e}")))?;
    Ok(())
}

/// List all offline-availability entries for an account, or all entries if account_id is omitted.
#[tauri::command]
pub async fn db_list_offline_available(
    pool: State<'_, SqlitePool>,
    account_id: Option<String>,
) -> CmdResult<Vec<OfflineAvailabilityEntry>> {
    let entries: Vec<OfflineAvailabilityEntry> = if let Some(account_id) = account_id {
        sqlx::query_as(
            "SELECT * FROM offline_availability WHERE account_id = ? ORDER BY updated_at DESC"
        )
        .bind(&account_id)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as(
            "SELECT * FROM offline_availability ORDER BY updated_at DESC"
        )
        .fetch_all(&*pool)
        .await
    }
    .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to list offline availability: {e}")))?;
    Ok(entries)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT LOGS: Write in-memory log buffer to a text file
// ═══════════════════════════════════════════════════════════════════════════════

/// Exports all in-memory log entries to a formatted text file at the given destination.
#[tauri::command]
pub async fn db_export_logs(
    destination: String,
) -> CmdResult<()> {
    use crate::commands::logging::get_logs;

    let logs = get_logs(None)?;

    let mut content = String::new();
    content.push_str("SMEMaster Log Export\n");
    content.push_str(&format!(
        "Exported at: {}\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ));
    content.push_str(&format!("Total entries: {}\n", logs.len()));
    content.push_str(&"─".repeat(80));
    content.push('\n');
    content.push('\n');

    for log in logs.iter().rev() {
        let level = match log.level {
            crate::commands::logging::LogLevel::Debug => "DEBUG",
            crate::commands::logging::LogLevel::Info  => "INFO",
            crate::commands::logging::LogLevel::Warn  => "WARN",
            crate::commands::logging::LogLevel::Error => "ERROR",
        };
        let timestamp = log.timestamp.format("%Y-%m-%d %H:%M:%S%.3f");
        content.push_str(&format!(
            "[{}] [{}] [{}] {}\n",
            timestamp, level, log.category, log.message
        ));
        if let Some(ref data) = log.data {
            if let Ok(json) = serde_json::to_string_pretty(data) {
                for line in json.lines() {
                    content.push_str(&format!("  {}\n", line));
                }
            }
        }
        content.push('\n');
    }

    tokio::fs::write(&destination, &content).await
        .map_err(SerializedError::from)?;

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedMigration {
    pub version: i64,
    pub name: String,
    pub checksum: String,
}

/// Get the list of applied migrations in reverse order (most recent first).
#[tauri::command]
pub async fn db_get_migration_history(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AppliedMigration>, SerializedError> {
    let rows = crate::db::migration_rollback::get_applied_migrations(pool.inner())
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Failed to get migration history: {e}")))?;

    Ok(rows
        .into_iter()
        .map(|(version, name, checksum)| AppliedMigration {
            version,
            name,
            checksum,
        })
        .collect())
}

/// Rollback the last N migrations.
///
/// This command requires down-migration SQL files to be present.
/// The migrations directory is resolved from the app's resource directory.
#[tauri::command]
pub async fn db_rollback_migrations(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    count: i64,
) -> Result<Vec<String>, SerializedError> {
    if count <= 0 {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Rollback count must be greater than 0",
        ));
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| {
            SerializedError::new(
                ERR_INTERNAL,
                format!("Cannot get app data directory: {e}"),
            )
        })?;

    // Resolve the migrations directory (look in several locations)
    let migrations_dir = crate::db::migration_rollback::resolve_migrations_dir(&app_data_dir);

    if !migrations_dir.exists() {
        return Err(SerializedError::new(
            ERR_FILE_IO,
            format!(
                "Migrations directory not found at: {}",
                migrations_dir.display()
            ),
        ));
    }

    log::info!(
        "[migrate] Rolling back {count} migration(s) using directory: {}",
        migrations_dir.display()
    );

    let reverted = crate::db::migration_rollback::rollback_n(pool.inner(), count, &migrations_dir)
        .await?;

    Ok(reverted)
}
