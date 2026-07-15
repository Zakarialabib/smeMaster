import { invokeCommand } from './command';

import type { BackupSchedule, Campaign, CampaignRecipientWithCampaign } from '../schema';

export async function listCampaigns(companyId: string): Promise<Campaign[]> {
  return invokeCommand<Campaign[]>('db_list_campaigns', { companyId });
}

export async function listCampaignsByContact(contactId: string): Promise<CampaignRecipientWithCampaign[]> {
  return invokeCommand<CampaignRecipientWithCampaign[]>('db_list_campaigns_by_contact', { contactId });
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return invokeCommand<Campaign | null>('db_get_campaign', { id });
}

export async function createCampaign(
  companyId: string,
  name: string,
  templateId?: string | null,
  segmentId?: string | null,
): Promise<string> {
  return invokeCommand<string>('db_create_campaign', {
    companyId,
    name,
    templateId: templateId ?? null,
    segmentId: segmentId ?? null,
  });
}

export async function updateCampaignStatus(
  id: string,
  status: string,
  sentAt?: number | null,
): Promise<void> {
  return invokeCommand<void>('db_update_campaign_status', { id, status, sentAt: sentAt ?? null });
}

export async function incrementCampaignSentCount(id: string): Promise<void> {
  return invokeCommand<void>('db_increment_campaign_sent_count', { id });
}

export async function deleteCampaign(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_campaign', { id });
}

export async function createCampaignWithRecipients(input: {
  companyId: string;
  name: string;
  templateId?: string | null;
  segmentId?: string | null;
  abTestConfig?: string | null;
  bodyHtml?: string | null;
  contactIds: string[];
  scheduledAt?: number | null;
}): Promise<{ campaign: Campaign; recipientCount: number }> {
  return invokeCommand<{ campaign: Campaign; recipientCount: number }>(
    'db_create_campaign_with_recipients',
    {
      input: {
        company_id: input.companyId,
        name: input.name,
        template_id: input.templateId ?? null,
        segment_id: input.segmentId ?? null,
        ab_test_config: input.abTestConfig ?? null,
        body_html: input.bodyHtml ?? null,
        contact_ids: input.contactIds,
        scheduled_at: input.scheduledAt ?? null,
      },
    },
  );
}

export async function sendCampaign(campaignId: string): Promise<number> {
  return invokeCommand<number>('db_send_campaign', { campaignId });
}

export async function listBackupSchedules(companyId?: string | null): Promise<BackupSchedule[]> {
  return invokeCommand<BackupSchedule[]>('db_list_backup_schedules', {
    companyId: companyId ?? null,
  });
}

// Return the scheduled-but-not-yet-sent campaigns for a company, ordered by
// `scheduledAt` ASC. Used by the campaign dashboard and "upcoming sends" widget.
export interface CampaignSchedule {
  id: string;
  campaignId: string;
  scheduledAt: number;
  status: string;
  createdAt: number;
}

export async function listCampaignSchedules(companyId: string): Promise<CampaignSchedule[]> {
  return invokeCommand<CampaignSchedule[]>('db_list_campaign_schedules', { companyId });
}
