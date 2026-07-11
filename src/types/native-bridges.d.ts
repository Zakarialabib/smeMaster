/**
 * Type declarations for Android Kotlin `@JavascriptInterface` bridges.
 *
 * These bridges are registered in `MainActivity.kt::onWebViewCreate()`
 * and provide low-latency WebView ↔ Kotlin channels that bypass the
 * Tauri IPC (Rust) layer.
 *
 * Access pattern (always safe):
 * ```ts
 * import { getSplashBridge, getHapticsBridge } from "@shared/services/nativeBridges";
 * getSplashBridge()?.onAppReady();
 * ```
 *
 * ⚠️ Bridges are only available after the WebView has been created and
 *    `onWebViewCreate()` has run. Always check for existence before calling.
 */

/** Haptic feedback intensity levels. */
export type HapticIntensity = "light" | "medium" | "heavy";

/**
 * Bridge to the native Android SplashScreen API.
 * Allows React to signal when it's fully mounted so the splash can dismiss.
 */
export interface SplashBridge {
  /** Call when React has finished mounting and the app is ready to display. */
  onAppReady(): void;
}

/**
 * Bridge to the native Android haptic feedback system.
 * Provides tactile feedback for gestures and actions.
 */
export interface HapticsBridge {
  /**
   * Trigger haptic feedback at the specified intensity.
   * @param intensity - "light" | "medium" | "heavy"
   */
  performHaptic(intensity: HapticIntensity): void;
}

/**
 * Bridge to the native Android photo/video picker.
 * Launches the system `PickVisualMedia` intent.
 */
export interface MainActivityBridge {
  /** Open the system media picker (images and videos). */
  openMediaPicker(): void;
}

/**
 * Bridge to the native Android device info / screen metrics.
 * Provides access to Android `Configuration.screenWidthDp`, `screenHeightDp`,
 * and `isTablet()` / `getScreenSizeClass()` derived from `isTablet()` or
 * `smallestScreenWidthDp`.
 */
/**
 * Generic event relay bridge — forwards typed Rust events to Kotlin.
 */
export interface EventRelayBridge {
  onEvent(kind: string, payload: string): void;
}

/**
 * Bridge to the native Android ContactsContract provider.
 * Reads device contacts as a JSON array string.
 */
export interface ContactsBridge {
  /** Fetch all device contacts. Returns JSON array string. */
  fetchContacts(): string;
}

/**
 * Bridge to the native Android CalendarContract provider.
 * Reads device calendar events as a JSON array string.
 */
export interface CalendarBridge {
  /** Fetch all calendar events. Returns JSON array string. */
  fetchCalendarEvents(): string;
}

export interface DeviceInfoBridge {
  /** Screen width in density-independent pixels (dp). */
  getScreenWidthDp(): number;
  /** Screen height in density-independent pixels (dp). */
  getScreenHeightDp(): number;
  /** Whether the device is classified as a tablet (sw >= 600dp). */
  isTablet(): boolean;
  /**
   * Screen size class derived from `smallestScreenWidthDp`:
   * - `"phone"`  → sw < 600dp
   * - `"foldable"` → 600dp ≤ sw < 840dp (including foldable in folded state)
   * - `"tablet"`  → sw ≥ 840dp
   */
  getScreenSizeClass(): "phone" | "foldable" | "tablet";
}

/**
 * Global `Window` augmentation for Kotlin JS bridges.
 * These are injected by `MainActivity.kt` via `addJavascriptInterface`.
 */
declare global {
  interface Window {
    /** Dismiss native splash screen when React is ready. */
    SplashBridge?: SplashBridge;
    /** Trigger haptic feedback on Android devices. */
    HapticsBridge?: HapticsBridge;
    /** Launch the native photo/video picker. */
    MainActivityBridge?: MainActivityBridge;
    /** Access Android screen metrics (dp, tablet classification). */
    DeviceInfoBridge?: DeviceInfoBridge;
    /** Forward typed Rust events to the Kotlin EventRelayBridge. */
    EventRelayBridge?: EventRelayBridge;
    /** Read device contacts via ContactsContract. */
    ContactsBridge?: ContactsBridge;
    /** Read device calendar events via CalendarContract. */
    CalendarBridge?: CalendarBridge;
  }
}
