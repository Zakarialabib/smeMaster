import { listBlacklistCache, upsertBlacklistCache, executeSearchQuery } from "@/shared/services/db/db-invoke";
import type { BlacklistCheckRow } from "@/shared/services/db/db-invoke";

export type { BlacklistCheckRow };

export async function getCachedCheck(accountId: string, checkType: string, target: string): Promise<BlacklistCheckRow | null> {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  const rows = await executeSearchQuery(
    "SELECT * FROM blacklist_checks WHERE account_id = $1 AND check_type = $2 AND target = $3 AND checked_at > $4 ORDER BY checked_at DESC LIMIT 1",
    [accountId, checkType, target, oneHourAgo],
  ) as unknown as BlacklistCheckRow[];
  return rows[0] ?? null;
}

export async function cacheCheck(
  accountId: string,
  checkType: string,
  target: string,
  listed: boolean,
  listName: string | null,
  responded: boolean,
): Promise<void> {
  await upsertBlacklistCache({
    accountId,
    checkType,
    target,
    listed,
    listName,
    responded,
  });
}

export async function getBlacklistHistory(accountId: string): Promise<BlacklistCheckRow[]> {
  return listBlacklistCache(accountId);
}
