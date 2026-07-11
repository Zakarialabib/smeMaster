/**
 * usePersistentStorage — cross-platform persistent state hook.
 *
 * On Tauri (Windows + Android), values are written to a real on-disk file via
 * `tauri-plugin-store`. This is the durable, OS-managed equivalent of
 * `localStorage` that survives Android "clear cache", is included in user-data
 * backups, and is visible to native plugins through the same data directory.
 *
 * Outside Tauri (browser dev mode, tests), it transparently falls back to
 * `localStorage` so the same hook works in both environments.
 *
 * The setter is fire-and-forget to match the ergonomics of `useLocalStorage`
 * — writes are awaited internally and errors are swallowed (logged) to keep
 * the call sites simple. Use `setValueAsync` if you need to await the write.
 *
 * @example
 *   const [viewMode, setViewMode] = usePersistentStorage<ViewMode>(
 *     "smemaster.contacts.viewMode",
 *     "list",
 *   );
 */
import { useCallback, useEffect, useRef, useState } from "react";

const STORE_FILE = "smemaster.prefs.json";
const STORE_KEY_PREFIX = "smemaster.";

/**
 * Detect Tauri runtime. Avoids importing from a service module so this hook
 * has no cross-cutting dependencies and works in test envs (jsdom).
 */
function detectTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 always sets this on the window before the app boots.
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

const isBrowser = typeof window !== "undefined" && !detectTauri();

// ── Lazy store singleton (Tauri) ──────────────────────────────────────────
// We keep one tauri-plugin-store instance for the whole app to avoid
// repeatedly loading the same file from disk.
let tauriStorePromise: Promise<unknown> | null = null;

async function getTauriStore(): Promise<{
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
} | null> {
  if (!detectTauri()) return null;
  if (!tauriStorePromise) {
    tauriStorePromise = import("@tauri-apps/plugin-store")
      .then(({ load }) =>
        load(STORE_FILE, { autoSave: true, defaults: {} }),
      )
      .catch((err) => {
        // Reset the cached promise so a later call can retry.
        tauriStorePromise = null;
        console.warn("[usePersistentStorage] tauri-plugin-store load failed", err);
        return null;
      });
  }
  return (await tauriStorePromise) as Awaited<ReturnType<typeof getTauriStore>>;
}

// ── localStorage fallback (browser) ───────────────────────────────────────
function lsGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private mode — silently fail
  }
}

function lsDelete(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────
export interface UsePersistentStorageResult<T> {
  /** Current persisted value. */
  value: T;
  /**
   * Persist a new value. Fire-and-forget; safe to call from render but
   * also stable across re-renders. Returns a promise for callers that
   * need to await the write (tests, ordered migrations).
   */
  setValue: (next: T | ((prev: T) => T)) => void;
  /** Awaitable version of `setValue`. */
  setValueAsync: (next: T | ((prev: T) => T)) => Promise<void>;
  /** Remove the key from the store entirely. */
  remove: () => Promise<void>;
  /** True while the initial value is being read from the durable store. */
  loading: boolean;
}

export function usePersistentStorage<T>(
  key: string,
  initialValue: T,
): UsePersistentStorageResult<T> {
  const namespacedKey = key.startsWith(STORE_KEY_PREFIX)
    ? key
    : `${STORE_KEY_PREFIX}${key}`;

  const [value, setValueState] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const initialValueRef = useRef(initialValue);
  // Keep latest initialValue reference in case caller passes a new default.
  initialValueRef.current = initialValue;

  // ── Initial load ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Browser fallback: synchronous-ish via localStorage.
      if (isBrowser) {
        const cached = lsGet<T>(namespacedKey);
        if (!cancelled && cached !== null) setValueState(cached);
        if (!cancelled) setLoading(false);
        return;
      }

      // Tauri: read from durable store, fall back to localStorage.
      const store = await getTauriStore();
      if (cancelled) return;
      let stored: T | null = null;
      if (store) {
        try {
          stored = await store.get<T>(namespacedKey);
        } catch (err) {
          console.warn(
            `[usePersistentStorage] read failed for ${namespacedKey}`,
            err,
          );
        }
      }
      // Fallback: try localStorage (dual-write mirror)
      if (stored === null || stored === undefined) {
        try {
          const raw = window.localStorage.getItem(namespacedKey);
          if (raw !== null) stored = JSON.parse(raw) as T;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled && stored !== null && stored !== undefined) {
        setValueState(stored);
      }
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [namespacedKey]);

  // ── Write (dual: plugin store + localStorage mirror) ──────────────────
  const writeValue = useCallback(
    async (next: T | ((prev: T) => T)): Promise<void> => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(value)
          : next;
      setValueState(resolved);

      // Always write to localStorage as the universal fallback layer.
      lsSet(namespacedKey, resolved);

      // Also write to the durable plugin store if available.
      if (!isBrowser) {
        const store = await getTauriStore();
        if (store) {
          try {
            await store.set(namespacedKey, resolved);
            await store.save();
          } catch (err) {
            console.warn(
              `[usePersistentStorage] write failed for ${namespacedKey}`,
              err,
            );
          }
        }
      }
    },
    [namespacedKey, value],
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      void writeValue(next);
    },
    [writeValue],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (isBrowser) {
      lsDelete(namespacedKey);
    } else {
      const store = await getTauriStore();
      if (store) {
        try {
          await store.delete(namespacedKey);
          await store.save();
        } catch (err) {
          console.warn(
            `[usePersistentStorage] delete failed for ${namespacedKey}`,
            err,
          );
        }
      }
    }
    setValueState(initialValueRef.current);
  }, [namespacedKey]);

  return { value, setValue, setValueAsync: writeValue, remove, loading };
}
