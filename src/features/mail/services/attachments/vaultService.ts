import { invokeCommand } from "@shared/services/db/invoke/command";
import { getEmailProvider } from "@features/mail/services/email/providerFactory";
import { saveContactFile } from "@features/contacts/db/contactFiles";
import { categorizeByFilename } from "./vaultCategorizer";
import { getContactByEmail } from "../../../../features/contacts/db/contacts.ts";
import type { DbAttachment } from "@shared/services/db/attachments";

export async function saveAttachmentToVault(
  accountId: string,
  messageId: string,
  senderEmail: string,
  attachment: DbAttachment,
): Promise<string> {
  const provider = await getEmailProvider(accountId);
  const response = await provider.fetchAttachment(messageId, attachment.gmail_attachment_id!);

  const base64 = response.data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const vaultRoot = await invokeCommand<string>("get_vault_root");
  const contactDir = senderEmail.replace(/[@.]/g, "_");
  const storedFilename = `${Date.now()}_${attachment.filename ?? "unnamed"}`;
  const vaultPath = `${vaultRoot}/${contactDir}/${storedFilename}`;
  const dest = `${vaultRoot}/${contactDir}`;

  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  await mkdir(dest, { recursive: true }).catch(() => {});
  await writeFile(vaultPath, bytes);

  const contact = await getContactByEmail(senderEmail);
  const category = categorizeByFilename(attachment.filename ?? "");

  await saveContactFile({
    companyId: accountId,
    contactId: contact?.id ?? null,
    filename: storedFilename,
    originalName: attachment.filename ?? "unnamed",
    mimeType: attachment.mime_type,
    size: attachment.size,
    category,
    senderEmail,
    messageId,
    localPath: vaultPath,
  });

  return vaultPath;
}

