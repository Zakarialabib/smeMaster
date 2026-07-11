import { normalizeEmail } from "@shared/utils/emailUtils";
import { listImageAllowlist, upsertImageAllowlist, executeSearchQuery, removeImageAllowlist } from "@/shared/services/db/db-invoke";
import type { ImageAllowlistEntry } from "@/shared/services/db/db-invoke";

export type { ImageAllowlistEntry };

export async function isAllowlisted(
  accountId: string,
  senderAddress: string,
): Promise<boolean> {
  const rows = await executeSearchQuery(
    "SELECT id FROM image_allowlist WHERE account_id = $1 AND sender_address = $2 LIMIT 1",
    [accountId, normalizeEmail(senderAddress)],
  ) as unknown as { id: string }[];
  return rows.length > 0;
}

/**
 * Batch-check which senders are allowlisted in a single query.
 */
export async function getAllowlistedSenders(
  accountId: string,
  senderAddresses: string[],
): Promise<Set<string>> {
  if (senderAddresses.length === 0) return new Set();

  const normalized = senderAddresses.map(normalizeEmail);
  const placeholders = normalized.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await executeSearchQuery(
    `SELECT sender_address FROM image_allowlist WHERE account_id = $1 AND sender_address IN (${placeholders})`,
    [accountId, ...normalized],
  ) as unknown as { sender_address: string }[];
  return new Set(rows.map((r) => r.sender_address));
}

export async function addToAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  await upsertImageAllowlist({
    accountId,
    senderAddress: normalizeEmail(senderAddress),
  });
}

export async function removeFromAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  await removeImageAllowlist(accountId, normalizeEmail(senderAddress));
}

export async function getAllowlistForAccount(
  accountId: string,
): Promise<ImageAllowlistEntry[]> {
  return listImageAllowlist(accountId);
}
