/**
 * Safe accessors for native Android `@JavascriptInterface` bridges.
 *
 * These bridges bypass Tauri IPC for latency-sensitive WebView ↔ Kotlin calls.
 * They are only available on Android after `MainActivity.onWebViewCreate()` runs.
 * Always check for existence before calling — will return `undefined` on
 * desktop or if the bridge hasn't been injected yet.
 *
 * @module nativeBridges
 */

import type { SplashBridge, HapticsBridge, MainActivityBridge, DeviceInfoBridge, EventRelayBridge } from "@/types/native-bridges";

/** Safe access to the native splash screen dismissal bridge. */
export function getSplashBridge(): SplashBridge | undefined {
  try {
    return window.SplashBridge;
  } catch {
    return undefined;
  }
}

/** Safe access to the native haptic feedback bridge. */
export function getHapticsBridge(): HapticsBridge | undefined {
  try {
    return window.HapticsBridge;
  } catch {
    return undefined;
  }
}

/** Safe access to the native media picker bridge. */
export function getMainActivityBridge(): MainActivityBridge | undefined {
  try {
    return window.MainActivityBridge;
  } catch {
    return undefined;
  }
}

/** Safe access to the native device info bridge (screen metrics, tablet detection). */
export function getDeviceInfoBridge(): DeviceInfoBridge | undefined {
  try {
    return window.DeviceInfoBridge;
  } catch {
    return undefined;
  }
}

/** Safe access to the native event relay bridge (forwards Rust events to Kotlin). */
export function getEventRelayBridge(): EventRelayBridge | undefined {
  try {
    return window.EventRelayBridge;
  } catch {
    return undefined;
  }
}

/**
 * Synchronous, best-effort detection of the Android runtime.
 *
 * Every native @JavascriptInterface bridge above is injected ONLY on
 * Android (after MainActivity.onWebViewCreate()). Their presence is
 * therefore a reliable synchronous Android indicator - no async IPC needed.
 *
 * Used to skip Android-only IPC calls (e.g. close_splashscreen,
 * plugin:share|get_pending_share) on desktop/Web so we don't spam the
 * console with "command/plugin not found" errors at launch.
 */
export function isAndroid(): boolean {
  try {
    return Boolean(
      window.SplashBridge ||
        window.HapticsBridge ||
        window.MainActivityBridge ||
        window.DeviceInfoBridge ||
        window.EventRelayBridge,
    );
  } catch {
    return false;
  }
}
