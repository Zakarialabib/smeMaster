import {
  getContactFiles,
  searchContactFiles as dbSearchContactFiles,
  saveContactFile as dbSaveContactFile,
  getContactFilesBySender as dbGetContactFilesBySender,
  getContactFilesByAccount as dbGetContactFilesByAccount,
  getContactFilesByCategory as dbGetContactFilesByCategory,
  getContactFileCategories as dbGetContactFileCategories,
  updateContactFileCategory as dbUpdateContactFileCategory,
  toggleContactFileStarred as dbToggleContactFileStarred,
  deleteContactFile as dbDeleteContactFile,
} from "../../../shared/services/db/db-invoke";

export interface ContactFile {
  id: string;
  company_id: string;
  contact_id: string | null;
  filename: string;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  category: string;
  starred: number;
  sender_email: string | null;
  message_id: string | null;
  local_path: string | null;
  created_at: number;
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
  await dbSaveContactFile({
    companyId: file.companyId,
    contactId: file.contactId,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category,
    senderEmail: file.senderEmail,
    messageId: file.messageId,
    localPath: file.localPath,
  });
}

export async function getContactFilesByContact(contactId: string): Promise<ContactFile[]> {
  return getContactFiles(contactId);
}

export async function getContactFilesBySender(senderEmail: string): Promise<ContactFile[]> {
  return dbGetContactFilesBySender(senderEmail);
}

export async function getContactFilesByAccount(companyId: string): Promise<ContactFile[]> {
  return dbGetContactFilesByAccount(companyId);
}

export async function searchContactFiles(query: string): Promise<ContactFile[]> {
  return dbSearchContactFiles(query);
}

export async function getContactFilesByCategory(companyId: string, category: string): Promise<ContactFile[]> {
  return dbGetContactFilesByCategory(companyId, category);
}

export async function getContactFileCategories(companyId: string): Promise<string[]> {
  return dbGetContactFileCategories(companyId);
}

export async function updateFileCategory(id: string, category: string): Promise<void> {
  await dbUpdateContactFileCategory(id, category);
}

export async function toggleFileStarred(id: string): Promise<void> {
  await dbToggleContactFileStarred(id);
}

export async function deleteContactFile(id: string): Promise<void> {
  const localPath = await dbDeleteContactFile(id);
  if (localPath) {
    try {
      const { invokeCommand } = await import("@shared/services/db/invoke/command");
      await invokeCommand("delete_from_vault", { vaultPath: localPath });
    } catch {
      // file may already be deleted
    }
  }
}
