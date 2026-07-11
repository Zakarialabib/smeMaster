import { useEffect } from "react";
import { useShortcutStore } from "@features/settings/stores/shortcutStore";
import { withRetry } from "./_utils";

/**
 * Phase 4: Load custom keyboard shortcut bindings from the settings DB
 * and merge them with the default key map.
 */
export function useKeyMapLoader(): void {
  useEffect(() => {
    withRetry("loadKeyMap", () => useShortcutStore.getState().loadKeyMap()).catch(
      (err) => console.warn("[init] Failed to load key map:", err),
    );
  }, []);
}