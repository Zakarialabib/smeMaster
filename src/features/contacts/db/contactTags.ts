import {
  listContactLabels,
  deleteContactLabel,
  addEntityLink,
  removeEntityLink,
  getLinkedEntities,
  getContactTagById as dbGetContactTagById,
  upsertContactTag as dbUpsertContactTag,
  getContactCountForTag as dbGetContactCountForTag,
} from "../../../shared/services/db/db-invoke";

export interface DbContactTag {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface DbContactTagPivot {
  contact_id: string;
  tag_id: string;
}

export async function getContactTags(companyId: string): Promise<DbContactTag[]> {
  return listContactLabels(companyId);
}

export async function getContactTagById(id: string): Promise<DbContactTag | null> {
  return dbGetContactTagById(id);
}

export async function upsertContactTag(
  id: string | undefined,
  companyId: string,
  name: string,
  color?: string | null,
): Promise<string> {
  return dbUpsertContactTag(id ?? null, companyId, name, color ?? null);
}

export async function deleteContactTag(id: string, _companyId: string): Promise<void> {
  await deleteContactLabel(id);
}

export async function getContactCountForTag(tagId: string): Promise<number> {
  return dbGetContactCountForTag(tagId);
}

export async function addTagToContact(contactId: string, tagId: string): Promise<void> {
  await addEntityLink("contact", contactId, "label", tagId);
}

export async function removeTagFromContact(contactId: string, tagId: string): Promise<void> {
  await removeEntityLink("contact", contactId, "label", tagId);
}

export async function getTagIdsForContact(contactId: string): Promise<string[]> {
  const pivots = await getLinkedEntities("contact", contactId);
  return pivots.map((p) => p.pivot_id);
}
