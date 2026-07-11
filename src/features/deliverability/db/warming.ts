import { listWarming, upsertWarming, executeSearchQuery, insertWarmingLog } from "@/shared/services/db/db-invoke";
import type { EmailWarmingRow } from "@/shared/services/db/db-invoke";

export type { EmailWarmingRow };

export interface WarmingLogRow {
  id: string;
  account_id: string;
  sent_date: string;
  volume: number;
  created_at: number;
}

export async function getWarmingPlan(accountId: string): Promise<EmailWarmingRow | null> {
  const plans = await listWarming(accountId);
  return plans[0] ?? null;
}

export async function upsertWarmingPlan(accountId: string, plan: Partial<EmailWarmingRow>): Promise<void> {
  await upsertWarming({
    accountId,
    enabled: plan.enabled,
    startVolume: plan.start_volume,
    currentVolume: plan.current_volume,
    targetVolume: plan.target_volume,
    rampDays: plan.ramp_days,
  });
}

export async function logWarmingVolume(accountId: string, volume: number): Promise<void> {
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  await insertWarmingLog(id, accountId, today, volume);
}

export async function getWarmingLogs(accountId: string): Promise<WarmingLogRow[]> {
  return executeSearchQuery(
    "SELECT * FROM warming_log WHERE account_id = $1 ORDER BY sent_date ASC",
    [accountId],
  ) as unknown as Promise<WarmingLogRow[]>;
}

export async function getLastWarmingLogDate(accountId: string): Promise<string | null> {
  const rows = await executeSearchQuery(
    "SELECT sent_date FROM warming_log WHERE account_id = $1 ORDER BY sent_date DESC LIMIT 1",
    [accountId],
  ) as unknown as { sent_date: string }[];
  return rows[0]?.sent_date ?? null;
}
