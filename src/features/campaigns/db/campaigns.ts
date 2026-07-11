/**
 * Campaigns database operations — thin Tauri-invoke wrappers.
 *
 * These are intentionally transparent (no error handling) so callers
 * (store, service layer, UI) can wrap with safeDbOperation as needed.
 */

import {
  listCampaigns as dbListCampaigns,
  getCampaign as dbGetCampaign,
  createCampaign as dbCreateCampaign,
  updateCampaignStatus as dbUpdateCampaignStatus,
  incrementCampaignSentCount as dbIncrementCampaignSentCount,
  deleteCampaign as dbDeleteCampaign,
} from "@shared/services/db/db-invoke";
import type { Campaign } from "@shared/services/db/schema";

export type { Campaign };
export type DbCampaign = Campaign;

export async function getCampaigns(companyId: string): Promise<Campaign[]> {
  return dbListCampaigns(companyId);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return dbGetCampaign(id);
}

export async function createCampaign(
  companyId: string,
  name: string,
  templateId?: string,
  segmentId?: string,
): Promise<string> {
  return dbCreateCampaign(companyId, name, templateId, segmentId);
}

export async function updateCampaignStatus(
  id: string,
  status: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await dbUpdateCampaignStatus(id, status, status === "sent" ? now : null);
}

export async function incrementSentCount(id: string): Promise<void> {
  await dbIncrementCampaignSentCount(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  await dbDeleteCampaign(id);
}
