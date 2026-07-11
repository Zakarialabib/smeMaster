import { getUncategorizedInboxThreadIds, setThreadCategory } from "@features/mail/db/threadCategories";
import { getThreadLabelIds } from "@shared/services/db/threads";
import { getMessagesForThread } from "@shared/services/db/messages";
import { categorizeByRules } from "@features/mail/services/categorization/ruleEngine";
import { getAllThreadsForAccount } from "@shared/services/db/threads";
import { matchSmartLabels } from "./smartLabelService";
import { addThreadLabel } from "@features/mail/services/emailActions";
import { parseDbMessage } from "@features/mail/services/gmail/messageParser";

/**
 * Backfill custom smart labels to all existing threads.
 */
export async function backfillSmartLabels(
  accountId: string,
): Promise<number> {
  const threads = await getAllThreadsForAccount(accountId);
  let totalApplied = 0;

  for (const thread of threads) {
    const messages = await getMessagesForThread(accountId, thread.id);
    if (messages.length === 0) continue;

    const parsedMessages = messages.map((m) => parseDbMessage(m, accountId));
    const matches = await matchSmartLabels(accountId, parsedMessages);

    for (const match of matches) {
      for (const labelId of match.labelIds) {
        await addThreadLabel(accountId, thread.id, labelId);
        totalApplied++;
      }
    }
  }

  return totalApplied;
}

/**
 * Backfill uncategorized inbox threads with rule-based categorization.
 *
 * 1. Query inbox threads that have no entry in thread_categories
 * 2. For each, get labels and last message to run rule engine
 * 3. Insert the resulting category
 * 4. Return count of categorized threads
 */
export async function backfillUncategorizedThreads(
  accountId: string,
  batchSize = 50,
): Promise<number> {
  let totalCategorized = 0;
  let batch: Awaited<ReturnType<typeof getUncategorizedInboxThreadIds>>;

  do {
    batch = await getUncategorizedInboxThreadIds(accountId, batchSize);

    await Promise.all(batch.map(async (thread) => {
      const [labelIds, messages] = await Promise.all([
        getThreadLabelIds(accountId, thread.id),
        getMessagesForThread(accountId, thread.id),
      ]);
      const lastMessage = messages[messages.length - 1];

      const category = categorizeByRules({
        labelIds,
        fromAddress: lastMessage?.from_address ?? thread.fromAddress ?? null,
        listUnsubscribe: lastMessage?.list_unsubscribe ?? null,
      });

      await setThreadCategory(accountId, thread.id, category, false);
      totalCategorized++;
    }));
  } while (batch.length === batchSize);

  return totalCategorized;
}


