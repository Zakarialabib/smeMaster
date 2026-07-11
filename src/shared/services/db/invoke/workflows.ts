import { invokeCommand } from './command';

import type {
  CleanupHistory,
  CleanupRule,
  FollowUpReminder,
  PendingOperation,
  WorkflowRule,
} from '../schema';

import type { CountRow } from './core';

export async function listWorkflowRules(companyId: string): Promise<WorkflowRule[]> {
  return invokeCommand<WorkflowRule[]>('db_list_workflow_rules', { companyId });
}

export async function listWorkflowRulesPaginated(
  companyId: string,
  limit: number,
  offset: number,
): Promise<WorkflowRule[]> {
  return invokeCommand<WorkflowRule[]>('db_list_workflow_rules_paginated', {
    companyId,
    limit,
    offset,
  });
}

export async function countWorkflowRules(companyId: string): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_workflow_rules', { companyId });
}

export async function listActiveWorkflowRules(
  companyId: string,
  triggerEvent: string,
): Promise<WorkflowRule[]> {
  return invokeCommand<WorkflowRule[]>('db_list_active_workflow_rules', {
    companyId,
    triggerEvent,
  });
}

export async function listFollowUpReminders(
  companyId: string,
  status?: string | null,
): Promise<FollowUpReminder[]> {
  return invokeCommand<FollowUpReminder[]>('db_list_follow_up_reminders', {
    companyId,
    status: status ?? null,
  });
}

export async function listPendingOperations(
  companyId: string,
  status?: string | null,
): Promise<PendingOperation[]> {
  return invokeCommand<PendingOperation[]>('db_list_pending_operations', {
    companyId,
    status: status ?? null,
  });
}

export async function listCleanupRules(companyId: string): Promise<CleanupRule[]> {
  return invokeCommand<CleanupRule[]>('db_list_cleanup_rules', { companyId });
}

export async function upsertCleanupRule(
  id: string,
  companyId: string,
  name: string,
  ruleType: string,
  conditionJson: string,
  action: string,
  targetFolder?: string | null,
  retentionDays?: number | null,
  isScheduled?: number,
  scheduleCron?: string | null,
): Promise<string> {
  return invokeCommand<string>('db_upsert_cleanup_rule', {
    id,
    companyId,
    name,
    ruleType,
    conditionJson,
    action,
    targetFolder: targetFolder ?? null,
    retentionDays: retentionDays ?? null,
    isScheduled: isScheduled ?? 0,
    scheduleCron: scheduleCron ?? null,
  });
}

export async function deleteCleanupRule(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_cleanup_rule', { id });
}

export async function listCleanupHistory(
  companyId: string,
  limit: number,
): Promise<CleanupHistory[]> {
  return invokeCommand<CleanupHistory[]>('db_list_cleanup_history', { companyId, limit });
}

export async function executeCleanupRule(
  companyId: string,
  ruleId: string,
): Promise<CleanupHistory> {
  return invokeCommand<CleanupHistory>('db_execute_cleanup_rule', { companyId, ruleId });
}
