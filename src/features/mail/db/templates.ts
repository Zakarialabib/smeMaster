import { v4 as uuidv4 } from 'uuid';
import {
  listTemplates,
  getTemplateById as dbGetTemplateById,
  countTemplates as dbCountTemplates,
  upsertTemplate as dbUpsertTemplate,
  deleteTemplate as dbDeleteTemplate,
  incrementTemplateUsage as dbIncrementTemplateUsage,
  updateTemplate as dbUpdateTemplate,
  getFavoriteTemplates as dbGetFavoriteTemplates,
  getMostUsedTemplates as dbGetMostUsedTemplates,
  getTemplatesByType as dbGetTemplatesByType,
  listTemplateCategories as dbListTemplateCategories,
  upsertTemplateCategory as dbUpsertTemplateCategory,
  deleteTemplateCategory as dbDeleteTemplateCategory,
  insertTemplateIgnore as dbInsertTemplateIgnore,
  listTemplatesPaginated as dbListTemplatesPaginated,
} from "@shared/services/db/db-invoke";
import type { Template, TemplateCategory } from "@shared/services/db/schema";

export type DbTemplate = Template;

export type DbTemplateCategory = TemplateCategory;

export async function getTemplatesForAccount(
  companyId: string,
): Promise<DbTemplate[]> {
  return listTemplates(companyId);
}

/**
 * Get templates with pagination for an account.
 * @param accountId - The owning account ID
 * @param limit - Maximum number of templates
 * @param offset - Number of templates to skip
 * @param templateType - Optional template type filter
 * @param origin - Optional origin filter
 */
export async function getTemplatesPaginated(
  companyId: string,
  limit: number,
  offset: number,
  templateType?: string | null,
  origin?: string | null,
): Promise<DbTemplate[]> {
  return dbListTemplatesPaginated(companyId, limit, offset, templateType, origin);
}

export const getTemplateById = dbGetTemplateById;

export async function countTemplatesCount(): Promise<number> {
  const rows = await dbCountTemplates(null, null);
  return rows[0]?.count ?? 0;
}

export async function insertTemplate(tmpl: {
  accountId: string | null;
  name: string;
  subject: string | null;
  bodyHtml: string;
  shortcut: string | null;
  categoryId?: string | null;
  conditionalBlocksJson?: string | null;
  templateType?: string;
  origin?: string;
  deliveryConfigJson?: string | null;
  aiConfigJson?: string | null;
  voiceConfigJson?: string | null;
  complianceProfileId?: string | null;
}): Promise<string> {
  const id = uuidv4();
  await dbUpsertTemplate({
    id,
    accountId: tmpl.accountId,
    name: tmpl.name,
    subject: tmpl.subject,
    bodyHtml: tmpl.bodyHtml,
    shortcut: tmpl.shortcut,
    categoryId: tmpl.categoryId ?? null,
    conditionalBlocksJson: tmpl.conditionalBlocksJson ?? null,
    templateType: tmpl.templateType ?? "email",
    origin: tmpl.origin ?? "user_created",
    deliveryConfigJson: tmpl.deliveryConfigJson ?? null,
    aiConfigJson: tmpl.aiConfigJson ?? null,
    voiceConfigJson: tmpl.voiceConfigJson ?? null,
    complianceProfileId: tmpl.complianceProfileId ?? null,
  });
  return id;
}

export async function updateTemplate(
  id: string,
  updates: { name?: string; subject?: string | null; bodyHtml?: string; shortcut?: string | null; categoryId?: string | null; isFavorite?: boolean; conditionalBlocksJson?: string | null; templateType?: string; origin?: string; deliveryConfigJson?: string | null; aiConfigJson?: string | null; voiceConfigJson?: string | null; complianceProfileId?: string | null },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.subject !== undefined) set.subject = updates.subject;
  if (updates.bodyHtml !== undefined) set.body_html = updates.bodyHtml;
  if (updates.shortcut !== undefined) set.shortcut = updates.shortcut;
  if (updates.categoryId !== undefined) set.category_id = updates.categoryId;
  if (updates.isFavorite !== undefined) set.is_favorite = updates.isFavorite ? 1 : 0;
  if (updates.conditionalBlocksJson !== undefined) set.conditional_blocks_json = updates.conditionalBlocksJson;
  if (updates.templateType !== undefined) set.template_type = updates.templateType;
  if (updates.origin !== undefined) set.origin = updates.origin;
  if (updates.deliveryConfigJson !== undefined) set.delivery_config_json = updates.deliveryConfigJson;
  if (updates.aiConfigJson !== undefined) set.ai_config_json = updates.aiConfigJson;
  if (updates.voiceConfigJson !== undefined) set.voice_config_json = updates.voiceConfigJson;
  if (updates.complianceProfileId !== undefined) set.compliance_profile_id = updates.complianceProfileId;

  if (Object.keys(set).length > 0) {
    await dbUpdateTemplate(id, { set, unset: [] });
  }
}

export const deleteTemplate = dbDeleteTemplate;
export const incrementTemplateUsage = dbIncrementTemplateUsage;
export const getFavorites = dbGetFavoriteTemplates;
export const getMostUsed = dbGetMostUsedTemplates;
export const getCategories = dbListTemplateCategories;
export const getTemplatesByType = dbGetTemplatesByType;

export async function upsertCategory(cat: {
  id?: string;
  accountId: string | null;
  name: string;
  icon?: string | null;
}): Promise<string> {
  const id = cat.id ?? uuidv4();
  await dbUpsertTemplateCategory({
    id,
    accountId: cat.accountId,
    name: cat.name,
    icon: cat.icon ?? null,
  });
  return id;
}

export const deleteCategory = dbDeleteTemplateCategory;

export async function seedCampaignTemplates(): Promise<void> {
  const existing = await dbCountTemplates("campaign", "built_in");
  if (existing[0]?.count && existing[0].count >= 10) return;

  const { campaignTemplates } = await import("@/constants/campaignTemplates");
  for (const t of campaignTemplates) {
    try {
      await dbInsertTemplateIgnore({
        id: t.id,
        name: t.name,
        subject: t.name,
        bodyHtml: t.html,
        templateType: "campaign",
        origin: "built_in",
        sortOrder: 0,
        isFavorite: true,
      });
    } catch {
      // Skip duplicates
    }
  }
}

export async function seedAllPresets(): Promise<void> {
  const existing = await dbCountTemplates(null, "built_in");
  if (existing[0] && existing[0].count >= 10) {
    console.log(`[seed] Presets already seeded: ${existing[0].count} built-in templates`);
    return;
  }

  const { emailPresets } = await import("@features/mail/constants/emailPresets");
  let seeded = 0;
  for (const p of emailPresets) {
    try {
      await dbInsertTemplateIgnore({
        id: p.id,
        name: p.name,
        subject: p.subject,
        bodyHtml: p.bodyHtml,
        templateType: "email",
        origin: "built_in",
        sortOrder: 0,
        isFavorite: true,
      });
      seeded++;
    } catch (err) {
      console.error(`[seed] Failed to insert email preset ${p.id}:`, err);
    }
  }

  const { campaignPresets } = await import("@/constants/campaignPresets");
  for (const p of campaignPresets) {
    try {
      await dbInsertTemplateIgnore({
        id: p.id,
        name: p.name,
        subject: p.subject,
        bodyHtml: p.bodyHtml,
        templateType: "campaign",
        origin: "built_in",
        sortOrder: 0,
        isFavorite: true,
      });
      seeded++;
    } catch (err) {
      console.error(`[seed] Failed to insert campaign preset ${p.id}:`, err);
    }
  }

  const { warmupPresets } = await import("@/constants/warmupPresets");
  for (const p of warmupPresets) {
    try {
      await dbInsertTemplateIgnore({
        id: p.id,
        name: p.name,
        subject: p.subject,
        bodyHtml: p.bodyHtml,
        templateType: "warmup",
        origin: "built_in",
        sortOrder: 0,
        isFavorite: true,
      });
      seeded++;
    } catch (err) {
      console.error(`[seed] Failed to insert warmup preset ${p.id}:`, err);
    }
  }

  const { WORKFLOW_PRESETS } = await import("@/constants/workflowPresets");
  for (const p of WORKFLOW_PRESETS) {
    try {
      await dbInsertTemplateIgnore({
        id: p.id,
        name: p.name,
        subject: p.description,
        bodyHtml: p.description,
        templateType: "workflow",
        origin: "built_in",
        sortOrder: 0,
        isFavorite: true,
        deliveryConfigJson: JSON.stringify({
          trigger_event: p.trigger_event,
          trigger_conditions: p.trigger_conditions,
          actions: p.actions,
          category: p.category,
        }),
      });
      seeded++;
    } catch (err) {
      console.error(`[seed] Failed to insert workflow preset ${p.id}:`, err);
    }
  }

  console.log(`[seed] Seeded ${seeded} built-in templates`);
}
