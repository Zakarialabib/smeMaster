import type { QuickStepAction } from "./types";
import { getQuickStepsForAccount, insertQuickStep } from "@features/mail/db/quickSteps";

const DEFAULT_QUICK_STEPS: {
  name: string;
  actions: QuickStepAction[];
  icon: string;
}[] = [
  {
    name: "Reply & Archive",
    actions: [{ type: "reply" }, { type: "archive" }],
    icon: "Reply",
  },
  {
    name: "Mark Read & Archive",
    actions: [{ type: "markRead" }, { type: "archive" }],
    icon: "MailOpen",
  },
  {
    name: "Star & Pin",
    actions: [{ type: "star" }, { type: "pin" }],
    icon: "Star",
  },
];

/**
 * Seed default quick steps for an account if none exist yet.
 */
export async function seedDefaultQuickSteps(
  accountId: string,
): Promise<void> {
  const existing = await getQuickStepsForAccount(accountId);
  if (existing.length > 0) return;

  for (const step of DEFAULT_QUICK_STEPS) {
    await insertQuickStep({
      accountId,
      name: step.name,
      actions: step.actions,
      icon: step.icon,
    });
  }
}
