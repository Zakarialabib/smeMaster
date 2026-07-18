import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAllLabelUnreadCounts } from "@shared/services/db/threads";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
import { subscribeFromManifest } from "@shared/services/events/eventBusMap";

type PerAccountSyncStatus = "idle" | "syncing" | "error";

interface PerAccountSyncState {
  status: PerAccountSyncStatus;
  lastSyncAt: number | null;
  error: string | null;
}

interface SyncState {
  isOnline: boolean;
  pendingOpsCount: number;
  isSyncingFolder: string | null;
  unreadCounts: Record<string, number>;
  isHydrated: boolean;

  /** Holistic sync lifecycle flags. */
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Per-account sync status, keyed by account id. */
  perAccount: Record<string, PerAccountSyncState>;

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
      isSyncing: false,
      lastSyncAt: null,
      lastError: null,
      perAccount: {},

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

      handleEvent: (eventType, payload) => {
        switch (eventType) {
          case "sync:started":
            set({
              isSyncing: true,
              isSyncingFolder: "__all__",
              lastError: null,
            });
            break;

          case "sync:complete":
            set({
              isSyncing: false,
              isSyncingFolder: null,
              lastSyncAt: Date.now(),
              lastError: null,
            });
            break;

          case "sync:error": {
            const p = payload as { last_error?: string | null } | undefined;
            set({
              isSyncing: false,
              isSyncingFolder: null,
              lastError: p?.last_error ?? "Sync error",
            });
            break;
          }

          case "sync:account-start": {
            const p = payload as { host?: string; username?: string };
            const key = accountKey(p);
            set((state) => ({
              isSyncing: true,
              perAccount: {
                ...state.perAccount,
                [key]: {
                  status: "syncing",
                  lastSyncAt: state.perAccount[key]?.lastSyncAt ?? null,
                  error: null,
                },
              },
            }));
            break;
          }

          case "sync:account-complete": {
            const p = payload as { host?: string; username?: string };
            const key = accountKey(p);
            set((state) => ({
              perAccount: {
                ...state.perAccount,
                [key]: { status: "idle", lastSyncAt: Date.now(), error: null },
              },
            }));
            break;
          }

          case "sync:account-error": {
            const p = payload as {
              host?: string;
              username?: string;
              error?: string;
            };
            const key = accountKey(p);
            set((state) => ({
              perAccount: {
                ...state.perAccount,
                [key]: {
                  status: "error",
                  lastSyncAt: state.perAccount[key]?.lastSyncAt ?? null,
                  error: p?.error ?? "Account sync error",
                },
              },
            }));
            break;
          }

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

/**
 * Derive a stable per-account key from a sync account payload. Falls back to
 * an empty string when the payload lacks host/username (e.g. global events).
 */
function accountKey(p: { host?: string; username?: string } | undefined): string {
  if (!p) return "";
  return `${p.username ?? ""}@${p.host ?? ""}`;
}

let _syncEventCleanup: (() => void) | null = null;

/**
 * Subscribe the sync store to its owned events from the EVENT_BUS_MAP.
 *
 * Registers handlers for ALL sync lifecycle events owned by `"syncStore"`:
 *   - `sync:started`          → `isSyncing = true`, syncing folder `"__all__"`
 *   - `sync:complete`         → `isSyncing = false`, `lastSyncAt` updated
 *   - `sync:error`            → `isSyncing = false`, `lastError` set
 *   - `sync:account-start`    → marks the account `syncing` in `perAccount`
 *   - `sync:account-complete` → marks the account `idle` in `perAccount`
 *   - `sync:account-error`    → marks the account `error` in `perAccount`
 *   - `rust:init:complete`    → marks the store as online
 *
 * @returns A cleanup function that removes all registered handlers.
 */
export function initSyncStoreEvents(): () => void {
  if (_syncEventCleanup) return _syncEventCleanup;

  _syncEventCleanup = subscribeFromManifest("syncStore", {
    "sync:started": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:started", payload);
    },
    "sync:complete": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:complete", payload);
    },
    "sync:error": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:error", payload);
    },
    "sync:account-start": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:account-start", payload);
    },
    "sync:account-complete": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:account-complete", payload);
    },
    "sync:account-error": (payload) => {
      useSyncStore.getState().handleEvent?.("sync:account-error", payload);
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
