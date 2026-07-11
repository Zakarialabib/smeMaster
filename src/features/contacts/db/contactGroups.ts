import {
  listContactGroups,
  addContactToGroup as dbAddContactToGroup,
  removeContactFromGroup as dbRemoveContactFromGroup,
  upsertContactGroup as dbUpsertContactGroup,
  deleteContactGroup as dbDeleteContactGroup,
  getContactCountForGroup as dbGetContactCountForGroup,
  getContactGroupMembers as dbGetContactGroupMembers,
} from "../../../shared/services/db/db-invoke";

export interface DbContactGroup {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface DbContactGroupPivot {
  contact_id: string;
  group_id: string;
}

export async function getContactGroups(companyId: string): Promise<DbContactGroup[]> {
  return listContactGroups(companyId);
}

export async function upsertContactGroup(
  id: string | undefined,
  companyId: string,
  name: string,
  description?: string | null,
): Promise<string> {
  return dbUpsertContactGroup(id ?? null, companyId, name, description ?? null);
}

export async function deleteContactGroup(id: string, companyId: string): Promise<void> {
  await dbDeleteContactGroup(id, companyId);
}

export async function getContactCountForGroup(groupId: string): Promise<number> {
  return dbGetContactCountForGroup(groupId);
}

export async function addContactToGroup(contactId: string, groupId: string): Promise<void> {
  await dbAddContactToGroup(contactId, groupId);
}

export async function removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
  await dbRemoveContactFromGroup(contactId, groupId);
}

export async function getContactGroupIds(groupId: string): Promise<{ contact_id: string }[]> {
  return dbGetContactGroupMembers(groupId);
}
