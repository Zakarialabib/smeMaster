/**
 * Settings service — single source of truth for app-wide toggles that
 * must be visible to native code (Android Kotlin / Tauri Rust).
 *
 * Replaces the old `localStorage`-based settings scattered across
 * `MobileSettingsPage`, `AboutTab`, and onboarding flows. The old
 * approach desynced with the native layer (e.g. bg_sync_interval in JS
 * vs the actual WorkManager schedule) and was lost on Android
 * "clear data" / "clear cache" since `localStorage` lives in the WebView.
 *
 * On Tauri (Windows / Android) values flow:
 *   React  ─►  this service  ─►  Tauri command  ─►  sync_prefs.json
 *                                                 (or .onboarding_done flag)
 *
 * On browser dev mode the service falls back to `tauri-plugin-store`
 * (in-memory) via `tauriStoreStorage` so the same code path works
 * everywhere.
 */
import { invokeCommand } from "@shared/services/db/invoke/command";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

// ── Background sync prefs ──────────────────────────────────────────────────

export interface BackgroundSyncPrefs {
  enabled: boolean;
  intervalMins: number;
}

const DEFAULT_BG_SYNC: BackgroundSyncPrefs = { enabled: true, intervalMins: 15 };

/**
 * Read the background-sync preferences. On Tauri this hits the Rust
 * command (which also reads from the file Kotlin may have written).
 * In browser dev mode the localStorage-equivalent store is used.
 */
export async function getBackgroundSyncPrefs(): Promise<BackgroundSyncPrefs> {
  if (typeof window === "undefined") return DEFAULT_BG_SYNC;
  const isTauri =
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  if (isTauri) {
    try {
      const prefs = await invokeCommand<{ enabled: boolean; interval_minutes: number }>(
        "get_background_sync_prefs",
      );
      return {
        enabled: prefs.enabled,
        intervalMins: prefs.interval_minutes,
      };
    } catch {
      return DEFAULT_BG_SYNC;
    }
  }
  const raw = await tauriStoreStorage.getItem("smemaster.bgSync");
  if (!raw) return DEFAULT_BG_SYNC;
  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundSyncPrefs>;
    return { ...DEFAULT_BG_SYNC, ...parsed };
  } catch {
    return DEFAULT_BG_SYNC;
  }
}

/**
 * Persist background-sync prefs and (on Tauri) reschedule the WorkManager
 * job. Replaces the old write to `localStorage` only — Kotlin used to
 * reschedule independently and the two could drift.
 */
export async function setBackgroundSyncPrefs(
  prefs: Partial<BackgroundSyncPrefs>,
): Promise<BackgroundSyncPrefs> {
  const current = await getBackgroundSyncPrefs();
  const next: BackgroundSyncPrefs = {
    enabled: prefs.enabled ?? current.enabled,
    intervalMins: prefs.intervalMins ?? current.intervalMins,
  };
  if (typeof window === "undefined") return next;
  const isTauri =
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  if (isTauri) {
    try {
      await invokeCommand("set_background_sync_prefs", {
        enabled: next.enabled,
        intervalMins: next.intervalMins,
      });
    } catch {
      // ignore — the on-disk file is the source of truth on next read
    }
  } else {
    await tauriStoreStorage.setItem("smemaster.bgSync", JSON.stringify(next));
  }
  return next;
}

/**
 * Reset onboarding flag so the setup wizard appears on next launch.
 * Uses native dialog for confirmation when available.
 * After reset, reloads the app with a brief message delay.
 */
export async function resetOnboarding(): Promise<void> {
  // Remove the companion flag from dual-write storage (covers both
  // tauri-plugin-store and localStorage fallback).
  await tauriStoreStorage.removeItem("smemaster.onboarding.done");

  if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) {
    const { message } = await import("@tauri-apps/plugin-dialog");
    await invokeCommand("db_reset_onboarding", {});
    await message("Onboarding flag cleared. The setup wizard will appear on next launch.", { kind: "info" });
    // Brief delay so the user sees the message, then reload
    await new Promise((r) => setTimeout(r, 1500));
    window.location.reload();
  } else {
    // Fallback for non-Tauri (web preview)
    window.location.reload();
  }
}
