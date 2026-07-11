import { invokeCommand } from './command';

import type {
  Account,
  Attachment,
  FolderSyncState,
  Label,
  Message,
  Setting,
  Task,
  Thread,
} from '../schema';

export type {
  Account,
  Label,
  Thread,
  Message,
  Attachment,
  FolderSyncState,
  Setting,
  Contact,
  ContactLabel,
  ContactGroup,
  EntityPivot,
  ContactSegment,
  ContactFile,
  FilterRule,
  FilterLog,
  SmartFolder,
  QuickStep,
  QuickReply,
  Template,
  Signature,
  SendAsAlias,
  ScheduledEmail,
  LocalDraft,
  ComposerPreset,
  AiCache,
  AiConfig,
  Campaign,
  CampaignRecipient,
  UtmLink,
  UtmClick,
  BackupSchedule,
  DeliverabilityConfig,
  DeliverabilityEvent,
  NewsletterBundle,
  PairedDevice,
  PgpKey,
  Allowlist,
  LinkScanResult,
  WorkflowRule,
  FollowUpReminder,
  PendingOperation,
  Calendar,
  CalendarEvent,
  SnoozePreset,
  Task,
  ComplianceProfile,
  ComplianceCheck,
  CleanupRule,
  CleanupHistory,
} from '../schema';

export interface SerializedError {
  code: string;
  message: string;
  details?: string;
}

export interface EngagementLog {
  id: string;
  contact_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  event_type: string;
  score_delta: number;
  metadata_json: string;
  created_at: number;
}

export interface TaskTag {
  tag: string;
  company_id: string | null;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface ThreadSender {
  from_name: string | null;
  from_address: string | null;
}

export interface ThreadSenderEnrichment {
  thread_id: string;
  from_name: string | null;
  from_address: string | null;
}

export interface LabelUnreadCount {
  label_id: string;
  count: number;
}

export interface AttachmentWithContext extends Attachment {
  from_address: string | null;
  from_name: string | null;
  date: number | null;
  subject: string | null;
  thread_id: string | null;
}

export interface AttachmentSender {
  from_address: string;
  from_name: string | null;
  count: number;
}

export interface UnifiedSearchResult {
  type: 'message' | 'file' | 'task' | 'contact';
  id: string;
  title: string;
  snippet: string | null;
  date: number;
  rank: number;
  account_id?: string;
  metadata?: Record<string, unknown>;
}

export interface WritingStyleProfile {
  id: string;
  account_id: string;
  profile_text: string;
  sample_count: number;
  created_at: number;
  updated_at: number;
}

export interface ThreadCategoryRow {
  account_id: string;
  thread_id: string;
  category: string;
  is_manual: number;
  is_user_override: number;
}

export interface CreateAccountRequest {
  id?: string | null;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  provider: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  imapSecurity?: string | null;
  imapUsername?: string | null;
  imapPassword?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecurity?: string | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  oauthProvider?: string | null;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
  authMethod?: string | null;
}

export interface UpsertMessageRequest {
  id: string;
  accountId: string;
  threadId: string;
  fromAddress?: string | null;
  fromName?: string | null;
  toAddresses?: string | null;
  ccAddresses?: string | null;
  bccAddresses?: string | null;
  replyTo?: string | null;
  subject?: string | null;
  snippet?: string | null;
  date: number;
  isRead?: boolean | null;
  isStarred?: boolean | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  messageIdHeader?: string | null;
  referencesHeader?: string | null;
  inReplyToHeader?: string | null;
  imapUid?: number | null;
  imapFolder?: string | null;
  listUnsubscribe?: string | null;
  listUnsubscribePost?: string | null;
  authResults?: string | null;
}

export interface UpdateFields {
  set: Record<string, unknown>;
  unset: string[];
}

export interface ThreadFilters {
  labelId?: string | null;
  isRead?: boolean | null;
  isStarred?: boolean | null;
  isImportant?: boolean | null;
  isSnoozed?: boolean | null;
  isPinned?: boolean | null;
  searchQuery?: string | null;
  folder?: string | null;
}

export interface UpsertThreadRequest {
  id: string;
  accountId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: number | null;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
}

export interface ThreadBatchUpdate {
  isRead?: boolean | null;
  isStarred?: boolean | null;
  isImportant?: boolean | null;
  isSnoozed?: boolean | null;
  isPinned?: boolean | null;
  isMuted?: boolean | null;
  addLabelIds?: string[] | null;
  removeLabelIds?: string[] | null;
}

export interface UpsertLabelRequest {
  accountId: string;
  id: string;
  name: string;
  /** Maps to Rust label_type, serialized as `type` */
  type: string;
  colorBg?: string | null;
  colorFg?: string | null;
  visible?: boolean | null;
  sortOrder?: number | null;
  imapFolderPath?: string | null;
  imapSpecialUse?: string | null;
}

export interface UpsertContactRequest {
  id?: string | null;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  frequency?: number | null;
  lastContactedAt?: number | null;
}

export interface CreateGroupRequest {
  companyId: string;
  name: string;
  description?: string | null;
}

export interface CreateLabelRequest {
  companyId: string;
  name: string;
  color?: string | null;
}

export interface CreateSegmentRequest {
  companyId: string;
  name: string;
  query: string;
  isDynamic?: boolean | null;
}

export interface LogEngagementRequest {
  contactId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  eventType: string;
  scoreDelta: number;
  metadataJson?: string | null;
}

export interface ContactStats {
  total_emails: number;
  total_meetings: number;
  total_calls: number;
  last_interaction: number | null;
  engagement_trend: string;
}

export interface UpsertFolderSyncStateRequest {
  accountId: string;
  folderPath: string;
  uidvalidity?: number | null;
  lastUid: number;
  modseq?: number | null;
  lastSyncAt?: number | null;
}

export interface CreateTaskRequest {
  companyId?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  dueDate?: number | null;
  parentId?: string | null;
  contactId?: string | null;
  threadId?: string | null;
  threadAccountId?: string | null;
  recurrenceRule?: string | null;
  tagsJson?: string | null;
  workflowConfigJson?: string | null;
  reminderConfigJson?: string | null;
}

export interface UpdateTaskRequest {
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  isCompleted?: boolean | null;
  dueDate?: number | null;
  parentId?: string | null;
  sortOrder?: number | null;
  recurrenceRule?: string | null;
  tagsJson?: string | null;
  workflowConfigJson?: string | null;
  reminderConfigJson?: string | null;
}

export interface CreateCalendarRequest {
  companyId: string;
  provider: string;
  remoteId: string;
  displayName?: string | null;
  color?: string | null;
  isPrimary?: boolean | null;
  isVisible?: boolean | null;
}

export interface UpdateCalendarRequest {
  displayName?: string | null;
  color?: string | null;
  isPrimary?: boolean | null;
  isVisible?: boolean | null;
  syncToken?: string | null;
  ctag?: string | null;
}

export interface CreateCalendarEventRequest {
  companyId?: string | null;
  calendarId?: string | null;
  googleEventId: string;
  remoteEventId?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  status: string;
  organizerEmail?: string | null;
  attendeesJson?: string | null;
  htmlLink?: string | null;
  etag?: string | null;
  icalData?: string | null;
  uid?: string | null;
}

export interface UpdateCalendarEventRequest {
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  isAllDay?: boolean | null;
  status?: string | null;
  organizerEmail?: string | null;
  attendeesJson?: string | null;
  htmlLink?: string | null;
  etag?: string | null;
  icalData?: string | null;
  uid?: string | null;
}

export interface CreateSnoozePresetRequest {
  companyId: string;
  label: string;
  durationMinutes: number;
  isRecurring?: boolean | null;
  sortOrder?: number | null;
}

export interface CreateScheduledEmailRequest {
  accountId: string;
  toAddresses: string;
  ccAddresses?: string | null;
  bccAddresses?: string | null;
  subject?: string | null;
  bodyHtml: string;
  replyToMessageId?: string | null;
  threadId?: string | null;
  scheduledAt: number;
  signatureId?: string | null;
  attachmentPaths?: string | null;
  status: string;
}

export interface UpsertWritingStyleProfileRequest {
  accountId: string;
  profileText: string;
  sampleCount: number;
}

export interface UpsertThreadCategoryRequest {
  accountId: string;
  threadId: string;
  category: string;
  isManual?: boolean | null;
  isUserOverride?: boolean | null;
}

export interface ContactWithStats {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  frequency: number;
  last_contacted_at: number | null;
  first_contacted_at: number | null;
  notes: string | null;
  engagement_score: number;
  last_engaged_at: number | null;
  health_status: string;
  created_at: number;
  updated_at: number;
  task_count: number;
  email_count: number;
}

export interface ContactAttachment {
  filename: string;
  mime_type: string | null;
  size: number | null;
  date: number;
}

export interface SameDomainContact {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ContactEngagementData {
  lastContactedAt: number | null;
  emailCount: number;
  recentEmailCount: number;
  replyCount: number;
}

export interface DbContactTag {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface DynamicSegmentRow {
  id: string;
  company_id: string;
  name: string;
  query: string;
  refreshed_at: number | null;
}

export interface ContactEmailStats {
  emailCount: number;
  firstEmail: number | null;
  lastEmail: number | null;
}

export interface EngagementTrendPoint {
  date: string;
  score: number;
}

export interface ContactEngagementInput {
  daysSinceLastContact: number;
  contactsLast30d: number;
  repliesSent: number;
  emailsReceived: number;
}

export interface ActivityEvent {
  type: string;
  date: number;
  summary: string;
  id: string;
}

export interface CountRow {
  count: number;
}

export interface ContentRow {
  subject: string | null;
  body_html: string;
}

export interface UpsertTemplateRequest {
  [key: string]: unknown;
  id: string;
  companyId?: string | null;
  name: string;
  subject?: string | null;
  bodyHtml: string;
  shortcut?: string | null;
  sortOrder?: number | null;
  categoryId?: string | null;
  isFavorite?: boolean | null;
  conditionalBlocksJson?: string | null;
  templateType?: string | null;
  origin?: string | null;
  deliveryConfigJson?: string | null;
  aiConfigJson?: string | null;
  voiceConfigJson?: string | null;
  complianceProfileId?: string | null;
}

export interface TemplateUpdateFields {
  set: Record<string, unknown>;
  unset: string[];
}

export interface UpsertTemplateCategoryRequest {
  [key: string]: unknown;
  id: string;
  companyId?: string | null;
  name: string;
  icon?: string | null;
}

export interface InsertTemplateIgnoreRequest {
  [key: string]: unknown;
  id: string;
  companyId?: string | null;
  name: string;
  subject?: string | null;
  bodyHtml: string;
  shortcut?: string | null;
  sortOrder?: number | null;
  categoryId?: string | null;
  isFavorite?: boolean | null;
  templateType?: string | null;
  origin?: string | null;
  deliveryConfigJson?: string | null;
  aiConfigJson?: string | null;
  voiceConfigJson?: string | null;
  complianceProfileId?: string | null;
}

export interface InsertTemplateCategoryIgnoreRequest {
  [key: string]: unknown;
  id: string;
  companyId?: string | null;
  name: string;
  icon?: string | null;
  sortOrder?: number | null;
}

export interface InsertSignatureIgnoreRequest {
  id: string;
  accountId: string;
  name: string;
  bodyHtml: string;
  isDefault?: boolean | null;
  sortOrder?: number | null;
}

export interface UpsertSignatureRequest {
  [key: string]: unknown;
  id: string;
  accountId: string;
  name: string;
  bodyHtml: string;
  isDefault?: boolean | null;
}

export interface UpsertLocalDraftRequest {
  id: string;
  accountId: string;
  toAddresses?: string | null;
  ccAddresses?: string | null;
  bccAddresses?: string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  replyToMessageId?: string | null;
  threadId?: string | null;
  fromEmail?: string | null;
  signatureId?: string | null;
  remoteDraftId?: string | null;
  attachments?: string | null;
}

export interface UpsertSmartFolderRequest {
  accountId?: string | null;
  name: string;
  query: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpsertQuickStepRequest {
  [key: string]: unknown;
  id: string;
  accountId: string;
  name: string;
  description?: string | null;
  shortcut?: string | null;
  actionsJson: string;
  icon?: string | null;
  isEnabled?: boolean | null;
  continueOnError?: boolean | null;
  sortOrder?: number | null;
}

export interface UpsertQuickReplyRequest {
  [key: string]: unknown;
  id: string;
  accountId: string;
  title: string;
  bodyHtml: string;
  shortcut?: string | null;
  sortOrder?: number | null;
}

export interface InsertQuickReplyIgnoreRequest {
  id: string;
  accountId: string;
  title: string;
  bodyHtml: string;
  shortcut?: string | null;
  sortOrder?: number | null;
}

export interface UpsertSendAsAliasRequest {
  accountId: string;
  email: string;
  displayName?: string | null;
  replyToAddress?: string | null;
  signatureId?: string | null;
  isPrimary?: boolean | null;
  isDefault?: boolean | null;
  treatAsAlias?: boolean | null;
  verificationStatus?: string | null;
}

export interface UpsertAiCacheRequest {
  accountId: string;
  threadId: string;
  type: string;
  content: string;
}

export interface TaskWithContact extends Task {
  contact_name: string | null;
  contact_avatar: string | null;
  contact_email: string | null;
}

export interface ContactTaskCount {
  contact_id: string;
  cnt: number;
}

export interface DashboardTimeSeries {
  date: string;
  score: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface GraphNode {
  id: string;
  entity_type: string;
  label: string;
  group: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface UpsertComplianceProfileRequest {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  regionHint?: string | null;
  rulesJson: string;
  isActive?: boolean | null;
  isDefault?: boolean | null;
}

export interface InsertComplianceProfileIgnoreRequest {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  regionHint?: string | null;
  rulesJson: string;
}

export interface ArfReportRow {
  id: string;
  account_id: string;
  original_recipient: string | null;
  reported_domain: string | null;
  feedback_type: string | null;
  user_agent: string | null;
  source_ip: string | null;
  arrival_date: number | null;
  report_raw: string | null;
  processed: number;
  created_at: number;
}

export interface CreateArfReportRequest {
  accountId: string;
  feedbackType: string;
  userAgent: string;
  originalRecipient: string;
  originalMailFrom?: string | null;
  arrivalDate?: string | null;
  sourceIP?: string | null;
  reportedDomain?: string | null;
  reportRaw: string;
}

export interface BlacklistCheckRow {
  id: string;
  account_id: string;
  check_type: string;
  target: string;
  listed: number;
  list_name: string | null;
  responded: number;
  checked_at: number;
}

export interface UpsertBlacklistCacheRequest {
  id?: string;
  accountId: string;
  checkType: string;
  target: string;
  listed: boolean;
  listName: string | null;
  responded: boolean;
}

export interface BlacklistMonitor {
  id: string;
  account_id: string;
  target: string;
  check_type: string;
  interval_minutes: number;
  alerts_json: string;
  enabled: number;
  created_at: number;
  updated_at: number;
  last_check_at: number | null;
}

export interface CreateBlacklistMonitorRequest {
  accountId: string;
  target: string;
  checkType: string;
  intervalMinutes: number;
  alertsJson: string;
}

export interface UpdateBlacklistMonitorRequest {
  id: string;
  intervalMinutes?: number;
  alertsJson?: string;
  enabled?: boolean;
}

export interface DelistRequest {
  id: string;
  account_id: string;
  list_name: string;
  target: string;
  target_type: string;
  reason: string | null;
  status: string;
  delist_url: string | null;
  submitted_at: number | null;
  resolved_at: number | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateDelistRequestRequest {
  accountId: string;
  listName: string;
  target: string;
  targetType: string;
  reason?: string;
}

export interface BulkCheckJob {
  id: string;
  account_id: string;
  status: string;
  total_targets: number;
  processed_targets: number;
  results_json: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface ReputationScore {
  id: string;
  account_id: string;
  overall_score: number;
  blacklist_factor: number;
  bounce_factor: number;
  complaint_factor: number;
  warmup_factor: number;
  calculated_at: number;
}

export interface UpsertReputationScoreRequest {
  accountId: string;
  overallScore: number;
  blacklistFactor: number;
  bounceFactor: number;
  complaintFactor: number;
  warmupFactor: number;
}

export interface AlertPreferences {
  id: string;
  account_id: string;
  blacklist_enabled: number;
  channels_json: string;
  threshold: string;
  created_at: number;
  updated_at: number;
}

export interface UpsertAlertPreferencesRequest {
  accountId: string;
  blacklistEnabled: boolean;
  channelsJson: string;
  threshold: string;
}

export interface DbBundleRule {
  id: string;
  account_id: string;
  category: string;
  is_bundled: number;
  delivery_enabled: number;
  delivery_schedule: string | null;
  last_delivered_at: number | null;
  created_at: number;
}

export interface UpsertBundleRuleRequest {
  id?: string;
  accountId: string;
  category: string;
  isBundled: boolean;
  deliveryEnabled: boolean;
  deliverySchedule?: string | null;
}

export interface ImageAllowlistEntry {
  id: string;
  account_id: string;
  sender_address: string;
  created_at: number;
}

export interface UpsertImageAllowlistRequest {
  id?: string;
  accountId: string;
  senderAddress: string;
}

export interface PhishingAllowlistEntry {
  id: string;
  account_id: string;
  sender_address: string;
  created_at: number;
}

export interface UpsertPhishingAllowlistRequest {
  id?: string;
  accountId: string;
  senderAddress: string;
}

export interface EmailWarmingRow {
  id: string;
  account_id: string;
  enabled: number;
  start_volume: number;
  current_volume: number;
  target_volume: number;
  ramp_days: number;
  created_at: number;
  updated_at: number;
}

export interface WarmingLogRow {
  id: string;
  account_id: string;
  sent_date: string;
  volume: number;
  created_at: number;
}

export interface UpsertWarmingRequest {
  accountId: string;
  enabled?: number;
  startVolume?: number;
  currentVolume?: number;
  targetVolume?: number;
  rampDays?: number;
}

export interface NotificationVipRow {
  id: string;
  account_id: string;
  email_address: string;
  display_name: string | null;
  created_at: number;
}

export interface UpsertNotificationVipRequest {
  id?: string;
  accountId: string;
  emailAddress: string;
  displayName?: string | null;
}

export interface UpsertFollowUpReminderRequest {
  id?: string;
  companyId: string;
  threadId: string;
  messageId: string;
  remindAt: number;
}

export interface UpsertWorkflowRuleRequest {
  id?: string;
  companyId: string;
  name: string;
  triggerEvent: string;
  triggerConditions?: string | null;
  actions: string;
}

export interface UpsertPendingOperationRequest {
  companyId: string;
  operationType: string;
  resourceId: string;
  params: Record<string, unknown>;
  campaignId?: string | null;
  holdUntil?: number | null;
}

export async function getAccount(accountId: string): Promise<Account> {
  return invokeCommand<Account>('db_get_account', { accountId });
}

export async function listAccounts(): Promise<Account[]> {
  return invokeCommand<Account[]>('db_list_accounts');
}

export async function createAccount(account: CreateAccountRequest): Promise<Account> {
  return invokeCommand<Account>('db_create_account', { account });
}

export async function updateAccount(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_account', { id, fields });
}

export async function deleteAccount(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_account', { id });
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  return invokeCommand<Account | null>('db_get_account_by_email', { email });
}

export async function updateAccountLastSync(id: string, historyId: string): Promise<void> {
  return invokeCommand<void>('db_update_account_last_sync', { id, historyId });
}

export async function getMessagesForThread(
  accountId: string,
  threadId: string,
): Promise<Message[]> {
  return invokeCommand<Message[]>('db_get_messages_for_thread', { accountId, threadId });
}

export async function upsertMessage(msg: UpsertMessageRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_message', { msg });
}

export async function deleteMessage(accountId: string, messageId: string): Promise<void> {
  return invokeCommand<void>('db_delete_message', { accountId, messageId });
}

export async function searchMessages(
  accountId: string,
  query: string,
  limit: number,
): Promise<Message[]> {
  return invokeCommand<Message[]>('db_search_messages', { accountId, query, limit });
}

export async function updateMessageFlags(
  messageId: string,
  isRead?: boolean | null,
  isStarred?: boolean | null,
): Promise<void> {
  return invokeCommand<void>('db_update_message_flags', {
    messageId,
    isRead: isRead ?? null,
    isStarred: isStarred ?? null,
  });
}

export async function bulkUpdateMessageThread(
  accountId: string,
  messageIds: string[],
  threadId: string,
): Promise<void> {
  return invokeCommand<void>('db_bulk_update_message_thread', { accountId, messageIds, threadId });
}

export async function bulkUpdateMessageImapFolder(
  accountId: string,
  messageIds: string[],
  newFolder: string,
): Promise<void> {
  return invokeCommand<void>('db_bulk_update_message_imap_folder', {
    accountId,
    messageIds,
    newFolder,
  });
}

export async function deleteAllMessagesForAccount(accountId: string): Promise<number> {
  return invokeCommand<number>('db_delete_account_messages', { accountId });
}

export async function getRecentSentMessages(
  accountId: string,
  fromAddress: string,
  limit: number,
): Promise<Message[]> {
  return invokeCommand<Message[]>('db_get_recent_sent_messages', { accountId, fromAddress, limit });
}

export async function getThreads(
  accountId: string,
  limit: number,
  offset: number,
  filters?: ThreadFilters | null,
): Promise<Thread[]> {
  return invokeCommand<Thread[]>('db_get_threads', {
    accountId,
    limit,
    offset,
    filters: filters ?? null,
  });
}

export async function getThread(accountId: string, threadId: string): Promise<Thread> {
  return invokeCommand<Thread>('db_get_thread', { accountId, threadId });
}

export async function updateThreadMetadata(
  threadId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  return invokeCommand<void>('db_update_thread_metadata', { threadId, metadata });
}

export async function batchUpdateThreads(ids: string[], changes: ThreadBatchUpdate): Promise<void> {
  return invokeCommand<void>('db_batch_update_threads', { ids, changes });
}

export async function upsertThread(thread: UpsertThreadRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_thread', { thread });
}

export async function deleteThread(accountId: string, threadId: string): Promise<void> {
  return invokeCommand<void>('db_delete_thread', { accountId, threadId });
}

export async function deleteAllThreadsForAccount(accountId: string): Promise<number> {
  return invokeCommand<number>('db_delete_account_threads', { accountId });
}

export async function getAllThreads(accountId: string): Promise<Thread[]> {
  return invokeCommand<Thread[]>('db_get_all_threads', { accountId });
}

export async function getThreadLastSender(
  accountId: string,
  threadId: string,
): Promise<ThreadSender | null> {
  return invokeCommand<ThreadSender | null>('db_get_thread_last_sender', { accountId, threadId });
}

export async function getThreadCount(accountId: string): Promise<number> {
  return invokeCommand<number>('db_get_thread_count', { accountId });
}

export async function getLabelUnreadCount(accountId: string, labelId: string): Promise<number> {
  return invokeCommand<number>('db_get_label_unread_count', { accountId, labelId });
}

export async function getAllLabelUnreadCounts(accountId: string): Promise<LabelUnreadCount[]> {
  return invokeCommand<LabelUnreadCount[]>('db_get_all_label_unread_counts', { accountId });
}

export async function getUnreadInboxCount(): Promise<number> {
  return invokeCommand<number>('db_get_unread_inbox_count');
}

export async function getMutedThreadIds(accountId: string): Promise<string[]> {
  return invokeCommand<string[]>('db_get_muted_thread_ids', { accountId });
}

export async function enrichThreadsWithSender(
  accountId: string,
  threadIds: string[],
): Promise<ThreadSenderEnrichment[]> {
  return invokeCommand<ThreadSenderEnrichment[]>('db_enrich_threads_with_sender', {
    accountId,
    threadIds,
  });
}

export async function getThreadsForCategory(
  accountId: string,
  category: string,
  limit: number,
  offset: number,
): Promise<ThreadSenderEnrichment[]> {
  return invokeCommand<ThreadSenderEnrichment[]>('db_get_threads_for_category', {
    accountId,
    category,
    limit,
    offset,
  });
}

export async function setThreadLabels(
  accountId: string,
  threadId: string,
  labelIds: string[],
): Promise<void> {
  return invokeCommand<void>('db_set_thread_labels', { accountId, threadId, labelIds });
}

export async function getThreadLabelIds(accountId: string, threadId: string): Promise<string[]> {
  return invokeCommand<string[]>('db_get_thread_label_ids', { accountId, threadId });
}

export async function updateThreadFlags(
  accountId: string,
  threadId: string,
  isRead?: boolean | null,
  isStarred?: boolean | null,
): Promise<void> {
  return invokeCommand<void>('db_update_thread_flags', {
    accountId,
    threadId,
    isRead: isRead ?? null,
    isStarred: isStarred ?? null,
  });
}

export async function snoozeThread(
  accountId: string,
  threadId: string,
  until: number,
): Promise<void> {
  return invokeCommand<void>('db_snooze_thread', { accountId, threadId, until });
}

export async function unsnoozeThread(accountId: string, threadId: string): Promise<void> {
  return invokeCommand<void>('db_unsnooze_thread', { accountId, threadId });
}

export async function addThreadLabel(
  accountId: string,
  threadId: string,
  labelId: string,
): Promise<void> {
  return invokeCommand<void>('db_add_thread_label', { accountId, threadId, labelId });
}

export async function removeThreadLabel(
  accountId: string,
  threadId: string,
  labelId: string,
): Promise<void> {
  return invokeCommand<void>('db_remove_thread_label', { accountId, threadId, labelId });
}

export async function getLabelsForAccount(accountId: string): Promise<Label[]> {
  return invokeCommand<Label[]>('db_get_labels_for_account', { accountId });
}

export async function upsertLabel(label: UpsertLabelRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_label', { label });
}

export async function deleteLabel(accountId: string, labelId: string): Promise<void> {
  return invokeCommand<void>('db_delete_label', { accountId, labelId });
}

export async function deleteLabelsForAccount(accountId: string): Promise<void> {
  return invokeCommand<void>('db_delete_labels_for_account', { accountId });
}

export async function updateLabelSortOrder(
  accountId: string,
  labelOrders: { id: string; sortOrder: number }[],
): Promise<void> {
  return invokeCommand<void>('db_update_label_sort_order', { accountId, labelOrders });
}

export async function getAttachmentsForMessage(messageId: string): Promise<Attachment[]> {
  return invokeCommand<Attachment[]>('db_get_attachments_for_message', { messageId });
}

export async function saveAttachmentLocally(
  messageId: string,
  attachmentId: string,
): Promise<string> {
  return invokeCommand<string>('db_save_attachment_locally', { messageId, attachmentId });
}

export async function upsertAttachment(att: Attachment): Promise<void> {
  return invokeCommand<void>('db_upsert_attachment', { attachment: att });
}

export async function getAttachmentsForAccount(
  accountId: string,
  limit: number,
  offset: number,
): Promise<AttachmentWithContext[]> {
  return invokeCommand<AttachmentWithContext[]>('db_get_attachments_for_account', {
    accountId,
    limit,
    offset,
  });
}

export async function getAttachmentSenders(accountId: string): Promise<AttachmentSender[]> {
  return invokeCommand<AttachmentSender[]>('db_get_attachment_senders', { accountId });
}

export async function cacheAttachment(
  id: string,
  localPath: string,
  cacheSize: number,
): Promise<void> {
  return invokeCommand<void>('db_cache_attachment', { id, localPath, cacheSize });
}

export async function clearAttachmentCache(): Promise<void> {
  return invokeCommand<void>('db_clear_attachment_cache');
}

export async function evictSingleAttachmentCache(id: string): Promise<void> {
  return invokeCommand<void>('db_evict_single_attachment_cache', { id });
}

export async function getFolderSyncState(
  accountId: string,
  folderPath: string,
): Promise<FolderSyncState | null> {
  return invokeCommand<FolderSyncState | null>('db_get_folder_sync_state', {
    accountId,
    folderPath,
  });
}

export async function upsertFolderSyncState(state: UpsertFolderSyncStateRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_folder_sync_state', { state });
}

export async function deleteFolderSyncState(accountId: string, folderPath: string): Promise<void> {
  return invokeCommand<void>('db_delete_folder_sync_state', { accountId, folderPath });
}

export async function clearFolderSyncStates(accountId: string): Promise<void> {
  return invokeCommand<void>('db_clear_folder_sync_states', { accountId });
}

export async function listFolderSyncStates(accountId: string): Promise<FolderSyncState[]> {
  return invokeCommand<FolderSyncState[]>('db_list_folder_sync_states', { accountId });
}

export async function getSetting(key: string): Promise<string | null> {
  return invokeCommand<string | null>('db_get_setting', { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invokeCommand<void>('db_set_setting', { key, value });
}

export async function dashboardContactsTotal(): Promise<number> {
  return invokeCommand<number>('db_dashboard_contacts_total');
}

export async function dashboardContactsActive(): Promise<number> {
  return invokeCommand<number>('db_dashboard_contacts_active');
}

export async function dashboardContactsNewWeek(): Promise<number> {
  return invokeCommand<number>('db_dashboard_contacts_new_week');
}

export async function dashboardRecentActivity(): Promise<EngagementLog[]> {
  return invokeCommand<EngagementLog[]>('db_dashboard_recent_activity');
}

export async function dashboardCampaignsTotal(): Promise<number> {
  return invokeCommand<number>('db_dashboard_campaigns_total');
}

export async function dashboardCampaignsSent(): Promise<number> {
  return invokeCommand<number>('db_dashboard_campaigns_sent');
}

export async function dashboardCampaignsOpenRate(): Promise<number> {
  return invokeCommand<number>('db_dashboard_campaigns_open_rate');
}

export async function dashboardCampaignsClickRate(): Promise<number> {
  return invokeCommand<number>('db_dashboard_campaigns_click_rate');
}

export async function dashboardTasksDueToday(): Promise<number> {
  return invokeCommand<number>('db_dashboard_tasks_due_today');
}

export async function dashboardTasksIncomplete(): Promise<number> {
  return invokeCommand<number>('db_dashboard_tasks_incomplete');
}

export async function dashboardTasksOverdue(): Promise<number> {
  return invokeCommand<number>('db_dashboard_tasks_overdue');
}

export async function dashboardWorkflowRulesTotal(): Promise<number> {
  return invokeCommand<number>('db_dashboard_workflow_rules_total');
}

export async function dashboardWorkflowRulesActive(): Promise<number> {
  return invokeCommand<number>('db_dashboard_workflow_rules_active');
}

export async function dashboardEmailVolume(): Promise<DashboardTimeSeries[]> {
  return invokeCommand<DashboardTimeSeries[]>('db_dashboard_email_volume');
}

export async function dashboardEmailHeatmap(days?: number): Promise<DailyCount[]> {
  return invokeCommand<DailyCount[]>('db_dashboard_email_heatmap', {
    days: days ?? 365,
  });
}

export async function dashboardContactGrowth(): Promise<DashboardTimeSeries[]> {
  return invokeCommand<DashboardTimeSeries[]>('db_dashboard_contact_growth');
}

export async function getEntityGraph(depth?: number): Promise<GraphData> {
  return invokeCommand<GraphData>('db_get_entity_graph', {
    depth: depth ?? 2,
  });
}

export async function executeSearchQuery(
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  return invokeCommand<Record<string, unknown>[]>('db_execute_search_query', { sql, params });
}

export async function unifiedSearch(
  query: string,
  accountId?: string,
  limit?: number,
): Promise<UnifiedSearchResult[]> {
  return invokeCommand<UnifiedSearchResult[]>('db_unified_search', {
    query,
    accountId: accountId ?? null,
    limit: limit ?? 50,
  });
}

export async function listArfReports(accountId: string): Promise<ArfReportRow[]> {
  return invokeCommand<ArfReportRow[]>('db_list_arf_reports', { accountId });
}

export async function createArfReport(report: CreateArfReportRequest): Promise<void> {
  return invokeCommand<void>('db_create_arf_report', { report });
}

export async function updateArfReportProcessed(id: string): Promise<void> {
  return invokeCommand<void>('db_update_arf_report_processed', { id });
}

export async function listBlacklistCache(accountId: string): Promise<BlacklistCheckRow[]> {
  return invokeCommand<BlacklistCheckRow[]>('db_list_blacklist_cache', { accountId });
}

export async function upsertBlacklistCache(entry: UpsertBlacklistCacheRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_blacklist_cache', { entry });
}

export async function deleteBlacklistCache(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_blacklist_cache', { id });
}

export async function listBlacklistMonitors(accountId: string): Promise<BlacklistMonitor[]> {
  return invokeCommand<BlacklistMonitor[]>('db_list_blacklist_monitors', { accountId });
}

export async function getBlacklistMonitor(id: string): Promise<BlacklistMonitor | null> {
  return invokeCommand<BlacklistMonitor | null>('db_get_blacklist_monitor', { id });
}

export async function createBlacklistMonitor(
  request: CreateBlacklistMonitorRequest,
): Promise<BlacklistMonitor> {
  return invokeCommand<BlacklistMonitor>('db_create_blacklist_monitor', { request });
}

export async function updateBlacklistMonitor(
  request: UpdateBlacklistMonitorRequest,
): Promise<void> {
  return invokeCommand<void>('db_update_blacklist_monitor', { request });
}

export async function deleteBlacklistMonitor(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_blacklist_monitor', { id });
}

export async function listDelistRequests(accountId: string): Promise<DelistRequest[]> {
  return invokeCommand<DelistRequest[]>('db_list_delist_requests', { accountId });
}

export async function getDelistRequest(id: string): Promise<DelistRequest | null> {
  return invokeCommand<DelistRequest | null>('db_get_delist_request', { id });
}

export async function createDelistRequest(
  request: CreateDelistRequestRequest,
): Promise<DelistRequest> {
  return invokeCommand<DelistRequest>('db_create_delist_request', { request });
}

export async function updateDelistRequestStatus(
  id: string,
  status: string,
  delistUrl?: string,
  notes?: string,
): Promise<void> {
  return invokeCommand<void>('db_update_delist_request_status', { id, status, delistUrl, notes });
}

export async function deleteDelistRequest(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_delist_request', { id });
}

export async function getBulkCheckJob(id: string): Promise<BulkCheckJob | null> {
  return invokeCommand<BulkCheckJob | null>('db_get_bulk_check_job', { id });
}

export async function listBulkCheckJobs(
  accountId: string,
  limit: number = 10,
): Promise<BulkCheckJob[]> {
  return invokeCommand<BulkCheckJob[]>('db_list_bulk_check_jobs', { accountId, limit });
}

export async function createBulkCheckJob(
  accountId: string,
  totalTargets: number,
): Promise<BulkCheckJob> {
  return invokeCommand<BulkCheckJob>('db_create_bulk_check_job', { accountId, totalTargets });
}

export async function updateBulkCheckJobProgress(
  id: string,
  processedTargets: number,
  resultsJson: string,
): Promise<void> {
  return invokeCommand<void>('db_update_bulk_check_job_progress', {
    id,
    processedTargets,
    resultsJson,
  });
}

export async function completeBulkCheckJob(id: string, resultsJson: string): Promise<void> {
  return invokeCommand<void>('db_complete_bulk_check_job', { id, resultsJson });
}

export async function failBulkCheckJob(id: string): Promise<void> {
  return invokeCommand<void>('db_fail_bulk_check_job', { id });
}

export async function getReputationScore(accountId: string): Promise<ReputationScore | null> {
  return invokeCommand<ReputationScore | null>('db_get_reputation_score', { accountId });
}

export async function upsertReputationScore(
  request: UpsertReputationScoreRequest,
): Promise<ReputationScore> {
  return invokeCommand<ReputationScore>('db_upsert_reputation_score', { request });
}

export async function getAlertPreferences(accountId: string): Promise<AlertPreferences | null> {
  return invokeCommand<AlertPreferences | null>('db_get_alert_preferences', { accountId });
}

export async function upsertAlertPreferences(
  request: UpsertAlertPreferencesRequest,
): Promise<AlertPreferences> {
  return invokeCommand<AlertPreferences>('db_upsert_alert_preferences', { request });
}

export async function listBundleRules(accountId: string): Promise<DbBundleRule[]> {
  return invokeCommand<DbBundleRule[]>('db_list_bundle_rules', { accountId });
}

export async function upsertBundleRule(rule: UpsertBundleRuleRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_bundle_rule', { rule });
}

export async function deleteBundleRule(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_bundle_rule', { id });
}

export async function listImageAllowlist(accountId: string): Promise<ImageAllowlistEntry[]> {
  return invokeCommand<ImageAllowlistEntry[]>('db_list_image_allowlist', { accountId });
}

export async function upsertImageAllowlist(entry: UpsertImageAllowlistRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_image_allowlist', { entry });
}

export async function deleteImageAllowlist(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_image_allowlist', { id });
}

export async function listPhishingAllowlist(accountId: string): Promise<PhishingAllowlistEntry[]> {
  return invokeCommand<PhishingAllowlistEntry[]>('db_list_phishing_allowlist', { accountId });
}

export async function upsertPhishingAllowlist(
  entry: UpsertPhishingAllowlistRequest,
): Promise<void> {
  return invokeCommand<void>('db_upsert_phishing_allowlist', { entry });
}

export async function deletePhishingAllowlist(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_phishing_allowlist', { id });
}

export async function listWarming(accountId: string): Promise<EmailWarmingRow[]> {
  return invokeCommand<EmailWarmingRow[]>('db_list_warming', { accountId });
}

export async function upsertWarming(entry: UpsertWarmingRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_warming', { entry });
}

export async function updateWarming(id: string, fields: UpdateFields): Promise<void> {
  return invokeCommand<void>('db_update_warming', { id, fields });
}

export async function deleteWarming(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_warming', { id });
}

export async function listNotificationVips(accountId: string): Promise<NotificationVipRow[]> {
  return invokeCommand<NotificationVipRow[]>('db_list_notification_vips', { accountId });
}

export async function upsertNotificationVip(vip: UpsertNotificationVipRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_notification_vip', { vip });
}

export async function deleteNotificationVip(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_notification_vip', { id });
}

export async function upsertFollowUpReminder(
  reminder: UpsertFollowUpReminderRequest,
): Promise<string> {
  return invokeCommand<string>('db_upsert_follow_up_reminder', { reminder });
}

export async function deleteFollowUpReminder(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_follow_up_reminder', { id });
}

export async function deleteSetting(key: string): Promise<void> {
  return invokeCommand<void>('db_delete_setting', { key });
}

export async function listSettings(): Promise<Setting[]> {
  return invokeCommand<Setting[]>('db_list_settings', {});
}

export async function upsertWorkflowRule(rule: UpsertWorkflowRuleRequest): Promise<string> {
  return invokeCommand<string>('db_upsert_workflow_rule', { rule });
}

export async function deleteWorkflowRule(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_workflow_rule', { id });
}

export async function updateWorkflowRuleActive(id: string, isActive: boolean): Promise<void> {
  return invokeCommand<void>('db_update_workflow_rule_active', { id, isActive });
}

export async function upsertPendingOperation(op: UpsertPendingOperationRequest): Promise<string> {
  const id = crypto.randomUUID();
  return invokeCommand<string>('db_upsert_pending_operation', {
    id,
    companyId: op.companyId,
    operationType: op.operationType,
    resourceId: op.resourceId,
    params: JSON.stringify(op.params),
    status: undefined as string | undefined,
    maxRetries: undefined as number | undefined,
    campaignId: op.campaignId ?? null,
  });
}

export async function deletePendingOperation(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_pending_operation', { id });
}

export async function insertAnalyticsSnapshot(
  id: string,
  campaignId: string,
  snapshotData: string,
): Promise<void> {
  return invokeCommand<void>('db_insert_analytics_snapshot', { id, campaignId, snapshotData });
}

export async function updateCampaignABTestConfig(
  campaignId: string,
  config: string,
): Promise<void> {
  return invokeCommand<void>('db_update_campaign_ab_test_config', { campaignId, config });
}

export async function setRecipientVariant(
  campaignId: string,
  contactId: string,
  variant: string,
  isWinner?: boolean,
): Promise<void> {
  return invokeCommand<void>('db_set_recipient_variant', {
    campaignId,
    contactId,
    variant,
    isWinner,
  });
}

export async function insertWarmingLog(
  id: string,
  accountId: string,
  sentDate: string,
  volume: number,
): Promise<void> {
  return invokeCommand<void>('db_insert_warming_log', { id, accountId, sentDate, volume });
}

export async function removePhishingAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  return invokeCommand<void>('db_remove_phishing_allowlist', { accountId, senderAddress });
}

export async function removeImageAllowlist(
  accountId: string,
  senderAddress: string,
): Promise<void> {
  return invokeCommand<void>('db_remove_image_allowlist', { accountId, senderAddress });
}

export async function holdBundledThread(
  accountId: string,
  threadId: string,
  category: string,
  heldUntil: number | null,
): Promise<void> {
  return invokeCommand<void>('db_hold_bundled_thread', {
    accountId,
    threadId,
    category,
    heldUntil,
  });
}

export async function releaseHeldThreads(accountId: string, category: string): Promise<number> {
  return invokeCommand<number>('db_release_held_threads', { accountId, category });
}

export async function updateBundleRuleDelivered(
  accountId: string,
  category: string,
  now: number,
): Promise<void> {
  return invokeCommand<void>('db_update_bundle_rule_delivered', { accountId, category, now });
}

export async function insertBounce(bounce: {
  id: string;
  campaignId: string | null;
  contactId: string | null;
  recipientEmail: string;
  bounceType: string;
  diagnosticCode: string | null;
  reason: string | null;
}): Promise<void> {
  return invokeCommand<void>('db_insert_bounce', { bounce });
}

export async function insertSuppression(
  id: string,
  accountId: string,
  email: string,
  reason: string,
): Promise<void> {
  return invokeCommand<void>('db_insert_suppression', { id, accountId, email, reason });
}

export async function removeSuppression(accountId: string, email: string): Promise<void> {
  return invokeCommand<void>('db_remove_suppression', { accountId, email });
}

export async function updateOperationStatus(
  id: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  return invokeCommand<void>('db_update_operation_status', {
    id,
    status,
    errorMessage: errorMessage ?? null,
  });
}

export async function incrementRetry(
  id: string,
  newCount: number,
  isFailed: boolean,
  nextRetryAt?: number,
): Promise<void> {
  return invokeCommand<void>('db_increment_retry', {
    id,
    newCount,
    isFailed,
    nextRetryAt: nextRetryAt ?? null,
  });
}

export async function deletePendingOpsByIds(ids: string[]): Promise<void> {
  return invokeCommand<void>('db_delete_pending_ops_by_ids', { ids });
}

export async function clearFailedOperations(companyId?: string): Promise<void> {
  return invokeCommand<void>('db_clear_failed_operations', { companyId: companyId ?? null });
}

export async function retryFailedOperations(companyId?: string): Promise<void> {
  return invokeCommand<void>('db_retry_failed_operations', { companyId: companyId ?? null });
}

export async function removeNotificationVip(
  accountId: string,
  emailAddress: string,
): Promise<void> {
  return invokeCommand<void>('db_remove_notification_vip', { accountId, emailAddress });
}

export async function updateFollowUpStatus(id: string, status: string): Promise<void> {
  return invokeCommand<void>('db_update_follow_up_status', { id, status });
}

export async function cancelFollowUpForThread(companyId: string, threadId: string): Promise<void> {
  return invokeCommand<void>('db_cancel_follow_up_for_thread', { companyId, threadId });
}

export async function cacheAttachmentDb(
  id: string,
  localPath: string,
  cacheSize: number,
): Promise<void> {
  return invokeCommand<void>('db_cache_attachment', { id, localPath, cacheSize });
}

export async function executeInsert(table: string, record: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_execute_insert', { table, record });
}


