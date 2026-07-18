import { useEffect, useState, useRef } from "react";
import { onSyncStatus } from "@features/mail/services/gmail/syncManager";
import { updateBadgeCount } from "@shared/services/badgeManager";
import { formatSyncError } from "@shared/utils/networkErrors";
import { uiBus } from "@shared/services/events/uiBus";

/**
 * Hook: subscribes to the sync engine and exposes current sync status
 * for display in the App UI status bar.
 *
 * Returns `syncStatus` â€” a string describing the current sync state,
 * or `null` when idle.
 */
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const backfillDoneRef = useRef(false);

  useEffect(() => {
    const unsub = onSyncStatus((accountId, status, progress, error) => {
      if (status === "syncing") {
        if (progress) {
          if (progress.phase === "messages") {
            setSyncStatus(
              `Syncing: ${progress.current}/${progress.total} messages`,
            );
          } else if (progress.phase === "labels") {
            setSyncStatus("Syncing labels...");
          } else if (progress.phase === "threads") {
            setSyncStatus(`Building threads... (${progress.current}/${progress.total})`);
          }
        } else {
          setSyncStatus("Syncing...");
        }
      } else if (status === "done") {
        setSyncStatus("Sync complete");
        setTimeout(() => setSyncStatus(null), 2_000);
        uiBus.emit("data:changed");
        updateBadgeCount();

        // Backfill uncategorized threads after first successful sync
        if (!backfillDoneRef.current) {
          backfillDoneRef.current = true;
          import("@features/mail/services/categorization/backfillService")
            .then(({ backfillUncategorizedThreads }) => backfillUncategorizedThreads(accountId))
            .catch((err) => console.error("Backfill error:", err));
        }
      } else if (status === "error") {
        setSyncStatus(error ? `Sync failed: ${formatSyncError(error)}` : "Sync failed");
        // Still emit data:changed so the UI refreshes with any partially stored data
        uiBus.emit("data:changed");
        // Auto-clear the error after 8 seconds
        setTimeout(() => setSyncStatus(null), 8_000);
      }
    });
    return unsub;
  }, []);

  return syncStatus;
}
