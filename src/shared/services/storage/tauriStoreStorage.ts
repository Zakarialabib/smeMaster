/**
 * tauriStoreStorage — a Zustand `persist` storage adapter backed by
 * `tauri-plugin-store` (real on-disk KV file) on Windows / Android, with a
 * `localStorage` fallback for browser dev mode and tests.
 *
 * **Dual-write strategy**: every write goes to both the Tauri plugin store
 * AND localStorage (as JSON).  On read, the plugin store is tried first;
 * if it returns null, localStorage is used as a fallback.  This ensures
 * data survives regardless of which module's Tauri store instance was used
 * to write (avoids the dual-instance issue where `tauriStoreStorage` and
 * `usePersistentStorage` each hold their own in-memory store cache).
 *
 * @example
 *   import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";
 *   persist(stateFn, {
 *     name: "smemaster.task.viewPrefs",
 *     storage: createJSONStorage(() => tauriStoreStorage),
 *   });
 */
import type { StateStorage } from "zustand/middleware";

/** Tauri runtime detection — duplicated from usePersistentStorage to keep
 *  this module dependency-free for the test environment. */
function detectTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

// ── localStorage helpers (used as fallback on read, mirror on write) ───────
function lsGetItem(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function lsSetItem(name: string, value: string): void {
  try {
    window.localStorage.setItem(name, value);
  } catch {
    /* ignore */
  }
}

function lsRemoveItem(name: string): void {
  try {
    window.localStorage.removeItem(name);
  } catch {
    /* ignore */
  }
}

// ── Tauri store (lazy-loaded, single instance) ─────────────────────────────
let tauriStore: unknown = null;
let tauriStorePromise: Promise<unknown> | null = null;

async function getTauriStore(): Promise<unknown> {
  if (!detectTauri()) return null;
  if (tauriStore) return tauriStore;
  if (!tauriStorePromise) {
    tauriStorePromise = import("@tauri-apps/plugin-store")
      .then(({ load }) =>
        load("smemaster.prefs.json", { autoSave: true, defaults: {} }),
      )
      .then((s) => {
        tauriStore = s;
        return s;
      })
      .catch((err) => {
        tauriStorePromise = null;
        console.warn("[tauriStoreStorage] load failed", err);
        return null;
      });
  }
  return tauriStorePromise;
}

interface TauriStoreLike {
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
}

/**
 * Storage adapter used by configStore, themeStore, syncStore, and ad-hoc
 * callers (updaterService, aiService, contextualHelp, settingsService).
 *
 * Dual-write + dual-read strategy ensures maximum reliability:
 *   1. Plugin store → durable on-disk KV, survives "clear cache"
 *   2. localStorage → fallback, survives plugin store corruption or
 *      dual-instance split-brain
 */
export const tauriStoreStorage: StateStorage = {
  getItem: async (name): Promise<string | null> => {
    if (!detectTauri()) {
      return Promise.resolve(lsGetItem(name));
    }

    // Tauri: try the durable store first.
    try {
      const store = (await getTauriStore()) as TauriStoreLike | null;
      if (store) {
        const value = await store.get<unknown>(name);
        if (value !== null && value !== undefined) {
          // Found in plugin store — write back to localStorage for future
          // reads that might go through the *other* store instance.
          lsSetItem(name, JSON.stringify(value));
          return JSON.stringify(value);
        }
      }
    } catch {
      /* fall through to localStorage */
    }

    // Fallback: read from localStorage (mirror written by dual-write).
    return lsGetItem(name);
  },

  setItem: async (name, value): Promise<void> => {
    // Always write to localStorage as the universal fallback layer.
    lsSetItem(name, value);

    if (!detectTauri()) return;

    // Also write to the durable plugin store.
    try {
      const store = (await getTauriStore()) as TauriStoreLike | null;
      if (store) {
        const parsed = JSON.parse(value);
        await store.set(name, parsed);
        await store.save();
      }
    } catch {
      /* ignore — localStorage already saved */
    }
  },

  removeItem: async (name): Promise<void> => {
    lsRemoveItem(name);

    if (!detectTauri()) return;

    try {
      const store = (await getTauriStore()) as TauriStoreLike | null;
      if (store) {
        await store.delete(name);
        await store.save();
      }
    } catch {
      /* ignore */
    }
  },
};
