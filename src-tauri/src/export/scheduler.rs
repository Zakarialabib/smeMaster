use crate::error::{SerializedError, ERR_FILE_IO, ERR_INVALID_INPUT, ERR_DB_CORRUPT};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::fs;
use tokio::sync::RwLock;

/// Configuration for the automatic backup scheduler.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    /// Whether the backup scheduler is enabled.
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Interval between backup ticks in seconds (default: 86400 = 24h).
    #[serde(default = "default_interval")]
    pub interval_secs: u64,
    /// Number of backup files to retain (default: 7). Older files are pruned.
    #[serde(default = "default_retention")]
    pub retention_count: usize,
    /// Destination directory for backup files. If None, only emits the event.
    pub destination_path: Option<String>,
}

fn default_enabled() -> bool {
    true
}
fn default_interval() -> u64 {
    86400
}
fn default_retention() -> usize {
    7
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_secs: 86400,
            retention_count: 7,
            destination_path: None,
        }
    }
}

/// Thread-safe shared access to `BackupConfig`.
pub type SharedBackupConfig = Arc<RwLock<BackupConfig>>;

/// Spawn the backup scheduler loop.
///
/// Reads the shared config on each tick, emits `backup-tick` events, and
/// enforces the retention policy when a destination path is configured.
pub fn run_backup_scheduler(app: AppHandle, config: SharedBackupConfig) {
    tokio::spawn(async move {
        log::info!("[backup] Scheduler started");

        loop {
            let cfg = config.read().await;
            let interval = cfg.interval_secs;
            let enabled = cfg.enabled;
            let retention = cfg.retention_count;
            let dest = cfg.destination_path.clone();
            drop(cfg);

            if enabled {
                log::info!("[backup] Running scheduled backup tick");
                let _ = app.emit("backup-tick", ());

                // Enforce retention policy if a destination is configured
                if let Some(ref path) = dest {
                    if let Err(e) = enforce_retention(path, retention).await {
                        log::warn!("[backup] Retention enforcement failed: {e}");
                    }
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
        }
    });
}

/// Delete the oldest files in the destination directory beyond `retention_count`.
async fn enforce_retention(path: &str, retention_count: usize) -> Result<(), SerializedError> {
    let dir = Path::new(path);
    match fs::metadata(dir).await {
        Ok(meta) if meta.is_dir() => enforce_retention_in_dir(dir, retention_count).await,
        _ => {
            // If it's a file or doesn't exist, use its parent directory
            let parent = dir
                .parent()
                .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "Invalid destination path"))?;
            enforce_retention_in_dir(parent, retention_count).await
        }
    }
}

async fn enforce_retention_in_dir(dir: &Path, retention_count: usize) -> Result<(), SerializedError> {
    let mut read_dir = fs::read_dir(dir)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read backup directory: {e}")))?;

    let mut entries = Vec::new();
    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read entry: {e}")))?
    {
        let ft = entry
            .file_type()
            .await
            .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to get file type: {e}")))?;
        if ft.is_file() {
            let modified = entry
                .metadata()
                .await
                .ok()
                .and_then(|m| m.modified().ok());
            entries.push((entry, modified));
        }
    }

    // Sort by modification time (oldest first)
    entries.sort_by_key(|(_, modified)| *modified);

    if entries.len() <= retention_count {
        return Ok(());
    }

    let to_remove = entries.len() - retention_count;
    for (entry, _) in entries.iter().take(to_remove) {
        let path = entry.path();
        if let Err(e) = fs::remove_file(&path).await {
            log::warn!("[backup] Failed to remove old backup {:?}: {e}", path);
        } else {
            log::info!("[backup] Removed old backup {:?}", path);
        }
    }

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/// Compute SHA-256 hash of a backup file and store it alongside the backup
/// as a `<filename>.sha256` file. Returns the hex-encoded hash.
pub async fn compute_backup_hash(backup_path: &Path) -> Result<String, SerializedError> {
    let mut file = fs::File::open(backup_path)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to open backup file: {e}")))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536]; // 64KB read buffer
    loop {
        use tokio::io::AsyncReadExt;
        let bytes_read = file
            .read(&mut buffer)
            .await
            .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read backup file: {e}")))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let hash = hex::encode(hasher.finalize());
    Ok(hash)
}

/// Store the SHA-256 hash of a backup file in a sibling `.sha256` file.
pub async fn store_backup_hash(backup_path: &Path, hash: &str) -> Result<(), SerializedError> {
    let hash_path = backup_path.with_extension("sha256");
    fs::write(&hash_path, hash)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to write hash file: {e}")))?;
    log::info!("[backup] Hash stored at {:?}", hash_path);
    Ok(())
}

/// Verify the integrity of a backup file by comparing its SHA-256 hash
/// against the stored `<filename>.sha256` file.
///
/// Returns:
/// - `Ok(true)` if the hash file exists and the hashes match.
/// - `Ok(false)` if the hash file is missing (legacy backup without hash).
/// - `Err(...)` if the hash file exists but the hash does not match (corruption).
pub async fn verify_backup_integrity(backup_path: &Path) -> Result<bool, SerializedError> {
    let hash_path = backup_path.with_extension("sha256");

    // If no hash file exists, this is a legacy backup — can't verify
    if !hash_path.exists() {
        log::warn!("[backup] No hash file found for {:?} — legacy backup, skipping integrity check", backup_path);
        return Ok(false);
    }

    // Read the stored hash
    let stored_hash = fs::read_to_string(&hash_path)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to read hash file: {e}")))?;
    let stored_hash = stored_hash.trim().to_lowercase();

    // Compute the current hash
    let computed_hash = compute_backup_hash(backup_path).await?;

    if stored_hash == computed_hash {
        log::info!("[backup] Integrity check passed for {:?}", backup_path);
        Ok(true)
    } else {
        log::error!(
            "[backup] INTEGRITY CHECK FAILED for {:?}: stored={}, computed={}",
            backup_path, stored_hash, computed_hash
        );
        Err(SerializedError::new(
            ERR_DB_CORRUPT,
            format!(
                "Backup file integrity check failed: stored hash {}, computed hash {}",
                stored_hash, computed_hash
            ),
        ))
    }
}

// ─── Tauri commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_backup_config(
    config: State<'_, SharedBackupConfig>,
) -> Result<BackupConfig, SerializedError> {
    Ok(config.read().await.clone())
}

#[tauri::command]
pub async fn set_backup_config(
    config: State<'_, SharedBackupConfig>,
    new_config: BackupConfig,
) -> Result<(), SerializedError> {
    *config.write().await = new_config;
    log::info!("[backup] Configuration updated");
    Ok(())
}

#[tauri::command]
pub async fn toggle_backup(
    config: State<'_, SharedBackupConfig>,
    enabled: bool,
) -> Result<(), SerializedError> {
    config.write().await.enabled = enabled;
    log::info!("[backup] Toggled enabled={}", enabled);
    Ok(())
}
