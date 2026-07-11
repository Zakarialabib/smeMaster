import { eventBus } from "@shared/services/events/eventBus";
import { useActionStatusStore } from "./actionStatusStore";

/**
 * Queue progress event payload (emitted by the Rust backend via EventBus).
 * Maps to `queue:progress` events.
 */
interface QueueProgressPayload {
  actionId: string;
  progress: number;
  operationType?: string;
}

/**
 * Sync phase event payload (emitted by the Rust backend via EventBus).
 * Maps to `sync:phase` events.
 */
interface SyncPhasePayload {
  actionId: string;
  phase: string;
  status: string;
  error?: string;
}

/**
 * Subscribe the ActionStatus store to relevant EventBus events.
 *
 * - `queue:progress` → updates the `progress` field on an ActionStatus entry
 * - `sync:phase`     → maps phase names to ActionStatus lifecycle states
 *
 * @returns An unsubscribe function that removes all registered handlers.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const unsub = initActionStatusEventBridge();
 *   return unsub;
 * }, []);
 * ```
 */
export function initActionStatusEventBridge(): () => void {
  const unsub1 = eventBus.register("queue:progress", (payload: unknown) => {
    const p = payload as QueueProgressPayload;
    if (!p?.actionId) return;

    const store = useActionStatusStore.getState();
    const current = store.statuses[p.actionId];

    store.setStatus(p.actionId, current?.status ?? "loading", {
      progress: p.progress,
    });
  });

  const unsub2 = eventBus.register("sync:phase", (payload: unknown) => {
    const p = payload as SyncPhasePayload;
    if (!p?.actionId) return;

    const store = useActionStatusStore.getState();

    switch (p.status) {
      case "started":
        store.setStatus(p.actionId, "loading", {
          category: "sync",
        });
        break;
      case "completed":
        store.setStatusWithAutoClear(p.actionId, "success", {
          category: "sync",
          autoClearMs: 2000,
        });
        break;
      case "error":
        store.setStatusWithAutoClear(p.actionId, "error", {
          error: p.error ?? "Sync phase failed",
          category: "sync",
          autoClearMs: 5000,
        });
        break;
    }
  });

  return () => {
    unsub1();
    unsub2();
  };
}
