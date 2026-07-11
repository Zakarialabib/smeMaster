import { MicrosoftGraphClient } from "./client";
import { startMicrosoftOAuthFlow } from "./auth";
import { getAllAccounts, getAccount, updateAccountAllTokens } from "@features/accounts/db/accounts";
import { getSetting, getSecureSetting } from "@features/settings/db/settings";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { normalizeEmail } from "@shared/utils/emailUtils";

// In-memory cache of active MicrosoftGraphClient instances per account
const clients = new Map<string, MicrosoftGraphClient>();

/**
 * Get or create a MicrosoftGraphClient for the given account.
 */
export async function getMicrosoftGraphClient(
  accountId: string,
): Promise<MicrosoftGraphClient> {
  const existing = clients.get(accountId);
  if (existing) return existing;

  const clientId = await getMicrosoftClientId();
  const clientSecret = await getMicrosoftClientSecret();
  const accounts = await getAllAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) throw new Error(`Account ${accountId} not found`);
  if (!account.access_token || !account.refresh_token) {
    throw new Error(`Account ${accountId} has no tokens`);
  }

  const client = new MicrosoftGraphClient(accountId, clientId, {
    accessToken: account.access_token,
    refreshToken: account.refresh_token,
    expiresAt: account.token_expires_at ?? 0,
  }, clientSecret);

  clients.set(accountId, client);
  return client;
}

/**
 * Remove a client from cache (e.g., on account removal or re-auth).
 */
export function removeMicrosoftClient(accountId: string): void {
  clients.delete(accountId);
}

/**
 * Get the Microsoft OAuth client ID from settings.
 */
export async function getMicrosoftClientId(): Promise<string> {
  const clientId = await getSetting("microsoft_client_id");
  if (!clientId) {
    throw new Error("Microsoft Client ID not configured. Go to Settings to set it up.");
  }
  return clientId;
}

/**
 * Get the Microsoft OAuth client secret from settings (optional, for Web app clients).
 */
export async function getMicrosoftClientSecret(): Promise<string | undefined> {
  const clientSecret = await getSecureSetting("microsoft_client_secret");
  return clientSecret ?? undefined;
}

/**
 * Initialize clients for all active Microsoft Graph accounts on app startup.
 */
export async function initializeMicrosoftClients(): Promise<void> {
  const accounts = await getAllAccounts();
  const clientId = await getSetting("microsoft_client_id");
  if (!clientId) return;
  const clientSecret = (await getSecureSetting("microsoft_client_secret")) ?? undefined;

  for (const account of accounts) {
    if (account.provider === "microsoft_graph" && account.is_active && account.access_token && account.refresh_token) {
      const client = new MicrosoftGraphClient(account.id, clientId, {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        expiresAt: account.token_expires_at ?? 0,
      }, clientSecret);
      clients.set(account.id, client);
    }
  }
}

/**
 * Re-authorize an existing Microsoft account to obtain new tokens (e.g., after scope changes).
 * Preserves all local data — only replaces tokens.
 */
export async function reauthorizeMicrosoftAccount(
  accountId: string,
  expectedEmail: string,
): Promise<void> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const clientId = await getMicrosoftClientId();
  const clientSecret = await getMicrosoftClientSecret();

  const { tokens, userInfo } = await startMicrosoftOAuthFlow(clientId, clientSecret);

  if (normalizeEmail(userInfo.email) !== normalizeEmail(expectedEmail)) {
    throw new Error(
      `Signed in as ${userInfo.email}, but expected ${expectedEmail}. Please sign in with the correct account.`,
    );
  }

  if (!tokens.refresh_token) {
    throw new Error(
      "Microsoft did not return a refresh token. Please revoke app access at https://myaccount.microsoft.com/permissions and try again.",
    );
  }

  const expiresAt = getCurrentUnixTimestamp() + tokens.expires_in;
  await updateAccountAllTokens(accountId, tokens.access_token, tokens.refresh_token, expiresAt);

  // Evict stale client and create a fresh one
  clients.delete(accountId);
  const client = new MicrosoftGraphClient(accountId, clientId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  }, clientSecret);
  clients.set(accountId, client);
}