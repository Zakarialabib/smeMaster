import { eventBus } from "@shared/services/events/eventBus";

/**
 * A self-managed EventBus subscription handle. The returned `init()` is
 * idempotent — calling it more than once is a no-op and returns the same
 * cleanup function. Use `dispose()` to unregister and allow re-init.
 */
export interface EventBusSubscription {
  /** Register all subscribers. Idempotent. Returns the cleanup function. */
  init: () => () => void;
  /** Unregister all subscribers. Safe to call multiple times. */
  dispose: () => void;
}

/**
 * Create an idempotent EventBus subscription that bundles a set of
 * event-kind → handler pairs.
 *
 * This is the standard pattern for stores that need to self-subscribe to
 * a fixed set of events declared up-front (vs. `useEventBus` for dynamic
 * per-component subscriptions). The returned `init()` is safe to call
 * multiple times — subsequent calls return the same cleanup without
 * double-registering handlers, matching the legacy `init*StoreEvents()`
 * pattern.
 *
 * @param name  Human-readable identifier for this subscription. Used only
 *              for debugging; the EventBus itself is name-agnostic.
 * @param subscribers  Map of event-kind → handler. All entries are
 *                     registered with the EventBus via `eventBus.onMany()`
 *                     in a single call and torn down together.
 *
 * @example
 * ```ts
 * const sub = createEventBusSubscription("threadStore", {
 *   "sync:complete": (payload) =>
 *     useThreadStore.getState().handleEvent("sync:complete", payload),
 *   "sync:account-error": (payload) =>
 *     useThreadStore.getState().handleEvent("sync:account-error", payload),
 * });
 *
 * // Eagerly wire in browser environments (matches legacy init*StoreEvents).
 * if (typeof window !== "undefined") {
 *   sub.init();
 * }
 * ```
 */
export function createEventBusSubscription<
  TSubscribers extends Record<string, (payload: any) => void>,
>(_name: string, subscribers: TSubscribers): EventBusSubscription {
  let cleanup: (() => void) | null = null;

  return {
    init: () => {
      if (cleanup) return cleanup;
      cleanup = eventBus.onMany(subscribers);
      return cleanup;
    },
    dispose: () => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  };
}
