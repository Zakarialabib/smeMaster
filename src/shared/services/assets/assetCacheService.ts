import { invokeCommand } from "@shared/services/db/invoke/command";

/**
 * Get the total size of the attachment cache in bytes.
 */
export async function getCacheSize(): Promise<number> {
  return invokeCommand<number>("get_cache_size");
}

/**
 * Clear all cached attachments.
 */
export async function clearCache(): Promise<void> {
  return invokeCommand("clear_cache");
}

/**
 * Get the file system path for a cached attachment.
 * The file may not exist yet — the caller should check.
 */
export async function getAttachmentCachePath(
  attachmentId: string,
  extension: string,
): Promise<string> {
  return invokeCommand<string>("get_attachment_cache_path", {
    attachmentId,
    extension,
  });
}

/**
 * Get human-readable cache size.
 */
export async function getCacheSizeFormatted(): Promise<string> {
  const bytes = await getCacheSize();
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
