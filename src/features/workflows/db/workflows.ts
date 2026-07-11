/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import {
  listWorkflowRules as dbListWorkflowRules,
  listActiveWorkflowRules as dbListActiveWorkflowRules,
  upsertWorkflowRule as dbUpsertWorkflowRule,
  deleteWorkflowRule as dbDeleteWorkflowRule,
  updateWorkflowRuleActive as dbUpdateWorkflowRuleActive,
  listFollowUpReminders as dbListFollowUpReminders,
  upsertFollowUpReminder as dbUpsertFollowUpReminder,
  deleteFollowUpReminder as dbDeleteFollowUpReminder,
  updateFollowUpStatus as dbUpdateFollowUpStatus,
  cancelFollowUpForThread as dbCancelFollowUpForThread,
  listPendingOperations as dbListPendingOperations,
  upsertPendingOperation as dbUpsertPendingOperation,
  deletePendingOperation as dbDeletePendingOperation,
  deletePendingOpsByIds as dbDeletePendingOpsByIds,
  clearFailedOperations as dbClearFailedOperations,
  retryFailedOperations as dbRetryFailedOperations,
  updateOperationStatus as dbUpdateOperationStatus,
  incrementRetry as dbIncrementRetry,
} from "@shared/services/db/db-invoke";

import type {
  WorkflowRule,
  FollowUpReminder,
  PendingOperation,
} from "@shared/services/db/schema";

import type { UpsertWorkflowRuleRequest } from "@shared/services/db/db-invoke";

// â”€â”€ Re-export types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { WorkflowRule, FollowUpReminder, PendingOperation };
export type { UpsertWorkflowRuleRequest };

// â”€â”€ Workflow Rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * List all workflow rules for a company.
 */
export async function getWorkflowRules(companyId: string): Promise<WorkflowRule[]> {
  return dbListWorkflowRules(companyId);
}

/**
 * List active workflow rules for a specific trigger event.
 */
export async function getActiveWorkflowRules(
  companyId: string,
  triggerEvent: string,
): Promise<WorkflowRule[]> {
  return dbListActiveWorkflowRules(companyId, triggerEvent);
}

/**
 * Create or update a workflow rule.
 * @returns The workflow rule ID
 */
export async function saveWorkflowRule(rule: UpsertWorkflowRuleRequest): Promise<string> {
  return dbUpsertWorkflowRule(rule);
}

/**
 * Delete a workflow rule by ID.
 */
export async function removeWorkflowRule(id: string): Promise<void> {
  await dbDeleteWorkflowRule(id);
}

/**
 * Toggle a workflow rule's active state.
 */
export async function setWorkflowRuleActive(id: string, isActive: boolean): Promise<void> {
  await dbUpdateWorkflowRuleActive(id, isActive);
}

// â”€â”€ Follow-Up Reminders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * List follow-up reminders for a company, optionally filtered by status.
 */
export async function getFollowUpReminders(
  companyId: string,
  status?: string | null,
): Promise<FollowUpReminder[]> {
  return dbListFollowUpReminders(companyId, status);
}

/**
 * Create or update a follow-up reminder.
 * @returns The reminder ID
 */
export async function saveFollowUpReminder(reminder: {
  companyId: string;
  threadId: string;
  messageId: string;
  remindAt: number;
}): Promise<string> {
  return dbUpsertFollowUpReminder(reminder);
}

/**
 * Delete a follow-up reminder by ID.
 */
export async function removeFollowUpReminder(id: string): Promise<void> {
  await dbDeleteFollowUpReminder(id);
}

/**
 * Update the status of a follow-up reminder.
 */
export async function setFollowUpStatus(id: string, status: string): Promise<void> {
  await dbUpdateFollowUpStatus(id, status);
}

/**
 * Cancel all follow-up reminders for a thread.
 */
export async function cancelFollowUpForThread(companyId: string, threadId: string): Promise<void> {
  await dbCancelFollowUpForThread(companyId, threadId);
}

// â”€â”€ Pending Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * List pending operations for a company, optionally filtered by status.
 */
export async function getPendingOperations(
  companyId: string,
  status?: string | null,
): Promise<PendingOperation[]> {
  return dbListPendingOperations(companyId, status);
}

/**
 * Create or update a pending operation.
 * @returns The operation ID
 */
export async function savePendingOperation(op: {
  companyId: string;
  operationType: string;
  resourceId: string;
  params: Record<string, unknown>;
  campaignId?: string | null;
  holdUntil?: number | null;
}): Promise<string> {
  return dbUpsertPendingOperation(op);
}

/**
 * Delete a pending operation by ID.
 */
export async function removePendingOperation(id: string): Promise<void> {
  await dbDeletePendingOperation(id);
}

/**
 * Delete multiple pending operations by IDs.
 */
export async function removePendingOpsByIds(ids: string[]): Promise<void> {
  await dbDeletePendingOpsByIds(ids);
}

/**
 * Update the status of a pending operation.
 */
export async function setOperationStatus(
  id: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  await dbUpdateOperationStatus(id, status, errorMessage);
}

/**
 * Increment retry count for a pending operation.
 */
export async function incrementOperationRetry(
  id: string,
  newCount: number,
  isFailed: boolean,
  nextRetryAt?: number,
): Promise<void> {
  await dbIncrementRetry(id, newCount, isFailed, nextRetryAt);
}

/**
 * Clear all failed operations, optionally for a specific company.
 */
export async function clearFailedOps(companyId?: string): Promise<void> {
  await dbClearFailedOperations(companyId);
}

/**
 * Retry all failed operations, optionally for a specific company.
 */
export async function retryFailedOps(companyId?: string): Promise<void> {
  await dbRetryFailedOperations(companyId);
}
