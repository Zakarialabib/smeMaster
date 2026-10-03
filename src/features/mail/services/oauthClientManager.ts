/**
 * oauthClientManager — shared provider token/client manager.
 *
 * Gmail and Microsoft previously kept line-for-line clones of the same
 * client-cache / eager-init / reauthorize logic (and had already drifted:
 * only Microsoft filtered by `provider` during eager init). This factory owns
 * the shared flow once; each provider supplies only its brand strings,
 * settings keys, account filter, client constructor and OAuth flow.
 *
 * Public function names of `gmail/tokenManager.ts` and
 * `microsoft/tokenManager.ts` are unchanged — they re-export this manager.
 */
import {
  getAllAccounts,
  getAccount,
  updateAccountAllTokens,
  type DbAccount,
} from '@features/accounts/db/accounts';
import { getSetting, getSecureSetting } from '@features/settings/db/settings';
import { getCurrentUnixTimestamp } from '@shared/utils/timestamp';
import { normalizeEmail } from '@shared/utils/emailUtils';

/** Normalized token set handed to provider client constructors. */
export interface ManagerTokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/** Minimal OAuth flow contract shared by Google and Microsoft. */
export interface OAuthFlowResult {
  tokens: { access_token: string; refresh_token?: string; expires_in: number };
  userInfo: { email: string };
}

export interface ProviderTokenManagerConfig<TClient> {
  /** User-facing brand used in error messages ("Google", "Microsoft"). */
  brand: string;
  /** Settings key holding the OAuth client id. */
  clientIdSetting: string;
  /** Settings key holding the OAuth client secret (secure storage). */
  clientSecretSetting: string;
  /** Where the user revokes app access (shown when a refresh_token is missing). */
  revokeAccessUrl: string;
  /** Which accounts this manager may eagerly initialize (token checks are applied on top). */
  matchesAccount: (account: DbAccount) => boolean;
  /** Provider-specific client constructor. */
  createClient: (
    accountId: string,
    clientId: string,
    tokenInfo: ManagerTokenInfo,
    clientSecret?: string,
  ) => TClient;
  /** Provider-specific OAuth authorization-code flow. */
  startOAuthFlow: (clientId: string, clientSecret?: string) => Promise<OAuthFlowResult>;
}

export interface ProviderTokenManager<TClient> {
  getClient(accountId: string): Promise<TClient>;
  removeClient(accountId: string): void;
  getClientId(): Promise<string>;
  getClientSecret(): Promise<string | undefined>;
  initializeClients(): Promise<void>;
  reauthorizeAccount(accountId: string, expectedEmail: string): Promise<void>;
}

/**
 * Build a provider token manager with a shared in-memory client cache.
 * One manager instance per provider — its `clients` Map is module-private.
 */
export function createProviderTokenManager<TClient>(
  cfg: ProviderTokenManagerConfig<TClient>,
): ProviderTokenManager<TClient> {
  const clients = new Map<string, TClient>();

  async function getClientId(): Promise<string> {
    const clientId = await getSetting(cfg.clientIdSetting);
    if (!clientId) {
      throw new Error(`${cfg.brand} Client ID not configured. Go to Settings to set it up.`);
    }
    return clientId;
  }

  async function getClientSecret(): Promise<string | undefined> {
    return (await getSecureSetting(cfg.clientSecretSetting)) ?? undefined;
  }

  function toTokenInfo(account: {
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: number | null;
  }): ManagerTokenInfo {
    return {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.token_expires_at ?? 0,
    } as ManagerTokenInfo;
  }

  async function getClient(accountId: string): Promise<TClient> {
    const existing = clients.get(accountId);
    if (existing) return existing;

    const clientId = await getClientId();
    const clientSecret = await getClientSecret();
    const accounts = await getAllAccounts();
    const account = accounts.find((a) => a.id === accountId);

    if (!account) throw new Error(`Account ${accountId} not found`);
    if (!account.access_token || !account.refresh_token) {
      throw new Error(`Account ${accountId} has no tokens`);
    }

    const client = cfg.createClient(accountId, clientId, toTokenInfo(account), clientSecret);
    clients.set(accountId, client);
    return client;
  }

  function removeClient(accountId: string): void {
    clients.delete(accountId);
  }

  async function initializeClients(): Promise<void> {
    const accounts = await getAllAccounts();
    const clientId = await getSetting(cfg.clientIdSetting);
    if (!clientId) return;
    const clientSecret = (await getSecureSetting(cfg.clientSecretSetting)) ?? undefined;

    for (const account of accounts) {
      if (cfg.matchesAccount(account) && account.access_token && account.refresh_token) {
        const client = cfg.createClient(account.id, clientId, toTokenInfo(account), clientSecret);
        clients.set(account.id, client);
      }
    }
  }

  async function reauthorizeAccount(accountId: string, expectedEmail: string): Promise<void> {
    const account = await getAccount(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);

    const clientId = await getClientId();
    const clientSecret = await getClientSecret();

    const { tokens, userInfo } = await cfg.startOAuthFlow(clientId, clientSecret);

    if (normalizeEmail(userInfo.email) !== normalizeEmail(expectedEmail)) {
      throw new Error(
        `Signed in as ${userInfo.email}, but expected ${expectedEmail}. Please sign in with the correct account.`,
      );
    }

    if (!tokens.refresh_token) {
      throw new Error(
        `${cfg.brand} did not return a refresh token. Please revoke app access at ${cfg.revokeAccessUrl} and try again.`,
      );
    }

    const expiresAt = getCurrentUnixTimestamp() + tokens.expires_in;
    await updateAccountAllTokens(accountId, tokens.access_token, tokens.refresh_token, expiresAt);

    // Evict stale client and create a fresh one
    clients.delete(accountId);
    const client = cfg.createClient(
      accountId,
      clientId,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
      clientSecret,
    );
    clients.set(accountId, client);
  }

  return {
    getClient,
    removeClient,
    getClientId,
    getClientSecret,
    initializeClients,
    reauthorizeAccount,
  };
}
