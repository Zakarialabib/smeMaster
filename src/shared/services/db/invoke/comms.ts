import { invokeCommand } from './command';

import type {
  ComposerPreset,
  FilterLog,
  FilterRule,
  LocalDraft,
  QuickReply,
  QuickStep,
  ScheduledEmail,
  SendAsAlias,
  Signature,
  SmartFolder,
  Template,
  TemplateCategory,
} from '../schema';

import type {
  ContentRow,
  CountRow,
  InsertQuickReplyIgnoreRequest,
  InsertSignatureIgnoreRequest,
  InsertTemplateCategoryIgnoreRequest,
  InsertTemplateIgnoreRequest,
  TemplateUpdateFields,
  UpdateFields,
  UpsertLocalDraftRequest,
  UpsertQuickReplyRequest,
  UpsertQuickStepRequest,
  UpsertSendAsAliasRequest,
  UpsertSignatureRequest,
  UpsertSmartFolderRequest,
  UpsertTemplateCategoryRequest,
  UpsertTemplateRequest,
} from './core';

export async function listFilterRules(accountId: string): Promise<FilterRule[]> {
  return invokeCommand<FilterRule[]>('db_list_filter_rules', { accountId });
}

export async function createFilterRule(rule: Record<string, unknown>): Promise<FilterRule> {
  return invokeCommand<FilterRule>('db_create_filter_rule', { rule });
}

export async function updateFilter(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_filter', { id, fields });
}

export async function deleteFilter(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_filter', { id });
}

export async function upsertFilterGroup(group: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_upsert_filter_group', { group });
}

export async function deleteFilterGroup(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_filter_group', { id });
}

export async function upsertFilterCondition(condition: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_upsert_filter_condition', { condition });
}

export async function deleteFilterCondition(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_filter_condition', { id });
}

export async function countFilterRules(): Promise<number> {
  return invokeCommand<number>('db_count_filter_rules');
}

export async function getEnabledFilterRules(accountId: string): Promise<FilterRule[]> {
  return invokeCommand<FilterRule[]>('db_get_enabled_filter_rules', { accountId });
}

export async function getFilterRuleById(id: string): Promise<FilterRule | null> {
  return invokeCommand<FilterRule | null>('db_get_filter_rule', { id });
}

export async function getFilterGroupOperator(
  ruleId: string,
): Promise<{ group_operator: string | null }[]> {
  return invokeCommand<{ group_operator: string | null }[]>('db_get_filter_group_operator', {
    ruleId,
  });
}

export async function getFilterLogs(ruleId: string, limit: number): Promise<FilterLog[]> {
  return invokeCommand<FilterLog[]>('db_get_filter_logs', { ruleId, limit });
}

export async function getFilterStats(accountId: string): Promise<Record<string, unknown>> {
  return invokeCommand<Record<string, unknown>>('db_get_filter_stats', { accountId });
}

export async function getRecentFilterLogs(accountId: string, limit: number): Promise<FilterLog[]> {
  return invokeCommand<FilterLog[]>('db_get_recent_filter_logs', { accountId, limit });
}

export async function getFilterLogStats(accountId: string): Promise<Record<string, unknown>> {
  return invokeCommand<Record<string, unknown>>('db_get_filter_log_stats', { accountId });
}

export async function logFilterMatch(log: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_log_filter_match', { log });
}

export async function deleteFilterLogsOlderThan(olderThan: number): Promise<void> {
  return invokeCommand<void>('db_delete_filter_logs_older_than', { olderThan });
}

export async function listTemplates(companyId?: string | null): Promise<Template[]> {
  return invokeCommand<Template[]>('db_list_templates', {
    companyId: companyId ?? null,
  });
}

export async function getTemplateById(id: string): Promise<Template | null> {
  return invokeCommand<Template | null>('db_get_template', { id });
}

export async function countTemplates(
  templateType?: string | null,
  origin?: string | null,
): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_templates', {
    templateType: templateType ?? null,
    origin: origin ?? null,
  });
}

export async function listTemplatesPaginated(
  companyId: string,
  limit: number,
  offset: number,
  templateType?: string | null,
  origin?: string | null,
): Promise<Template[]> {
  return invokeCommand<Template[]>('db_list_templates_paginated', {
    companyId,
    limit,
    offset,
    templateType: templateType ?? null,
    origin: origin ?? null,
  });
}

export async function upsertTemplate(request: UpsertTemplateRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_template', request);
}

export async function deleteTemplate(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_template', { id });
}

export async function incrementTemplateUsage(id: string): Promise<void> {
  return invokeCommand<void>('db_increment_template_usage', { id });
}

export async function updateTemplate(id: string, fields: TemplateUpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_template', { id, fields });
}

export async function getFavoriteTemplates(companyId: string): Promise<Template[]> {
  return invokeCommand<Template[]>('db_get_favorite_templates', { companyId });
}

export async function getMostUsedTemplates(
  companyId: string,
  limit?: number | null,
): Promise<Template[]> {
  return invokeCommand<Template[]>('db_get_most_used_templates', {
    companyId,
    limit: limit ?? null,
  });
}

export async function getTemplatesByType(companyId: string, type: string): Promise<Template[]> {
  return invokeCommand<Template[]>('db_get_templates_by_type', {
    companyId,
    templateType: type,
  });
}

export async function listTemplateCategories(companyId: string): Promise<TemplateCategory[]> {
  return invokeCommand<TemplateCategory[]>('db_list_template_categories', { companyId });
}

export async function upsertTemplateCategory(
  request: UpsertTemplateCategoryRequest,
): Promise<void> {
  return invokeCommand<void>('db_upsert_template_category', request);
}

export async function deleteTemplateCategory(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_template_category', { id });
}

export async function insertTemplateIgnore(request: InsertTemplateIgnoreRequest): Promise<void> {
  return invokeCommand<void>('db_insert_template_ignore', request);
}

export async function countTemplateCategories(): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_template_categories');
}

export async function insertTemplateCategoryIgnore(
  request: InsertTemplateCategoryIgnoreRequest,
): Promise<void> {
  return invokeCommand<void>('db_insert_template_category_ignore', request);
}

export async function getTemplateContent(templateId: string): Promise<ContentRow[]> {
  return invokeCommand<ContentRow[]>('db_get_template_content', { templateId });
}

export async function listSignatures(accountId: string): Promise<Signature[]> {
  return invokeCommand<Signature[]>('db_list_signatures', { accountId });
}

export async function countSignatures(accountId: string): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_signatures', { accountId });
}

export async function insertSignatureIgnore(request: InsertSignatureIgnoreRequest): Promise<void> {
  return invokeCommand<void>('db_insert_signature_ignore', {
    id: request.id,
    accountId: request.accountId,
    name: request.name,
    bodyHtml: request.bodyHtml,
    isDefault: request.isDefault ?? null,
    sortOrder: request.sortOrder ?? null,
  });
}

export async function upsertSignature(request: UpsertSignatureRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_signature', request);
}

export async function deleteSignature(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_signature', { id });
}

export async function updateSignature(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_signature', { id, fields });
}

export async function clearDefaultSignature(accountId: string): Promise<void> {
  return invokeCommand<void>('db_clear_default_signature', { accountId });
}

export async function getDefaultSignature(accountId: string): Promise<Signature | null> {
  return invokeCommand<Signature | null>('db_get_default_signature', { accountId });
}

export async function getSignatureAccount(id: string): Promise<{ account_id: string }[]> {
  return invokeCommand<{ account_id: string }[]>('db_get_signature_account', { id });
}

export async function listLocalDrafts(accountId: string): Promise<LocalDraft[]> {
  return invokeCommand<LocalDraft[]>('db_list_local_drafts', { accountId });
}

export async function getLocalDraft(id: string): Promise<LocalDraft | null> {
  return invokeCommand<LocalDraft | null>('db_get_local_draft', { id });
}

export async function upsertLocalDraft(draft: UpsertLocalDraftRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_local_draft', { draft });
}

export async function deleteLocalDraft(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_local_draft', { id });
}

export async function markDraftSynced(id: string, remoteDraftId: string): Promise<void> {
  return invokeCommand<void>('db_mark_draft_synced', { id, remoteDraftId });
}

export async function listScheduledEmails(accountId: string): Promise<ScheduledEmail[]> {
  return invokeCommand<ScheduledEmail[]>('db_list_scheduled_emails', { accountId });
}

export async function listSmartFolders(accountId?: string | null): Promise<SmartFolder[]> {
  return invokeCommand<SmartFolder[]>('db_list_smart_folders', {
    accountId: accountId ?? null,
  });
}

export async function upsertSmartFolder(folder: UpsertSmartFolderRequest): Promise<SmartFolder> {
  return invokeCommand<SmartFolder>('db_upsert_smart_folder', { folder });
}

export async function deleteSmartFolder(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_smart_folder', { id });
}

export async function updateSmartFolder(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_smart_folder', { id, fields });
}

export async function updateSmartFolderSortOrder(
  orders: { id: string; sortOrder: number }[],
): Promise<void> {
  return invokeCommand<void>('db_update_smart_folder_sort_order', { orders });
}

export async function listQuickSteps(accountId: string): Promise<QuickStep[]> {
  return invokeCommand<QuickStep[]>('db_list_quick_steps', { accountId });
}

export async function upsertQuickStep(request: UpsertQuickStepRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_quick_step', request);
}

export async function updateQuickStep(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_quick_step', { id, fields });
}

export async function deleteQuickStep(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_quick_step', { id });
}

export async function reorderQuickSteps(accountId: string, orderedIds: string[]): Promise<void> {
  return invokeCommand<void>('db_reorder_quick_steps', { accountId, orderedIds });
}

export async function getEnabledQuickSteps(accountId: string): Promise<QuickStep[]> {
  return invokeCommand<QuickStep[]>('db_get_enabled_quick_steps', { accountId });
}

export async function listQuickReplies(accountId: string): Promise<QuickReply[]> {
  return invokeCommand<QuickReply[]>('db_list_quick_replies', { accountId });
}

export async function upsertQuickReply(request: UpsertQuickReplyRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_quick_reply', request);
}

export async function deleteQuickReply(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_quick_reply', { id });
}

export async function incrementQuickReplyUsage(id: string): Promise<void> {
  return invokeCommand<void>('db_increment_quick_reply_usage', { id });
}

export async function insertQuickReplyIgnore(
  request: InsertQuickReplyIgnoreRequest,
): Promise<void> {
  return invokeCommand<void>('db_insert_quick_reply_ignore', {
    id: request.id,
    accountId: request.accountId,
    title: request.title,
    bodyHtml: request.bodyHtml,
    shortcut: request.shortcut ?? null,
    sortOrder: request.sortOrder ?? null,
  });
}

export async function countQuickReplies(): Promise<number> {
  return invokeCommand<number>('db_count_quick_replies');
}

export async function getPendingScheduledEmails(): Promise<ScheduledEmail[]> {
  return invokeCommand<ScheduledEmail[]>('db_get_pending_scheduled_emails');
}

export async function updateScheduledEmailStatus(id: string, status: string): Promise<void> {
  return invokeCommand<void>('db_update_scheduled_email_status', { id, status });
}

export async function deleteScheduledEmail(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_scheduled_email', { id });
}

export async function listSendAsAliases(accountId: string): Promise<SendAsAlias[]> {
  return invokeCommand<SendAsAlias[]>('db_list_send_as_aliases', { accountId });
}

export async function upsertSendAsAlias(alias: UpsertSendAsAliasRequest): Promise<SendAsAlias> {
  return invokeCommand<SendAsAlias>('db_upsert_send_as_alias', { alias });
}

export async function deleteSendAsAlias(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_send_as_alias', { id });
}

export async function setDefaultAlias(accountId: string, aliasId: string): Promise<void> {
  return invokeCommand<void>('db_set_default_alias', { accountId, aliasId });
}

export async function listComposerPresets(accountId: string): Promise<ComposerPreset[]> {
  return invokeCommand<ComposerPreset[]>('db_list_composer_presets', { accountId });
}
