use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub struct UpdateTracker {
    data_dir: PathBuf,
    current_version: String,
}

impl UpdateTracker {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let current_version = app.package_info().version.to_string();
        Ok(Self {
            data_dir,
            current_version,
        })
    }

    /// Read the last known version from the app data directory.
    pub fn get_last_version(&self) -> Option<String> {
        let path = self.data_dir.join("last_version.txt");
        if path.exists() {
            fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
        } else {
            None
        }
    }

    /// Persist the current version as the last known version.
    pub fn set_current_version(&self, version: &str) {
        let path = self.data_dir.join("last_version.txt");
        let _ = fs::write(&path, version);
    }

    /// Increment a crash counter file and return the new count.
    /// The counter is reset when `mark_successful_launch` is called.
    /// Note: the panic hook also increments the counter directly (static hook
    /// cannot access UpdateTracker). This method is the programmatic API.
    #[allow(dead_code)]
    pub fn increment_crash_count(&self) -> u32 {
        let path = self.data_dir.join("crash_count.txt");
        let count: u32 = fs::read_to_string(&path)
            .ok()
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(0);
        let new_count = count + 1;
        let _ = fs::write(&path, new_count.to_string());
        new_count
    }

    /// Mark a successful launch: record current version and reset crash counter.
    pub fn mark_successful_launch(&mut self) {
        self.set_current_version(&self.current_version);
        let crash_path = self.data_dir.join("crash_count.txt");
        let _ = fs::write(&crash_path, "0");
        let version_path = self.data_dir.join("last_successful_version.txt");
        let _ = fs::write(&version_path, &self.current_version);
    }

    /// Determine if a rollback is needed: if crash count >= 2, return true.
    pub fn needs_rollback(&self) -> bool {
        let path = self.data_dir.join("crash_count.txt");
        let count: u32 = fs::read_to_string(&path)
            .ok()
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(0);
        count >= 2
    }

    /// Get the version to roll back to (the last successful version).
    pub fn get_rollback_version(&self) -> Option<String> {
        let path = self.data_dir.join("last_successful_version.txt");
        if path.exists() {
            fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
        } else {
            self.get_last_version()
        }
    }
}
