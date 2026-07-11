export type {
  DbContact,
  ContactAttachment,
  SameDomainContact,
  ContactStats,
  ContactEngagementRow,
  DynamicSegmentRow,
} from "./db/contacts";

export type {
  ContactTag,
  ContactGroup,
  ContactSegment,
} from "./stores/contactStore";

export { useContactStore } from "./stores/contactStore";

export {
  searchContacts,
  updateContact,
  deleteContact,
  upsertContact,
  getContactById,
  getContactByEmail,
  getContactStats,
  getRecentThreadsWithContact,
  updateContactNotes,
  getAttachmentsFromContact,
  getContactsFromSameDomain,
  getLatestAuthResult,
  getContactEngagementData,
  updateContactScore,
  getContactsNeedingScoreUpdate,
  createDynamicSegment,
  updateDynamicSegmentRefresh,
  deleteDynamicSegment,
} from "./db/contacts";
