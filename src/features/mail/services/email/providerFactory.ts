import type { EmailProvider } from "./types";
import { GmailApiProvider } from "./gmailProvider";
import { ImapSmtpProvider } from "./imapSmtpProvider";
import { getAccount } from "@features/accounts/db/accounts";
import { getGmailClient } from "../gmail/tokenManager";

const providers = new Map<string, EmailProvider>();

/**
 * Known provider types stored in the `provider` column of the accounts table.
 * - `"imap"`           → IMAP/SMTP (generic / self-hosted)
 * - `"gmail_api"`      → Gmail API (OAuth)
 * - `"microsoft_graph"`→ Microsoft 365 / Outlook.com (OAuth)
 */
type ProviderKind = "imap" | "gmail_api" | "microsoft_graph";

/**
 * Get or create the appropriate EmailProvider for the given account.
 * Providers are cached in memory by account ID.
 *
 * Supported provider types:
 *   - `imap`           → ImapSmtpProvider (generic, works for drafts)
 *   - `gmail_api`      → GmailApiProvider  (OAuth + Gmail API)
 *   - `microsoft_graph`→ throws a descriptive error (not yet implemented)
 */
export async function getEmailProvider(
  accountId: string,
): Promise<EmailProvider> {
  const existing = providers.get(accountId);
  if (existing) return existing;

  const account = await getAccount(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const kind = (account.provider ?? "imap") as ProviderKind;
  let provider: EmailProvider;

  switch (kind) {
    case "imap":
      provider = new ImapSmtpProvider(accountId);
      break;

    case "microsoft_graph":
      throw new Error(
        `Microsoft Graph provider is not yet supported for ${account.email || accountId}. ` +
        `Actions like creating drafts, sending, and label management are only available ` +
        `for IMAP and Gmail accounts at this time.`,
      );

    case "gmail_api":
    default: {
      const client = await getGmailClient(accountId);
      provider = new GmailApiProvider(accountId, client);
      break;
    }
  }

  providers.set(accountId, provider);
  return provider;
}

/**
 * Remove a provider from cache (e.g., on account removal or re-auth).
 */
export function removeProvider(accountId: string): void {
  providers.delete(accountId);
}

/**
 * Invalidate the cached IMAP/SMTP config for a provider without removing
 * the provider itself. Call this after updating account credentials so the
 * next sync picks up the new password/host settings.
 */
export function invalidateProviderConfig(accountId: string): void {
  const existing = providers.get(accountId);
  if (existing && existing instanceof ImapSmtpProvider) {
    existing.clearConfigCache();
  }
}

/**
 * Clear all cached providers.
 */
export function clearAllProviders(): void {
  providers.clear();
}
