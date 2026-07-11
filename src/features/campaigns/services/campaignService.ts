/**
 * Campaign service — thin orchestration layer.
 *
 * All heavy lifting (create campaign + add recipients + A/B test config,
 * send campaign + variant assignment + enqueue pending ops) happens in Rust
 * via single Tauri invoke commands. This file is a thin wrapper that resolves
 * group/segment contact IDs on the frontend (complex dynamic queries) and
 * forwards to the Rust command.
 */

import {
  createCampaignWithRecipients,
  sendCampaign as dbSendCampaign,
} from "@shared/services/db/db-invoke";
import { getContactGroupIds } from "@features/contacts/db/contactGroups";

export interface CampaignCreateInput {
  companyId: string;
  name: string;
  templateId?: string;
  segmentId?: string;
  recipientContactIds?: string[];
  groupId?: string;
  status?: string;
  abTestConfig?: {
    variantA: { subject: string; body: string };
    variantB: { subject: string; body: string };
    splitRatio: number;
    testDurationHours: number;
  };
}

/**
 * Create a campaign with all recipient resolution in a single invoke.
 *
 * - Resolves group/segment contact IDs on the frontend (dynamic queries).
 * - Delegates the actual DB work (campaign insert + recipient bulk insert +
 *   A/B test config) to the Rust `db_create_campaign_with_recipients` command.
 */
export async function createCampaign(
  input: CampaignCreateInput,
): Promise<string> {
  // Resolve contact IDs from group or segment
  let contactIds: string[] = [];
  if (input.recipientContactIds) {
    contactIds = input.recipientContactIds;
  } else if (input.groupId) {
    const members = await getContactGroupIds(input.groupId);
    contactIds = members.map((m) => m.contact_id);
  } else if (input.segmentId) {
    const { getContactSegments } = await import(
      "@features/contacts/db/contactSegments"
    );
    const segments = await getContactSegments(input.companyId);
    const seg = segments.find((s) => s.id === input.segmentId);
    if (seg) {
      const { evaluateSegmentQuery } = await import(
        "@features/contacts/services/segments"
      );
      contactIds = await evaluateSegmentQuery(input.companyId, seg.query);
    }
  }

  // Serialize AB test config to JSON string if provided
  let abTestConfig: string | undefined;
  if (input.abTestConfig) {
    abTestConfig = JSON.stringify({
      variantA: input.abTestConfig.variantA,
      variantB: input.abTestConfig.variantB,
      splitRatio: input.abTestConfig.splitRatio,
      testDurationHours: input.abTestConfig.testDurationHours,
    });
  }

  // Single Rust invoke — creates campaign + inserts recipients + stores A/B config
  const result = await createCampaignWithRecipients({
    companyId: input.companyId,
    name: input.name,
    templateId: input.templateId,
    segmentId: input.segmentId,
    abTestConfig,
    contactIds,
  });

  return result.campaign.id;
}

/**
 * Send a campaign — all logic in Rust (variant assignment, pending ops, status update).
 * Returns the number of recipients processed.
 */
export async function sendCampaign(campaignId: string): Promise<number> {
  return dbSendCampaign(campaignId);
}
