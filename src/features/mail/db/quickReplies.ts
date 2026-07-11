import { v4 as uuidv4 } from 'uuid';
import {
  listQuickReplies,
  upsertQuickReply as dbUpsertQuickReply,
  deleteQuickReply as dbDeleteQuickReply,
  incrementQuickReplyUsage as dbIncrementQuickReplyUsage,
  countQuickReplies,
} from "@/shared/services/db/db-invoke";
import type { QuickReply } from "@shared/services/db/schema";

export type DbQuickReply = QuickReply;

export async function getQuickReplies(accountId: string): Promise<DbQuickReply[]> {
  return listQuickReplies(accountId);
}

export { countQuickReplies as countQuickReplies };
export async function countQuickRepliesCount(): Promise<number> {
  return countQuickReplies();
}

export async function upsertQuickReply(qr: {
  id?: string;
  accountId: string;
  title: string;
  bodyHtml: string;
  shortcut?: string | null;
  sortOrder?: number;
}): Promise<string> {
  const id = qr.id ?? uuidv4();
  await dbUpsertQuickReply({
    id,
    accountId: qr.accountId,
    title: qr.title,
    bodyHtml: qr.bodyHtml,
    shortcut: qr.shortcut ?? null,
    sortOrder: qr.sortOrder ?? 0,
  });
  return id;
}

export const deleteQuickReply = dbDeleteQuickReply;
export const incrementQuickReplyUsage = dbIncrementQuickReplyUsage;
