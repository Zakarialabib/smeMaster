// src/shared/services/commands.ts
// Typed IPC layer for all Tauri commands registered in src-tauri/src/lib.rs
// Last synced: 2026-05-19
//
// Usage:
//   import { invoke } from "@shared/services/commands";
//   const platform = await invoke("get_platform");
//   const folders = await invoke("imap_list_folders", { config: myConfig });

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { isTauriEnvironment, TauriUnavailableError } from "@shared/services/ipc";
import type { Contact } from "./db/schema";

// ==========================================================================
// Shared Types (mirrors Rust structs used in command signatures)
// ==========================================================================

// ── Platform ──────────────────────────────────────────────────────────────

export interface PlatformInfo {
  mobile: boolean;
  desktop: boolean;
  os: string;
  arch: string;
  is_tablet: boolean;
  is_phone: boolean;
}

// ── Biometric ─────────────────────────────────────────────────────────────

export interface BiometricStatus {
  is_available: boolean;
  biometry_type: number; // u32
  error: string | null;
}

// ── OAuth ─────────────────────────────────────────────────────────────────

export interface OAuthResult {
  code: string;
  state: string;
}

export interface TokenExchangeResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // u64
  token_type: string;
  scope?: string;
  id_token?: string;
  expires_at?: number; // u64 epoch seconds
}

// ── IMAP ──────────────────────────────────────────────────────────────────

export interface ImapConfig {
  host: string;
  port: number; // u16
  security: string; // "tls" | "starttls" | "none"
  username: string;
  password: string;
  auth_method: string; // "password" | "oauth2"
  accept_invalid_certs?: boolean;
}

export interface ImapFolder {
  path: string;
  raw_path: string;
  name: string;
  delimiter: string;
  special_use?: string;
  exists: number; // u32
  unseen: number; // u32
}

export interface ImapAttachment {
  part_id: string;
  filename: string;
  mime_type: string;
  size: number; // u32
  content_id?: string;
  is_inline: boolean;
}

export interface ImapMessage {
  uid: number; // u32
  folder: string;
  message_id?: string;
  in_reply_to?: string;
  references?: string;
  from_address?: string;
  from_name?: string;
  to_addresses?: string;
  cc_addresses?: string;
  bcc_addresses?: string;
  reply_to?: string;
  subject?: string;
  date: number; // i64
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  body_html?: string;
  body_text?: string;
  snippet?: string;
  raw_size: number; // u32
  list_unsubscribe?: string;
  list_unsubscribe_post?: string;
  auth_results?: string;
  attachments: ImapAttachment[];
}

export interface ImapFolderStatus {
  uidvalidity: number; // u32
  uidnext: number; // u32
  exists: number; // u32
  unseen: number; // u32
  highest_modseq?: number; // u64
}

export interface ImapFetchResult {
  messages: ImapMessage[];
  folder_status: ImapFolderStatus;
}

export interface ImapFolderSyncResult {
  uids: number[]; // u32[]
  messages: ImapMessage[];
  folder_status: ImapFolderStatus;
}

export interface ImapFolderSearchResult {
  uids: number[]; // u32[]
  folder_status: ImapFolderStatus;
}

export interface DeltaCheckRequest {
  folder: string;
  last_uid: number; // u32
  uidvalidity: number; // u32
}

export interface DeltaCheckResult {
  folder: string;
  uidvalidity: number; // u32
  new_uids: number[]; // u32[]
  uidvalidity_changed: boolean;
}

// ── IMAP Batch ────────────────────────────────────────────────────────────

export interface BatchItemResult {
  itemId: string;
  success: boolean;
  error?: string;
}

export interface BatchResult {
  total: number; // usize
  succeeded: number; // usize
  failed: number; // usize
  items: BatchItemResult[];
}

export interface BatchMetadata {
  uid: number; // u32
  flags: string[];
  internalDate?: string;
  size?: number; // u32
  envelope?: string;
}

// ── SMTP ──────────────────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number; // u16
  security: string; // "tls" | "starttls" | "none"
  username: string;
  password: string;
  auth_method: string; // "password" | "oauth2"
  accept_invalid_certs?: boolean;
  timeout_secs?: number; // u64
}

export interface SmtpSendResult {
  success: boolean;
  message: string;
}

// ── DNS ───────────────────────────────────────────────────────────────────

export interface DnsCheckResult {
  spf?: string;
  dkim?: string;
  dmarc?: string;
}

// ── PGP ───────────────────────────────────────────────────────────────────

export interface PgpKeyInfo {
  id: string;
  fingerprint: string;
  user_id: string;
  algorithm: string;
  created_at: number; // u64
  expires_at?: number; // u64
  is_revoked: boolean;
}

// ── Vault ─────────────────────────────────────────────────────────────────

export interface VaultEntry {
  path: string;
  is_dir: boolean;
}

export interface CopyToVaultOptions {
  encrypt: boolean;
  publicKeyArmored?: string;
}

// ── Device Pairing ────────────────────────────────────────────────────────

export interface PairingToken {
  token: string;
  device_name: string;
  created_at: number; // u64
  expires_at: number; // u64
}

export interface PairedDevice {
  id: string;
  device_name: string;
  device_type: string;
  token_hash: string;
  paired_at: number; // u64
  last_seen_at: number; // u64
  is_active: boolean;
}

// ── Device Sync ───────────────────────────────────────────────────────────

export type ChangeKind =
  | { EmailFlagRead: string }
  | { EmailArchived: string }
  | { EmailMoved: { thread_id: string; from_folder: string; to_folder: string } }
  | { VaultFileAdded: string }
  | { VaultFileDeleted: string }
  | { SettingChanged: { key: string; value: string } }
  | { ContactAdded: string }
  | { ContactUpdated: string }
  | { GenericEntityChange: { entity_type: string; entity_id: string; action: string } };

export interface SyncedChange {
  id: string;
  device_id: string;
  timestamp: number; // u64 millis
  kind: ChangeKind;
  payload: string;
  acknowledged?: boolean;
}

export interface PairingEntry {
  device_id: string;
  device_name: string;
  paired_at: string; // DateTime<Utc> → ISO string
  public_key?: string;
  last_seen_at?: string; // DateTime<Utc> → ISO string
}

// ── Deliverability ────────────────────────────────────────────────────────

export interface DnsblResult {
  list_name: string;
  listed: boolean;
  responded: boolean;
}

export interface RecordStatus {
  present: boolean;
  valid: boolean;
  issues: string[];
  raw_value?: string;
}

export interface BlacklistResult {
  provider: string;
  listed: boolean;
  details?: string;
}

export interface DomainHealth {
  domain: string;
  score: number; // u8
  spf_status: RecordStatus;
  dkim_status: RecordStatus;
  dmarc_status: RecordStatus;
  ptr_status: RecordStatus;
  mx_status: RecordStatus;
  blacklist_status: BlacklistResult[];
  checked_at: string; // DateTime<Utc> → ISO string
}

export type FailureType =
  | "MissingSpf"
  | "SpfPermissive"
  | "SpfLookupLimit"
  | "MissingDkim"
  | "WeakDkimKey"
  | "MissingDmarc"
  | "WeakDmarcPolicy"
  | "BlacklistedIp"
  | "NoPtrMatch"
  | "MxIssues";

export interface LocalizedString {
  en: string;
  fr: string;
  ar: string;
}

export type Provider = "Gmail" | "Outlook" | "Yahoo" | "Exchange" | "All";

export type ImpactSeverity = "Critical" | "Warning" | "Info";

export interface ProviderImpact {
  provider: Provider;
  severity: ImpactSeverity;
  description: string;
}

export type FixMethod = "SelfService" | "Cpanel" | "Cloudflare" | "Godaddy" | "Ovh" | "Automated";

export interface FixStep {
  step_number: number; // u8
  action: string;
  expected_result: string;
  copy_value?: string;
}

export interface FixPath {
  method: FixMethod;
  instructions: FixStep[];
  estimated_time: string;
}

export interface RemediationNode {
  failure_type: FailureType;
  explanation: LocalizedString;
  impact: ProviderImpact[];
  fix_paths: FixPath[];
}

export type AlertType = "RegressionDetected" | "KeyExpirationWarning" | "ScoreDropped";

export type AlertSeverity = "Critical" | "Warning" | "Info";

export interface SentinelAlert {
  id: string;
  alert_type: AlertType;
  domain: string;
  severity: AlertSeverity;
  message: string;
  created_at: number; // i64
  acknowledged: boolean;
}

// ── Export ────────────────────────────────────────────────────────────────

export interface BackupConfig {
  enabled: boolean;
  interval_secs: number; // u64
  retention_count: number; // usize
  destination_path?: string;
}

// ── Orchestrator ──────────────────────────────────────────────────────────

export interface SyncHealthSummary {
  total_syncs: number; // u64
  failed_syncs: number; // u64
  success_rate_percent: number; // f64
  last_error?: string;
  last_sync_at?: number; // i64
}

// ── Theme ─────────────────────────────────────────────────────────────────

interface ThemePreference {
  mode: string;
  colorTheme: string;
  fontScale: string;
  reduceMotion: boolean;
  surface: string;
  density: string;
}

// ── Observability (Gate 6) ────────────────────────────────────────────────

export type CacheStats = {
  hits: number;
  misses: number;
  hitRatePct: number;
  size: number;
};

export type DbHealthStats = {
  dbSizeBytes: number;
  walSizeBytes: number;
  uptimeSecs: number;
  poolSize: number;
  poolActiveConnections: number;
  poolMaxConnections: number;
  cache: Record<string, CacheStats>;
};

export type AccountSyncStatus = {
  accountId: string;
  email: string;
  provider: string;
  status: string;
  lastSyncAt: number | null;
  lastError: string | null;
  folderCount: number;
  messageCount: number;
};

// Mirrors crate::commands::db::DbBootstrapState
export type DbBootstrapState = {
  accounts: unknown[];
  labels: unknown[];
  recentThreads: unknown[];
  unreadCounts: Record<string, number>;
  syncStatus: AccountSyncStatus[];
};

// Mirrors crate::orchestrator::subsystem_lifecycle::SubsystemStatusSnapshot
export type SubsystemStatusSnapshot = {
  name: string;
  class: "always_on" | "lazy" | "on_demand";
  status: "inactive" | "dormant" | "starting" | "active" | "shutting_down" | "failed";
  reason: string;
  uptimeSecs?: number;
  error?: string;
  featureFlag?: string;
};

// Mirrors crate::commands::db::DbStatusSnapshot
export type DbStatusSnapshot = {
  health: DbHealthStats;
  syncStatus: AccountSyncStatus[];
  subsystems: SubsystemStatusSnapshot[];
};

// Mirrors crate::commands::db::OfflineAvailabilityEntry
export type OfflineAvailabilityEntry = {
  id: string;
  accountId: string;
  folderId: string | null;
  contactId: string | null;
  reason: "manual" | "recent" | "favorite" | "label";
  enabled: number;
  createdAt: number;
  updatedAt: number;
};

// ==========================================================================
// Command Registry
// Maps each command name to { params, result } for full type safety.
// ==========================================================================

type TauriCommands = {
  // ── Platform ─────────────────────────────────────────────────────────
  get_platform: { params: void; result: PlatformInfo };

  // ── Biometric ────────────────────────────────────────────────────────
  check_biometric: { params: void; result: BiometricStatus };
  authenticate_biometric: { params: { reason: string }; result: void };

  // ── OAuth ────────────────────────────────────────────────────────────
  start_oauth_server: { params: { port: number; state: string }; result: OAuthResult };
  start_oauth_browser: { params: { auth_url: string; state: string }; result: OAuthResult };
  oauth_exchange_token: {
    params: {
      token_url: string;
      code: string;
      client_id: string;
      redirect_uri: string;
      code_verifier?: string;
      client_secret?: string;
      scope?: string;
    };
    result: TokenExchangeResult;
  };
  oauth_refresh_token: {
    params: {
      token_url: string;
      refresh_token: string;
      client_id: string;
      client_secret?: string;
      scope?: string;
    };
    result: TokenExchangeResult;
  };

  // ── Tray & Window ────────────────────────────────────────────────────
  set_tray_tooltip: { params: { tooltip: string }; result: void };
  close_splashscreen: { params: void; result: void };
  open_devtools: { params: void; result: void };

  // ── IMAP ─────────────────────────────────────────────────────────────
  imap_test_connection: { params: { config: ImapConfig }; result: string };
  imap_list_folders: { params: { config: ImapConfig }; result: ImapFolder[] };
  imap_fetch_messages: {
    params: {
      config: ImapConfig;
      folder: string;
      uids: number[];
      body_only?: boolean;
      raw?: boolean;
    };
    result: ImapFetchResult;
  };
  imap_fetch_new_uids: {
    params: { config: ImapConfig; folder: string; since_uid: number };
    result: number[];
  };
  imap_search: {
    params: { config: ImapConfig; folder: string; since_date?: string; all?: boolean };
    result: ImapFolderSearchResult;
  };
  imap_set_flags: {
    params: { config: ImapConfig; folder: string; uids: number[]; flags: string[]; add: boolean };
    result: void;
  };
  imap_move_messages: {
    params: { config: ImapConfig; folder: string; uids: number[]; destination: string };
    result: void;
  };
  imap_delete_messages: {
    params: { config: ImapConfig; folder: string; uids: number[] };
    result: void;
  };
  imap_get_folder_status: {
    params: { config: ImapConfig; folder: string };
    result: ImapFolderStatus;
  };
  imap_fetch_attachment: {
    params: { config: ImapConfig; folder: string; uid: number; part_id: string };
    result: string;
  };
  imap_append_message: {
    params: { config: ImapConfig; folder: string; flags?: string; raw_message: string };
    result: void;
  };
  imap_sync: {
    params: {
      config: ImapConfig;
      folder: string;
      batch_size?: number;
      since_date?: string;
      delta_check?: DeltaCheckRequest[];
    };
    result: unknown; // serde_json::Value
  };
  imap_search_all_uids: {
    params: { config: ImapConfig; folder: string };
    result: number[];
  };
  imap_fetch_message_body: {
    params: { config: ImapConfig; folder: string; uid: number };
    result: ImapMessage;
  };
  imap_fetch_raw_message: {
    params: { config: ImapConfig; folder: string; uid: number };
    result: string;
  };
  imap_delta_check: {
    params: { config: ImapConfig; folders: DeltaCheckRequest[] };
    result: DeltaCheckResult[];
  };
  imap_sync_folder: {
    params: { config: ImapConfig; folder: string; batch_size: number; since_date?: string };
    result: ImapFolderSyncResult;
  };
  imap_search_folder: {
    params: { config: ImapConfig; folder: string; since_date?: string };
    result: ImapFolderSearchResult;
  };
  imap_raw_fetch_diagnostic: {
    params: { config: ImapConfig; folder: string; uid_range: string };
    result: string;
  };

  // ── IMAP Batch ───────────────────────────────────────────────────────
  batch_imap_set_flags: {
    params: {
      config: ImapConfig;
      folder: string;
      message_uids: number[];
      flags: string[];
      is_add: boolean;
    };
    result: BatchResult;
  };
  batch_imap_move: {
    params: {
      config: ImapConfig;
      source_folder: string;
      dest_folder: string;
      message_uids: number[];
    };
    result: BatchResult;
  };
  batch_imap_delete: {
    params: { config: ImapConfig; folder: string; message_uids: number[] };
    result: BatchResult;
  };
  batch_imap_fetch_metadata: {
    params: {
      config: ImapConfig;
      folder: string;
      message_uids: number[];
      fields: string[];
    };
    result: BatchMetadata[];
  };

  // ── SMTP ─────────────────────────────────────────────────────────────
  smtp_send_email: {
    params: { config: SmtpConfig; raw_email: string };
    result: SmtpSendResult;
  };
  smtp_test_connection: { params: { config: SmtpConfig }; result: SmtpSendResult };

  // ── DNS ──────────────────────────────────────────────────────────────
  check_dns_records: { params: { domain: string }; result: DnsCheckResult };

  // ── PGP ──────────────────────────────────────────────────────────────
  generate_key: { params: { user_id: string; passphrase: string }; result: [string, string] };
  get_key_info_cmd: { params: { armored_key: string }; result: PgpKeyInfo };
  rotate_pgp_key: { params: { key_id: string; new_passphrase: string }; result: PgpKeyInfo };
  encrypt: { params: { plaintext: string; public_key_armored: string }; result: string };
  decrypt_message: {
    params: { ciphertext_b64: string; private_key_armored: string; passphrase: string };
    result: string;
  };
  pgp_cache_passphrase: { params: { account_id: string; passphrase: string }; result: void };
  pgp_get_cached_passphrase: { params: { account_id: string }; result: string | null };
  pgp_clear_passphrase_cache: { params: { account_id: string }; result: void };

  // ── Vault ────────────────────────────────────────────────────────────
  get_vault_root: { params: void; result: string };
  copy_to_vault: { params: { source_path: string; vault_path: string }; result: void };
  delete_from_vault: { params: { vault_path: string }; result: void };
  list_vault_dir: { params: { dir_path: string }; result: VaultEntry[] };
  read_vault_file: { params: { path: string }; result: string };
  copy_vault_to_downloads: { params: { vault_path: string }; result: void };
  create_vault_dir: { params: { path: string }; result: void };
  set_vault_pin: { params: { pin: string }; result: void };
  verify_vault_pin: { params: { pin: string }; result: boolean };
  copy_to_vault_encrypted: {
    params: { source_path: string; vault_path: string; options?: CopyToVaultOptions };
    result: void;
  };
  move_vault_item: { params: { source_path: string; dest_path: string }; result: void };
  rename_vault_item: { params: { path: string; new_name: string }; result: void };
  copy_vault_item: { params: { source_path: string; dest_path: string }; result: void };
  get_vault_size: { params: void; result: number }; // u64
  search_vault: { params: { dir_path: string; pattern: string }; result: string[] };

  // ── Export ───────────────────────────────────────────────────────────
  append_to_mbox: {
    params: {
      file_path: string;
      message_rfc2822: string;
      from_address: string;
      date_seconds: number;
    };
    result: void;
  };
  export_analytics_report: { params: { campaign_data: string }; result: string };
  export_contacts_csv: { params: { destinationPath: string }; result: number };
  export_contacts_vcard: { params: { destinationPath: string }; result: number };
  export_tasks_csv: { params: { destinationPath: string }; result: number };
  export_calendar_ics: { params: { destinationPath: string }; result: number };
  get_export_formats: { params: void; result: string[] };
  validate_export_config: { params: { format: string; destination: string }; result: boolean };

  // ── Deliverability ───────────────────────────────────────────────────
  check_dnsbl_cmd: { params: { ip: string }; result: DnsblResult[] };
  check_domain_health: { params: { domain: string; sending_ip?: string }; result: DomainHealth };
  get_remediation: { params: { domain: string; failure_types: FailureType[] }; result: RemediationNode[] };
  run_sentinel_check: { params: { domain: string; previous_score: number }; result: SentinelAlert[] };
  get_sentinel_alerts: { params: void; result: SentinelAlert[] };

  // ── Device Pairing ───────────────────────────────────────────────────
  generate_qr_token: { params: { device_name: string }; result: PairingToken };
  verify_device_token: { params: { token: string; device_type: string }; result: PairedDevice };
  get_qr_payload: { params: { token: PairingToken }; result: string };

  // ── Device Management ────────────────────────────────────────────────
  get_pairings: { params: void; result: PairingEntry[] };
  save_device_pairing: { params: { entry: PairingEntry }; result: void };
  remove_device_pairing: { params: { device_id: string }; result: void };

  // ── Device Sync ──────────────────────────────────────────────────────
  push_changes: {
    params: { device_id: string; changes: SyncedChange[] };
    result: void;
  };
  pull_changes: {
    params: { device_id: string; since_timestamp: number };
    result: SyncedChange[];
  };
  ack_sync: {
    params: { device_id: string; up_to_timestamp: number };
    result: void;
  };
  record_change: {
    params: { device_id: string; kind: ChangeKind; payload: string };
    result: SyncedChange;
  };
  sync_log_get_history: {
    params: { limit?: number };
    result: SyncedChange[];
  };
  sync_log_maintenance: {
    params: { older_than_secs?: number };
    result: { pruned_count: number; remaining_count: number };
  };

  // ── Assets ───────────────────────────────────────────────────────────
  get_cache_size: { params: void; result: number }; // u64
  clear_cache: { params: void; result: void };
  get_attachment_cache_path: {
    params: { attachment_id: string; extension: string };
    result: string;
  };

  // ── App ──────────────────────────────────────────────────────────────
  reset_app: { params: void; result: void };

  // ── Backup Scheduler ─────────────────────────────────────────────────
  get_backup_config: { params: void; result: BackupConfig };
  set_backup_config: { params: { new_config: BackupConfig }; result: void };
  toggle_backup: { params: { enabled: boolean }; result: void };

  // ── Orchestrator ─────────────────────────────────────────────────────
  get_sync_health_summary: { params: void; result: SyncHealthSummary };

  // ── IMAP IDLE ────────────────────────────────────────────────────────
  start_idle: { params: { account_id: string; config: ImapConfig }; result: void };
  stop_idle: { params: { account_id: string }; result: void };

  // ── Theme Preferences ────────────────────────────────────────────────
  db_get_theme_preference: { params: void; result: ThemePreference | null };
  db_set_theme_preference: {
    params: { preference: ThemePreference };
    result: void;
  };

  // ── Observability (Gate 6) ───────────────────────────────────────────
  db_health_stats: { params: void; result: DbHealthStats };
  db_sync_status: { params: void; result: AccountSyncStatus[] };
  db_bootstrap_state: { params: void; result: DbBootstrapState };
  db_status_snapshot: { params: void; result: DbStatusSnapshot };
  db_cache_status: {
    params: void;
    result: { enabled: boolean; domains: Record<string, CacheStats> };
  };
  db_cache_invalidate_all: { params: void; result: void };
  db_cache_benchmark: { params: void; result: Record<string, number> };
  db_set_offline_available: {
    params: {
      id: string;
      accountId: string;
      folderId?: string;
      contactId?: string;
      reason: string;
      enabled: boolean;
    };
    result: void;
  };
  db_remove_offline_available: { params: { id: string }; result: void };
  db_list_offline_available: {
    params: { accountId?: string };
    result: OfflineAvailabilityEntry[];
  };

  // ── Contacts: filtered query ───────────────────────────────────────
  db_filter_contacts: {
    params: {
      tagId: string | null;
      groupId: string | null;
      segmentId: string | null;
      limit: number;
      offset: number;
    };
    result: Contact[];
  };

  // ── Subsystem lifecycle: restart ───────────────────────────────────
  db_restart_subsystem: {
    params: { name: string };
    result: SubsystemStatusSnapshot;
  };
};

// ==========================================================================
// Typed Invoke Function
// ==========================================================================

/**
 * Typed invocation wrapper for Tauri commands.
 *
 * Provides:
 * - Autocomplete for command names
 * - Type checking for parameters and return values
 * - Single import for all Tauri IPC calls
 *
 * Usage:
 *   import { invoke } from "@shared/services/commands";
 *
 *   // With params:
 *   const result = await invoke("imap_list_folders", { config: myImapConfig });
 *
 *   // Without params:
 *   const platform = await invoke("get_platform");
 *
 * @param command - The command name (autocompleted via keyof TauriCommands)
 * @param args - The command arguments object (type-checked per command)
 * @returns Promise resolving to the typed result
 */
export async function invoke<T extends keyof TauriCommands>(
  command: T,
  ...[args]: TauriCommands[T]['params'] extends void
    ? [params?: undefined]
    : [params: TauriCommands[T]['params']]
): Promise<TauriCommands[T]['result']> {
  // Mirror the guard in @shared/services/ipc: outside a Tauri shell the raw
  // invoke dereferences window.__TAURI_INTERNALS__ and throws the cryptic
  // "Cannot read properties of undefined (reading 'invoke')". Short-circuit
  // with a clean, catchable error instead.
  if (!isTauriEnvironment()) {
    throw new TauriUnavailableError(command as string);
  }
  return tauriInvoke(command as string, (args ?? {}) as Record<string, unknown>);
}
