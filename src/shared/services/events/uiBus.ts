/**
 * Typed UI event bus.
 *
 * Replaces the stringly-typed `window.dispatchEvent(new Event("smemaster-*"))`
 * anti-pattern with a small, fully-typed emitter. These are *cross-component UI
 * signals* (open a palette, toggle a panel, notify that local data changed) —
 * not domain data-sync events, which belong on the EventBus (`eventBus.ts`).
 *
 * Why not `window` events:
 *   - No compile-time safety on event names or payload shapes.
 *   - Listeners leak if cleanup is missed; `EventTarget` gives us the same
 *     ergonomics with a single import and a typed contract.
 *
 * Usage:
 *   import { uiBus } from "@shared/services/events/uiBus";
 *   uiBus.on("data:changed", () => refetch());
 *   uiBus.emit("data:changed");
 */

// ── Typed event contract ────────────────────────────────────────────────────

export interface UiBusEventMap {
  /** Local data changed (was `smemaster-sync-done`) — refresh UI/cache. */
  "data:changed": void;
  /** Toggle the command palette. */
  "toggle:command-palette": void;
  /** Toggle the keyboard shortcuts help overlay. */
  "toggle:shortcuts-help": void;
  /** Toggle the Ask-Inbox assistant panel. */
  "toggle:ask-inbox": void;
  /** Toggle the template demo overlay. */
  "toggle:template-demo": void;
  /** Request moving the given thread IDs to a folder. */
  "move-to-folder": { threadIds: string[] };
  /** Restore onboarding progress to a given step (multi-tab safety). */
  "restore-onboarding": { step: number };
  /** Activate inline reply in the active thread view. */
  "inline-reply": { mode: "reply" | "replyAll" | "forward" };
  /** Open the task-extract dialog for a thread. */
  "extract-task": { threadId: string };
  /** View raw message. */
  "view-raw-message": { messageId: string };
  /** Navigate help. */
  "navigate-help": { topic: string };
  /** Calendar sync done. */
  "calendar:sync:done": void;
  /** Show toast notification. */
  "toast:show": { message: string };
  /** Edit template. */
  "edit-template": { templateId: string };
}

export type UiBusEventName = keyof UiBusEventMap;

// ── Implementation ──────────────────────────────────────────────────────────

type Handler<K extends UiBusEventName> = (payload: UiBusEventMap[K]) => void;

class UiBus {
  private target = new EventTarget();
  private listeners = new Map<string, Set<{ original: (...args: any[]) => void; wrapped: EventListener }>>();

  /**
   * Subscribe to a UI event. Returns an unsubscribe function.
   */
  on<K extends UiBusEventName>(event: K, handler: Handler<K>): () => void {
    const type = this.typeOf(event);
    const wrapped = ((e: Event) => {
      const detail = (e as CustomEvent).detail as UiBusEventMap[K];
      handler(detail);
    }) as EventListener;

    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add({ original: handler as (...args: any[]) => void, wrapped });

    this.target.addEventListener(type, wrapped);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a previously registered handler.
   */
  off<K extends UiBusEventName>(event: K, handler: Handler<K>): void {
    const type = this.typeOf(event);
    const set = this.listeners.get(type);
    if (!set) return;

    for (const entry of set) {
      if (entry.original === (handler as (...args: any[]) => void)) {
        this.target.removeEventListener(type, entry.wrapped);
        set.delete(entry);
        break;
      }
    }
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  /**
   * Emit a UI event. `payload` is required for events whose contract is
   * non-`void`.
   */
  emit<K extends UiBusEventName>(
    event: K,
    ...args: UiBusEventMap[K] extends void ? [] : [UiBusEventMap[K]]
  ): void {
    const payload = (args[0] as UiBusEventMap[K]) ?? undefined;
    this.target.dispatchEvent(new CustomEvent(this.typeOf(event), { detail: payload }));
  }

  private typeOf(event: UiBusEventName): string {
    return `ui:${event}`;
  }
}

/** Application-wide singleton instance. */
export const uiBus = new UiBus();
