/**
 * Sync Store — re-export from the canonical persist-backed store.
 *
 * The canonical `useSyncStore` is defined in `src/stores/shared/syncStore.ts`
 * (with Zustand `persist` middleware + Tauri store storage).  This file
 * re-exports it so that both import paths resolve to the **same** singleton:
 *
 *   - `@shared/stores/syncStore`  (used by UI components, App.tsx)
 *   - `@/stores/shared`            (used by hooks, services)
 *
 * The `initSyncStoreEvents()` function wires the store to the typed
 * EventBus manifest and is called eagerly at module-load time.
 */
export {
  useSyncStore,
  initSyncStoreEvents,
} from "@/stores/shared/syncStore";
