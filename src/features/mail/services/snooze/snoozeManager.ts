import { invokeCommand } from "@shared/services/db/invoke/command";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { createBackgroundChecker } from "@shared/services/backgroundCheckers";

/**
 * Check for snoozed threads that should be un-snoozed (time has passed).
 * Moves them back to INBOX.
 */
async function checkSnoozedThreads(): Promise<void> {
  const now = getCurrentUnixTimestamp();

  // Find threads where snooze time has passed
  const snoozed = await invokeCommand<{ id: string; account_id: string }[]>(
    "db_get_expired_snoozed_threads",
    { now },
  );

  if (snoozed.length > 0) {
    for (const thread of snoozed) {
      // Un-snooze the thread and re-add INBOX label atomically
      await invokeCommand<void>("db_unsnooze_thread", {
        accountId: thread.account_id,
        threadId: thread.id,
      });
    }

    // Notify the UI to refresh
    window.dispatchEvent(new Event("smemaster-sync-done"));
  }
}

/**
 * Snooze a thread: remove from INBOX, set snooze time.
 */
export async function snoozeThread(
  accountId: string,
  threadId: string,
  snoozeUntil: number,
): Promise<void> {
  await invokeCommand<void>("db_snooze_thread", {
    accountId,
    threadId,
    snoozeUntil,
  });
}

const snoozeChecker = createBackgroundChecker("Snooze", checkSnoozedThreads);
export const startSnoozeChecker = snoozeChecker.start;
export const stopSnoozeChecker = snoozeChecker.stop;

