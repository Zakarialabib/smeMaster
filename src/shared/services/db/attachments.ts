import {
  getAttachmentsForMessage as dbInvokeGetAttachmentsForMessage,
  upsertAttachment as dbInvokeUpsertAttachment,
  getAttachmentsForAccount as dbInvokeGetAttachmentsForAccount,
  getAttachmentSenders as dbInvokeGetAttachmentSenders,
  type Attachment,
} from "@shared/services/db/db-invoke";
import type { AttachmentWithContext, AttachmentSender as DbAttachmentSender } from "@shared/services/db/db-invoke";

export type DbAttachment = Attachment;

// Re-export for convenience
export type { AttachmentWithContext, DbAttachmentSender as AttachmentSender };

/**
 * Get attachments for a specific message via the typed db-invoke wrapper.
 */
export async function getAttachmentsForMessage(
  _accountId: string,
  messageId: string,
): Promise<DbAttachment[]> {
  // Note: db-invoke's getAttachmentsForMessage only requires messageId
  return dbInvokeGetAttachmentsForMessage(messageId);
}

/**
 * Upsert an attachment record.
 * Delegates to the Rust-backed db_upsert_attachment command.
 */
export async function upsertAttachment(att: {
  id: string;
  messageId: string;
  accountId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  gmailAttachmentId: string | null;
  contentId: string | null;
  isInline: boolean;
}): Promise<void> {
  // Map to Attachment shape expected by the Rust command
  await dbInvokeUpsertAttachment({
    id: att.id,
    message_id: att.messageId,
    account_id: att.accountId,
    filename: att.filename,
    mime_type: att.mimeType,
    size: att.size,
    gmail_attachment_id: att.gmailAttachmentId,
    content_id: att.contentId,
    is_inline: att.isInline ? 1 : 0,
    local_path: null,
  } as Attachment);
}

/**
 * Get attachments for an account with message context (JOIN).
 * Delegates to the Rust-backed db_get_attachments_for_account command.
 */
export async function getAttachmentsForAccount(
  accountId: string,
  limit = 200,
  offset = 0,
): Promise<AttachmentWithContext[]> {
  return dbInvokeGetAttachmentsForAccount(accountId, limit, offset);
}

/**
 * Get attachment senders grouped by from_address.
 * Delegates to the Rust-backed db_get_attachment_senders command.
 */
export async function getAttachmentSenders(
  accountId: string,
): Promise<DbAttachmentSender[]> {
  return dbInvokeGetAttachmentSenders(accountId);
}
