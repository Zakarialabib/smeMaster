// ═════════════════════════════════════════════════════════════════════════════
// System Commands – Desktop-specific (tray, window state, devtools)
// ═════════════════════════════════════════════════════════════════════════════
//
// This module is only compiled when `cfg(desktop)` is true (macOS / Windows /
// Linux). Each function assumes it runs on a desktop target — no #[cfg] gates
// needed for desktop vs. mobile, though optional feature gates (e.g.
// `feature = "devtools"`) may still appear inline.

use tauri::Manager;

// ─────────────────────────────────────────────────────────────────────────────
// Tray tooltip – desktop only (macOS / Windows / Linux)
// ─────────────────────────────────────────────────────────────────────────────

/// Set the system tray icon tooltip text.
#[tauri::command]
pub fn set_tray_tooltip(app: tauri::AppHandle, tooltip: String) -> Result<(), String> {
    let tray = app
        .tray_by_id(&tauri::tray::TrayIconId::new("main-tray"))
        .ok_or_else(|| "Tray icon not found".to_string())?;
    tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Window state reset – desktop only
// ─────────────────────────────────────────────────────────────────────────────

/// Reset the main window to its default size, position, and resizable state.
#[tauri::command]
pub fn reset_window_state(_app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = _app.get_webview_window("main") {
        let _ = window.set_size(tauri::LogicalSize::new(1200, 800));
        let _ = window.center();
        let _ = window.set_resizable(true);
        let _ = window.unmaximize();
        if let Some(cache_dir) = _app.path().app_cache_dir().ok() {
            let _ = std::fs::remove_file(cache_dir.join(".window-state"));
        }
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// DevTools – behind the "devtools" feature flag (desktop only)
// ─────────────────────────────────────────────────────────────────────────────

/// Open the Developer Tools window for the main WebView.
#[tauri::command]
pub fn open_devtools(app: tauri::AppHandle) {
    #[cfg(feature = "devtools")]
    if let Some(w) = app.get_webview_window("main") {
        println!("[devtools] Opening Developer Tools for main window");
        w.open_devtools();
    }
    #[cfg(not(feature = "devtools"))]
    {
        println!("[devtools] Feature not enabled — rebuild with --features devtools");
        let _ = app;
    }
}
