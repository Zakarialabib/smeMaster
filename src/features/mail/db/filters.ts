import { v4 as uuidv4 } from 'uuid';
import {
  listFilterRules,
  createFilterRule as dbCreateFilterRule,
  updateFilter as dbUpdateFilter,
  deleteFilter as dbDeleteFilter,
  getFilterRuleById as dbGetFilterRuleById,
  getFilterGroupOperator as dbGetFilterGroupOperator,
  upsertFilterGroup as dbUpsertFilterGroup,
  deleteFilterGroup as dbDeleteFilterGroup,
  upsertFilterCondition,
  deleteFilterCondition as dbDeleteFilterCondition,
  getFilterLogs as dbGetFilterLogs,
  logFilterMatch as dbLogFilterMatch,
  getFilterStats as dbGetFilterStats,
  getRecentFilterLogs as dbGetRecentFilterLogs,
  getFilterLogStats as dbGetFilterLogStats,
  deleteFilterLogsOlderThan as dbDeleteFilterLogsOlderThan,
  countFilterRules,
  getEnabledFilterRules,
} from "@/shared/services/db/db-invoke";
import type { FilterRule } from "@shared/services/db/schema";

export type FilterOperator = 'contains' | 'matches' | 'starts_with' | 'ends_with' | 'not_contains';
export type FilterField = 'from' | 'to' | 'subject' | 'body' | 'hasAttachment';

export interface FilterCondition {
  id: string;
  filterId: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
  weight?: number;
}

export interface FilterGroup {
  id: string;
  ruleId: string;
  operator: 'AND' | 'OR';
  parentGroupId?: string;
}

export interface FilterConditionInput {
  field: FilterField;
  operator: FilterOperator;
  value: string;
  weight?: number;
}

export interface FilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachment?: boolean;
  conditions?: FilterConditionInput[];
  matchType?: "all" | "any";
}

export interface FilterActions {
  applyLabel?: string;
  archive?: boolean;
  star?: boolean;
  markRead?: boolean;
  trash?: boolean;
}

export type DbFilterRule = FilterRule;

export interface FilterLog {
  id: string;
  rule_id: string;
  message_id: string;
  matched: number;
  score: number;
  applied_actions: string | null;
  created_at: number;
}

export interface FilterStats {
  matchCount: number;
  topRules: { ruleId: string; ruleName: string; matchCount: number }[];
  zeroMatchRules: { ruleId: string; ruleName: string }[];
}

export async function getFiltersForAccount(accountId: string): Promise<DbFilterRule[]> {
  return listFilterRules(accountId);
}

export async function countMailRules(): Promise<number> {
  return countFilterRules();
}

export const getEnabledFiltersForAccount = getEnabledFilterRules;

export async function insertFilter(filter: {
  accountId: string;
  name: string;
  criteria: FilterCriteria;
  actions: FilterActions;
  isEnabled?: boolean;
  scoreThreshold?: number;
  chainingAction?: string;
}): Promise<string> {
  const id = uuidv4();
  await dbCreateFilterRule({
    id,
    accountId: filter.accountId,
    name: filter.name,
    isEnabled: filter.isEnabled !== false,
    criteriaJson: JSON.stringify(filter.criteria),
    actionsJson: JSON.stringify(filter.actions),
    scoreThreshold: filter.scoreThreshold ?? null,
    chainingAction: filter.chainingAction ?? 'stop',
  });
  return id;
}

export async function updateFilter(
  id: string,
  updates: {
    name?: string;
    criteria?: FilterCriteria;
    actions?: FilterActions;
    isEnabled?: boolean;
    scoreThreshold?: number | null;
    chainingAction?: string;
  },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.criteria !== undefined) set.criteria_json = JSON.stringify(updates.criteria);
  if (updates.actions !== undefined) set.actions_json = JSON.stringify(updates.actions);
  if (updates.isEnabled !== undefined) set.is_enabled = updates.isEnabled ? 1 : 0;
  if (updates.scoreThreshold !== undefined) set.score_threshold = updates.scoreThreshold;
  if (updates.chainingAction !== undefined) set.chaining_action = updates.chainingAction;
  if (Object.keys(set).length > 0) {
    await dbUpdateFilter(id, { set, unset: [] });
  }
}

export const deleteFilter = dbDeleteFilter;
export const getFilterRuleById = dbGetFilterRuleById;

export async function getFilterGroups(ruleId: string): Promise<FilterGroup[]> {
  const rows = await dbGetFilterGroupOperator(ruleId);
  if (rows.length === 0) return [];
  return [{
    id: ruleId,
    ruleId,
    operator: (rows[0]!.group_operator as 'AND' | 'OR') ?? 'AND',
  }];
}

export const upsertFilterGroup = dbUpsertFilterGroup;
export const deleteFilterGroup = dbDeleteFilterGroup;

/** @deprecated Use getFilterConditionsForRule() instead. */
export async function getFilterConditions(_groupId: string): Promise<FilterCondition[]> {
  return getFilterConditionsForRule(_groupId);
}

export async function getFilterConditionsForRule(ruleId: string): Promise<FilterCondition[]> {
  const rule = await dbGetFilterRuleById(ruleId);
  if (!rule) return [];
  try {
    const criteria: FilterCriteria & { conditions?: FilterConditionInput[] } = JSON.parse(rule.criteria_json);
    const conditions: FilterCondition[] = [];
    const fieldMap: [keyof FilterCriteria, FilterField][] = [
      ['from', 'from'], ['to', 'to'], ['subject', 'subject'], ['body', 'body'],
    ];
    for (const [key, field] of fieldMap) {
      const val = (criteria as Record<string, unknown>)[key];
      if (typeof val === 'string' && val.trim()) {
        conditions.push({ id: `cond-${field}`, filterId: ruleId, field, operator: 'contains', value: val, weight: 1 });
      }
    }
    if (criteria.hasAttachment !== undefined) {
      conditions.push({ id: 'cond-hasAttachment', filterId: ruleId, field: 'hasAttachment', operator: 'contains', value: criteria.hasAttachment ? 'true' : 'false', weight: 1 });
    }
    if (criteria.conditions) {
      for (const c of criteria.conditions) {
        conditions.push({ id: `cond-${c.field}-${conditions.length}`, filterId: ruleId, field: c.field, operator: c.operator, value: c.value, weight: c.weight ?? 1 });
      }
    }
    return conditions;
  } catch { return []; }
}

export { upsertFilterCondition };
export const deleteFilterCondition = dbDeleteFilterCondition;
export const getFilterLogs = dbGetFilterLogs;

export async function logFilterMatch(
  ruleId: string, messageId: string, matched: boolean, score: number, actions: FilterActions,
): Promise<void> {
  const id = uuidv4();
  await dbLogFilterMatch({ id, ruleId, messageId, matched: matched ? 1 : 0, score, appliedActions: JSON.stringify(actions) });
}

export const getFilterStats = dbGetFilterStats;

export interface FilterLogStats {
  total: number; matches: number; noMatches: number; avgScore: number;
}

export async function getRecentFilterLogs(accountId: string, limit = 10): Promise<FilterLog[]> {
  return dbGetRecentFilterLogs(accountId, limit);
}

export async function getFilterLogStats(accountId: string): Promise<FilterLogStats> {
  const stats = await dbGetFilterLogStats(accountId);
  return {
    total: Number(stats.total) || 0,
    matches: Number(stats.matches) || 0,
    noMatches: Number(stats.noMatches) || 0,
    avgScore: Number(stats.avgScore) || 0,
  };
}

export async function deleteFilterLogsOlderThan(_accountId: string, olderThan: number): Promise<void> {
  await dbDeleteFilterLogsOlderThan(olderThan);
}
