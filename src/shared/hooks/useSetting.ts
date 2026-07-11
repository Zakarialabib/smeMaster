/**
 * useSetting — reactive persistence hook for SQLite-backed settings.
 *
 * Replaces the manual `useState` + `useEffect` + `getSetting` / `setSetting`
 * pattern with a single hook. Values are:
 *   • loaded from SQLite on mount
 *   • persisted to SQLite on every change (auto-save)
 *   • returned as reactive React state
 *
 * When defaultDefault is provided, it's used if the setting is not yet in the DB.
 * This value is also written to the DB on first load (so subsequent reads are
 * faster and the schema is self-documenting).
 *
 * @example
 *   const [syncDays, setSyncDays] = useSetting("sync_period_days", "365");
 *   const [blockImages] = useSetting("block_remote_images", "true");
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting, setSetting } from "@features/settings/db/settings";

/**
 * Returns a tuple [value, setValue, { loading }] — same shape as useState
 * but with auto-persistence and a loading flag for the initial read.
 */
export function useSetting(
  key: string,
  defaultDefault?: string,
): [string, (next: string) => void, { loading: boolean }] {
  const [value, setValue] = useState<string>(defaultDefault ?? "");
  const [loading, setLoading] = useState(true);
  const lastKeyRef = useRef(key);
  const persistedRef = useRef(false);

  // Re-load if key changes
  useEffect(() => {
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      persistedRef.current = false;
    }
  }, [key]);

  // Initial load from SQLite
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stored = await getSetting(lastKeyRef.current);
        if (cancelled) return;

        if (stored !== null && stored !== undefined) {
          setValue(stored);
        } else if (defaultDefault !== undefined) {
          // Seed default if key doesn't exist yet
          await setSetting(lastKeyRef.current, defaultDefault);
        }
      } catch (err) {
        console.warn(`[useSetting] load failed for "${lastKeyRef.current}"`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // Only run on mount / key change — not when defaultDefault changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-save on value change (skip initial write)
  useEffect(() => {
    if (loading) return;
    if (!persistedRef.current) {
      // First read complete, the initial seed already happened in load()
      persistedRef.current = true;
      return;
    }

    const currentKey = lastKeyRef.current;
    void setSetting(currentKey, value);
  }, [value, loading]);

  const setValuePersisted = useCallback((next: string) => {
    setValue(next);
  }, []);

  return [value, setValuePersisted, { loading }];
}
