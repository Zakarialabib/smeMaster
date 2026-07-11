import ComposerWindow from "@/ComposerWindow";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";

/**
 * Root component for the compose Tauri window.
 *
 * Provides a lightweight wrapper around the existing ComposerWindow component.
 * This layer exists so that main.tsx can switch on the Tauri window label
 * without importing the full App bootstrap (router, EventBus, useAppInit, etc.).
 *
 * Currently this is a pass-through; ComposerWindow handles its own initialisation
 * (settings restore, account loading, composer state from URL params). In a
 * future step the initialisation logic may be extracted into this root.
 */
export default function ComposerWindowRoot() {
  return (
    <ErrorBoundary name="ComposerWindow">
      <ComposerWindow />
    </ErrorBoundary>
  );
}
