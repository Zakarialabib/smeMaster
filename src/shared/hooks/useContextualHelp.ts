import { useState, useCallback, useEffect } from "react";
import {
  getContextualHelp,
  getContextualHelpKeys,
  type ContextualHelpEntry,
} from "@/constants/contextualHelp";
import { tauriStoreStorage } from "@shared/services/storage/tauriStoreStorage";

const DISMISSED_KEYS_KEY = "smemaster.contextualHelp.dismissed";
const SEEN_KEYS_KEY = "smemaster.contextualHelp.seen";

/**
 * Load previously dismissed keys from durable storage.
 */
function getDismissedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw =
      "__TAURI_INTERNALS__" in window || "__TAURI__" in window
        ? null // async path handled in useState init
        : window.localStorage.getItem(DISMISSED_KEYS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Persist dismissed keys to durable storage.
 */
function saveDismissedKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify([...keys]);
  if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) {
    void tauriStoreStorage.setItem(DISMISSED_KEYS_KEY, payload);
  } else {
    try {
      window.localStorage.setItem(DISMISSED_KEYS_KEY, payload);
    } catch {
      /* ignore */
    }
  }
}

function saveSeenKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify([...keys]);
  if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) {
    void tauriStoreStorage.setItem(SEEN_KEYS_KEY, payload);
  } else {
    try {
      window.localStorage.setItem(SEEN_KEYS_KEY, payload);
    } catch {
      /* ignore */
    }
  }
}

function removeAll() {
  if (typeof window === "undefined") return;
  if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) {
    void tauriStoreStorage.removeItem(DISMISSED_KEYS_KEY);
    void tauriStoreStorage.removeItem(SEEN_KEYS_KEY);
  } else {
    try {
      window.localStorage.removeItem(DISMISSED_KEYS_KEY);
      window.localStorage.removeItem(SEEN_KEYS_KEY);
    } catch {
      /* ignore */
    }
  }
}

interface ContextualHelpState {
  /** Currently open slide panel info key (or null) */
  activeKey: string | null;
  /** Full entry data for the active key */
  activeEntry: ContextualHelpEntry | null;
  /** Set of previously-dismissed help keys */
  dismissedKeys: Set<string>;
  /** Keys with content the user hasn't seen yet */
  unseenKeys: string[];
  /** Open the slide panel for a given info key */
  openHelp: (key: string) => void;
  /** Close the slide panel */
  closeHelp: () => void;
  /** Mark a key as dismissed so the indicator dot disappears */
  dismissKey: (key: string) => void;
  /** Mark key as seen without permanent dismissal */
  markSeen: (key: string) => void;
  /** Reset all dismissals */
  resetAll: () => void;
}

/**
 * Hook that manages contextual help state:
 * - Tracks which help keys the user has seen/dismissed
 * - Controls the slide panel open/close state
 * - Provides "unseen" key list for indicator dots
 *
 * Persists to `tauri-plugin-store` on Windows / Android (survives cache
 * clears) with a `localStorage` fallback in browser dev mode.
 */
export function useContextualHelp(): ContextualHelpState {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(getDismissedKeys);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());

  // Async hydrate the seen keys (and re-hydrate dismissed keys in Tauri).
  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
    if (!isTauri) {
      // In browser, populate seen from localStorage on mount so the
      // initial render after a refresh is consistent.
      try {
        const raw = window.localStorage.getItem(SEEN_KEYS_KEY);
        if (raw) setSeenKeys(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* ignore */
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [seenRaw, dismissedRaw] = await Promise.all([
          tauriStoreStorage.getItem(SEEN_KEYS_KEY),
          tauriStoreStorage.getItem(DISMISSED_KEYS_KEY),
        ]);
        if (cancelled) return;
        if (seenRaw) setSeenKeys(new Set(JSON.parse(seenRaw) as string[]));
        if (dismissedRaw)
          setDismissedKeys(new Set(JSON.parse(dismissedRaw) as string[]));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allKeys = getContextualHelpKeys();
  const unseenKeys = allKeys.filter(
    (k) => !dismissedKeys.has(k) && !seenKeys.has(k),
  );

  const activeEntry = activeKey ? getContextualHelp(activeKey) ?? null : null;

  const openHelp = useCallback((key: string) => {
    setActiveKey(key);
    // Mark as seen
    setSeenKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveSeenKeys(next);
      return next;
    });
  }, []);

  const closeHelp = useCallback(() => {
    setActiveKey(null);
  }, []);

  const dismissKey = useCallback((key: string) => {
    setDismissedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveDismissedKeys(next);
      return next;
    });
  }, []);

  const markSeen = useCallback((key: string) => {
    setSeenKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveSeenKeys(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setDismissedKeys(new Set());
    setSeenKeys(new Set());
    removeAll();
  }, []);

  return {
    activeKey,
    activeEntry,
    dismissedKeys,
    unseenKeys,
    openHelp,
    closeHelp,
    dismissKey,
    markSeen,
    resetAll,
  };
}
