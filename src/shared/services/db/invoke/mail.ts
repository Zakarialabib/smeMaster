import { invokeCommand } from './command';

import type {
  ThreadCategoryRow,
  UpsertThreadCategoryRequest,
  UpsertWritingStyleProfileRequest,
  WritingStyleProfile,
} from './core';

export async function listWritingStyleProfiles(companyId: string): Promise<WritingStyleProfile[]> {
  return invokeCommand<WritingStyleProfile[]>('db_list_writing_style_profiles', { companyId });
}

export async function upsertWritingStyleProfile(
  profile: UpsertWritingStyleProfileRequest,
): Promise<void> {
  return invokeCommand<void>('db_upsert_writing_style_profile', { profile });
}

export async function deleteWritingStyleProfile(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_writing_style_profile', { id });
}

export async function createCampaignTemplate(input: {
  companyId: string;
  name: string;
  subject?: string | null;
  bodyHtml: string;
}): Promise<void> {
  await invokeCommand<void>('db_create_campaign_template', {
    company_id: input.companyId,
    name: input.name,
    subject: input.subject ?? null,
    body_html: input.bodyHtml,
  });
}

export async function listThreadCategories(companyId: string): Promise<ThreadCategoryRow[]> {
  return invokeCommand<ThreadCategoryRow[]>('db_list_thread_categories', { companyId });
}

export async function upsertThreadCategory(cat: UpsertThreadCategoryRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_thread_category', { cat });
}

export async function setThreadCategoriesBatch(
  entries: { accountId: string; threadId: string; category: string }[],
): Promise<void> {
  return invokeCommand<void>('db_set_thread_categories_batch', { entries });
}
