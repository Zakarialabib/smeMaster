import { useState, useEffect } from "react";

export type WindowLabel = "main" | "thread" | "compose";
export type WindowLabelState = WindowLabel | null;

/**
 * Reads the current Tauri webview window label and maps it to a known
 * WindowLabel type.
 *
 * **Why `null` initial state?**
 * The Tauri `getCurrentWebviewWindow().label` is async, so we must NOT
 * default to `"main"` — doing so would cause thread/compose windows to
 * briefly render the full app (RouterProvider with sidebar, etc.) before
 * the async check resolves and switches to the correct root. This would
 * trigger wasteful initialisation, data fetching, and a visible flash.
 *
 * Instead we start with `null` (loading) and use a synchronous URL-param
 * fallback so that thread/compose windows render correctly on first paint.
 * Main windows wait briefly for the Tauri label (a one-time async check).
 */
export function useWindowLabel(): WindowLabelState {
  const [label, setLabel] = useState<WindowLabelState>(null);

  useEffect(() => {
    // ── Synchronous URL-param fallback ──────────────────────────────
    // This runs BEFORE any rendering in the current task, ensuring
    // thread/compose windows never flash the main app content.
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const isThread = params?.has("thread") && params?.has("account");
    const isCompose = params?.has("compose");

    if (isThread) {
      setLabel("thread");
      return;
    }
    if (isCompose) {
      setLabel("compose");
      return;
    }

    // ── Async Tauri label (source of truth) ─────────────────────────
    import("@tauri-apps/api/webviewWindow")
      .then(({ getCurrentWebviewWindow }) => {
        const win = getCurrentWebviewWindow();
        const rawLabel = win.label;

        if (rawLabel.startsWith("thread")) {
          setLabel("thread");
        } else if (rawLabel.startsWith("compose")) {
          setLabel("compose");
        } else {
          setLabel("main");
        }
      })
      .catch(() => {
        // Fallback for non-Tauri environments (browser dev, tests)
        setLabel("main");
      });
  }, []);

  return label;
}
