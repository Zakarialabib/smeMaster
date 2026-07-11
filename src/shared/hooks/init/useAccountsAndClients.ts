import { useEffect, useCallback, useRef, useState } from "react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import type { Account } from "@features/accounts/stores/accountStore";
import { getAllAccounts } from "@features/accounts/db/accounts";
import { getSetting } from "@features/settings/db/settings";
import {
  initializeClients,
  getGmailClient,
} from "@features/mail/services/gmail/tokenManager";
import { fetchSendAsAliases } from "@features/mail/services/gmail/sendAs";
import { syncAccount } from "@features/mail/services/gmail/syncManager";
import { withRetry } from "./_utils";

/**
 * Maps a `DbAccount` (snake_case, number booleans) to the store's `Account`
 * type (camelCase, boolean booleans).
 */
function mapDbAccounts(
  dbAccounts: Awaited<ReturnType<typeof getAllAccounts>>,
): Account[] {
  return dbAccounts.map((a) => ({
    id: a.id,
    email: a.email,
    displayName: a.display_name,
    company: null,
    avatarUrl: a.avatar_url,
    isActive: a.is_active === 1,
    provider: a.provider,
  }));
}

/**
 * Fetch send-as aliases for all active Gmail/IMAP accounts in parallel.
 * Failures are non-fatal per account.
 */
async function fetchAliasesForAccounts(accounts: Account[]): Promise<void> {
  const emailAccountIds = accounts
    .filter((a) => a.isActive && a.provider !== "caldav" && a.provider !== "local")
    .map((a) => a.id);

  await Promise.allSettled(
    emailAccountIds.map(async (accountId) => {
      try {
        const client = await getGmailClient(accountId);
        await fetchSendAsAliases(client, accountId);
      } catch (err) {
        console.warn(`[init] Failed to fetch send-as aliases for ${accountId}:`, err);
      }
    }),
  );
}

/**
 * Phase 5 + Phase 7: Load accounts from DB, initialize Gmail clients,
 * set accounts in store, and fetch send-as aliases (non-blocking).
 *
 * Returns `{ accounts, refresh }` where `refresh()` can be called
 * after adding a new account (replaces `handleAddAccountSuccess`).
 */
export function useAccountsAndClients(): {
  accounts: Account[];
  refresh: () => Promise<void>;
} {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function load() {
      // Phase 5: Load accounts & initialize clients
      const mapped = await withRetry<Account[]>(
        "getAllAccounts",
        async () => {
          const dbAccounts = await getAllAccounts();
          return mapDbAccounts(dbAccounts);
        },
        [],
      );
      if (!mapped || mapped.length === 0) return;

      const savedAccountId = await withRetry("getSetting(active_account_id)", () =>
        getSetting("active_account_id"),
      );

      useAccountStore.getState().setAccounts(mapped, savedAccountId ?? undefined);
      setAccounts(mapped);

      await withRetry("initializeClients", () => initializeClients());

      // Phase 7: Fetch send-as aliases (non-blocking per account)
      fetchAliasesForAccounts(mapped).catch(() => {});
    }

    load();
  }, []);

  const refresh = useCallback(async () => {
    const dbAccounts = await getAllAccounts();
    const mapped = mapDbAccounts(dbAccounts);
    useAccountStore.getState().setAccounts(mapped);
    setAccounts(mapped);

    await initializeClients();

    const newest = mapped[mapped.length - 1];
    if (newest) {
      syncAccount(newest.id);
      if (newest.provider !== "caldav") {
        getGmailClient(newest.id)
          .then((client) => fetchSendAsAliases(client, newest.id))
          .catch((err) =>
            console.warn(`[init] Failed to fetch send-as aliases for new account:`, err),
          );
      }
    }
  }, []);

  return { accounts, refresh };
}