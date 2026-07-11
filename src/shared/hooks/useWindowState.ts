/**
 * useWindowState — save/restore Tauri window position and size.
 *
 * Uses `@tauri-apps/plugin-window-state` to persist and restore window
 * geometry (position, size, maximized state) across app restarts.
 *
 * In the browser (dev mode, tests) all operations are no-ops.
 *
 * @example
 * ```tsx
 * const { saveState, restoreState } = useWindowState();
 * await saveState();        // Persist current window geometry
 * await restoreState();     // Restore from disk
 * ```
 */

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

// Re-export the plugin's StateFlags for consumers
export type { StateFlags } from "@tauri-apps/plugin-window-state";

export interface UseWindowStateResult {
  /**
   * Save the state of all open windows to disk.
   * @param flags Bitmask of state properties to save. Defaults to `StateFlags.ALL`.
   */
  saveState: (flags?: number) => Promise<void>;
  /**
   * Restore the state for the current window from disk.
   * @param flags Bitmask of state properties to restore. Defaults to `StateFlags.ALL`.
   */
  restoreState: (flags?: number) => Promise<void>;
  /**
   * Get the filename used to store window state on disk.
   */
  getFilename: () => Promise<string>;
}

const ALL_FLAGS = 1 | 2 | 4 | 8; // SIZE | POSITION | MAXIMIZED | VISIBLE

/**
 * Hook providing functions to save and restore Tauri window state.
 *
 * In Tauri environments this persists/restores window position, size,
 * and maximized state to/from disk automatically. The plugin is already
 * registered on the Rust side in `lib.rs`.
 *
 * In browser environments all methods are no-ops that resolve silently.
 */
export function useWindowState(): UseWindowStateResult {
  const saveState = async (flags: number = ALL_FLAGS): Promise<void> => {
    if (!isTauri()) return;
    try {
      const { saveWindowState } = await import("@tauri-apps/plugin-window-state");
      await saveWindowState(flags);
    } catch (err) {
      console.warn("[useWindowState] Failed to save window state", err);
    }
  };

  const restoreState = async (flags: number = ALL_FLAGS): Promise<void> => {
    if (!isTauri()) return;
    try {
      const { restoreStateCurrent } = await import("@tauri-apps/plugin-window-state");
      await restoreStateCurrent(flags);
    } catch (err) {
      console.warn("[useWindowState] Failed to restore window state", err);
    }
  };

  const getFilename = async (): Promise<string> => {
    if (!isTauri()) return "";
    try {
      const { filename } = await import("@tauri-apps/plugin-window-state");
      return await filename();
    } catch {
      return "";
    }
  };

  return { saveState, restoreState, getFilename };
}
