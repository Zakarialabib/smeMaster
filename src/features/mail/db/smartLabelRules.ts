import { v4 as uuidv4 } from "uuid";
import type { FilterCriteria } from "./filters";

export interface DbSmartLabelRule {
  id: string;
  account_id: string;
  label_id: string;
  ai_description: string;
  criteria_json: string | null;
  is_enabled: number;
  sort_order: number;
  created_at: number;
}

/**
 * Retrieve smart label rules for an account.
 *
 * @deprecated The `smart_label_rules` database table has been removed since v56.
 *   No replacement is available. This function always returns an empty array.
 */
export async function getSmartLabelRulesForAccount(
  _accountId: string,
): Promise<DbSmartLabelRule[]> {
  return [];
}

/**
 * Retrieve enabled smart label rules for an account.
 *
 * @deprecated The `smart_label_rules` database table has been removed since v56.
 *   No replacement is available. This function always returns an empty array.
 */
export async function getEnabledSmartLabelRules(
  _accountId: string,
): Promise<DbSmartLabelRule[]> {
  return [];
}

/**
 * Insert a new smart label rule.
 *
 * @deprecated The `smart_label_rules` database table has been removed since v56.
 *   No replacement is available. This function logs a warning and returns a
 *   generated UUID without persisting anything.
 */
export async function insertSmartLabelRule(rule: {
  accountId: string;
  labelId: string;
  aiDescription: string;
  criteria?: FilterCriteria;
  isEnabled?: boolean;
}): Promise<string> {
  const id = uuidv4();
  console.warn(
    "[deprecated] smart_label_rules table has been removed. " +
      `Ignoring insertSmartLabelRule for labelId="${rule.labelId}". Generated id="${id}".`,
  );
  return id;
}

/**
 * Update an existing smart label rule.
 *
 * @deprecated The `smart_label_rules` database table has been removed since v56.
 *   No replacement is available. This function logs a warning and does nothing.
 */
export async function updateSmartLabelRule(
  id: string,
  updates: {
    labelId?: string;
    aiDescription?: string;
    criteria?: FilterCriteria | null;
    isEnabled?: boolean;
  },
): Promise<void> {
  console.warn(
    "[deprecated] smart_label_rules table has been removed. " +
      `Ignoring updateSmartLabelRule for id="${id}".`,
    updates,
  );
}

/**
 * Delete a smart label rule.
 *
 * @deprecated The `smart_label_rules` database table has been removed since v56.
 *   No replacement is available. This function logs a warning and does nothing.
 */
export async function deleteSmartLabelRule(id: string): Promise<void> {
  console.warn(
    "[deprecated] smart_label_rules table has been removed. " +
      `Ignoring deleteSmartLabelRule for id="${id}".`,
  );
}
