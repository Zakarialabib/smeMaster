import { executeSearchQuery, insertSuppression, removeSuppression } from "@shared/services/db/db-invoke";

export interface SuppressionEntry {
  id: string;
  account_id: string;
  email: string;
  reason: string;
  suppressed_at: number;
}

export async function isSuppressed(accountId: string, email: string): Promise<boolean> {
  const rows = await executeSearchQuery(
    "SELECT COUNT(*) as count FROM suppression_list WHERE account_id = $1 AND email = $2",
    [accountId, email.toLowerCase()],
  ) as unknown as { count: number }[];
  return (rows[0]?.count ?? 0) > 0;
}

export async function addToSuppression(accountId: string, email: string, reason: string): Promise<void> {
  await insertSuppression(crypto.randomUUID(), accountId, email.toLowerCase(), reason);
}

export async function removeFromSuppression(accountId: string, email: string): Promise<void> {
  await removeSuppression(accountId, email.toLowerCase());
}

export async function getSuppressionList(accountId: string): Promise<SuppressionEntry[]> {
  return executeSearchQuery(
    "SELECT * FROM suppression_list WHERE account_id = $1 ORDER BY suppressed_at DESC",
    [accountId],
  ) as unknown as Promise<SuppressionEntry[]>;
}
