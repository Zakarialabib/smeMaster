import { invokeCommand } from '@shared/services/db/invoke/command';

// ---------- IMAP types ----------

export interface ImapConfig {
  host: string;
  port: number;
  security: 'tls' | 'starttls' | 'none';
  username: string;
  password: string; // plaintext password or OAuth2 access token
  auth_method: 'password' | 'oauth2';
  accept_invalid_certs?: boolean;
}

export interface ImapFolder {
  path: string;       // decoded UTF-8 display name
  raw_path: string;   // original modified UTF-7 path for IMAP commands
  name: string;       // decoded display name (last segment)
  delimiter: string;
  special_use: string | null;
  exists: number;
  unseen: number;
}

export interface ImapMessage {
  uid: number;
  folder: string;
  message_id: string | null;
  in_reply_to: string | null;
  references: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  reply_to: string | null;
  subject: string | null;
  date: number;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  body_html: string | null;
  body_text: string | null;
  snippet: string | null;
  raw_size: number;
  list_unsubscribe: string | null;
  list_unsubscribe_post: string | null;
  auth_results: string | null;
  attachments: ImapAttachment[];
}

export interface ImapAttachment {
  part_id: string;
  filename: string;
  mime_type: string;
  size: number;
  content_id: string | null;
  is_inline: boolean;
}

export interface ImapFolderStatus {
  uidvalidity: number;
  uidnext: number;
  exists: number;
  unseen: number;
  highest_modseq: number | null;
}

export interface ImapFetchResult {
  messages: ImapMessage[];
  folder_status: ImapFolderStatus;
}

// ---------- Folder search result (lightweight: UIDs + status only) ----------

export interface ImapFolderSearchResult {
  uids: number[];
  folder_status: ImapFolderStatus;
}

// ---------- Folder sync result (single-connection search + fetch) ----------

export interface ImapFolderSyncResult {
  uids: number[];
  messages: ImapMessage[];
  folder_status: ImapFolderStatus;
}

// ---------- Delta check types ----------

export interface DeltaCheckRequest {
  folder: string;
  last_uid: number;
  uidvalidity: number;
}

export interface DeltaCheckResult {
  folder: string;
  uidvalidity: number;
  new_uids: number[];
  uidvalidity_changed: boolean;
}

// ---------- SMTP types ----------

export interface SmtpConfig {
  host: string;
  port: number;
  security: 'tls' | 'starttls' | 'none';
  username: string;
  password: string;
  auth_method: 'password' | 'oauth2';
  accept_invalid_certs?: boolean;
}

export interface SmtpSendResult {
  success: boolean;
  message: string;
}

// ---------- Generic invoke helpers ----------

function imapCmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invokeCommand<T>(`imap_${name}`, args ?? {});
}

function smtpCmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invokeCommand<T>(`smtp_${name}`, args ?? {});
}

// ---------- IMAP commands ----------

export const imapTestConnection = (config: ImapConfig): Promise<string> =>
  imapCmd('test_connection', { config });

export const imapListFolders = (config: ImapConfig): Promise<ImapFolder[]> =>
  imapCmd('list_folders', { config });

export const imapFetchMessages = (config: ImapConfig, folder: string, uids: number[]): Promise<ImapFetchResult> =>
  imapCmd('fetch_messages', { config, folder, uids });

export const imapFetchNewUids = (config: ImapConfig, folder: string, sinceUid: number): Promise<number[]> =>
  imapCmd('fetch_new_uids', { config, folder, sinceUid });

export const imapSearchAllUids = (config: ImapConfig, folder: string): Promise<number[]> =>
  imapCmd('search_all_uids', { config, folder });

export const imapFetchMessageBody = (config: ImapConfig, folder: string, uid: number): Promise<ImapMessage> =>
  imapCmd('fetch_message_body', { config, folder, uid });

export const imapSetFlags = (config: ImapConfig, folder: string, uids: number[], flags: string[], add: boolean): Promise<void> =>
  imapCmd('set_flags', { config, folder, uids, flags, add });

export const imapMoveMessages = (config: ImapConfig, folder: string, uids: number[], destination: string): Promise<void> =>
  imapCmd('move_messages', { config, folder, uids, destination });

export const imapDeleteMessages = (config: ImapConfig, folder: string, uids: number[]): Promise<void> =>
  imapCmd('delete_messages', { config, folder, uids });

export const imapAppendMessage = (config: ImapConfig, folder: string, rawMessage: string, flags?: string): Promise<void> =>
  imapCmd('append_message', { config, folder, flags: flags ?? null, rawMessage });

export const imapGetFolderStatus = (config: ImapConfig, folder: string): Promise<ImapFolderStatus> =>
  imapCmd('get_folder_status', { config, folder });

export const imapFetchAttachment = (config: ImapConfig, folder: string, uid: number, partId: string): Promise<string> =>
  imapCmd('fetch_attachment', { config, folder, uid, partId });

export const imapFetchRawMessage = (config: ImapConfig, folder: string, uid: number): Promise<string> =>
  imapCmd('fetch_raw_message', { config, folder, uid });

export const imapDeltaCheck = (config: ImapConfig, folders: DeltaCheckRequest[]): Promise<DeltaCheckResult[]> =>
  imapCmd('delta_check', { config, folders });

export const imapSyncFolder = (config: ImapConfig, folder: string, batchSize: number, sinceDate?: string | null): Promise<ImapFolderSyncResult> =>
  imapCmd('sync_folder', { config, folder, batchSize, sinceDate: sinceDate ?? null });

export const imapSearchFolder = (config: ImapConfig, folder: string, sinceDate?: string | null): Promise<ImapFolderSearchResult> =>
  imapCmd('search_folder', { config, folder, sinceDate: sinceDate ?? null });

export const imapRawFetchDiagnostic = (config: ImapConfig, folder: string, uidRange: string): Promise<string> =>
  imapCmd('raw_fetch_diagnostic', { config, folder, uidRange });

// ---------- SMTP commands ----------

export const smtpSendEmail = (config: SmtpConfig, rawEmail: string): Promise<SmtpSendResult> =>
  smtpCmd('send_email', { config, rawEmail });

export const smtpTestConnection = (config: SmtpConfig): Promise<SmtpSendResult> =>
  smtpCmd('test_connection', { config });
