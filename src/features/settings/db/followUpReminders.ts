import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { upsertFollowUpReminder as dbUpsertFollowUpReminder, executeSearchQuery, updateFollowUpStatus as dbUpdateFollowUpStatus, cancelFollowUpForThread as dbCancelFollowUpForThread } from "@/shared/services/db/db-invoke";

export interface DbFollowUpReminder {
  id: string;
  account_id: string;
  thread_id: string;
  message_id: string;
  remind_at: number;
  status: string;
  created_at: number;
}

export async function insertFollowUpReminder(
  accountId: string,
  threadId: string,
  messageId: string,
  remindAt: number,
): Promise<void> {
  await dbUpsertFollowUpReminder({
    companyId: accountId,
    threadId,
    messageId,
    remindAt,
  });
}

export async function getPendingFollowUpReminders(): Promise<DbFollowUpReminder[]> {
  const now = getCurrentUnixTimestamp();
  return executeSearchQuery(
    "SELECT * FROM follow_up_reminders WHERE status = 'pending' AND remind_at <= $1",
    [now],
  ) as unknown as Promise<DbFollowUpReminder[]>;
}

export async function getFollowUpForThread(
  accountId: string,
  threadId: string,
): Promise<DbFollowUpReminder | null> {
  const rows = await executeSearchQuery(
    "SELECT * FROM follow_up_reminders WHERE account_id = $1 AND thread_id = $2 AND status = 'pending' LIMIT 1",
    [accountId, threadId],
  ) as unknown as DbFollowUpReminder[];
  return rows[0] ?? null;
}

export async function updateFollowUpStatus(
  id: string,
  status: "triggered" | "cancelled",
): Promise<void> {
  await dbUpdateFollowUpStatus(id, status);
}

export async function cancelFollowUpForThread(
  accountId: string,
  threadId: string,
): Promise<void> {
  await dbCancelFollowUpForThread(accountId, threadId);
}

export interface FollowUpWithThread {
  id: string;
  account_id: string;
  thread_id: string;
  message_id: string;
  remind_at: number;
  status: string;
  thread_subject: string | null;
  thread_snippet: string | null;
  created_at: number;
}

/**
 * Get follow-up reminders with the associated thread subject and snippet.
 */
export async function getFollowUpsWithThreadSubject(
  accountId: string,
  limit = 50,
): Promise<FollowUpWithThread[]> {
  return executeSearchQuery(
    `SELECT fr.id, fr.account_id, fr.thread_id, fr.message_id, fr.remind_at, fr.status, fr.created_at,
            t.subject as thread_subject, t.snippet as thread_snippet
     FROM follow_up_reminders fr
     LEFT JOIN threads t ON fr.thread_id = t.id AND fr.account_id = t.account_id
     WHERE fr.account_id = $1
     ORDER BY fr.remind_at ASC
     LIMIT $2`,
    [accountId, limit],
  ) as unknown as Promise<FollowUpWithThread[]>;
}

export async function getActiveFollowUpThreadIds(
  accountId: string,
  threadIds: string[],
): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
  const rows = await executeSearchQuery(
    `SELECT thread_id FROM follow_up_reminders WHERE account_id = $1 AND status = 'pending' AND thread_id IN (${placeholders})`,
    [accountId, ...threadIds],
  ) as { thread_id: string }[];
  return new Set(rows.map((r) => r.thread_id));
}
