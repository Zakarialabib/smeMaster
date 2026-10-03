// ── Database Module ─────────────────────────────────────────────────────────
// Public API for all database operations.
//
// Pool configuration:
//   - Fixed pool size of 5 (SignSync-proven default)
//   - WAL journal mode for concurrent reads
//   - Foreign keys enforced
//   - 5-second busy timeout
//   - Auto-create database file if missing

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteJournalMode};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;
use log;

// ── Domain modules ───────────────────────────────────────────────────────────

pub mod commands;
pub mod common;
pub mod crypto;
pub mod error;
pub mod migration_rollback;
pub mod tables;
pub mod license;
pub mod change_tracker;

pub mod core;
pub mod mail;
pub mod contacts;
pub mod campaigns;
#[cfg(feature = "local-ai")]
pub mod ai;
pub mod invoicing;
pub mod vault;
pub mod calendar;
pub mod tasks;
pub mod workflows;
pub mod compliance;
pub mod security;
pub mod deliverability;
pub mod migrations;
pub mod seed;

/// Maximum concurrent SQLite connections (fixed pool, proven default).
pub const MAX_POOL_SIZE: u32 = 5;

/// Create the SqlitePool with WAL mode, busy timeout, and foreign keys.
/// Called once during app setup.
pub async fn create_pool(app_data_dir: PathBuf) -> Result<SqlitePool, sqlx::Error> {
    // Ensure the parent directory exists before SQLite tries to create the file
    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        log::warn!("[db] Failed to create app data dir: {e} — file-based DB may fail");
    }
    let db_path = app_data_dir.join("smemaster.db");

    let opts = SqliteConnectOptions::from_str(&db_path.to_string_lossy())?
        .journal_mode(SqliteJournalMode::Wal)   // WAL mode for concurrent reads
        .foreign_keys(true)                      // FK enforcement
        .busy_timeout(Duration::from_secs(5))    // 5s busy timeout
        .create_if_missing(true)                 // auto-create
        .pragma("cache_size", "-64000")          // 64MB page cache (default is -2000 = 2MB)
        .pragma("mmap_size", "268435456")        // 256MB memory-mapped I/O for large DBs
        .pragma("wal_autocheckpoint", "1000");   // checkpoint every 1000 pages (default)

    SqlitePoolOptions::new()
        .max_connections(MAX_POOL_SIZE)
        .acquire_timeout(Duration::from_secs(10))
        .connect_with(opts)
        .await
}

/// Quick health check: runs `SELECT 1` and logs the result.
pub async fn health_check(pool: &SqlitePool) -> Result<(), String> {
    let start = std::time::Instant::now();
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .map_err(|e| format!("DB health check failed: {e}"))?;
    log::info!("[db] Health check OK ({:?})", start.elapsed());
    Ok(())
}

// ── End of db module ─────────────────────────────────────────────────────────
