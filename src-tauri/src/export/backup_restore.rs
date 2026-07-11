// ── Database Backup & Restore ─────────────────────────────────────────────────
//
// Full SQLite database backup using VACUUM INTO for safe online backups,
// and restore with integrity verification.
//
// Backups include an SHA-256 hash stored alongside the backup file for
// integrity verification on restore.

use crate::error::{SerializedError, ERR_FILE_IO, ERR_INVALID_INPUT};
use sqlx::SqlitePool;
use std::path::Path;
use tauri::Manager;

/// Create a full database backup to the given destination directory.
///
/// Uses SQLite's `VACUUM INTO` (available since SQLite 3.27.0) to create a
/// clean, optimised copy of the database without locking out readers. The
/// backup file is named `smemaster_backup_<YYYYMMDD_HHMMSS>.db`.
///
/// After the backup, an SHA-256 integrity hash is computed and stored in a
/// sibling `.sha256` file for verification during restore.
///
/// Returns the full path to the backup file.
pub async fn create_full_backup(
    pool: &SqlitePool,
    destination_dir: &str,
) -> Result<String, SerializedError> {
    if destination_dir.trim().is_empty() {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Destination directory cannot be empty",
        ));
    }

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("smemaster_backup_{}.db", timestamp);
    let backup_path = Path::new(destination_dir).join(&backup_filename);

    // Ensure destination directory exists
    if let Some(parent) = backup_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| {
                SerializedError::new(
                    "BACKUP_FAILED",
                    format!("Failed to create backup directory: {e}"),
                )
            })?;
    }

    // VACUUM INTO requires the filename as a string literal.
    // Escape single quotes by doubling them (SQLite string literal rule).
    let path_str = backup_path.to_string_lossy().replace('\'', "''");
    let vacuum_sql = format!("VACUUM INTO '{}'", path_str);

    sqlx::query(sqlx::AssertSqlSafe(vacuum_sql.as_str()))
        .execute(pool)
        .await
        .map_err(|e| {
            SerializedError::new(
                "BACKUP_FAILED",
                format!("VACUUM INTO failed: {e}"),
            )
        })?;

    // Compute and store integrity hash
    let hash =
        crate::export::scheduler::compute_backup_hash(&backup_path).await?;
    crate::export::scheduler::store_backup_hash(&backup_path, &hash).await?;

    log::info!(
        "[backup] Full database backup created at {:?} ({} bytes)",
        backup_path,
        backup_path
            .metadata()
            .map(|m| m.len())
            .unwrap_or(0)
    );
    Ok(backup_path.to_string_lossy().to_string())
}

/// Restore the database from a backup file.
///
/// # Warning
///
/// This operation **replaces** the current database file. The caller should
/// restart the application after a successful restore so the connection pool
/// is rebuilt against the restored data.
///
/// Before copying, the backup's integrity is verified against the stored
/// SHA-256 hash (if present). Legacy backups without a hash file will be
/// restored with a warning.
pub async fn restore_from_backup(
    pool: &SqlitePool,
    backup_path: &str,
    app_data_dir: &Path,
) -> Result<(), SerializedError> {
    if backup_path.trim().is_empty() {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Backup file path cannot be empty",
        ));
    }

    let backup = Path::new(backup_path);

    // Verify the backup file exists
    if !tokio::fs::try_exists(backup)
        .await
        .unwrap_or(false)
    {
        return Err(SerializedError::new(
            "RESTORE_FAILED",
            format!("Backup file not found: {backup_path}"),
        ));
    }

    // Verify backup integrity (warn-only for legacy backups without hash)
    match crate::export::scheduler::verify_backup_integrity(backup).await {
        Ok(true) => log::info!("[backup] Integrity check passed for {backup_path}"),
        Ok(false) => log::warn!(
            "[backup] No integrity hash found for {backup_path} — restoring legacy backup"
        ),
        Err(e) => return Err(e),
    }

    let db_path = app_data_dir.join("smemaster.db");
    let wal_path = app_data_dir.join("smemaster.db-wal");
    let shm_path = app_data_dir.join("smemaster.db-shm");

    // Close all existing connections so the file can be replaced
    pool.close().await;

    // Remove WAL and SHM files that may reference the old database
    let _ = tokio::fs::remove_file(&wal_path).await;
    let _ = tokio::fs::remove_file(&shm_path).await;

    // Copy the backup over the current database file
    tokio::fs::copy(backup_path, &db_path)
        .await
        .map_err(|e| {
            SerializedError::new(
                "RESTORE_FAILED",
                format!("Failed to copy backup over database: {e}"),
            )
        })?;

    log::info!("[backup] Database successfully restored from {backup_path}");
    Ok(())
}

/// List all SMEMaster backup files in a directory.
///
/// Scans for files matching the pattern `smemaster_backup_*.db` and returns
/// them sorted with the most recent first.
pub async fn list_backup_files(directory: &str) -> Result<Vec<String>, SerializedError> {
    if directory.trim().is_empty() {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Directory cannot be empty",
        ));
    }

    let dir = Path::new(directory);
    let mut read_dir = tokio::fs::read_dir(dir)
        .await
        .map_err(|e| {
            SerializedError::new(
                ERR_FILE_IO,
                format!("Failed to read directory: {e}"),
            )
        })?;

    let mut backups = Vec::new();
    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| {
            SerializedError::new(
                ERR_FILE_IO,
                format!("Failed to read directory entry: {e}"),
            )
        })? {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("db")
            && path
                .file_stem()
                .and_then(|s| s.to_str())
                .map_or(false, |s| s.starts_with("smemaster_backup_"))
        {
            backups.push(path.to_string_lossy().to_string());
        }
    }

    // Most recent first
    backups.sort_by(|a, b| b.cmp(a));
    Ok(backups)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAURI COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

/// Create a full database backup.
#[tauri::command]
pub async fn create_backup(
    pool: tauri::State<'_, SqlitePool>,
    destination_dir: String,
) -> Result<String, SerializedError> {
    if destination_dir.trim().is_empty() {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Destination directory cannot be empty",
        ));
    }
    create_full_backup(pool.inner(), &destination_dir).await
}

/// Restore the database from a backup file.
///
/// The application will restart automatically after the restore completes.
#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    backup_path: String,
) -> Result<(), SerializedError> {
    if backup_path.trim().is_empty() {
        return Err(SerializedError::new(
            ERR_INVALID_INPUT,
            "Backup file path cannot be empty",
        ));
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| {
            SerializedError::new(
                "INTERNAL_ERROR",
                format!("Cannot get app data directory: {e}"),
            )
        })?;

    restore_from_backup(pool.inner(), &backup_path, &app_data_dir).await?;

    // Restart the app so the connection pool is rebuilt against restored data
    log::info!("[backup] Restore complete — restarting application");
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}

/// List all SMEMaster backup files in the given directory.
#[tauri::command]
pub async fn list_backups(directory: String) -> Result<Vec<String>, SerializedError> {
    list_backup_files(&directory).await
}
