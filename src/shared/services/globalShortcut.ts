import {
  register as tauriRegister,
  unregister as tauriUnregister,
  isRegistered as tauriIsRegistered,
} from "@tauri-apps/plugin-global-shortcut";

/** Check if running inside a Tauri webview. */
function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

const DEFAULT_SHORTCUT = "CmdOrCtrl+Shift+M";

let currentHandler: (() => void) | null = null;
let currentShortcut: string | null = null;

/**
 * Initialize global shortcut support.
 * On non-Tauri environments, this is a no-op.
 */
export async function initGlobalShortcut(): Promise<void> {
  if (!isTauri()) {
    console.info("Global shortcuts disabled — not in Tauri environment");
    return;
  }
  // No-op: registration happens via registerComposeShortcut
}

/**
 * Register a global shortcut for quick compose.
 * On non-Tauri environments, logs and succeeds silently.
 */
export async function registerComposeShortcut(shortcut: string): Promise<void> {
  // Unregister previous shortcut if any
  if (currentShortcut) {
    await unregisterComposeShortcut();
  }

  if (!isTauri()) {
    console.info("Global shortcuts disabled — not in Tauri environment");
    currentShortcut = shortcut;
    return;
  }

  try {
    await tauriRegister(shortcut, (event) => {
      if (event.state === "Pressed") {
        currentHandler?.();
      }
    });
    currentShortcut = shortcut;
  } catch (err) {
    console.error("Failed to register global shortcut:", err);
  }
}

/**
 * Set the handler to call when the compose shortcut is triggered.
 * The handler is fired on every key-down event of the registered shortcut.
 */
export function setComposeHandler(handler: () => void): void {
  currentHandler = handler;
}

/**
 * Unregister the current compose shortcut.
 */
export async function unregisterComposeShortcut(): Promise<void> {
  if (!currentShortcut || !isTauri()) return;
  try {
    await tauriUnregister(currentShortcut);
  } catch {
    // Ignore unregister errors (shortcut may already be gone)
  }
  currentShortcut = null;
}

/**
 * Get the currently registered shortcut string.
 */
export function getCurrentShortcut(): string | null {
  return currentShortcut;
}

/**
 * Check if a specific shortcut is registered.
 */
export async function isShortcutRegistered(shortcut: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await tauriIsRegistered(shortcut);
  } catch {
    return false;
  }
}

export { DEFAULT_SHORTCUT };
