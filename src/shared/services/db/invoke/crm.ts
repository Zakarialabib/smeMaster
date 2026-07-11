import { invokeCommand } from './command';

import { executeSearchQuery } from './core';

import type {
  Contact,
  ContactFile,
  ContactGroup,
  ContactLabel,
  ContactSegment,
  EntityPivot,
} from '../schema';

import type {
  ActivityEvent,
  ContactAttachment,
  ContactEmailStats,
  ContactEngagementData,
  ContactEngagementInput,
  ContactStats,
  ContactWithStats,
  CountRow,
  CreateGroupRequest,
  CreateLabelRequest,
  CreateSegmentRequest,
  DbContactTag,
  DynamicSegmentRow,
  EngagementLog,
  EngagementTrendPoint,
  LogEngagementRequest,
  SameDomainContact,
  UpdateFields,
  UpsertContactRequest,
} from './core';

export async function listContacts(
  limit: number,
  offset: number,
  sortBy?: string | null,
  searchQuery?: string | null,
): Promise<Contact[]> {
  return invokeCommand<Contact[]>('db_list_contacts', {
    limit,
    offset,
    sortBy: sortBy ?? null,
    searchQuery: searchQuery ?? null,
  });
}

export async function countContacts(searchQuery?: string | null): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_contacts', {
    searchQuery: searchQuery ?? null,
  });
}

export async function getContact(contactId: string): Promise<Contact> {
  return invokeCommand<Contact>('db_get_contact', { contactId });
}

export async function getContactByEmail(email: string): Promise<Contact | null> {
  return invokeCommand<Contact | null>('db_get_contact_by_email', { email });
}

export async function upsertContact(contact: UpsertContactRequest): Promise<Contact> {
  return invokeCommand<Contact>('db_upsert_contact', { contact });
}

export async function updateContact(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_contact', { id, fields });
}

export async function deleteContact(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_contact', { id });
}

export async function getContactStats(email: string): Promise<ContactStats> {
  return invokeCommand<ContactStats>('db_get_contact_stats', { email });
}

export async function searchContacts(query: string, limit: number): Promise<Contact[]> {
  return invokeCommand<Contact[]>('db_search_contacts', { query, limit });
}

export async function getContactWithStats(contactId: string): Promise<ContactWithStats | null> {
  return invokeCommand<ContactWithStats | null>('db_get_contact_with_stats', { contactId });
}

export async function getRecentThreadsWithContact(
  email: string,
  limit: number,
): Promise<{ thread_id: string; subject: string | null; last_message_at: number | null }[]> {
  return invokeCommand<
    { thread_id: string; subject: string | null; last_message_at: number | null }[]
  >('db_get_recent_threads_with_contact', { email, limit });
}

export async function getAttachmentsFromContact(
  email: string,
  limit: number,
): Promise<ContactAttachment[]> {
  return invokeCommand<ContactAttachment[]>('db_get_attachments_from_contact', { email, limit });
}

export async function getContactsFromSameDomain(
  email: string,
  limit: number,
): Promise<SameDomainContact[]> {
  return invokeCommand<SameDomainContact[]>('db_get_contacts_from_same_domain', { email, limit });
}

export async function getLatestAuthResult(email: string): Promise<string | null> {
  return invokeCommand<string | null>('db_get_latest_auth_result', { email });
}

export async function getContactEngagementData(
  email: string,
  thirtyDaysAgo?: number,
): Promise<ContactEngagementData> {
  const cutoff = thirtyDaysAgo ?? Math.floor(Date.now() / 1000) - 30 * 86400;
  return invokeCommand<ContactEngagementData>('db_get_contact_engagement_data', {
    email,
    thirtyDaysAgo: cutoff,
  });
}

export async function updateContactScore(
  contactId: string,
  score: number,
  lastEngagedAt: number,
  healthStatus: string,
): Promise<void> {
  return invokeCommand<void>('db_update_contact_score', {
    contactId,
    score,
    lastEngagedAt,
    healthStatus,
  });
}

export async function getContactsNeedingScoreUpdate(
  hours: number,
  limit: number = 100,
): Promise<{ id: string; email: string }[]> {
  return invokeCommand<{ id: string; email: string }[]>('db_get_contacts_needing_score_update', {
    cutoffHours: hours,
    limit,
  });
}

export async function listContactLabels(companyId: string): Promise<ContactLabel[]> {
  return invokeCommand<ContactLabel[]>('db_list_contact_labels', { companyId });
}

export async function createContactLabel(label: CreateLabelRequest): Promise<ContactLabel> {
  return invokeCommand<ContactLabel>('db_create_contact_label', { label });
}

export async function deleteContactLabel(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_contact_label', { id });
}

export async function listContactGroups(companyId: string): Promise<ContactGroup[]> {
  return invokeCommand<ContactGroup[]>('db_list_contact_groups', { companyId });
}

export async function createContactGroup(group: CreateGroupRequest): Promise<ContactGroup> {
  return invokeCommand<ContactGroup>('db_create_contact_group', { group });
}

export async function addContactToGroup(contactId: string, groupId: string): Promise<void> {
  return invokeCommand<void>('db_add_contact_to_group', { contactId, groupId });
}

export async function removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
  return invokeCommand<void>('db_remove_contact_from_group', { contactId, groupId });
}

export async function upsertContactGroup(
  id: string | undefined | null,
  companyId: string,
  name: string,
  description?: string | null,
): Promise<string> {
  const groupId = id ?? crypto.randomUUID();
  await invokeCommand<void>('db_upsert_contact_group', {
    id: groupId,
    companyId,
    name,
    description: description ?? null,
  });
  return groupId;
}

export async function deleteContactGroup(id: string, companyId: string): Promise<void> {
  return invokeCommand<void>('db_delete_contact_group', { id, companyId });
}

export async function getContactCountForGroup(groupId: string): Promise<number> {
  return invokeCommand<number>('db_get_contact_count_for_group', { groupId });
}

export async function getContactGroupMembers(groupId: string): Promise<{ contact_id: string }[]> {
  return invokeCommand<{ contact_id: string }[]>('db_get_contact_group_members', { groupId });
}

export async function getContactTagById(id: string): Promise<DbContactTag | null> {
  return invokeCommand<DbContactTag | null>('db_get_contact_tag_by_id', { id });
}

export async function upsertContactTag(
  id: string | undefined | null,
  companyId: string,
  name: string,
  color?: string | null,
): Promise<string> {
  const tagId = id ?? crypto.randomUUID();
  await invokeCommand<void>('db_upsert_contact_tag', {
    id: tagId,
    companyId,
    name,
    color: color ?? null,
  });
  return tagId;
}

export async function getContactCountForTag(tagId: string): Promise<number> {
  return invokeCommand<number>('db_get_contact_count_for_tag', { tagId });
}

export async function upsertContactSegment(
  id: string | undefined | null,
  companyId: string,
  name: string,
  query: string,
): Promise<string> {
  return invokeCommand<string>('db_upsert_segment', { id, companyId, name, query });
}

export async function deleteContactSegment(id: string, companyId: string): Promise<void> {
  return invokeCommand<void>('db_delete_segment', { id, companyId });
}

export async function addEntityLink(
  entityType: string,
  entityId: string,
  pivotType: string,
  pivotId: string,
): Promise<void> {
  return invokeCommand<void>('db_add_entity_link', { entityType, entityId, pivotType, pivotId });
}

export async function removeEntityLink(
  entityType: string,
  entityId: string,
  pivotType: string,
  pivotId: string,
): Promise<void> {
  return invokeCommand<void>('db_remove_entity_link', { entityType, entityId, pivotType, pivotId });
}

export async function getLinkedEntities(
  entityType: string,
  entityId: string,
): Promise<EntityPivot[]> {
  return invokeCommand<EntityPivot[]>('db_get_linked_entities', { entityType, entityId });
}

export async function listSegments(companyId: string): Promise<ContactSegment[]> {
  return invokeCommand<ContactSegment[]>('db_list_segments', { companyId });
}

export async function createSegment(segment: CreateSegmentRequest): Promise<ContactSegment> {
  return invokeCommand<ContactSegment>('db_create_segment', { segment });
}

export async function executeSegmentQuery(segmentId: string): Promise<Contact[]> {
  return invokeCommand<Contact[]>('db_execute_segment_query', { segmentId });
}

export async function logEngagement(event: LogEngagementRequest): Promise<void> {
  return invokeCommand<void>('db_log_engagement', { event });
}

export async function getEngagementHistory(
  contactId: string,
  limit: number,
): Promise<EngagementLog[]> {
  return invokeCommand<EngagementLog[]>('db_get_engagement_history', { contactId, limit });
}

export async function getContactFiles(contactId: string): Promise<ContactFile[]> {
  return invokeCommand<ContactFile[]>('db_get_contact_files', { contactId });
}

export async function searchContactFiles(query: string): Promise<ContactFile[]> {
  return invokeCommand<ContactFile[]>('db_search_contact_files', { query });
}

export async function saveContactFile(file: {
  companyId: string;
  contactId: string | null;
  filename: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  category: string;
  senderEmail: string | null;
  messageId: string | null;
  localPath: string;
}): Promise<void> {
  const id = crypto.randomUUID();
  return invokeCommand<void>('db_create_contact_file', {
    id,
    companyId: file.companyId,
    contactId: file.contactId,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size ?? null,
    category: file.category,
    senderEmail: file.senderEmail,
    messageId: file.messageId,
    localPath: file.localPath,
  });
}

export async function getContactFilesBySender(senderEmail: string): Promise<ContactFile[]> {
  return invokeCommand<ContactFile[]>('db_get_contact_files_by_sender', { senderEmail });
}

export async function getContactFilesByAccount(companyId: string): Promise<ContactFile[]> {
  return invokeCommand<ContactFile[]>('db_get_contact_files_by_account', { companyId });
}

export async function getContactFilesByCategory(
  companyId: string,
  category: string,
): Promise<ContactFile[]> {
  return invokeCommand<ContactFile[]>('db_get_contact_files_by_category', { companyId, category });
}

export async function getContactFileCategories(companyId: string): Promise<string[]> {
  return invokeCommand<string[]>('db_get_contact_file_categories', { companyId });
}

export async function updateContactFileCategory(id: string, category: string): Promise<void> {
  return invokeCommand<void>('db_update_contact_file_category', { id, category });
}

export async function toggleContactFileStarred(id: string): Promise<void> {
  return invokeCommand<void>('db_toggle_contact_file_starred', { id });
}

export async function deleteContactFile(id: string): Promise<string | null> {
  return invokeCommand<string | null>('db_delete_contact_file', { id });
}

export async function mergeContacts(keepId: string, mergeId: string): Promise<void> {
  return invokeCommand<void>('db_merge_contacts', { keepId, mergeId });
}

export async function listDynamicSegments(companyId: string): Promise<DynamicSegmentRow[]> {
  const rows = await executeSearchQuery(
    'SELECT * FROM dynamic_segments WHERE company_id = $1 ORDER BY name ASC',
    [companyId],
  );
  return rows as unknown as DynamicSegmentRow[];
}

export async function createDynamicSegment(
  companyId: string,
  name: string,
  query: string,
): Promise<string> {
  return invokeCommand<string>('db_create_dynamic_segment', { companyId, name, query });
}

export async function updateDynamicSegmentRefresh(segmentId: string): Promise<void> {
  return invokeCommand<void>('db_update_dynamic_segment_refresh', { segmentId });
}

export async function deleteDynamicSegment(id: string, companyId: string): Promise<void> {
  return invokeCommand<void>('db_delete_dynamic_segment', { id, companyId });
}

export async function getContactEmailStats(email: string): Promise<ContactEmailStats> {
  const rows = await executeSearchQuery(
    `SELECT COUNT(*) as cnt, MIN(date) as first_date, MAX(date) as last_date
     FROM messages WHERE from_address = $1`,
    [email],
  );
  const row = rows[0] as
    | { cnt: number; first_date: number | null; last_date: number | null }
    | undefined;
  return {
    emailCount: row?.cnt ?? 0,
    firstEmail: row?.first_date ?? null,
    lastEmail: row?.last_date ?? null,
  };
}

export async function getEngagementTrend(
  contactId: string,
  days: number,
): Promise<EngagementTrendPoint[]> {
  return invokeCommand<EngagementTrendPoint[]>('db_get_engagement_trend', { contactId, days });
}

export async function getEngagementForEntity(
  entityType: string,
  entityId: string,
  days?: number,
): Promise<EngagementLog[]> {
  return invokeCommand<EngagementLog[]>('db_get_engagement_for_entity', {
    entityType,
    entityId,
    days: days ?? null,
  });
}

export async function getEngagementDataForContact(email: string): Promise<ContactEngagementInput> {
  return invokeCommand<ContactEngagementInput>('db_get_engagement_data_for_contact', { email });
}

export async function batchUpdateContactScores(): Promise<void> {
  return invokeCommand<void>('db_batch_update_contact_scores');
}

export async function getContactActivity(
  companyId: string,
  email: string,
  limit: number,
): Promise<ActivityEvent[]> {
  return invokeCommand<ActivityEvent[]>('db_get_contact_activity', { companyId, email, limit });
}
