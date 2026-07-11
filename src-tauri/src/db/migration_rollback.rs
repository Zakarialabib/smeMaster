// ── Migration Rollback Support ──────────────────────────────────────────────
//
// Each migration can have an optional down.sql counterpart that reverts it.
// This module tracks applied migrations and supports reverting the last N.
//
// The tracking table `_migrations_applied` records every successfully applied
// migration along with its version, name, and an SHA-256 checksum of the
// migration SQL for auditability.

use crate::error::SerializedError;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

/// Create the `_migrations_applied` tracking table if it doesn't exist.
///
/// This table is separate from `_schema_version` (which tracks the current
/// version number) — it maintains a full audit log of every applied migration
/// including the migration name and checksum.
pub async fn ensure_tracking_table(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations_applied (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now')),
            name TEXT NOT NULL,
            checksum TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Record a migration as successfully applied.
///
/// Uses `INSERT OR REPLACE` so that replaying a migration (e.g. during
/// force-rebuild) updates the existing record rather than failing.
pub async fn record_migration(
    pool: &SqlitePool,
    version: i64,
    name: &str,
    checksum: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO _migrations_applied (version, name, checksum) VALUES (?, ?, ?)",
    )
    .bind(version)
    .bind(name)
    .bind(checksum)
    .execute(pool)
    .await?;
    Ok(())
}

/// Get the list of applied migrations in reverse order (most recent first).
///
/// Returns `(version, name, checksum)` tuples.
pub async fn get_applied_migrations(
    pool: &SqlitePool,
) -> Result<Vec<(i64, String, String)>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT version, name, checksum FROM _migrations_applied ORDER BY version DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Compute the SHA-256 checksum of a migration SQL string.
pub fn compute_checksum(sql: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sql.as_bytes());
    hex::encode(hasher.finalize())
}

/// Remove a migration from the tracking table (used after successful rollback).
async fn remove_migration_record(pool: &SqlitePool, version: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM _migrations_applied WHERE version = ?")
        .bind(version)
        .execute(pool)
        .await?;
    Ok(())
}

/// Remove a version from the `_schema_version` table (used after rollback).
async fn remove_schema_version(pool: &SqlitePool, version: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM _schema_version WHERE version = ?")
        .bind(version)
        .execute(pool)
        .await?;
    Ok(())
}

/// Backfill `_migrations_applied` from `_schema_version` for existing databases
/// that were migrated before this tracking system was introduced.
///
/// For each version present in `_schema_version` that is missing from
/// `_migrations_applied`, an entry is inserted using the provided migration list.
///
/// The `migrations` parameter is a slice of `(name, sql)` tuples matching the
/// `MIGRATIONS` constant in `db::migrations`.
pub async fn backfill_from_schema_version(
    pool: &SqlitePool,
    migrations: &[(&str, &str)],
) -> Result<(), sqlx::Error> {
    // Get all versions from _schema_version
    let schema_versions: Vec<i64> =
        sqlx::query_scalar("SELECT version FROM _schema_version ORDER BY version")
            .fetch_all(pool)
            .await?;

    if schema_versions.is_empty() {
        return Ok(());
    }

    // Get already recorded versions
    let recorded: Vec<i64> =
        sqlx::query_scalar("SELECT version FROM _migrations_applied ORDER BY version")
            .fetch_all(pool)
            .await?;

    for version in &schema_versions {
        if recorded.contains(version) {
            continue;
        }

        let idx = (*version - 1) as usize;
        let (name, sql) = if idx < migrations.len() {
            migrations[idx]
        } else {
            ("unknown", "")
        };

        let checksum = compute_checksum(sql);
        record_migration(pool, *version, name, &checksum).await?;
    }

    log::info!(
        "[migrate] Backfilled {} migration records from _schema_version",
        schema_versions.len().saturating_sub(recorded.len())
    );
    Ok(())
}

/// Rollback the last `n` migrations.
///
/// For each migration being rolled back, this function:
/// 1. Looks for a down-migration file at `{migrations_dir}/{version}_down.sql`
/// 2. If found, executes the down SQL to revert the schema/data changes
/// 3. Removes the version from `_migrations_applied` and `_schema_version`
///
/// Returns a list of human-readable descriptions of reverted migrations.
///
/// # Errors
///
/// Returns `ROLLBACK_FAILED` if:
/// - No down-migration file exists for a migration
/// - The down SQL fails to execute
pub async fn rollback_n(
    pool: &SqlitePool,
    n: i64,
    migrations_dir: &Path,
) -> Result<Vec<String>, SerializedError> {
    if n <= 0 {
        return Ok(Vec::new());
    }

    let applied = get_applied_migrations(pool)
        .await
        .map_err(|e| SerializedError::new("ROLLBACK_FAILED", e.to_string()))?;

    let to_rollback: Vec<_> = applied.iter().take(n as usize).collect();

    if to_rollback.is_empty() {
        return Err(SerializedError::new(
            "ROLLBACK_FAILED",
            "No migrations to roll back".to_string(),
        ));
    }

    let mut reverted = Vec::new();

    for (version, name, _checksum) in &to_rollback {
        let down_filename = format!("{}_down.sql", version);
        let down_path = migrations_dir.join(&down_filename);

        if !down_path.exists() {
            return Err(SerializedError::new(
                "ROLLBACK_FAILED",
                format!(
                    "No down migration found for v{} ({}) — expected at: {}",
                    version,
                    name,
                    down_path.display()
                ),
            ));
        }

        let down_sql = std::fs::read_to_string(&down_path).map_err(|e| {
            SerializedError::new(
                "ROLLBACK_FAILED",
                format!("Failed to read down migration file {}: {e}", down_path.display()),
            )
        })?;

        // Execute the down migration
        sqlx::raw_sql(sqlx::AssertSqlSafe(down_sql.as_str()))
            .execute(pool)
            .await
            .map_err(|e| {
                SerializedError::new(
                    "ROLLBACK_FAILED",
                    format!("Down migration v{version} ({name}) failed: {e}"),
                )
            })?;

        // Remove from tracking tables
        remove_migration_record(pool, *version)
            .await
            .map_err(|e| {
                SerializedError::new(
                    "ROLLBACK_FAILED",
                    format!("Failed to remove v{version} from tracking: {e}"),
                )
            })?;

        remove_schema_version(pool, *version)
            .await
            .map_err(|e| {
                SerializedError::new(
                    "ROLLBACK_FAILED",
                    format!("Failed to remove v{version} from schema version: {e}"),
                )
            })?;

        reverted.push(format!("v{}: {}", version, name));
        log::info!("[migrate] Rolled back v{} ({})", version, name);
    }

    Ok(reverted)
}

/// Attempt to find the migrations directory relative to the given base path.
///
/// Searches in order:
/// 1. `{base}/migrations/`
/// 2. `{base}/../db/migrations/` (during development from commands module)
/// 3. `./migrations/` (current working directory)
pub fn resolve_migrations_dir(base: &Path) -> PathBuf {
    let candidates = [
        base.join("migrations"),
        base.join("..").join("db").join("migrations"),
        Path::new(".").join("migrations"),
    ];

    for candidate in &candidates {
        if candidate.join("001_core.sql").exists() {
            return candidate.to_path_buf();
        }
    }

    // Fall back to the first candidate
    candidates[0].to_path_buf()
}
