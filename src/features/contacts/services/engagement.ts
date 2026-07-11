import { logEngagement as dbLogEngagement, getEngagementTrend as dbGetEngagementTrend, getEngagementForEntity as dbGetEngagementForEntity } from "@shared/services/db/db-invoke";

export interface EngagementTrendPoint {
  date: string;
  score: number;
}

export interface EngagementLogRow {
  id: string;
  contact_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  event_type: string;
  score_delta: number;
  metadata_json: string;
  created_at: number;
}

/**
 * Log an engagement event for a contact (backward-compatible signature).
 * When entityType is 'contact', both contact_id and entity_type/entity_id are populated.
 * When entityType is anything else, contact_id is null.
 */
export async function logEngagement(
  contactId: string,
  eventType: string,
  scoreDelta: number,
  entityType?: string,
  entityId?: string,
  metadataJson?: string,
): Promise<void> {
  const actualEntityType = entityType ?? (contactId ? "contact" : null);
  const actualEntityId = entityId ?? (actualEntityType === "contact" ? contactId : null);
  const actualContactId = actualEntityType === "contact" ? contactId : null;

  await dbLogEngagement({
    contactId: actualContactId ?? undefined,
    entityType: actualEntityType ?? undefined,
    entityId: actualEntityId ?? undefined,
    eventType,
    scoreDelta,
    metadataJson: metadataJson ?? null,
  });
}

/**
 * Log an engagement event for any entity (contact, thread, task, campaign)
 * without requiring a contact_id.
 */
export async function logEntityEngagement(
  entityType: string,
  entityId: string,
  eventType: string,
  scoreDelta: number,
  metadataJson?: string,
): Promise<void> {
  const contactId = entityType === "contact" ? entityId : null;
  await logEngagement(
    contactId ?? "",
    eventType,
    scoreDelta,
    entityType,
    entityId,
    metadataJson,
  );
}

/**
 * Get engagement trend for a contact (backward compatible).
 */
export async function getEngagementTrend(contactId: string, days = 30): Promise<EngagementTrendPoint[]> {
  return dbGetEngagementTrend(contactId, days);
}

/**
 * Get engagement log rows for any entity using the polymorphic pattern.
 */
export async function getEngagementForEntity(
  entityType: string,
  entityId: string,
  days?: number,
): Promise<EngagementLogRow[]> {
  return dbGetEngagementForEntity(entityType, entityId, days);
}