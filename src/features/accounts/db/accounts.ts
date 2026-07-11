import { encryptValue, decryptValue, isEncrypted } from "@shared/utils/crypto";
import {
  getAccount as dbGetAccount,
  getAccountByEmail as dbGetAccountByEmail,
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount as dbDeleteAccount,
  updateAccountLastSync,
} from "../../../shared/services/db/db-invoke";
import type { Account } from "../../../shared/services/db/db-invoke";

export type DbAccount = Account & {
  caldav_url: string | null;
  caldav_username: string | null;
  caldav_password: string | null;
  caldav_principal_url: string | null;
  caldav_home_url: string | null;
  calendar_provider: string | null;
  accept_invalid_certs: number;
};

interface AccountMetadata {
  caldav_url?: string | null;
  caldav_username?: string | null;
  caldav_password?: string | null;
  caldav_principal_url?: string | null;
  caldav_home_url?: string | null;
  calendar_provider?: string | null;
  accept_invalid_certs?: boolean | number | null;
  [key: string]: unknown;
}

function parseAccountMetadata(account: Account): AccountMetadata {
  try {
    const parsed = JSON.parse(account.metadata_json || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as AccountMetadata
      : {};
  } catch {
    return {};
  }
}

function normalizeCertFlag(value: boolean | number | null | undefined): number {
  return value === true || value === 1 ? 1 : 0;
}

async function hydrateAccount(account: Account): Promise<DbAccount> {
  const decrypted = await decryptAccountTokens({ ...account });
  const metadata = parseAccountMetadata(decrypted);
  const caldavPassword = metadata.caldav_password;
  let decryptedCalDavPassword = typeof caldavPassword === "string" ? caldavPassword : null;

  if (decryptedCalDavPassword && isEncrypted(decryptedCalDavPassword)) {
    try {
      decryptedCalDavPassword = await decryptValue(decryptedCalDavPassword);
    } catch (err) {
      console.warn("Failed to decrypt CalDAV password, using raw value:", err);
    }
  }

  return {
    ...decrypted,
    caldav_url: typeof metadata.caldav_url === "string" ? metadata.caldav_url : null,
    caldav_username: typeof metadata.caldav_username === "string" ? metadata.caldav_username : null,
    caldav_password: decryptedCalDavPassword,
    caldav_principal_url: typeof metadata.caldav_principal_url === "string" ? metadata.caldav_principal_url : null,
    caldav_home_url: typeof metadata.caldav_home_url === "string" ? metadata.caldav_home_url : null,
    calendar_provider: typeof metadata.calendar_provider === "string" ? metadata.calendar_provider : null,
    accept_invalid_certs: normalizeCertFlag(metadata.accept_invalid_certs),
  };
}

async function decryptAccountTokens(account: Account): Promise<Account> {
  if (account.access_token && isEncrypted(account.access_token)) {
    try {
      account.access_token = await decryptValue(account.access_token);
    } catch (err) {
      console.warn("Failed to decrypt access token, using raw value:", err);
    }
  }
  if (account.refresh_token && isEncrypted(account.refresh_token)) {
    try {
      account.refresh_token = await decryptValue(account.refresh_token);
    } catch (err) {
      console.warn("Failed to decrypt refresh token, using raw value:", err);
    }
  }
  if (account.imap_password && isEncrypted(account.imap_password)) {
    try {
      account.imap_password = await decryptValue(account.imap_password);
    } catch (err) {
      console.warn("Failed to decrypt IMAP password, using raw value:", err);
    }
  }
  if (account.oauth_client_secret && isEncrypted(account.oauth_client_secret)) {
    try {
      account.oauth_client_secret = await decryptValue(account.oauth_client_secret);
    } catch (err) {
      console.warn("Failed to decrypt OAuth client secret, using raw value:", err);
    }
  }
  if (account.smtp_password && isEncrypted(account.smtp_password)) {
    try {
      account.smtp_password = await decryptValue(account.smtp_password);
    } catch (err) {
      console.warn("Failed to decrypt SMTP password, using raw value:", err);
    }
  }
  return account;
}

export async function getAllAccounts(): Promise<DbAccount[]> {
  const accounts = await listAccounts();
  return Promise.all(accounts.map(hydrateAccount));
}

export async function countAccounts(): Promise<number> {
  return (await getAllAccounts()).length;
}

export async function insertAccount(account: {
   id?: string;
   email: string;
   displayName: string | null;
   avatarUrl?: string | null;
   accessToken: string;
   refreshToken: string;
   tokenExpiresAt: number;
}): Promise<DbAccount> {
   const encAccessToken = await encryptValue(account.accessToken);
   const encRefreshToken = await encryptValue(account.refreshToken);
   const created = await createAccount({
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl ?? null,
    provider: "gmail_api",
    accessToken: encAccessToken,
    refreshToken: encRefreshToken,
  });
   await updateAccount(created.id, {
     set: { token_expires_at: account.tokenExpiresAt },
     unset: [],
   });
   return hydrateAccount({ ...created, token_expires_at: account.tokenExpiresAt });
}

export async function insertMicrosoftAccount(account: {
   id?: string;
   email: string;
   displayName: string | null;
   avatarUrl?: string | null;
   accessToken: string;
   refreshToken: string;
   tokenExpiresAt: number;
}): Promise<DbAccount> {
   const encAccessToken = await encryptValue(account.accessToken);
   const encRefreshToken = await encryptValue(account.refreshToken);
   const created = await createAccount({
     email: account.email,
     displayName: account.displayName,
     provider: "microsoft_graph",
     accessToken: encAccessToken,
     refreshToken: encRefreshToken,
   });
   await updateAccount(created.id, {
     set: { token_expires_at: account.tokenExpiresAt },
     unset: [],
   });
   return hydrateAccount({ ...created, token_expires_at: account.tokenExpiresAt });
}

export async function updateAccountTokens(
  id: string,
  accessToken: string,
  tokenExpiresAt: number,
): Promise<void> {
  const encAccessToken = await encryptValue(accessToken);
  await updateAccount(id, {
    set: { access_token: encAccessToken, token_expires_at: tokenExpiresAt },
    unset: [],
  });
}

export async function updateAccountSyncState(
  id: string,
  historyId: string,
): Promise<void> {
  await updateAccountLastSync(id, historyId);
}

export async function clearAccountHistoryId(id: string): Promise<void> {
  await updateAccount(id, {
    set: {},
    unset: ["history_id"],
  });
}

export async function updateAccountAllTokens(
  id: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: number,
): Promise<void> {
  const encAccessToken = await encryptValue(accessToken);
  const encRefreshToken = await encryptValue(refreshToken);
  await updateAccount(id, {
    set: {
      access_token: encAccessToken,
      refresh_token: encRefreshToken,
      token_expires_at: tokenExpiresAt,
    },
    unset: [],
  });
}

export async function deleteAccount(id: string): Promise<void> {
  await dbDeleteAccount(id);
}

export async function insertImapAccount(account: {
  id?: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecurity: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  authMethod: string;
  password: string;
  imapUsername?: string | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  acceptInvalidCerts?: boolean | null;
}): Promise<DbAccount> {
  const encPassword = await encryptValue(account.password);
  const encSmtpPassword = account.smtpPassword
    ? await encryptValue(account.smtpPassword)
    : null;
  const created = await createAccount({
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl ?? null,
    provider: "imap",
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecurity: account.imapSecurity,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecurity: account.smtpSecurity,
    authMethod: account.authMethod,
    imapPassword: encPassword,
    imapUsername: account.imapUsername || null,
    smtpUsername: account.smtpUsername || null,
    smtpPassword: encSmtpPassword,
  });
  if (account.acceptInvalidCerts !== undefined) {
    const metadata = {
      ...parseAccountMetadata(created),
      accept_invalid_certs: account.acceptInvalidCerts ?? false,
    };
    await updateAccount(created.id, {
      set: { metadata_json: JSON.stringify(metadata) },
      unset: [],
    });
    return hydrateAccount({ ...created, metadata_json: JSON.stringify(metadata) });
  }
  return hydrateAccount(created);
}

export async function insertCalDavAccount(account: {
  id?: string;
  email: string;
  displayName: string | null;
  caldavUrl: string;
  caldavUsername: string;
  caldavPassword: string;
  caldavPrincipalUrl?: string | null;
  caldavHomeUrl?: string | null;
  acceptInvalidCerts?: boolean | null;
}): Promise<DbAccount> {
  const encPassword = await encryptValue(account.caldavPassword);
  const metadata: AccountMetadata = {
    caldav_url: account.caldavUrl,
    caldav_username: account.caldavUsername,
    caldav_password: encPassword,
    caldav_principal_url: account.caldavPrincipalUrl ?? null,
    caldav_home_url: account.caldavHomeUrl ?? null,
    calendar_provider: "caldav",
    accept_invalid_certs: account.acceptInvalidCerts ?? false,
  };

  const created = await createAccount({
    email: account.email,
    displayName: account.displayName,
    provider: "caldav",
    authMethod: "password",
  });

  await updateAccount(created.id, {
    set: { metadata_json: JSON.stringify(metadata) },
    unset: [],
  });

  return hydrateAccount({
    ...created,
    metadata_json: JSON.stringify(metadata),
  });
}

export async function updateAccountCalDav(
  id: string,
  fields: {
    caldavUrl?: string | null;
    caldavUsername?: string | null;
    caldavPassword?: string | null;
    caldavPrincipalUrl?: string | null;
    caldavHomeUrl?: string | null;
    calendarProvider?: string | null;
    acceptInvalidCerts?: boolean | null;
  },
): Promise<void> {
  const current = await dbGetAccount(id);
  const metadata = parseAccountMetadata(current);

  if (fields.caldavUrl !== undefined) metadata.caldav_url = fields.caldavUrl || null;
  if (fields.caldavUsername !== undefined) metadata.caldav_username = fields.caldavUsername || null;
  if (fields.caldavPrincipalUrl !== undefined) metadata.caldav_principal_url = fields.caldavPrincipalUrl || null;
  if (fields.caldavHomeUrl !== undefined) metadata.caldav_home_url = fields.caldavHomeUrl || null;
  if (fields.calendarProvider !== undefined) metadata.calendar_provider = fields.calendarProvider || null;
  if (fields.acceptInvalidCerts !== undefined) metadata.accept_invalid_certs = fields.acceptInvalidCerts ?? false;
  if (fields.caldavPassword !== undefined) {
    metadata.caldav_password = fields.caldavPassword
      ? await encryptValue(fields.caldavPassword)
      : null;
  }

  await updateAccount(id, {
    set: { metadata_json: JSON.stringify(metadata) },
    unset: [],
  });
}

export async function insertOAuthImapAccount(account: {
  id?: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecurity: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  oauthProvider: string;
  oauthClientId: string;
  oauthClientSecret: string | null;
  imapUsername?: string | null;
  acceptInvalidCerts?: boolean | null;
}): Promise<DbAccount> {
  const encAccessToken = await encryptValue(account.accessToken);
  const encRefreshToken = await encryptValue(account.refreshToken);
  const encClientSecret = account.oauthClientSecret
    ? await encryptValue(account.oauthClientSecret)
    : null;
  const created = await createAccount({
    email: account.email,
    displayName: account.displayName,
    provider: "imap",
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecurity: account.imapSecurity,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecurity: account.smtpSecurity,
    authMethod: "oauth2",
    oauthProvider: account.oauthProvider,
    oauthClientId: account.oauthClientId,
    oauthClientSecret: encClientSecret,
    accessToken: encAccessToken,
    refreshToken: encRefreshToken,
    imapUsername: account.imapUsername || null,
  });
  await updateAccount(created.id, {
    set: {
      token_expires_at: account.tokenExpiresAt,
      metadata_json: JSON.stringify({
        ...parseAccountMetadata(created),
        accept_invalid_certs: account.acceptInvalidCerts ?? false,
      }),
    },
    unset: [],
  });
  return hydrateAccount({
    ...created,
    token_expires_at: account.tokenExpiresAt,
    metadata_json: JSON.stringify({
      ...parseAccountMetadata(created),
      accept_invalid_certs: account.acceptInvalidCerts ?? false,
    }),
  });
}

export async function getAccount(id: string): Promise<DbAccount | null> {
  try {
    const account = await dbGetAccount(id);
    return account ? hydrateAccount(account) : null;
  } catch {
    return null;
  }
}

export async function getAccountByEmail(
  email: string,
): Promise<DbAccount | null> {
  const account = await dbGetAccountByEmail(email);
  return account ? hydrateAccount(account) : null;
}
