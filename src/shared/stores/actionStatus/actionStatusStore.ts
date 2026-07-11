import { create } from "zustand";
import type { ActionStatus, ActionStatusValue } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SetStatusOptions {
  error?: string;
  progress?: number;
  category?: string;
}

export interface SetStatusWithAutoClearOptions extends SetStatusOptions {
  autoClearMs?: number;
}

interface ActionStatusStore {
  /** Map of actionId → ActionStatus */
  statuses: Record<string, ActionStatus>;

  /** Set or update the status for a given actionId */
  setStatus: (
    id: string,
    status: ActionStatusValue,
    opts?: SetStatusOptions,
  ) => void;

  /** Remove a single action status entry */
  clearStatus: (id: string) => void;

  /** Remove all action status entries in a given category */
  clearCategory: (category: string) => void;

  /**
   * Set status and automatically clear after a timeout.
   * Default auto-clear timeout is 3000ms for terminal states (success/error).
   */
  setStatusWithAutoClear: (
    id: string,
    status: ActionStatusValue,
    opts?: SetStatusWithAutoClearOptions,
  ) => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useActionStatusStore = create<ActionStatusStore>((set, get) => {
  /** Internal registry of active auto-clear timers, keyed by actionId */
  const autoClearTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Schedule auto-clear for a given actionId.
   * Cancels any existing timer for the same actionId first.
   */
  function scheduleAutoClear(
    id: string,
    ms: number,
  ): void {
    const existing = autoClearTimers.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      autoClearTimers.delete(id);
      get().clearStatus(id);
    }, ms);

    autoClearTimers.set(id, timer);
  }

  return {
    statuses: {},

    setStatus: (id, status, opts) =>
      set((state) => {
        const existing = state.statuses[id];
        const now = Date.now();
        const isTerminal = status === "success" || status === "error";

        return {
          statuses: {
            ...state.statuses,
            [id]: {
              id,
              status,
              // Only include error when explicitly provided
              ...(opts?.error !== undefined ? { error: opts.error } : {}),
              // Preserve existing error if not overwritten
              ...(opts?.error === undefined && existing?.error
                ? { error: existing.error }
                : {}),
              // Only include progress when explicitly provided, otherwise preserve existing
              ...(opts?.progress !== undefined
                ? { progress: opts.progress }
                : existing?.progress !== undefined
                  ? { progress: existing.progress }
                  : {}),
              // Only include category when explicitly provided
              ...(opts?.category !== undefined
                ? { category: opts.category }
                : existing?.category
                  ? { category: existing.category }
                  : {}),
              startedAt: existing?.startedAt ?? now,
              ...(isTerminal ? { completedAt: now } : {}),
            },
          },
        };
      }),

    clearStatus: (id) =>
      set((state) => {
        const { [id]: _unused, ...rest } = state.statuses;
        return { statuses: rest };
      }),

    clearCategory: (category) =>
      set((state) => {
        const filtered: Record<string, ActionStatus> = {};
        for (const [id, entry] of Object.entries(state.statuses)) {
          if (entry.category !== category) {
            filtered[id] = entry;
          }
        }
        return { statuses: filtered };
      }),

    setStatusWithAutoClear: (id, status, opts) => {
      const { autoClearMs, ...rest } = opts ?? {};
      get().setStatus(id, status, rest);

      // Only schedule auto-clear for terminal states (success/error)
      if (status === "success" || status === "error") {
        const ms = autoClearMs ?? 3000;
        scheduleAutoClear(id, ms);
      }
    },
  };
});
