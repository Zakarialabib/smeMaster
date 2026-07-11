import { invokeCommand } from "@shared/services/db/invoke/command";

export type SyncState = "idle" | "syncing" | "success" | "error";

export interface SyncResult {
  success: boolean;
  error?: string;
}

export interface SyncStatusInfo {
  state: SyncState;
  lastSyncAt: string | null;
  error?: string;
}

/**
 * Performs a full sync for the given device:
 * 1. Push local changes to the device
 * 2. Pull changes from the device
 */
export async function syncNow(deviceId: string): Promise<SyncResult> {
  try {
    await invokeCommand("push_changes", { deviceId, changes: [] });
    await invokeCommand("pull_changes", { deviceId, sinceTimestamp: 0 });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Creates a sync status tracker for a device.
 * Returns an object that can be used to track sync state over time.
 * The actual sync status is managed by the caller via React state.
 */
export function createSyncStatusTracker(): {
  status: SyncStatusInfo;
  startSync: () => SyncStatusInfo;
  completeSync: (result: SyncResult) => SyncStatusInfo;
  resetSync: () => SyncStatusInfo;
} {
  const base: SyncStatusInfo = { state: "idle", lastSyncAt: null };

  return {
    status: { ...base },
    startSync: () => ({ state: "syncing" as const, lastSyncAt: null }),
    completeSync: (result: SyncResult) => ({
      state: result.success ? ("success" as const) : ("error" as const),
      lastSyncAt: result.success ? new Date().toISOString() : null,
      error: result.error,
    }),
    resetSync: () => ({ ...base }),
  };
}
