import {
  getThreads,
  getThread,
  batchUpdateThreads,
  getAllThreads,
  enrichThreadsWithSender,
  getThreadsForCategory as dbInvokeGetThreadsForCategory,
  upsertThread as dbInvokeUpsertThread,
  setThreadLabels as dbInvokeSetThreadLabels,
  getThreadLabelIds as dbInvokeGetThreadLabelIds,
  getThreadLastSender,
  getThreadCount as dbInvokeGetThreadCount,
  getLabelUnreadCount as dbInvokeGetLabelUnreadCount,
  getAllLabelUnreadCounts as dbInvokeGetAllLabelUnreadCounts,
  getUnreadInboxCount as dbInvokeGetUnreadInboxCount,
  deleteThread as dbInvokeDeleteThread,
  deleteAllThreadsForAccount as dbInvokeDeleteAllThreadsForAccount,
  getMutedThreadIds as dbInvokeGetMutedThreadIds,
  type Thread,
} from "@shared/services/db/db-invoke";

export interface DbThread {
  id: string;
  account_id: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: number | null;
  message_count: number;
  is_read: number;
  is_starred: number;
  is_important: number;
  has_attachments: number;
  is_snoozed: number;
  snooze_until: number | null;
  is_pinned: number;
  is_muted: number;
  from_name: string | null;
  from_address: string | null;
}

/**
 * Map a Thread (from schema) to DbThread with default values for extra fields.
 */
function threadToDbThread(t: Thread): DbThread {
  const tAny = t as unknown as Record<string, unknown>;
  return {
    ...t,
    is_snoozed: (tAny.is_snoozed as number) ?? 0,
    snooze_until: (tAny.snooze_until as number | null) ?? null,
    is_pinned: (tAny.is_pinned as number) ?? 0,
    is_muted: (tAny.is_muted as number) ?? 0,
    from_name: null,
    from_address: null,
  } as DbThread;
}

/**
 * Get threads for an account with optional label filter.
 */
export async function getThreadsForAccount(
  accountId: string,
  labelId?: string,
  limit = 50,
  offset = 0,
): Promise<DbThread[]> {
  const threads = await getThreads(accountId, limit, offset, {
    labelId: labelId ?? null,
    isRead: null,
    isStarred: null,
    isImportant: null,
    isSnoozed: null,
    isPinned: null,
    searchQuery: null,
    folder: null,
  });

  if (threads.length === 0) return [];

  // Enrich with last sender info via Rust command
  const enriched = await enrichThreadsWithSender(
    accountId,
    threads.map((t) => t.id),
  );

  const enrichmentMap = new Map(enriched.map((e) => [e.thread_id, e]));

  return threads.map((t) => {
    const e = enrichmentMap.get(t.id);
    return {
      ...threadToDbThread(t),
      from_name: e?.from_name ?? null,
      from_address: e?.from_address ?? null,
    } as DbThread;
  });
}

/**
 * Get all threads for an account (unpaginated).
 * Delegates to the Rust-backed db_get_all_threads command.
 */
export async function getAllThreadsForAccount(
  accountId: string,
): Promise<DbThread[]> {
  const threads = await getAllThreads(accountId);
  return threads.map(threadToDbThread);
}

/**
 * Get threads filtered by category.
 * Delegates to the Rust-backed db_get_threads_for_category command.
 */
export async function getThreadsForCategory(
  accountId: string,
  category: string,
  limit = 50,
  offset = 0,
): Promise<DbThread[]> {
  const enriched = await dbInvokeGetThreadsForCategory(accountId, category, limit, offset);
  return enriched.map((e) => {
    return {
      id: e.thread_id,
      account_id: accountId,
      subject: null,
      snippet: null,
      last_message_at: null,
      message_count: 0,
      is_read: 0,
      is_starred: 0,
      is_important: 0,
      is_snoozed: 0,
      snooze_until: null,
      is_pinned: 0,
      is_muted: 0,
      has_attachments: 0,
      from_name: e.from_name,
      from_address: e.from_address,
    } as DbThread;
  });
}

/**
 * Upsert a thread record.
 * Delegates to the Rust-backed db_upsert_thread command.
 */
export async function upsertThread(thread: {
  id: string;
  accountId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: number | null;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
}): Promise<void> {
  await dbInvokeUpsertThread({
    id: thread.id,
    accountId: thread.accountId,
    subject: thread.subject,
    snippet: thread.snippet,
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    isRead: thread.isRead,
    isStarred: thread.isStarred,
    isImportant: thread.isImportant,
    hasAttachments: thread.hasAttachments,
  });
}

/**
 * Set thread labels (replaces all labels for a thread).
 * Delegates to the Rust-backed db_set_thread_labels command.
 */
export async function setThreadLabels(
  accountId: string,
  threadId: string,
  labelIds: string[],
): Promise<void> {
  await dbInvokeSetThreadLabels(accountId, threadId, labelIds);
}

/**
 * Get label IDs for a thread.
 * Delegates to the Rust-backed db_get_thread_label_ids command.
 */
export async function getThreadLabelIds(
  accountId: string,
  threadId: string,
): Promise<string[]> {
  return dbInvokeGetThreadLabelIds(accountId, threadId);
}

/**
 * Get a single thread by ID with from_name/from_address enrichment.
 */
export async function getThreadById(
  accountId: string,
  threadId: string,
): Promise<DbThread | undefined> {
  try {
    const t = await getThread(accountId, threadId);
    const lastSender = await getThreadLastSender(accountId, threadId);
    return {
      ...threadToDbThread(t),
      from_name: lastSender?.from_name ?? null,
      from_address: lastSender?.from_address ?? null,
    } as DbThread;
  } catch {
    return undefined;
  }
}

/**
 * Get total thread count for an account.
 * Delegates to the Rust-backed db_get_thread_count command.
 */
export async function getThreadCountForAccount(accountId: string): Promise<number> {
  return dbInvokeGetThreadCount(accountId);
}

/**
 * Get unread count for a specific label.
 * Delegates to the Rust-backed db_get_label_unread_count command.
 */
export async function getLabelUnreadCount(
  accountId: string,
  labelId: string,
): Promise<number> {
  return dbInvokeGetLabelUnreadCount(accountId, labelId);
}

/**
 * Get unread counts grouped by label.
 * Delegates to the Rust-backed db_get_all_label_unread_counts command.
 */
export async function getAllLabelUnreadCounts(
  accountId: string,
): Promise<Record<string, number>> {
  const rows = await dbInvokeGetAllLabelUnreadCounts(accountId);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.label_id] = row.count;
  }
  return counts;
}

/**
 * Get total unread count in INBOX across all accounts.
 * Delegates to the Rust-backed db_get_unread_inbox_count command.
 */
export async function getUnreadInboxCount(): Promise<number> {
  return dbInvokeGetUnreadInboxCount();
}

/**
 * Delete a thread by account and thread ID.
 * Delegates to the Rust-backed db_delete_thread command.
 */
export async function deleteThread(
  accountId: string,
  threadId: string,
): Promise<void> {
  await dbInvokeDeleteThread(accountId, threadId);
}

/**
 * Delete all threads for an account.
 * Delegates to the Rust-backed db_delete_account_threads command.
 */
export async function deleteAllThreadsForAccount(
  accountId: string,
): Promise<void> {
  await dbInvokeDeleteAllThreadsForAccount(accountId);
}

/**
 * Pin/unpin/mute/unmute via batchUpdateThreads typed wrapper.
 */

export async function pinThread(
  _accountId: string,
  threadId: string,
): Promise<void> {
  await batchUpdateThreads([threadId], { isPinned: true });
}

export async function unpinThread(
  _accountId: string,
  threadId: string,
): Promise<void> {
  await batchUpdateThreads([threadId], { isPinned: false });
}

export async function muteThread(
  _accountId: string,
  threadId: string,
): Promise<void> {
  await batchUpdateThreads([threadId], { isMuted: true });
}

export async function unmuteThread(
  _accountId: string,
  threadId: string,
): Promise<void> {
  await batchUpdateThreads([threadId], { isMuted: false });
}

/**
 * Get muted thread IDs.
 * Delegates to the Rust-backed db_get_muted_thread_ids command.
 */
export async function getMutedThreadIds(
  accountId: string,
): Promise<Set<string>> {
  const ids = await dbInvokeGetMutedThreadIds(accountId);
  return new Set(ids);
}
