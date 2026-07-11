import ThreadWindow from "@/ThreadWindow";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";

/**
 * Root component for the thread Tauri window.
 *
 * Provides a lightweight wrapper around the existing ThreadWindow component.
 * This layer exists so that main.tsx can switch on the Tauri window label
 * without importing the full App bootstrap (router, EventBus, useAppInit, etc.).
 *
 * Currently this is a pass-through; ThreadWindow handles its own initialisation
 * (settings restore, account loading, thread fetch). In a future step the
 * initialisation logic may be extracted into this root.
 */
export default function ThreadWindowRoot() {
  return (
    <ErrorBoundary name="ThreadWindow">
      <ThreadWindow />
    </ErrorBoundary>
  );
}
