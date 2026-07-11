import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { getUnreadInboxCount } from "@shared/services/db/threads";
import { useSyncStore } from "@shared/stores/syncStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";

let lastCount = -1;

export async function updateBadgeCount(): Promise<void> {
  try {
    const count = await getUnreadInboxCount();
    if (count === lastCount) return;
    lastCount = count;

    try {
      await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
    } catch {
    }

    const tooltip = count > 0 ? `SMEMaster - ${count} unread` : "SMEMaster";
    try {
      await invokeCommand("set_tray_tooltip", { tooltip });
    } catch {
    }

    const activeAcct = useAccountStore.getState().activeAccountId;
    if (activeAcct) {
      await useSyncStore.getState().refreshUnreadCounts(activeAcct);
    }
  } catch (err) {
    console.error("Failed to update badge count:", err);
  }
}
