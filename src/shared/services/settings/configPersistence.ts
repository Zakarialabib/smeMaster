/**
 * configPersistence — Syncs configStore changes to the SQLite settings table.
 *
 * The configStore uses Zustand `persist` middleware backed by the Tauri plugin
 * store (`tauriStoreStorage`).  That's one persistence layer.
 *
 * On reload, `useSettingsRestorer` reads from the SQLite `settings` table and
 * applies saved values to the stores.  But configStore setters never write to
 * SQLite — only the plugin store gets updated.  This means that on next reload
 * SQLite has stale/default values and the restored settings are lost.
 *
 * This module closes the gap by subscribing to configStore changes and writing
 * each changed key to SQLite with `setSetting()`.
 *
 * Call once from the app init phase (e.g. inside `useSettingsRestorer`).
 */
import { useConfigStore } from "@/stores/core";
import { setSetting } from "@features/settings/db/settings";

/** Keys we sync to SQLite.  Maps store field → setting DB key. */
interface SyncEntry {
  field: string;
  dbKey: string;
  serialize: (val: unknown) => string;
}

const SYNC_LIST: SyncEntry[] = [
  { field: "theme", dbKey: "theme", serialize: String },
  { field: "colorTheme", dbKey: "color_theme", serialize: String },
  { field: "fontScale", dbKey: "font_size", serialize: String },
  { field: "surface", dbKey: "surface", serialize: String },
  { field: "reduceMotion", dbKey: "reduce_motion", serialize: (v) => (v ? "true" : "false") },
  { field: "readingPanePosition", dbKey: "reading_pane_position", serialize: String },
  { field: "readFilter", dbKey: "read_filter", serialize: String },
  { field: "emailListWidth", dbKey: "email_list_width", serialize: String },
  { field: "emailDensity", dbKey: "email_density", serialize: String },
  { field: "defaultReplyMode", dbKey: "default_reply_mode", serialize: String },
  { field: "markAsReadBehavior", dbKey: "mark_as_read_behavior", serialize: String },
  { field: "sendAndArchive", dbKey: "send_and_archive", serialize: (v) => (v ? "true" : "false") },
  { field: "inboxViewMode", dbKey: "inbox_view_mode", serialize: String },
  { field: "sidebarNavConfig", dbKey: "sidebar_nav_config", serialize: JSON.stringify },
  { field: "locale", dbKey: "locale", serialize: String },
  { field: "aiLanguage", dbKey: "ai_language", serialize: String },
  { field: "advancedMode", dbKey: "advanced_settings_mode", serialize: (v) => (v ? "true" : "false") },
];

/**
 * How long (ms) to wait after the last change before writing to SQLite.
 * Avoids hammering the DB when the user toggles settings rapidly.
 */
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingWrites: Array<() => Promise<void>> = [];

function flush(): void {
  const batch = pendingWrites.splice(0, pendingWrites.length);
  Promise.allSettled(batch.map((fn) => fn())).catch(() => {
    /* swallow — writes are best-effort */
  });
}

function scheduleWrite(fn: () => Promise<void>): void {
  pendingWrites.push(fn);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flush, DEBOUNCE_MS);
}

let _initialized = false;

/**
 * Start listening for configStore changes and persist each tracked
 * key to the SQLite settings table.  Call once during app init.
 *
 * Safe to call multiple times — subsequent invocations are no-ops.
 */
export function initConfigPersistence(): void {
  if (_initialized) return;
  _initialized = true;

  // Snapshot the current values so we can detect changes.
  let prev = { ...useConfigStore.getState() };

  useConfigStore.subscribe((state) => {
    for (const entry of SYNC_LIST) {
      const cur = state[entry.field as keyof typeof state];
      const p = prev[entry.field as keyof typeof prev];

      if (Object.is(cur, p)) continue;
      if (cur === undefined) continue;

      scheduleWrite(() =>
        setSetting(entry.dbKey, entry.serialize(cur)),
      );
    }
    // Update snapshot after processing all changes
    prev = { ...state };
  });
}
