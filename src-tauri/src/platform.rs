use tauri::{Builder, Wry};

/// Register all command handlers with the Tauri builder.
///
/// NOTE: This module's #[tauri::command] functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// Each module's `register()` is now a no-op pass-through because
/// Tauri v2 keeps only the LAST `invoke_handler(...)` call — calling
/// it here would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

#[derive(serde::Serialize)]
pub struct PlatformInfo {
    pub mobile: bool,
    pub desktop: bool,
    pub os: String,
    pub arch: String,
    pub is_tablet: bool,
    pub is_phone: bool,
}

#[tauri::command]
pub fn get_platform() -> PlatformInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    #[cfg(target_os = "android")]
    let mobile = true;
    #[cfg(not(target_os = "android"))]
    let mobile = false;

    #[cfg(target_os = "android")]
    let desktop = false;
    #[cfg(not(target_os = "android"))]
    let desktop = true;

    // Detect tablet vs phone on Android
    #[cfg(target_os = "android")]
    let is_tablet = false; // False by default (Android WebView can't detect screen size at Rust compile time)
    #[cfg(not(target_os = "android"))]
    let is_tablet = false;

    let is_phone = mobile && !is_tablet;

    PlatformInfo { mobile, desktop, os, arch, is_tablet, is_phone }
}
