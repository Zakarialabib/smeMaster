// ═════════════════════════════════════════════════════════════════════════════
// System Commands – Cross‑platform system‑level Tauri commands
// ═════════════════════════════════════════════════════════════════════════════
//
// Only truly platform-agnostic functions live here. Platform-specific commands
// have been moved to:
//   - system_android.rs  (biometric, splash screen)  #[cfg(target_os = "android")]
//   - system_desktop.rs  (tray, window, devtools)     #[cfg(desktop)]

use serde::Serialize;
use sysinfo::System;

// ─────────────────────────────────────────────────────────────────────────────
// SystemInfo
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SystemInfo {
    pub hostname: Option<String>,
    pub cpu_usage_percent: f32,
    pub total_memory_mb: u64,
    pub used_memory_mb: u64,
}

/// Returns basic real‑time system metrics.
/// Works on all platforms where sysinfo is supported (desktop + mobile).
#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Average CPU usage over all cores
    let cpu_usage = sys.global_cpu_usage();

    Ok(SystemInfo {
        hostname: System::host_name(),
        cpu_usage_percent: cpu_usage,
        total_memory_mb: sys.total_memory() / 1_048_576,
        used_memory_mb: sys.used_memory() / 1_048_576,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Launch – desktop only (platform-aware via `auto-launch` crate)
// ─────────────────────────────────────────────────────────────────────────────

/// Check whether the app is set to auto-launch on login.
#[tauri::command]
pub async fn is_auto_launch_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    crate::auto_launch::is_enabled(&app).await
}

/// Enable auto-launch — start SMEMaster on user login.
#[tauri::command]
pub async fn enable_auto_launch(app: tauri::AppHandle) -> Result<(), String> {
    crate::auto_launch::enable(&app).await
}

/// Disable auto-launch — remove from startup.
#[tauri::command]
pub async fn disable_auto_launch(app: tauri::AppHandle) -> Result<(), String> {
    crate::auto_launch::disable(&app).await
}
