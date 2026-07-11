import { normalizeEmail } from "@shared/utils/emailUtils";
import { listPhishingAllowlist, upsertPhishingAllowlist, executeSearchQuery, removePhishingAllowlist } from "@/shared/services/db/db-invoke";
import type { PhishingAllowlistEntry } from "@/shared/services/db/db-invoke";

export type { PhishingAllowlistEntry };

export async function isPhishingAllowlisted(
  accountId: string,
  senderAddress: string,
): Promise<boolean> {
  const rows = await executeSearchQuery(
    "SELECT id FROM phishing_allowlist WHERE account_id = $1 AND sender_address = $2 LIMIT 1",
    [accountId, normalizeEmail(senderAddress)],
  ) as unknown as { id: string }[];
  return rows.length > 0;
}

export async function addToPhishingAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  await upsertPhishingAllowlist({
    accountId,
    senderAddress: normalizeEmail(senderAddress),
  });
}

export async function removeFromPhishingAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  await removePhishingAllowlist(accountId, normalizeEmail(senderAddress));
}

export async function getPhishingAllowlist(
  accountId: string,
): Promise<PhishingAllowlistEntry[]> {
  return listPhishingAllowlist(accountId);
}
