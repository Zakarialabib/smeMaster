import {
  getPendingFollowUpReminders,
  updateFollowUpStatus,
} from "@features/settings/db/followUpReminders";
import { notifyFollowUpDue } from "@features/settings/services/notifications/notificationManager";
import { createBackgroundChecker } from "@shared/services/backgroundCheckers";
import { executeSearchQuery } from "@shared/services/db/db-invoke";
import { uiBus } from "@shared/services/events/uiBus";

/**
 * Check for follow-up reminders that have fired.
 * If a reply has been received since the reminder was created, auto-cancel it.
 * Otherwise, trigger a notification.
 */
async function checkFollowUpReminders(): Promise<void> {
  const reminders = await getPendingFollowUpReminders();
  if (reminders.length === 0) return;

  for (const reminder of reminders) {
    // Check if a reply has arrived: any message in the thread from someone
    // other than the account owner, dated after the tracked message
    const replies = await executeSearchQuery(
      `SELECT COUNT(*) as count FROM messages m
       WHERE m.account_id = $1 AND m.thread_id = $2
         AND m.date > (SELECT date FROM messages WHERE id = $3 AND account_id = $1)
         AND m.from_address != (SELECT email FROM accounts WHERE id = $1)`,
      [reminder.account_id, reminder.thread_id, reminder.message_id],
    ) as { count: number }[];

    if ((replies[0]?.count ?? 0) > 0) {
      // Reply exists — auto-cancel the reminder
      await updateFollowUpStatus(reminder.id, "cancelled");
    } else {
      // No reply — trigger notification
      await updateFollowUpStatus(reminder.id, "triggered");

      // Get thread subject for notification
      const threads = await executeSearchQuery(
        "SELECT subject FROM threads WHERE account_id = $1 AND id = $2",
        [reminder.account_id, reminder.thread_id],
      ) as { subject: string | null }[];
      const subject = threads[0]?.subject ?? "";

      notifyFollowUpDue(subject, reminder.thread_id, reminder.account_id);
    }
  }

  // Refresh UI
  uiBus.emit("data:changed");
}

const followUpChecker = createBackgroundChecker("FollowUp", checkFollowUpReminders);
export const startFollowUpChecker = followUpChecker.start;
export const stopFollowUpChecker = followUpChecker.stop;

