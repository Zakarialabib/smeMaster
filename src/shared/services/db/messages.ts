import {
  getMessagesForThread as dbInvokeGetMessagesForThread,
  upsertMessage as dbInvokeUpsertMessage,
  deleteMessage as dbInvokeDeleteMessage,
  bulkUpdateMessageThread,
  deleteAllMessagesForAccount as dbInvokeDeleteAllMessagesForAccount,
  getRecentSentMessages as dbInvokeGetRecentSentMessages,
  type Message,
} from "@shared/services/db/db-invoke";

export type DbMessage = Message;

/**
 * Get all messages for a thread via the typed db-invoke wrapper.
 */
export async function getMessagesForThread(
  accountId: string,
  threadId: string,
): Promise<DbMessage[]> {
  return dbInvokeGetMessagesForThread(accountId, threadId);
}

/**
 * Upsert a message via the typed db-invoke wrapper.
 */
export async function upsertMessage(msg: {
  id: string;
  accountId: string;
  threadId: string;
  fromAddress: string | null;
  fromName: string | null;
  toAddresses: string | null;
  ccAddresses: string | null;
  bccAddresses: string | null;
  replyTo: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  isStarred: boolean;
  bodyHtml: string | null;
  bodyText: string | null;
  rawSize: number | null;
  internalDate: number | null;
  listUnsubscribe?: string | null;
  listUnsubscribePost?: string | null;
  authResults?: string | null;
  messageIdHeader?: string | null;
  referencesHeader?: string | null;
  inReplyToHeader?: string | null;
  imapUid?: number | null;
  imapFolder?: string | null;
}): Promise<void> {
  await dbInvokeUpsertMessage({
    id: msg.id,
    accountId: msg.accountId,
    threadId: msg.threadId,
    fromAddress: msg.fromAddress,
    fromName: msg.fromName,
    toAddresses: msg.toAddresses,
    ccAddresses: msg.ccAddresses,
    bccAddresses: msg.bccAddresses,
    replyTo: msg.replyTo,
    subject: msg.subject,
    snippet: msg.snippet,
    date: msg.date,
    isRead: msg.isRead,
    isStarred: msg.isStarred,
    bodyHtml: msg.bodyHtml,
    bodyText: msg.bodyText,
    listUnsubscribe: msg.listUnsubscribe ?? null,
    listUnsubscribePost: msg.listUnsubscribePost ?? null,
    authResults: msg.authResults ?? null,
    messageIdHeader: msg.messageIdHeader ?? null,
    referencesHeader: msg.referencesHeader ?? null,
    inReplyToHeader: msg.inReplyToHeader ?? null,
    imapUid: msg.imapUid ?? null,
    imapFolder: msg.imapFolder ?? null,
  });
}

/**
 * Delete a message via the typed db-invoke wrapper.
 */
export async function deleteMessage(
  accountId: string,
  messageId: string,
): Promise<void> {
  await dbInvokeDeleteMessage(accountId, messageId);
}

/**
 * Update thread_id for a batch of messages.
 * Delegates to the Rust-backed db_bulk_update_message_thread command.
 */
export async function updateMessageThreadIds(
  accountId: string,
  messageIds: string[],
  threadId: string,
): Promise<void> {
  if (messageIds.length === 0) return;
  await bulkUpdateMessageThread(accountId, messageIds, threadId);
}

/**
 * Delete all messages for an account.
 * Delegates to the Rust-backed db_delete_account_messages command.
 */
export async function deleteAllMessagesForAccount(
  accountId: string,
): Promise<void> {
  await dbInvokeDeleteAllMessagesForAccount(accountId);
}

/**
 * Get recent sent messages for an account.
 * Delegates to the Rust-backed db_get_recent_sent_messages command.
 */
export async function getRecentSentMessages(
  accountId: string,
  accountEmail: string,
  limit: number = 15,
): Promise<DbMessage[]> {
  return dbInvokeGetRecentSentMessages(accountId, accountEmail, limit);
}
