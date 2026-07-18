import {
  getBundleRules,
  releaseHeldThreads,
  updateLastDelivered,
  type DeliverySchedule,
} from "@features/deliverability/db/bundleRules";
import { getAllAccounts } from "@features/accounts/db/accounts";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { createBackgroundChecker } from "@shared/services/backgroundCheckers";
import { uiBus } from "@shared/services/events/uiBus";

/**
 * Check if the current time matches a delivery schedule.
 * We check within a 2-minute window to account for the 60s interval.
 */
function isDeliveryTime(schedule: DeliverySchedule): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (!schedule.days.includes(currentDay)) return false;
  if (currentHour !== schedule.hour) return false;
  // Allow within 2-minute window
  return currentMinute >= schedule.minute && currentMinute < schedule.minute + 2;
}

/**
 * Check all delivery schedules and release held threads when delivery time arrives.
 */
async function checkBundleDelivery(): Promise<void> {
  const accounts = await getAllAccounts();

  for (const account of accounts) {
    if (!account.is_active) continue;

    const rules = await getBundleRules(account.id);

    for (const rule of rules) {
      if (!rule.delivery_enabled || !rule.delivery_schedule) continue;

      let schedule: DeliverySchedule;
      try {
        schedule = JSON.parse(rule.delivery_schedule) as DeliverySchedule;
      } catch {
        continue;
      }

      if (isDeliveryTime(schedule)) {
        // Avoid double-delivery: check last_delivered_at
        const now = getCurrentUnixTimestamp();
        if (rule.last_delivered_at && now - rule.last_delivered_at < 120) continue;

        const released = await releaseHeldThreads(account.id, rule.category);
        if (released > 0) {
          await updateLastDelivered(account.id, rule.category);
          // Refresh UI
          uiBus.emit("data:changed");
        }
      }
    }
  }
}

const bundleChecker = createBackgroundChecker("Bundle", checkBundleDelivery);
export const startBundleChecker = bundleChecker.start;
export const stopBundleChecker = bundleChecker.stop;

