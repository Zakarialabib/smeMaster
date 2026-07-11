import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAllLabelUnreadCounts } from "@shared/services/db/threads";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
import { subscribeFromManifest } from "@shared/services/events/eventBusMap";

interface SyncState {
  isOnline: boolean;
  pendingOpsCount: number;
  isSyncingFolder: string | null;
  unreadCounts: Record<string, number>;
  isHydrated: boolean;

  setOnline: (online: boolean) => void;
  setPendingOpsCount: (count: number) => void;
  setSyncingFolder: (folder: string | null) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  refreshUnreadCounts: (accountId: string) => Promise<void>;
  handleEvent: (eventType: string, payload: unknown) => void;
  hydrate: () => Promise<void>;
  dehydrate: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: true,
      pendingOpsCount: 0,
      isSyncingFolder: null,
      unreadCounts: {},
      isHydrated: false,

      setOnline: (isOnline) => set({ isOnline }),
      setPendingOpsCount: (pendingOpsCount) => set({ pendingOpsCount }),
      setSyncingFolder: (isSyncingFolder) => set({ isSyncingFolder }),
      setUnreadCounts: (unreadCounts) => set({ unreadCounts }),

      refreshUnreadCounts: async (accountId: string) => {
        try {
          const counts = await getAllLabelUnreadCounts(accountId);
          set({ unreadCounts: counts });
        } catch (err) {
          console.error("Failed to refresh unread counts:", err);
        }
      },

      handleEvent: (eventType, _payload) => {
        switch (eventType) {
          case "sync:started":
            set({ isSyncingFolder: "__all__" });
            break;
          case "sync:complete":
          case "sync:error":
            set({ isSyncingFolder: null });
            break;
          case "rust:init:complete":
            set({ isOnline: true });
            break;
        }
      },

      hydrate: async () => {
        // Online state from navigator
        set({ isOnline: navigator.onLine, isHydrated: true });
      },

      dehydrate: async () => {
        // Persist handled by middleware
      },
    }),
    {
      name: "smemaster.sync",
      storage: createJSONStorage(() => tauriStoreStorage),
      partialize: (state) => ({
        isOnline: state.isOnline,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);

// ── EventBus manifest self-subscription ──────────────────────────────────
// Wires the persist-backed sync store to the typed EventBus manifest so
// that sync lifecycle events update store state automatically.

let _syncEventCleanup: (() => void) | null = null;

/**
 * Subscribe the sync store to its owned events from the EVENT_BUS_MAP.
 *
 * Registers handlers for events owned by `"syncStore"`:
 *   - `sync:started`        → sets syncing folder to `"__all__"`
 *   - `sync:error`          → resets syncing folder to `null`
 *   - `rust:init:complete`  → marks the store as online
 *
 * @returns A cleanup function that removes all registered handlers.
 *
 * @remarks
 * `sync:complete` is owned by `"threadStore"` in the manifest, so it is
 * NOT registered here. During the transition (Step 1) it continues to be
 * dispatched via `App.tsx`'s `useEventBus`. The `handleEvent` method stays
 * on the store for backward compatibility.
 */
export function initSyncStoreEvents(): () => void {
  if (_syncEventCleanup) return _syncEventCleanup;

  _syncEventCleanup = subscribeFromManifest("syncStore", {
    "sync:started": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:started", payload);
    },
    "sync:error": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:error", payload);
    },
    "rust:init:complete": (payload) => {
      useSyncStore.getState().handleEvent?.("rust:init:complete", payload);
    },
  });

  return _syncEventCleanup;
}

// Eagerly initialise in browser environments (module-level side-effect).
// This ensures the store self-subscribes before any React component mounts.
if (typeof window !== "undefined") {
  initSyncStoreEvents();
}
