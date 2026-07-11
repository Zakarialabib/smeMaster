import { invokeCommand } from "@shared/services/db/invoke/command";

/** Check if running inside a Tauri webview. */
function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * Check whether the app is set to auto-launch on system startup.
 * On non-Tauri environments, returns `false`.
 */
export async function isAutoLaunchEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invokeCommand<boolean>("is_auto_launch_enabled");
  } catch (err) {
    console.error("Failed to check autolaunch status:", err);
    return false;
  }
}

/**
 * Enable auto-launch on system startup.
 * The app will start minimized to the system tray.
 */
export async function enableAutoLaunch(): Promise<void> {
  if (!isTauri()) {
    console.info("Auto-launch disabled — not in Tauri environment");
    return;
  }
  try {
    await invokeCommand("enable_auto_launch");
  } catch (err) {
    console.error("Failed to enable autolaunch:", err);
  }
}

/**
 * Disable auto-launch on system startup.
 */
export async function disableAutoLaunch(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invokeCommand("disable_auto_launch");
  } catch (err) {
    console.error("Failed to disable autolaunch:", err);
  }
}
