import {
  addContactToGroup as dbAddToGroup,
  removeContactFromGroup as dbRemoveFromGroup,
  getContactGroups as dbGetGroups,
} from "@features/contacts/db/contactGroups";
import type { DbContactGroup } from "@features/contacts/db/contactGroups";

export async function addContactToGroup(contactId: string, groupId: string): Promise<void> {
  await dbAddToGroup(contactId, groupId);
}

export async function removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
  await dbRemoveFromGroup(contactId, groupId);
}

export async function getContactGroups(contactId: string): Promise<DbContactGroup[]> {
  return dbGetGroups(contactId);
}

