import { v4 as uuidv4 } from 'uuid';
import {
  listScheduledEmails,
  createScheduledEmail as dbCreateScheduledEmail,
  updateScheduledEmailStatus as dbUpdateScheduledEmailStatus,
  deleteScheduledEmail as dbDeleteScheduledEmail,
  getPendingScheduledEmails,
} from "@/shared/services/db/db-invoke";
import type { ScheduledEmail } from "@shared/services/db/schema";

export type DbScheduledEmail = ScheduledEmail;

export { getPendingScheduledEmails as getPendingScheduledEmails };

export async function getScheduledEmailsForAccount(accountId: string): Promise<DbScheduledEmail[]> {
  return listScheduledEmails(accountId);
}

export async function insertScheduledEmail(email: {
  accountId: string;
  toAddresses: string;
  ccAddresses: string | null;
  bccAddresses: string | null;
  subject: string | null;
  bodyHtml: string;
  replyToMessageId: string | null;
  threadId: string | null;
  scheduledAt: number;
  signatureId: string | null;
  attachmentPaths?: string | null;
  recurrence?: string;
  timezone?: string;
}): Promise<string> {
  const id = uuidv4();
  await dbCreateScheduledEmail({
    accountId: email.accountId,
    toAddresses: email.toAddresses,
    ccAddresses: email.ccAddresses,
    bccAddresses: email.bccAddresses,
    subject: email.subject,
    bodyHtml: email.bodyHtml,
    replyToMessageId: email.replyToMessageId,
    threadId: email.threadId,
    scheduledAt: email.scheduledAt,
    signatureId: email.signatureId,
    attachmentPaths: email.attachmentPaths ?? null,
    status: "pending",
  });
  return id;
}

export const updateScheduledEmailStatus = dbUpdateScheduledEmailStatus;
export const deleteScheduledEmail = dbDeleteScheduledEmail;
