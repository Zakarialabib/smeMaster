import { create } from "zustand";
import { setSetting } from "@features/settings/db/settings";
import { createEventBusSubscription } from "@shared/stores/createEventBusSubscription";

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  company: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  provider?: string;
}

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  setAccounts: (accounts: Account[], restoredId?: string | null) => void;
  setActiveAccount: (id: string) => void;
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  handleEvent: (eventType: string, payload: unknown) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  activeAccountId: null,

  setAccounts: (accounts, restoredId) => {
    const activeId = (restoredId && accounts.some((a) => a.id === restoredId))
      ? restoredId
      : accounts[0]?.id ?? null;
    set({ accounts, activeAccountId: activeId });
  },

  setActiveAccount: (activeAccountId) => {
    setSetting("active_account_id", activeAccountId).catch(() => {});
    set({ activeAccountId });
  },

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
      activeAccountId: state.activeAccountId ?? account.id,
    })),

  removeAccount: (id) =>
    set((state) => {
      const accounts = state.accounts.filter((a) => a.id !== id);
      return {
        accounts,
        activeAccountId:
          state.activeAccountId === id
            ? (accounts[0]?.id ?? null)
            : state.activeAccountId,
      };
    }),

  /**
   * Unified event handler called by the EventBus.
   * - `sync:account-start` — could log or update per-account sync state
   * - `sync:account-complete` — could mark account as synced
   * - `sync:account-error` — could flag account with error
   * - `share:received` — could log or prepare share context (already handled by shareHandler.ts)
   */
  handleEvent: (_eventType, _payload) => {
    // Account-level events are currently logged by the threadStore.
    // This handler is reserved for future per-account reactive state
    // (e.g. per-account sync status, error flags on Account model).
    // No-op by design — stores opt in as-needed.
  },
}));

// ── EventBus self-subscription ────────────────────────────────────────────

/**
 * Wire the account store's `handleEvent` to the events it cares about.
 *
 *   - `sync:account-start`    — placeholder for per-account sync UI
 *   - `sync:account-complete` — placeholder for per-account synced flag
 *   - `sync:account-error`    — placeholder for per-account error flag
 *   - `share:received`        — placeholder for share intent context
 *
 * Currently all handlers are no-ops (see `handleEvent` above). This
 * subscription exists so that future per-account state can be added
 * without re-wiring the EventBus — and so that any cross-store events
 * routed to "accountStore" via EVENT_BUS_MAP are at least seen here.
 */
const accountStoreEventSub = createEventBusSubscription("accountStore", {
  "sync:account-start": (payload) => {
    useAccountStore.getState().handleEvent?.("sync:account-start", payload);
  },
  "sync:account-complete": (payload) => {
    useAccountStore.getState().handleEvent?.("sync:account-complete", payload);
  },
  "sync:account-error": (payload) => {
    useAccountStore.getState().handleEvent?.("sync:account-error", payload);
  },
  "share:received": (payload) => {
    useAccountStore.getState().handleEvent?.("share:received", payload);
  },
});

/**
 * Initialize the account store's EventBus subscription. Idempotent —
 * subsequent calls return the same cleanup function. Returns a cleanup
 * function that removes all registered handlers.
 */
export function initAccountStoreEvents(): () => void {
  return accountStoreEventSub.init();
}

// Eagerly initialise in browser environments (module-level side-effect).
if (typeof window !== "undefined") {
  initAccountStoreEvents();
}
