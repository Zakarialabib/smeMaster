use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A persisted pairing entry representing a previously paired device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingEntry {
    pub device_id: String,
    pub device_name: String,
    pub paired_at: DateTime<Utc>,
    pub public_key: Option<String>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// Returns the path to the pairings JSON file within the given base directory.
fn pairings_path(base_dir: &Path) -> std::path::PathBuf {
    base_dir.join("pairings.json")
}

/// Load all persisted pairing entries from `pairings.json` in the given base directory.
///
/// Returns an empty `Vec` if the file does not exist or cannot be parsed.
pub fn load_pairings(base_dir: &Path) -> Vec<PairingEntry> {
    let path = pairings_path(base_dir);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Save a pairing entry (add if new, update if existing by `device_id`).
///
/// The file is created atomically via a temporary file.
pub fn save_pairing(base_dir: &Path, entry: &PairingEntry) -> Result<(), String> {
    let path = pairings_path(base_dir);
    let mut entries = load_pairings(base_dir);

    // Replace existing entry or push new one
    if let Some(pos) = entries.iter().position(|e| e.device_id == entry.device_id) {
        entries[pos] = entry.clone();
    } else {
        entries.push(entry.clone());
    }

    write_pairings(&path, &entries)
}

/// Remove a pairing entry by `device_id`.
pub fn remove_pairing(base_dir: &Path, device_id: &str) -> Result<(), String> {
    let path = pairings_path(base_dir);
    let mut entries = load_pairings(base_dir);

    entries.retain(|e| e.device_id != device_id);

    write_pairings(&path, &entries)
}

/// Serialize the entries and write to file atomically.
fn write_pairings(path: &std::path::Path, entries: &[PairingEntry]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Atomic write via temp file
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    

    #[test]
    fn test_save_and_load_pairings() {
        let dir = std::env::temp_dir().join("sme_pairing_test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let entry = PairingEntry {
            device_id: "dev_abc123".into(),
            device_name: "TestPhone".into(),
            paired_at: Utc::now(),
            public_key: Some("ssh-rsa AAA...".into()),
            last_seen_at: Some(Utc::now()),
        };

        save_pairing(&dir, &entry).unwrap();
        let loaded = load_pairings(&dir);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].device_id, "dev_abc123");

        let entry2 = PairingEntry {
            device_id: "dev_def456".into(),
            device_name: "TestLaptop".into(),
            paired_at: Utc::now(),
            public_key: None,
            last_seen_at: None,
        };
        save_pairing(&dir, &entry2).unwrap();
        let loaded = load_pairings(&dir);
        assert_eq!(loaded.len(), 2);

        remove_pairing(&dir, "dev_abc123").unwrap();
        let loaded = load_pairings(&dir);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].device_id, "dev_def456");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_load_empty_file() {
        let dir = std::env::temp_dir().join("sme_pairing_empty_test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let loaded = load_pairings(&dir);
        assert!(loaded.is_empty());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
