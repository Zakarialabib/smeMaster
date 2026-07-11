import {
  listContacts as dbListContacts,
  getContact as dbGetContact,
  getContactByEmail as dbGetContactByEmail,
  updateContact as dbUpdateContact,
  upsertContact as dbUpsertContact,
  deleteContact as dbDeleteContact,
  logEngagement,
  getEngagementHistory,
  searchContacts as dbSearchContacts,
  getContactWithStats as dbGetContactWithStats,
  getRecentThreadsWithContact as dbGetRecentThreadsWithContact,
  getAttachmentsFromContact as dbGetAttachmentsFromContact,
  getContactsFromSameDomain as dbGetContactsFromSameDomain,
  getLatestAuthResult as dbGetLatestAuthResult,
  updateContactScore as dbUpdateContactScoreCmd,
  getContactsNeedingScoreUpdate as dbGetContactsNeedingScoreUpdate,
  getContactEmailStats as dbGetContactEmailStats,
  listDynamicSegments as dbListDynamicSegments,
  createDynamicSegment as dbCreateDynamicSegment,
  updateDynamicSegmentRefresh as dbUpdateDynamicSegmentRefresh,
  deleteDynamicSegment as dbDeleteDynamicSegment,
  countContacts as dbCountContacts,
} from "@shared/services/db/db-invoke";
import { normalizeEmail } from "@shared/utils/emailUtils";

export interface DbContact {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  frequency: number;
  last_contacted_at: number | null;
  notes: string | null;
}

export interface ContactAttachment {
  filename: string;
  mime_type: string | null;
  size: number | null;
  date: number;
}

export interface SameDomainContact {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Search contacts by email or name prefix for autocomplete.
 */
export async function searchContacts(
  query: string,
  limit = 10,
): Promise<DbContact[]> {
  const results = await dbSearchContacts(query, limit);
  return results as unknown as DbContact[];
}

/**
 * Get all contacts, ordered by frequency descending.
 */
export async function getAllContacts(
  limit = 500,
  offset = 0,
): Promise<DbContact[]> {
  return dbListContacts(limit, offset, null, null) as Promise<DbContact[]>;
}

/**
 * Count all contacts, optionally filtered by search query.
 * @param searchQuery - Optional search query
 */
export async function countAllContacts(searchQuery?: string | null): Promise<number> {
  const rows = await dbCountContacts(searchQuery);
  return rows[0]?.count ?? 0;
}

/**
 * Update a contact's display name.
 */
export async function updateContact(
  id: string,
  displayName: string | null,
): Promise<void> {
  await dbUpdateContact(id, {
    set: {
      display_name: displayName,
      updated_at: Math.floor(Date.now() / 1000),
    },
    unset: [],
  });
}

/**
 * Delete a contact by ID.
 */
export async function deleteContact(id: string): Promise<void> {
  await dbDeleteContact(id);
}

/**
 * Upsert a contact — bumps frequency if already exists.
 */
export async function upsertContact(
  email: string,
  displayName: string | null,
): Promise<void> {
  await dbUpsertContact({
    email: normalizeEmail(email),
    displayName,
    lastContactedAt: Math.floor(Date.now() / 1000),
  });
}

export async function getContactById(id: string): Promise<DbContact | null> {
  try {
    return (await dbGetContact(id)) as unknown as DbContact;
  } catch {
    return null;
  }
}

export async function getContactByEmail(
  email: string,
): Promise<DbContact | null> {
  const result = await dbGetContactByEmail(normalizeEmail(email));
  return result as DbContact | null;
}

export interface ContactStats {
  emailCount: number;
  firstEmail: number | null;
  lastEmail: number | null;
}

export interface ContactWithStats {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  frequency: number;
  last_contacted_at: number | null;
  first_contacted_at: number | null;
  notes: string | null;
  engagement_score: number;
  last_engaged_at: number | null;
  health_status: string;
  created_at: number;
  updated_at: number;
  task_count: number;
  email_count: number;
}

/**
 * Get a single contact with computed task and email counts.
 */
export async function getContactWithStats(
  contactId: string,
): Promise<ContactWithStats | null> {
  return dbGetContactWithStats(contactId);
}

export async function getContactStats(email: string): Promise<ContactStats> {
  return dbGetContactEmailStats(normalizeEmail(email));
}

export async function getRecentThreadsWithContact(
  email: string,
  limit = 5,
): Promise<
  {
    thread_id: string;
    subject: string | null;
    last_message_at: number | null;
  }[]
> {
  return dbGetRecentThreadsWithContact(normalizeEmail(email), limit);
}

export async function updateContactAvatar(
  email: string,
  avatarUrl: string,
): Promise<void> {
  const contact = await dbGetContactByEmail(normalizeEmail(email));
  if (!contact) return;
  await dbUpdateContact(contact.id, {
    set: {
      avatar_url: avatarUrl,
      updated_at: Math.floor(Date.now() / 1000),
    },
    unset: [],
  });
}

/**
 * Update a contact's notes by email.
 */
export async function updateContactNotes(
  email: string,
  notes: string | null,
): Promise<void> {
  const contact = await dbGetContactByEmail(normalizeEmail(email));
  if (!contact) return;
  await dbUpdateContact(contact.id, {
    set: {
      notes: notes || null,
      updated_at: Math.floor(Date.now() / 1000),
    },
    unset: [],
  });
}

/**
 * Get recent non-inline attachments from a contact.
 */
export async function getAttachmentsFromContact(
  email: string,
  limit = 5,
): Promise<ContactAttachment[]> {
  return dbGetAttachmentsFromContact(normalizeEmail(email), limit);
}

const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.co.uk",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.net",
]);

/**
 * Get other contacts from the same email domain (e.g., colleagues).
 * Skips public email providers.
 */
export async function getContactsFromSameDomain(
  email: string,
  limit = 5,
): Promise<SameDomainContact[]> {
  const normalized = normalizeEmail(email);
  const atIdx = normalized.indexOf("@");
  if (atIdx === -1) return [];

  const domain = normalized.slice(atIdx + 1);
  if (PUBLIC_DOMAINS.has(domain)) return [];

  return dbGetContactsFromSameDomain(normalized, limit);
}

/**
 * Get the most recent auth_results JSON string for messages from this sender.
 */
export async function getLatestAuthResult(
  email: string,
): Promise<string | null> {
  return dbGetLatestAuthResult(normalizeEmail(email));
}

export interface ContactEngagementRow {
  id: string;
  email: string;
  engagement_score: number;
  last_engaged_at: number | null;
  health_status: string;
}

export async function getContactEngagementData(
  contactId: string,
): Promise<ContactEngagementRow | null> {
  const stats = await dbGetContactWithStats(contactId);
  if (!stats) return null;
  return {
    id: stats.id,
    email: stats.email,
    engagement_score: stats.engagement_score,
    last_engaged_at: stats.last_engaged_at,
    health_status: stats.health_status,
  };
}

export async function updateContactScore(
  contactId: string,
  score: number,
  lastEngagedAt: number,
  healthStatus: string,
): Promise<void> {
  await dbUpdateContactScoreCmd(contactId, score, lastEngagedAt, healthStatus);
}

export async function getContactsNeedingScoreUpdate(
  hours = 24,
  limit = 100,
): Promise<{ id: string; email: string }[]> {
  return dbGetContactsNeedingScoreUpdate(hours, limit);
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

export async function insertEngagementLog(
  contactId: string,
  eventType: string,
  scoreDelta: number,
  entityType?: string,
  entityId?: string,
  metadataJson?: string,
): Promise<void> {
  const actualEntityType = entityType ?? "contact";
  const actualEntityId = entityId ?? contactId;
  const actualContactId = actualEntityType === "contact" ? contactId : null;
  await logEngagement({
    contactId: actualContactId,
    entityType: actualEntityType,
    entityId: actualEntityId,
    eventType,
    scoreDelta,
    metadataJson: metadataJson ?? "{}",
  });
}

export async function getEngagementLog(
  contactId: string,
  limit = 50,
): Promise<EngagementLogRow[]> {
  return getEngagementHistory(contactId, limit);
}

export interface DynamicSegmentRow {
  id: string;
  company_id: string;
  name: string;
  query: string;
  refreshed_at: number | null;
}

export async function getDynamicSegments(
  accountId: string,
): Promise<DynamicSegmentRow[]> {
  return dbListDynamicSegments(accountId);
}

export async function createDynamicSegment(
  accountId: string,
  name: string,
  query: string,
): Promise<string> {
  return dbCreateDynamicSegment(accountId, name, query);
}

export async function updateDynamicSegmentRefresh(
  segmentId: string,
): Promise<void> {
  await dbUpdateDynamicSegmentRefresh(segmentId);
}

export async function deleteDynamicSegment(
  id: string,
  accountId: string,
): Promise<void> {
  await dbDeleteDynamicSegment(id, accountId);
}
