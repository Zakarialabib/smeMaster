use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPreferences {
    pub enabled: bool,
    pub interval_minutes: u64,
}

impl Default for SyncPreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_minutes: 15,
        }
    }
}

fn prefs_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    dir.join("sync_prefs.json")
}

#[allow(dead_code)]
pub async fn load_prefs(app: &tauri::AppHandle) -> SyncPreferences {
    let path = prefs_path(app);
    fs::read_to_string(&path)
        .await
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub async fn save_prefs(app: &tauri::AppHandle, prefs: &SyncPreferences) -> Result<(), String> {
    let path = prefs_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(prefs).map_err(|e| e.to_string())?;
    fs::write(&path, &json).await.map_err(|e| e.to_string())
}
