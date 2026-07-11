import { useEffect, useRef } from "react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useTaskStore } from "@features/tasks/stores/taskStore";
import { initNotifications } from "@features/settings/services/notifications/notificationManager";
import {
  initGlobalShortcut,
  unregisterComposeShortcut,
} from "@shared/services/globalShortcut";
import { initDeepLinkHandler } from "@shared/services/deepLinkHandler";
import { updateBadgeCount } from "@shared/services/badgeManager";
import { stopUpdateChecker } from "@shared/services/updateManager";
import { getIncompleteTaskCount } from "@features/tasks/db/tasks";
import { withRetry } from "./_utils";

/**
 * Phases 9, 10, 11: Initialize system-level integrations.
 *
 * - Phase 9: Notifications, global shortcut, deep link handler, badge count
 * - Phase 10: Load task count for the active account
 * - Phase 11: Start the auto-update checker
 *
 * Returns cleanup functions for each integration type so the caller can
 * tear them down if needed (e.g., during hot-reload or window close).
 */
export function useSystemIntegrations(): {
  cleanupIntegrations: () => void;
} {
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let deepLinkCleanup: (() => void) | undefined;

    async function init() {
      // Phase 9: System integrations (notifications, shortcut, deep link, badge)
      await withRetry("initNotifications", () => initNotifications()).catch(() => { });
      await withRetry("initGlobalShortcut", () => initGlobalShortcut()).catch(() => { });
      deepLinkCleanup = await withRetry("initDeepLinkHandler", () =>
        initDeepLinkHandler(),
      ).catch(() => undefined);
      await withRetry("updateBadgeCount", () => updateBadgeCount()).catch(() => { });

      // Phase 10: Load task count for the active account
      const activeAcct = useAccountStore.getState().activeAccountId;
      if (activeAcct) {
        const count = await withRetry("getIncompleteTaskCount", () =>
          getIncompleteTaskCount(activeAcct),
        ).catch(() => undefined);
        if (count !== undefined) {
          useTaskStore.getState().setIncompleteCount(count);
        }
      }

      // Phase 11: Auto-update checker (async, non-blocking)
      // void startUpdateChecker().catch(() => { });
    }

    init();

    cleanupRef.current = () => {
      stopUpdateChecker();
      unregisterComposeShortcut();
      deepLinkCleanup?.();
    };

    return () => {
      stopUpdateChecker();
      unregisterComposeShortcut();
      deepLinkCleanup?.();
    };
  }, []);

  return {
    cleanupIntegrations: () => cleanupRef.current?.(),
  };
}