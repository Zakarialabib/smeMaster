import type { StoreApi } from "zustand";

// ── State shape ─────────────────────────────────────────────────────────────

export interface DeleteConfirmationSlice {
  /** ID of the item pending deletion confirmation. `null` when no item is pending. */
  deleteTargetId: string | null;
  /** True while the delete operation is in-flight. */
  deleting: boolean;

  /** Prompt the user to confirm deletion of the given item. */
  requestDelete: (id: string) => void;
  /** Cancel the pending deletion. */
  cancelDelete: () => void;
  /** Execute the deletion for the current `deleteTargetId`. */
  confirmDelete: () => Promise<void>;
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface DeleteConfirmationOptions {
  /**
   * Called when `confirmDelete` is triggered and a `deleteTargetId` is set.
   * Typically delegates to a store method that performs the actual DB removal.
   *
   * @example
   * ```ts
   * onDelete: async (id) => { await get().deleteWorkflow(id); }
   * ```
   */
  onDelete: (id: string) => Promise<void>;
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a `DeleteConfirmationSlice` that manages the three-phase delete flow:
 *
 * 1. `requestDelete(id)` — sets the pending target
 * 2. `cancelDelete()` — clears the pending target
 * 3. `confirmDelete()` — executes the actual delete via `opts.onDelete`
 *
 * This eliminates the identical `deleteTargetId`/`deleting`/`requestDelete`/
 * `cancelDelete`/`confirmDelete` boilerplate found in multiple stores.
 *
 * @example
 * ```ts
 * const deleteSlice = createDeleteConfirmation(set, get, {
 *   onDelete: async (id) => { await get().deleteWorkflow(id); },
 * });
 *
 * return {
 *   ...deleteSlice,
 *   // ... other store fields
 * };
 * ```
 */
export function createDeleteConfirmation(
  set: StoreApi<any>["setState"],
  get: StoreApi<any>["getState"],
  opts: DeleteConfirmationOptions,
): DeleteConfirmationSlice {
  const setState: typeof set = set;

  return {
    deleteTargetId: null,
    deleting: false,

    requestDelete: (id: string) => {
      setState({ deleteTargetId: id });
    },

    cancelDelete: () => {
      setState({ deleteTargetId: null });
    },

    confirmDelete: async () => {
      const { deleteTargetId } = get();
      if (!deleteTargetId) return;

      setState({ deleting: true });
      try {
        await opts.onDelete(deleteTargetId);
        setState({ deleteTargetId: null });
      } finally {
        setState({ deleting: false });
      }
    },
  };
}
