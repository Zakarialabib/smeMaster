import {
  executeSearchQuery,
  getLocalDraft as dbGetLocalDraft,
  upsertLocalDraft as dbUpsertLocalDraft,
  deleteLocalDraft as dbDeleteLocalDraft,
  markDraftSynced as dbMarkDraftSynced,
  type LocalDraft as DbLocalDraft,
} from "@shared/services/db/db-invoke";

export type { DbLocalDraft };

export type LocalDraft = DbLocalDraft;

export async function upsertLocalDraft(draft: {
  id: string;
  account_id: string;
  to_addresses?: string | null;
  cc_addresses?: string | null;
  bcc_addresses?: string | null;
  subject?: string | null;
  body_html?: string | null;
  reply_to_message_id?: string | null;
  thread_id?: string | null;
  from_email?: string | null;
  signature_id?: string | null;
  remote_draft_id?: string | null;
  attachments?: string | null;
}): Promise<void> {
  await dbUpsertLocalDraft({
    id: draft.id,
    accountId: draft.account_id,
    toAddresses: draft.to_addresses ?? null,
    ccAddresses: draft.cc_addresses ?? null,
    bccAddresses: draft.bcc_addresses ?? null,
    subject: draft.subject ?? null,
    bodyHtml: draft.body_html ?? null,
    replyToMessageId: draft.reply_to_message_id ?? null,
    threadId: draft.thread_id ?? null,
    fromEmail: draft.from_email ?? null,
    signatureId: draft.signature_id ?? null,
    remoteDraftId: draft.remote_draft_id ?? null,
    attachments: draft.attachments ?? null,
  });
}

export async function getLocalDraft(id: string): Promise<LocalDraft | null> {
  return dbGetLocalDraft(id);
}

export async function getUnsyncedDrafts(
  accountId: string,
): Promise<LocalDraft[]> {
  return executeSearchQuery(
    "SELECT * FROM local_drafts WHERE account_id = $1 AND sync_status = 'pending' ORDER BY updated_at ASC",
    [accountId],
  ) as unknown as Promise<LocalDraft[]>;
}

export async function markDraftSynced(
  id: string,
  remoteDraftId: string,
): Promise<void> {
  return dbMarkDraftSynced(id, remoteDraftId);
}

export async function deleteLocalDraft(id: string): Promise<void> {
  return dbDeleteLocalDraft(id);
}
