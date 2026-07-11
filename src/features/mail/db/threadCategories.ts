import {
  executeSearchQuery,
  upsertThreadCategory as dbUpsertThreadCategory,
  setThreadCategoriesBatch as dbSetThreadCategoriesBatch,
} from "@shared/services/db/db-invoke";

export type ThreadCategory = "Primary" | "Updates" | "Promotions" | "Social" | "Newsletters";

export const ALL_CATEGORIES: ThreadCategory[] = [
  "Primary",
  "Updates",
  "Promotions",
  "Social",
  "Newsletters",
];

export async function getThreadCategory(
  accountId: string,
  threadId: string,
): Promise<string | null> {
  const rows = await executeSearchQuery(
    "SELECT category FROM thread_categories WHERE account_id = $1 AND thread_id = $2",
    [accountId, threadId],
  ) as { category: string }[];
  return rows[0]?.category ?? null;
}

export async function getThreadCategoryWithManual(
  accountId: string,
  threadId: string,
): Promise<{ category: string; isManual: boolean } | null> {
  const rows = await executeSearchQuery(
    "SELECT category, is_manual FROM thread_categories WHERE account_id = $1 AND thread_id = $2",
    [accountId, threadId],
  ) as { category: string; is_manual: number }[];
  if (!rows[0]) return null;
  return { category: rows[0].category, isManual: rows[0].is_manual === 1 };
}

export async function getRecentRuleCategorizedThreadIds(
  accountId: string,
  limit = 20,
): Promise<{ id: string; subject: string; snippet: string; fromAddress: string }[]> {
  return executeSearchQuery(
    `SELECT t.id, t.subject, t.snippet, m.from_address as fromAddress
     FROM threads t
     INNER JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id
     INNER JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id
     LEFT JOIN messages m ON m.account_id = t.account_id AND m.thread_id = t.id
       AND m.date = (SELECT MAX(m2.date) FROM messages m2 WHERE m2.account_id = t.account_id AND m2.thread_id = t.id)
     WHERE t.account_id = $1 AND tl.label_id = 'INBOX' AND tc.is_manual = 0
     ORDER BY t.last_message_at DESC
     LIMIT $2`,
    [accountId, limit],
  ) as Promise<{ id: string; subject: string; snippet: string; fromAddress: string }[]>;
}

export async function getCategoriesForThreads(
  accountId: string,
  threadIds: string[],
): Promise<Map<string, string>> {
  if (threadIds.length === 0) return new Map();
  const map = new Map<string, string>();
  const batchSize = 100;
  for (let i = 0; i < threadIds.length; i += batchSize) {
    const batch = threadIds.slice(i, i + batchSize);
    const placeholders = batch.map((_, idx) => `$${idx + 2}`).join(",");
    const rows = await executeSearchQuery(
      `SELECT thread_id, category FROM thread_categories WHERE account_id = $1 AND thread_id IN (${placeholders})`,
      [accountId, ...batch],
    ) as { thread_id: string; category: string }[];
    for (const row of rows) {
      map.set(row.thread_id, row.category);
    }
  }
  return map;
}

export async function setThreadCategory(
  accountId: string,
  threadId: string,
  category: string,
  isManual = false,
): Promise<void> {
  await dbUpsertThreadCategory({ accountId, threadId, category, isManual });
}

export async function setThreadCategoriesBatch(
  accountId: string,
  categories: Map<string, string>,
): Promise<void> {
  const entries: { accountId: string; threadId: string; category: string }[] = [];
  for (const [threadId, category] of categories) {
    entries.push({ accountId, threadId, category });
  }
  return dbSetThreadCategoriesBatch(entries);
}

export async function updateThreadCategory(
  accountId: string,
  threadId: string,
  category: string,
  isUserOverride = false,
): Promise<void> {
  await dbUpsertThreadCategory({ accountId, threadId, category, isUserOverride });
}

export async function getUserOverrides(
  accountId: string,
): Promise<{ threadId: string; category: string }[]> {
  const rows = await executeSearchQuery(
    "SELECT thread_id, category FROM thread_categories WHERE account_id = $1 AND is_user_override = 1",
    [accountId],
  ) as { thread_id: string; category: string }[];
  return rows.map((r) => ({ threadId: r.thread_id, category: r.category }));
}

export async function getCategoryUnreadCounts(
  accountId: string,
): Promise<Map<string, number>> {
  const rows = await executeSearchQuery(
    `SELECT tc.category, COUNT(*) as count
     FROM threads t
     INNER JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id
     LEFT JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id
     WHERE t.account_id = $1 AND tl.label_id = 'INBOX' AND t.is_read = 0
     GROUP BY tc.category`,
    [accountId],
  ) as { category: string | null; count: number }[];
  const map = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category ?? "Primary";
    map.set(cat, (map.get(cat) ?? 0) + row.count);
  }
  return map;
}

export async function getUncategorizedInboxThreadIds(
  accountId: string,
  limit = 20,
): Promise<{ id: string; subject: string; snippet: string; fromAddress: string }[]> {
  return executeSearchQuery(
    `SELECT t.id, t.subject, t.snippet, m.from_address as fromAddress
     FROM threads t
     INNER JOIN thread_labels tl ON tl.account_id = t.account_id AND tl.thread_id = t.id
     LEFT JOIN messages m ON m.account_id = t.account_id AND m.thread_id = t.id
       AND m.date = (SELECT MAX(m2.date) FROM messages m2 WHERE m2.account_id = t.account_id AND m2.thread_id = t.id)
     LEFT JOIN thread_categories tc ON tc.account_id = t.account_id AND tc.thread_id = t.id
     WHERE t.account_id = $1 AND tl.label_id = 'INBOX' AND tc.thread_id IS NULL
     ORDER BY t.last_message_at DESC
     LIMIT $2`,
    [accountId, limit],
  ) as Promise<{ id: string; subject: string; snippet: string; fromAddress: string }[]>;
}
