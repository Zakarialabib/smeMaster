import { executeSearchQuery } from "@shared/services/db/db-invoke";
import { getFilterRuleById, getFilterConditionsForRule } from "@features/mail/db/filters";
import type { FilterCondition } from "@features/mail/db/filters";
import { evaluateCondition } from "./filterEngine";

export interface ConditionDebugResult {
  condition: FilterCondition;
  passed: boolean;
  matchedText: string | null;
}

export interface FilterTestResult {
  conditions: ConditionDebugResult[];
  overall: boolean;
}

/**
 * Debug a filter rule against a stored message.
 * Loads the rule, its conditions, and the message from DB,
 * then evaluates each condition and returns per-condition details
 * plus an overall pass/fail.
 */
export async function testFilterOnMessage(
  ruleId: string,
  messageId: string,
): Promise<FilterTestResult> {
  const rule = await getFilterRuleById(ruleId);
  if (!rule) throw new Error(`Filter rule not found: ${ruleId}`);

  const msgRows = await executeSearchQuery(
    "SELECT id, thread_id, from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to, subject, snippet, date, is_read, is_starred, body_html, body_text, raw_size, internal_date FROM messages WHERE id = $1",
    [messageId],
  ) as {
    id: string;
    thread_id: string;
    from_address: string | null;
    from_name: string | null;
    to_addresses: string | null;
    cc_addresses: string | null;
    bcc_addresses: string | null;
    reply_to: string | null;
    subject: string | null;
    snippet: string | null;
    date: number;
    is_read: number;
    is_starred: number;
    body_html: string | null;
    body_text: string | null;
    raw_size: number | null;
    internal_date: number | null;
  }[];
  if (msgRows.length === 0) throw new Error(`Message not found: ${messageId}`);
  const msg0 = msgRows[0]!;

  const attachRows = await executeSearchQuery(
    "SELECT COUNT(*) AS cnt FROM attachments WHERE message_id = $1",
    [messageId],
  ) as { cnt: number }[];
  const hasAttachments = (attachRows[0]?.cnt ?? 0) > 0;

  const message = {
      id: msg0.id,
      threadId: msg0.thread_id,
      fromAddress: msg0.from_address,
      fromName: msg0.from_name,
      toAddresses: msg0.to_addresses,
      ccAddresses: msg0.cc_addresses,
      bccAddresses: msg0.bcc_addresses,
      replyTo: msg0.reply_to,
      subject: msg0.subject,
      snippet: msg0.snippet ?? "",
      date: msg0.date,
      isRead: msg0.is_read === 1,
      isStarred: msg0.is_starred === 1,
      bodyHtml: msg0.body_html,
      bodyText: msg0.body_text,
      rawSize: msg0.raw_size ?? 0,
      internalDate: msg0.internal_date ?? msg0.date,
      labelIds: [] as string[],
      hasAttachments,
      attachments: [] as { filename: string; mimeType: string; size: number; gmailAttachmentId: string; contentId: string | null; isInline: boolean }[],
      listUnsubscribe: null,
      listUnsubscribePost: null,
      authResults: null,
    };

  const conditions = await getFilterConditionsForRule(ruleId);

  if (conditions.length === 0) {
    return { conditions: [], overall: true };
  }

  const operator = (rule.group_operator as "AND" | "OR" | undefined) ?? "AND";

  const results: ConditionDebugResult[] = conditions.map((condition) => {
    const { passed, matchedText } = evaluateCondition(condition, message);
    return { condition, passed, matchedText };
  });

  const overall = operator === "AND"
    ? results.every((r) => r.passed)
    : results.some((r) => r.passed);

  return { conditions: results, overall };
}

