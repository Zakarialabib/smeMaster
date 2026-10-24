/**
 * Microsoft Graph token/client manager — thin wrapper over the shared provider
 * token manager (`../oauthClientManager.ts`). All public names are unchanged
 * for existing importers (`getMicrosoftGraphClient`, …).
 */
import { MicrosoftGraphClient } from './client';
import { startMicrosoftOAuthFlow } from './auth';
import { createProviderTokenManager } from '../oauthClientManager';

const manager = createProviderTokenManager<MicrosoftGraphClient>({
  brand: 'Microsoft',
  clientIdSetting: 'microsoft_client_id',
  clientSecretSetting: 'microsoft_client_secret',
  revokeAccessUrl: 'https://myaccount.microsoft.com/permissions',
  matchesAccount: (account) => account.provider === 'microsoft_graph' && !!account.is_active,
  createClient: (accountId, clientId, tokenInfo, clientSecret) =>
    new MicrosoftGraphClient(accountId, clientId, tokenInfo, clientSecret),
  startOAuthFlow: startMicrosoftOAuthFlow,
});

export const getMicrosoftGraphClient = manager.getClient;
export const removeMicrosoftClient = manager.removeClient;
export const getMicrosoftClientId = manager.getClientId;
export const getMicrosoftClientSecret = manager.getClientSecret;
export const initializeMicrosoftClients = manager.initializeClients;
export const reauthorizeMicrosoftAccount = manager.reauthorizeAccount;
