use std::path::Path;

use tokio::fs;

use crate::error::SerializedError;

use super::sync_types::SyncLog;

/// Load the persisted sync log from `sync_log.json` in the given base directory.
///
/// Returns a default `SyncLog` if the file does not exist or cannot be parsed.
pub async fn load_sync_log(base_dir: &Path) -> Result<SyncLog, SerializedError> {
    let path = base_dir.join("sync_log.json");
    if !fs::try_exists(&path).await? {
        return Ok(SyncLog::default());
    }
    let data = fs::read_to_string(&path).await?;
    serde_json::from_str(&data).map_err(SerializedError::from)
}

/// Persist the sync log to `sync_log.json` atomically via a temporary file.
pub async fn save_sync_log(base_dir: &Path, log: &SyncLog) -> Result<(), SerializedError> {
    let path = base_dir.join("sync_log.json");
    let json = serde_json::to_string_pretty(log)?;

    // Ensure parent directory exists
    fs::create_dir_all(base_dir).await?;

    // Atomic write via temp file
    let tmp_path = base_dir.join("sync_log.json.tmp");
    fs::write(&tmp_path, &json).await?;
    fs::rename(&tmp_path, &path).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::device::sync_types::ChangeKind;

    #[tokio::test]
    async fn test_save_and_load_sync_log() {
        let dir = std::env::temp_dir().join("sme_sync_log_test");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let mut log = SyncLog::default();
        log.add_change("dev_abc", ChangeKind::EmailFlagRead("thread_1".into()), r#"{"read":true}"#);
        log.add_change("dev_abc", ChangeKind::EmailArchived("thread_2".into()), r#"{"archived":true}"#);

        save_sync_log(&dir, &log).await.unwrap();

        let loaded = load_sync_log(&dir).await.unwrap();
        assert_eq!(loaded.changes.len(), 2);
        assert_eq!(loaded.changes[0].device_id, "dev_abc");

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn test_load_empty_sync_log() {
        let dir = std::env::temp_dir().join("sme_sync_log_empty_test");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let loaded = load_sync_log(&dir).await.unwrap();
        assert!(loaded.changes.is_empty());
        assert!(loaded.last_sync_per_device.is_empty());

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
