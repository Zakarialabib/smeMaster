import { v4 as uuidv4 } from 'uuid';
import {
  listQuickSteps,
  upsertQuickStep as dbUpsertQuickStep,
  updateQuickStep as dbUpdateQuickStep,
  deleteQuickStep as dbDeleteQuickStep,
  reorderQuickSteps as dbReorderQuickSteps,
  getEnabledQuickSteps,
} from "@/shared/services/db/db-invoke";
import type { QuickStep } from "@shared/services/db/schema";
import type { QuickStepAction } from "@features/settings/services/quickSteps/types";

export type DbQuickStep = QuickStep;

export async function getQuickStepsForAccount(accountId: string): Promise<DbQuickStep[]> {
  return listQuickSteps(accountId);
}

export { getEnabledQuickSteps as getEnabledQuickStepsForAccount };

export async function insertQuickStep(step: {
  accountId: string;
  name: string;
  description?: string;
  shortcut?: string;
  actions: QuickStepAction[];
  icon?: string;
  isEnabled?: boolean;
  continueOnError?: boolean;
}): Promise<string> {
  const id = uuidv4();
  await dbUpsertQuickStep({
    id,
    accountId: step.accountId,
    name: step.name,
    description: step.description ?? null,
    shortcut: step.shortcut ?? null,
    actionsJson: JSON.stringify(step.actions),
    icon: step.icon ?? null,
    isEnabled: step.isEnabled !== false,
    continueOnError: step.continueOnError ?? false,
    sortOrder: 0,
  });
  return id;
}

export async function updateQuickStep(
  id: string,
  updates: {
    name?: string;
    description?: string;
    shortcut?: string | null;
    actions?: QuickStepAction[];
    icon?: string;
    isEnabled?: boolean;
    continueOnError?: boolean;
  },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.description !== undefined) set.description = updates.description;
  if (updates.shortcut !== undefined) set.shortcut = updates.shortcut;
  if (updates.actions !== undefined) set.actions_json = JSON.stringify(updates.actions);
  if (updates.icon !== undefined) set.icon = updates.icon;
  if (updates.isEnabled !== undefined) set.is_enabled = updates.isEnabled ? 1 : 0;
  if (updates.continueOnError !== undefined) set.continue_on_error = updates.continueOnError ? 1 : 0;
  if (Object.keys(set).length > 0) {
    await dbUpdateQuickStep(id, { set, unset: [] });
  }
}

export const deleteQuickStep = dbDeleteQuickStep;
export const reorderQuickSteps = dbReorderQuickSteps;
