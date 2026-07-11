import { getTemplatesByType } from "@features/mail/db/templates";
import type { DbTemplate } from "@features/mail/db/templates";

export async function getCampaignTemplateList(accountId: string): Promise<DbTemplate[]> {
  return getTemplatesByType(accountId, "campaign");
}

