import {
  listActiveWorkflowRules,
  listWorkflowRules,
  listWorkflowRulesPaginated as dbListWorkflowRulesPaginated,
  countWorkflowRules as dbCountWorkflowRules,
  upsertWorkflowRule as dbUpsertWorkflowRule,
  deleteWorkflowRule as dbDeleteWorkflowRule,
  updateWorkflowRuleActive,
} from "@/shared/services/db/db-invoke";
import type { WorkflowRule } from "@/shared/services/db/db-invoke";

export type { WorkflowRule };
export type DbWorkflowRule = WorkflowRule;

export async function getWorkflowRules(companyId: string): Promise<WorkflowRule[]> {
  return listWorkflowRules(companyId);
}

/**
 * Get workflow rules with pagination for a company.
 * @param companyId - The owning company ID
 * @param limit - Maximum number of rules
 * @param offset - Number of rules to skip
 */
export async function getWorkflowRulesPaginated(
  companyId: string,
  limit: number,
  offset: number,
): Promise<WorkflowRule[]> {
  return dbListWorkflowRulesPaginated(companyId, limit, offset);
}

/**
 * Count workflow rules for a company.
 * @param companyId - The owning company ID
 */
export async function countWorkflowRulesForAccount(companyId: string): Promise<number> {
  const rows = await dbCountWorkflowRules(companyId);
  return rows[0]?.count ?? 0;
}

export async function getActiveWorkflowRules(companyId: string, event: string): Promise<WorkflowRule[]> {
  return listActiveWorkflowRules(companyId, event);
}

export async function upsertWorkflowRule(rule: {
  id?: string;
  companyId: string;
  name: string;
  triggerEvent: string;
  triggerConditions?: string;
  actions: string;
}): Promise<string> {
  return dbUpsertWorkflowRule(rule);
}

export async function deleteWorkflowRule(id: string): Promise<void> {
  await dbDeleteWorkflowRule(id);
}

export async function toggleWorkflowRule(id: string, isActive: boolean): Promise<void> {
  await updateWorkflowRuleActive(id, isActive);
}
