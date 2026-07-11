/**
 * useClipboard — cross-platform clipboard hook.
 *
 * On Tauri (desktop + mobile), reads/writes via `@tauri-apps/plugin-clipboard-manager`
 * for native system clipboard access.
 *
 * Falls back to `navigator.clipboard` (Web API) when running in a browser
 * or when Tauri clipboard plugin is unavailable.
 *
 * @example
 * ```tsx
 * const { copy, paste } = useClipboard();
 * await copy("Hello world");
 * const text = await paste();
 * ```
 */

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Writes text to the system clipboard.
 * Uses Tauri plugin when available, falls back to navigator.clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (isTauri()) {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return;
    } catch {
      // Fall through to web API
    }
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard may be unavailable in non-secure contexts or sandboxed iframes
    console.warn("[useClipboard] Failed to copy text");
  }
}

/**
 * Reads text from the system clipboard.
 * Uses Tauri plugin when available, falls back to navigator.clipboard.
 */
export async function pasteFromClipboard(): Promise<string> {
  if (isTauri()) {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      return await readText();
    } catch {
      // Fall through to web API
    }
  }

  try {
    return await navigator.clipboard.readText();
  } catch {
    console.warn("[useClipboard] Failed to read clipboard");
    return "";
  }
}

export interface UseClipboardResult {
  /** Copy text to clipboard. Safe to call in any environment. */
  copy: (text: string) => Promise<void>;
  /** Paste text from clipboard. Returns empty string on failure. */
  paste: () => Promise<string>;
}

/**
 * Hook returning stable `copy` and `paste` functions for clipboard access.
 *
 * In Tauri environments the native plugin is used; otherwise the Web
 * Clipboard API (navigator.clipboard) is used as a fallback.
 */
export function useClipboard(): UseClipboardResult {
  return { copy: copyToClipboard, paste: pasteFromClipboard };
}
