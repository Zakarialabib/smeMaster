import { createBackgroundChecker } from "./backgroundCheckers";
import type { BackgroundChecker } from "./backgroundCheckers";

interface UpdateInfo {
  version: string;
  body: string | null;
}

type UpdateCallback = (update: UpdateInfo) => void;

let checker: BackgroundChecker | null = null;
let availableUpdate: { info: UpdateInfo; raw: unknown } | null = null;
let callback: UpdateCallback | null = null;

// Track if updater plugin is available (disabled in dev builds)
let updaterAvailable = false;

async function checkUpdaterAvailability(): Promise<boolean> {
  try {
    // Attempt to dynamically import - will fail if plugin not built in
    const module = await import("@tauri-apps/plugin-updater");
    return typeof module.check === "function";
  } catch {
    return false;
  }
}

async function performCheck(): Promise<void> {
  // Skip if updater plugin not available
  if (!updaterAvailable) {
    return;
  }

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (update) {
    availableUpdate = {
      info: { version: update.version, body: update.body ?? null },
      raw: update,
    };
    callback?.(availableUpdate.info);
  }
}

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export async function startUpdateChecker(): Promise<void> {
  // Check if updater plugin is available before starting
  updaterAvailable = await checkUpdaterAvailability();
  if (!updaterAvailable) {
    console.debug("[updateManager] Updater plugin not available (disabled in build)");
    return;
  }
  if (checker) return;
  checker = createBackgroundChecker("update-checker", performCheck, FOUR_HOURS);
  checker.start();
}

export function stopUpdateChecker(): void {
  checker?.stop();
  checker = null;
}

export async function checkForUpdateNow(): Promise<UpdateInfo | null> {
  // Check if updater plugin is available
  if (!updaterAvailable) {
    updaterAvailable = await checkUpdaterAvailability();
  }
  if (!updaterAvailable) {
    return null;
  }
  await performCheck();
  return availableUpdate?.info ?? null;
}

export async function installUpdate(): Promise<void> {
  if (!updaterAvailable) {
    throw new Error("Updater plugin not available");
  }
  if (!availableUpdate) throw new Error("No update available");
  const update = availableUpdate.raw as {
    downloadAndInstall: () => Promise<void>;
  };
  await update.downloadAndInstall();
  console.info("Update downloaded. Please restart the application manually.");
}

export function getAvailableUpdate(): UpdateInfo | null {
  return availableUpdate?.info ?? null;
}

export function setUpdateCallback(cb: UpdateCallback | null): void {
  callback = cb;
}

export function _resetForTesting(): void {
  checker?.stop();
  checker = null;
  availableUpdate = null;
  callback = null;
}
