/**
 * Tauri environment detection.
 *
 * Single source of truth for "are we running inside a compiled Tauri shell
 * (desktop or mobile) vs. a plain browser dev server / web build?".
 *
 * The `@tauri-apps/api/core` `invoke` function exists as a module export even
 * in a browser, but internally dereferences `window.__TAURI_INTERNALS__.invoke`.
 * When that global is absent (dev server, web build) the call throws the cryptic
 * `Cannot read properties of undefined (reading 'invoke')`. Centralizing the
 * check here lets the IPC layer short-circuit with a clean, catchable error
 * instead of that raw TypeError.
 */

/**
 * Returns `true` when the app is running inside a Tauri webview where the
 * native Rust backend (and therefore IPC `invoke`) is available.
 *
 * Safe to call during module init and SSR-free browser contexts.
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * Error thrown by the IPC layer when a command is attempted outside a Tauri
 * environment. It is a normal `Error` (so existing `try/catch` blocks catch it
 * cleanly) and carries the attempted command name for diagnostics.
 */
export class TauriUnavailableError extends Error {
  /** The command that could not be invoked. */
  readonly command: string;
  /** Always true so callers can narrow with `err.isTauriUnavailable`. */
  readonly isTauriUnavailable = true;

  constructor(command: string) {
    super(
      `Tauri backend is not available in this environment (browser/dev server). ` +
        `Command "${command}" was not executed.`,
    );
    this.name = "TauriUnavailableError";
    this.command = command;
    // Preserve prototype chain when targeting ES5/ES2015.
    Object.setPrototypeOf(this, TauriUnavailableError.prototype);
  }
}
