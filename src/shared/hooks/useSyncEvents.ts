import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSyncStore } from "@shared/stores/syncStore";

interface SyncStatus {
  last_sync: number | null;
  is_syncing: boolean;
  last_error: string | null;
}

export function useSyncEvents() {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    listen<SyncStatus>("sync:started", () => {
      useSyncStore.getState().setSyncingFolder("__all__");
    }).then((fn) => unlisteners.push(fn));

    listen<SyncStatus>("sync:complete", () => {
      useSyncStore.getState().setSyncingFolder(null);
      window.dispatchEvent(new CustomEvent("smemaster-sync-done"));
    }).then((fn) => unlisteners.push(fn));

    listen<SyncStatus>("sync:error", (event) => {
      useSyncStore.getState().setSyncingFolder(null);
      console.error("Sync error:", event.payload.last_error);
    }).then((fn) => unlisteners.push(fn));

    return () => { unlisteners.forEach((fn) => fn()); };
  }, []);
}
