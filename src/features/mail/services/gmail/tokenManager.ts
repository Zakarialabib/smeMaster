/**
 * Gmail token/client manager — thin wrapper over the shared provider token
 * manager (`../oauthClientManager.ts`). All public names are unchanged for
 * existing importers (`getGmailClient`, `initializeClients`, …).
 */
import { GmailClient } from './client';
import { startOAuthFlow } from './auth';
import { createProviderTokenManager } from '../oauthClientManager';

const manager = createProviderTokenManager<GmailClient>({
  brand: 'Google',
  clientIdSetting: 'google_client_id',
  clientSecretSetting: 'google_client_secret',
  revokeAccessUrl: 'https://myaccount.google.com/permissions',
  // Preserve historical behavior: eager-init every active account that has
  // tokens (no provider filter — see docs/02-BACKEND/12-diagnostics.md).
  matchesAccount: (account) => !!account.is_active,
  createClient: (accountId, clientId, tokenInfo, clientSecret) =>
    new GmailClient(accountId, clientId, tokenInfo, clientSecret),
  startOAuthFlow,
});

export const getGmailClient = manager.getClient;
export const removeClient = manager.removeClient;
export const getClientId = manager.getClientId;
export const getClientSecret = manager.getClientSecret;
export const initializeClients = manager.initializeClients;
export const reauthorizeAccount = manager.reauthorizeAccount;
