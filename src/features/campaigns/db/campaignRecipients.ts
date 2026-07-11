import { invokeCommand } from "@shared/services/db/invoke/command";
import type { CampaignRecipient, CampaignRecipientWithCampaign } from "@shared/services/db/schema";

export type DbCampaignRecipient = CampaignRecipient;

export interface EngagementDataPoint {
  date: string;
  opens: number;
  clicks: number;
}

export interface RecipientStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export async function addRecipient(
  campaignId: string,
  contactId: string,
): Promise<void> {
  await invokeCommand<void>("db_add_campaign_recipient", { campaignId, contactId });
}

export async function addRecipientsBulk(
  campaignId: string,
  contactIds: string[],
): Promise<void> {
  await invokeCommand<void>("db_add_campaign_recipients_bulk", { campaignId, contactIds });
}

export async function getRecipients(
  campaignId: string,
): Promise<CampaignRecipient[]> {
  return invokeCommand<CampaignRecipient[]>("db_list_campaign_recipients", { campaignId });
}

export async function getRecipientStats(campaignId: string): Promise<RecipientStats> {
  // Rust exposes grouped counts via db_get_campaign_stats_by_status
  // (the flat db_get_campaign_recipient_stats command does not exist).
  const rows = await invokeCommand<{ status: string; count: number }[]>(
    "db_get_campaign_stats_by_status",
    { campaignId },
  );
  const stats: RecipientStats = { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 };
  for (const row of rows) {
    stats.total += row.count;
    switch (row.status.toLowerCase()) {
      case "sent": stats.sent += row.count; break;
      case "opened": stats.opened += row.count; break;
      case "clicked": stats.clicked += row.count; break;
      case "bounced": stats.bounced += row.count; break;
    }
  }
  return stats;
}

export async function updateRecipientStatus(
  campaignId: string,
  contactId: string,
  status: string,
): Promise<void> {
  await invokeCommand<void>("db_update_campaign_recipient_status", {
    campaignId,
    contactId,
    status,
  });
}

export async function updateRecipientOpen(
  campaignId: string,
  contactId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await invokeCommand<void>("db_update_campaign_recipient_open", {
    campaignId,
    contactId,
    openedAt: now,
  });
}

export async function updateRecipientClick(
  campaignId: string,
  contactId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await invokeCommand<void>("db_update_campaign_recipient_click", {
    campaignId,
    contactId,
    clickedAt: now,
  });
}

/** Get all campaigns for a contact with recipient status (joined data). */
export async function getCampaignsForContact(
  contactId: string,
): Promise<CampaignRecipientWithCampaign[]> {
  return invokeCommand<CampaignRecipientWithCampaign[]>("db_get_campaigns_for_contact", { contactId });
}

export async function getEngagementTimeSeries(campaignId: string): Promise<EngagementDataPoint[]> {
  return invokeCommand<EngagementDataPoint[]>("db_get_campaign_engagement_time_series", { campaignId });
}

export async function removeRecipient(
  campaignId: string,
  contactId: string,
): Promise<void> {
  await invokeCommand<void>("db_remove_campaign_recipient", { campaignId, contactId });
}

