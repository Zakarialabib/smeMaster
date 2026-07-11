import { invokeCommand } from "@shared/services/db/invoke/command";

export async function cachePassphrase(
  accountId: string,
  passphrase: string,
): Promise<void> {
  await invokeCommand("pgp_cache_passphrase", { accountId, passphrase });
}

export async function getCachedPassphrase(
  accountId: string,
): Promise<string | null> {
  return invokeCommand<string | null>("pgp_get_cached_passphrase", { accountId });
}

export async function clearPassphraseCache(accountId: string): Promise<void> {
  await invokeCommand("pgp_clear_passphrase_cache", { accountId });
}
