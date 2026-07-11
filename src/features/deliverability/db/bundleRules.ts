import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import {
  listBundleRules,
  upsertBundleRule,
  executeSearchQuery,
  holdBundledThread,
  releaseHeldThreads as releaseHeldThreadsWrapper,
  updateBundleRuleDelivered,
} from "@/shared/services/db/db-invoke";
import type { DbBundleRule } from "@/shared/services/db/db-invoke";

export type { DbBundleRule };

export interface DeliverySchedule {
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number;
  minute: number;
}

export interface DbBundledThread {
  account_id: string;
  thread_id: string;
  category: string;
  held_until: number | null;
}

export async function getBundleRules(accountId: string): Promise<DbBundleRule[]> {
  return listBundleRules(accountId);
}

export async function getBundleRule(
  accountId: string,
  category: string,
): Promise<DbBundleRule | null> {
  const rows = await executeSearchQuery(
    "SELECT * FROM bundle_rules WHERE account_id = $1 AND category = $2",
    [accountId, category],
  ) as unknown as DbBundleRule[];
  return rows[0] ?? null;
}

export async function setBundleRule(
  accountId: string,
  category: string,
  isBundled: boolean,
  deliveryEnabled: boolean,
  schedule: DeliverySchedule | null,
): Promise<void> {
  await upsertBundleRule({
    accountId,
    category,
    isBundled,
    deliveryEnabled,
    deliverySchedule: schedule ? JSON.stringify(schedule) : null,
  });
}

export async function holdThread(
  accountId: string,
  threadId: string,
  category: string,
  heldUntil: number | null,
): Promise<void> {
  await holdBundledThread(accountId, threadId, category, heldUntil);
}

export async function isThreadHeld(
  accountId: string,
  threadId: string,
): Promise<boolean> {
  const rows = await executeSearchQuery(
    "SELECT COUNT(*) as count FROM bundled_threads WHERE account_id = $1 AND thread_id = $2 AND held_until > $3",
    [accountId, threadId, getCurrentUnixTimestamp()],
  ) as unknown as { count: number }[];
  return (rows[0]?.count ?? 0) > 0;
}

export async function getHeldThreadIds(
  accountId: string,
): Promise<Set<string>> {
  const now = getCurrentUnixTimestamp();
  const rows = await executeSearchQuery(
    "SELECT thread_id FROM bundled_threads WHERE account_id = $1 AND held_until > $2",
    [accountId, now],
  ) as unknown as { thread_id: string }[];
  return new Set(rows.map((r) => r.thread_id));
}

export async function releaseHeldThreads(
  accountId: string,
  category: string,
): Promise<number> {
  return releaseHeldThreadsWrapper(accountId, category);
}

export async function updateLastDelivered(
  accountId: string,
  category: string,
): Promise<void> {
  const now = getCurrentUnixTimestamp();
  await updateBundleRuleDelivered(accountId, category, now);
}

export async function getBundleSummary(
  accountId: string,
  category: string,
): Promise<{ count: number; latestSubject: string | null; latestSender: string | null }> {
  const countRows = await executeSearchQuery(
    `SELECT COUNT(DISTINCT t.id) as count
     FROM threads t
     JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id AND tl.label_id = 'INBOX'
     JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id AND tc.category = $2
     WHERE t.account_id = $1`,
    [accountId, category],
  ) as unknown as { count: number }[];

  const latestRows = await executeSearchQuery(
    `SELECT t.subject, m.from_name
     FROM threads t
     JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id AND tl.label_id = 'INBOX'
     JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id AND tc.category = $2
     JOIN messages m ON m.account_id = t.account_id AND m.thread_id = t.id
     WHERE t.account_id = $1
     ORDER BY t.last_message_at DESC LIMIT 1`,
    [accountId, category],
  ) as unknown as { subject: string | null; from_name: string | null }[];

  return {
    count: countRows[0]?.count ?? 0,
    latestSubject: latestRows[0]?.subject ?? null,
    latestSender: latestRows[0]?.from_name ?? null,
  };
}

export async function getBundleSummaries(
  accountId: string,
  categories: string[],
): Promise<Map<string, { count: number; latestSubject: string | null; latestSender: string | null }>> {
  if (categories.length === 0) return new Map();

  const placeholders = categories.map((_, i) => `$${i + 2}`).join(", ");

  const countRows = await executeSearchQuery(
    `SELECT tc.category, COUNT(DISTINCT t.id) as count
     FROM threads t
     JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id AND tl.label_id = 'INBOX'
     JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id AND tc.category IN (${placeholders})
     WHERE t.account_id = $1
     GROUP BY tc.category`,
    [accountId, ...categories],
  ) as unknown as { category: string; count: number }[];

  const latestRows = await executeSearchQuery(
    `SELECT tc.category, t.subject, m.from_name
     FROM threads t
     JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id AND tl.label_id = 'INBOX'
     JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id AND tc.category IN (${placeholders})
     JOIN messages m ON m.account_id = t.account_id AND m.thread_id = t.id
     WHERE t.account_id = $1
     GROUP BY tc.category
     HAVING t.last_message_at = MAX(t.last_message_at)`,
    [accountId, ...categories],
  ) as unknown as { category: string; subject: string | null; from_name: string | null }[];

  const latestMap = new Map(latestRows.map((r) => [r.category, r]));
  const result = new Map<string, { count: number; latestSubject: string | null; latestSender: string | null }>();
  for (const cat of categories) {
    const countRow = countRows.find((r) => r.category === cat);
    const latest = latestMap.get(cat);
    result.set(cat, {
      count: countRow?.count ?? 0,
      latestSubject: latest?.subject ?? null,
      latestSender: latest?.from_name ?? null,
    });
  }
  return result;
}

export function getNextDeliveryTime(schedule: DeliverySchedule): number {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = schedule.hour * 60 + schedule.minute;

  for (let offset = 0; offset < 7; offset++) {
    const day = (currentDay + offset) % 7;
    if (schedule.days.includes(day)) {
      if (offset === 0 && currentMinutes < targetMinutes) {
        const target = new Date(now);
        target.setHours(schedule.hour, schedule.minute, 0, 0);
        return Math.floor(target.getTime() / 1000);
      }
      if (offset > 0) {
        const target = new Date(now);
        target.setDate(target.getDate() + offset);
        target.setHours(schedule.hour, schedule.minute, 0, 0);
        return Math.floor(target.getTime() / 1000);
      }
    }
  }

  const target = new Date(now);
  target.setDate(target.getDate() + 7);
  target.setHours(schedule.hour, schedule.minute, 0, 0);
  return Math.floor(target.getTime() / 1000);
}
