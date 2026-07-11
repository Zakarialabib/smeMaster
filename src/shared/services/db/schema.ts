// ─── Core ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  industry: string | null;
  timezone: string;
  logo_url: string | null;
  settings_json: string;
  // Morocco legal identifiers
  ice: string | null;
  tax_id: string | null;
  rc: string | null;
  cnss: string | null;
  created_at: number;
  updated_at: number;
}

export interface Account {
  id: string;
  company_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  history_id: string | null;
  last_sync_at: number | null;
  is_active: number;
  provider: string;
  provider_type: string | null;
  sync_state: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_security: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  auth_method: string;
  imap_password: string | null;
  imap_username: string | null;
  oauth_provider: string | null;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  smtp_username: string | null;
  smtp_password: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface Label {
  account_id: string;
  id: string;
  name: string;
  type: string;
  color_bg: string | null;
  color_fg: string | null;
  visible: number;
  sort_order: number;
  imap_folder_path: string | null;
  imap_special_use: string | null;
}

export interface Thread {
  account_id: string;
  id: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: number | null;
  message_count: number;
  is_read: number;
  is_starred: number;
  is_important: number;
  has_attachments: number;
  is_snoozed: number;
  snooze_until: number | null;
  is_pinned: number;
  is_muted: number;
  metadata_json: string;
}

export interface ThreadCategory {
  account_id: string;
  thread_id: string;
  category: string;
  is_manual: number;
  is_user_override: number;
  applied_at: number;
}

export interface Message {
  account_id: string;
  id: string;
  thread_id: string;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  reply_to: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  is_read: number;
  is_starred: number;
  body_html: string | null;
  body_text: string | null;
  body_cached: number;
  raw_size: number | null;
  internal_date: number | null;
  list_unsubscribe: string | null;
  list_unsubscribe_post: string | null;
  auth_results: string | null;
  message_id_header: string | null;
  references_header: string | null;
  in_reply_to_header: string | null;
  imap_uid: number | null;
  imap_folder: string | null;
}

export interface Attachment {
  id: string;
  message_id: string;
  account_id: string;
  filename: string | null;
  mime_type: string | null;
  size: number | null;
  gmail_attachment_id: string | null;
  content_id: string | null;
  is_inline: number;
  local_path: string | null;
  cached_at: number | null;
  cache_size: number | null;
  imap_part_id: string | null;
}

export interface FolderSyncState {
  account_id: string;
  folder_path: string;
  uidvalidity: number | null;
  last_uid: number;
  modseq: number | null;
  last_sync_at: number | null;
}

export interface Setting {
  key: string;
  value: string;
}

// ─── CRM ───────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  company_id: string;
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
}

export interface ContactLabel {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface ContactGroup {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface EntityPivot {
  id: string;
  entity_type: string;
  entity_id: string;
  pivot_type: string;
  pivot_id: string;
  created_at: number;
}

export interface ContactSegment {
  id: string;
  company_id: string;
  name: string;
  query: string;
  is_dynamic: number;
  created_at: number;
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

// ─── Comms ─────────────────────────────────────────────────────────────────

export interface FilterRule {
  id: string;
  account_id: string;
  name: string;
  is_enabled: number;
  criteria_json: string;
  actions_json: string;
  group_operator: string;
  score_threshold: number | null;
  chaining_action: string | null;
  sort_order: number;
  created_at: number;
}

export interface FilterLog {
  id: string;
  rule_id: string;
  message_id: string;
  matched: number;
  score: number;
  applied_actions: string | null;
  created_at: number;
}

export interface SmartFolder {
  id: string;
  account_id: string | null;
  name: string;
  query: string;
  icon: string;
  color: string | null;
  sort_order: number;
  is_default: number;
  created_at: number;
}

export interface QuickStep {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  shortcut: string | null;
  actions_json: string;
  icon: string | null;
  is_enabled: number;
  continue_on_error: number;
  sort_order: number;
  created_at: number;
}

export interface QuickReply {
  id: string;
  account_id: string;
  title: string;
  body_html: string;
  shortcut: string | null;
  sort_order: number;
  usage_count: number;
  created_at: number;
}

export interface Template {
  id: string;
  company_id: string;
  name: string;
  subject: string | null;
  body_html: string;
  shortcut: string | null;
  sort_order: number;
  category_id: string | null;
  is_favorite: number;
  usage_count: number;
  last_used_at: number | null;
  conditional_blocks_json: string | null;
  template_type: string;
  origin: string;
  delivery_config_json: string | null;
  ai_config_json: string | null;
  voice_config_json: string | null;
  compliance_profile_id: string | null;
  created_at: number;
}

export interface Signature {
  id: string;
  account_id: string;
  name: string;
  body_html: string;
  is_default: number;
  sort_order: number;
  created_at: number;
}

export interface SendAsAlias {
  id: string;
  account_id: string;
  email: string;
  display_name: string | null;
  reply_to_address: string | null;
  signature_id: string | null;
  is_primary: number;
  is_default: number;
  treat_as_alias: number;
  verification_status: string;
  created_at: number;
}

export interface ScheduledEmail {
  id: string;
  account_id: string;
  to_addresses: string;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_html: string;
  reply_to_message_id: string | null;
  thread_id: string | null;
  scheduled_at: number;
  signature_id: string | null;
  attachment_paths: string | null;
  status: string;
  created_at: number;
}

export interface LocalDraft {
  id: string;
  account_id: string;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_html: string | null;
  reply_to_message_id: string | null;
  thread_id: string | null;
  from_email: string | null;
  signature_id: string | null;
  remote_draft_id: string | null;
  attachments: string | null;
  sync_status: string;
  created_at: number;
  updated_at: number;
}

export interface ComposerPreset {
  id: string;
  account_id: string;
  name: string;
  default_reply_mode: string;
  send_and_archive: number;
  undo_send_delay: number;
  font_family: string;
  font_size: number;
  is_default: number;
  created_at: number;
}

// ─── AI ────────────────────────────────────────────────────────────────────

export interface AiCache {
  id: string;
  account_id: string;
  thread_id: string;
  type: string;
  content: string;
  created_at: number;
}

export interface AiConfig {
  id: string;
  account_id: string;
  config_type: string;
  config_json: string;
  is_enabled: number;
  created_at: number;
  updated_at: number;
}

// ─── Campaigns ─────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  template_id: string | null;
  segment_id: string | null;
  status: string;
  sent_count: number;
  sent_at: number | null;
  ab_test_config: string | null;
  analytics_json: string | null;
  created_at: number;
}

export interface CampaignRecipient {
  campaign_id: string;
  contact_id: string;
  status: string;
  opened_at: number | null;
  clicked_at: number | null;
  variant: string | null;
  is_winner: number | null;
}

/** Campaign + recipient status joined for a contact's campaign history view. */
export interface CampaignRecipientWithCampaign {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  sent_at: number | null;
  campaign_created_at: number;
  recipient_status: string;
  opened_at: number | null;
  clicked_at: number | null;
  variant: string | null;
  is_winner: number | null;
}

export interface UtmLink {
  id: string;
  campaign_id: string;
  url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  click_count: number;
  created_at: number;
}

export interface UtmClick {
  id: string;
  link_id: string;
  contact_id: string;
  clicked_at: number;
}

export interface BackupSchedule {
  id: string;
  company_id: string;
  name: string;
  format: string;
  cron_expression: string;
  destination_path: string | null;
  encrypt: number;
  is_enabled: number;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
}

// ─── Deliverability ────────────────────────────────────────────────────────

export interface DeliverabilityConfig {
  id: string;
  account_id: string;
  config_type: string;
  config_json: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface DeliverabilityEvent {
  id: string;
  account_id: string;
  event_type: string;
  event_data_json: string;
  created_at: number;
}

export interface NewsletterBundle {
  id: string;
  account_id: string;
  name: string;
  rules_json: string;
  thread_ids_json: string;
  created_at: number;
  updated_at: number;
}

// ─── Pairing ───────────────────────────────────────────────────────────────

export interface PairedDevice {
  id: string;
  device_name: string;
  device_type: string;
  token_hash: string;
  paired_at: number;
  last_seen_at: number;
  is_active: number;
}

// ─── Security ──────────────────────────────────────────────────────────────

export interface PgpKey {
  id: string;
  account_id: string;
  key_id: string;
  user_id: string;
  public_key: string;
  private_key_encrypted: string | null;
  passphrase_hint: string | null;
  fingerprint: string | null;
  created_at: number;
}

export interface Allowlist {
  id: string;
  account_id: string;
  list_type: string;
  target: string;
  display_name: string | null;
  created_at: number;
}

export interface LinkScanResult {
  message_id: string;
  account_id: string;
  result_json: string;
  scanned_at: number;
}

// ─── Workflows ─────────────────────────────────────────────────────────────

export interface WorkflowRule {
  id: string;
  company_id: string;
  name: string;
  trigger_event: string;
  trigger_conditions: string | null;
  actions: string;
  is_active: number;
  created_at: number;
}

export interface FollowUpReminder {
  id: string;
  company_id: string;
  thread_id: string;
  message_id: string;
  remind_at: number;
  status: string;
  created_at: number;
}

export interface PendingOperation {
  id: string;
  account_id: string;
  operation_type: string;
  resource_id: string;
  params: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: number | null;
  error_message: string | null;
  campaign_id: string | null;
  created_at: number;
}

// ─── Calendar ──────────────────────────────────────────────────────────────

export interface Calendar {
  id: string;
  company_id: string;
  provider: string;
  remote_id: string;
  display_name: string | null;
  color: string | null;
  is_primary: number;
  is_visible: number;
  sync_token: string | null;
  ctag: string | null;
  created_at: number;
  updated_at: number;
}

export interface CalendarEvent {
  id: string;
  company_id: string;
  calendar_id: string | null;
  google_event_id: string;
  remote_event_id: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  start_time: number;
  end_time: number;
  is_all_day: number;
  status: string;
  organizer_email: string | null;
  attendees_json: string | null;
  html_link: string | null;
  etag: string | null;
  ical_data: string | null;
  uid: string | null;
  updated_at: number;
}

export interface SnoozePreset {
  id: string;
  company_id: string;
  label: string;
  duration_minutes: number;
  is_recurring: number;
  sort_order: number;
  created_at: number;
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  priority: string;
  is_completed: number;
  completed_at: number | null;
  due_date: number | null;
  parent_id: string | null;
  contact_id: string | null;
  thread_id: string | null;
  thread_account_id: string | null;
  sort_order: number;
  recurrence_rule: string | null;
  next_recurrence_at: number | null;
  tags_json: string;
  workflow_config_json: string | null;
  reminder_config_json: string | null;
  created_at: number;
  updated_at: number;
}

// ─── Compliance ────────────────────────────────────────────────────────────

export interface ComplianceProfile {
  id: string;
  code: string;
  name: string;
  description: string | null;
  region_hint: string;
  rules_json: string;
  is_active: number;
  is_default: number;
  created_at: number;
}

export interface ComplianceCheck {
  id: string;
  company_id: string;
  email_draft_id: string | null;
  campaign_id: string | null;
  profile_ids: string;
  score: number;
  violations_json: string | null;
  checked_at: number;
}

// ─── CRM (continued) ────────────────────────────────────────────────────────

export interface ContactTag {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface ContactTagPivot {
  contact_id: string;
  tag_id: string;
}

export interface ContactGroupPivot {
  contact_id: string;
  group_id: string;
}

export interface DynamicSegment {
  id: string;
  company_id: string;
  name: string;
  query: string;
  refreshed_at: number | null;
  created_at: number;
}

// ─── Comms (continued) ─────────────────────────────────────────────────────

export interface FilterCondition {
  id: string;
  filter_id: string;
  field: string;
  operator: string;
  value: string;
}

export interface TemplateCategory {
  id: string;
  company_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_system: number;
}

// ─── AI (continued) ─────────────────────────────────────────────────────────

export interface WritingStyleProfile {
  id: string;
  account_id: string;
  profile_text: string;
  sample_count: number;
  created_at: number;
  updated_at: number;
}

export interface SmartLabelRule {
  id: string;
  account_id: string;
  label_id: string;
  ai_description: string;
  criteria_json: string | null;
  is_enabled: number;
  sort_order: number;
  created_at: number;
}

// ─── Deliverability (continued) ────────────────────────────────────────────

export interface EmailWarming {
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

export interface WarmingLog {
  id: string;
  account_id: string;
  sent_date: string;
  volume: number;
  created_at: number;
}

export interface Bounce {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  recipient_email: string;
  bounce_type: string;
  diagnostic_code: string | null;
  reason: string | null;
  bounced_at: number;
}

export interface SuppressionListEntry {
  id: string;
  account_id: string;
  email: string;
  reason: string;
  suppressed_at: number;
}

export interface UnsubscribeAction {
  id: string;
  account_id: string;
  thread_id: string;
  from_address: string;
  from_name: string | null;
  method: string;
  unsubscribe_url: string;
  status: string;
  unsubscribed_at: number | null;
  created_at: number;
}

export interface BundleRule {
  id: string;
  account_id: string;
  category: string;
  is_bundled: number;
  delivery_enabled: number;
  delivery_schedule: string | null;
  last_delivered_at: number | null;
  created_at: number;
}

export interface BundledThread {
  account_id: string;
  thread_id: string;
  category: string;
  held_until: number | null;
}

export interface BlacklistCheck {
  id: string;
  account_id: string;
  check_type: string;
  target: string;
  listed: number;
  list_name: string | null;
  responded: number;
  checked_at: number;
}

export interface ARFReport {
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

// ─── Security (continued) ─────────────────────────────────────────────────

export interface NotificationVip {
  id: string;
  account_id: string;
  email_address: string;
  display_name: string | null;
  created_at: number;
}

export interface ImageAllowlistEntry {
  id: string;
  account_id: string;
  sender_address: string;
  created_at: number;
}

export interface PhishingAllowlistEntry {
  id: string;
  account_id: string;
  sender_address: string;
  created_at: number;
}

// ─── Tasks (continued) ────────────────────────────────────────────────────

export interface TaskTag {
  tag: string;
  company_id: string | null;
  color: string | null;
  sort_order: number;
  created_at: number;
}

// ─── Cleanup Rules ───────────────────────────────────────────────────────

export interface CleanupRule {
  id: string;
  company_id: string;
  name: string;
  rule_type: string;
  condition_json: string;
  action: string;
  target_folder: string | null;
  retention_days: number | null;
  is_scheduled: number;
  schedule_cron: string | null;
  next_run_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CleanupHistory {
  id: string;
  company_id: string;
  rule_id: string | null;
  action: string;
  thread_count: number;
  message_count: number;
  status: string;
  error_message: string | null;
  executed_at: number;
}

// ─── Invoicing ──────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  tax_id: string | null;
  role: 'customer' | 'supplier' | 'both';
  credit_limit: number;
  payment_terms: number;
  notes: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string;
  document_type: 'invoice' | 'delivery_bill' | 'shipping_print';
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
  issue_date: number;
  due_date: number | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  notes: string | null;
  peppol_xml_path: string | null;
  pdf_path: string | null;
  created_at: number;
  updated_at: number;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_id: string | null;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: number;
}

export interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItem[];
}

export interface Item {
  id: string;
  name: string;
  description: string | null;
  type: 'product' | 'service';
  sku: string | null;
  category_id: string | null;
  unit: string;
  buy_price: number;
  sell_price: number;
  stock_qty: number;
  stock_alert: number;
  tax_rate: number;
  barcode: string | null;
  image_url: string | null;
  active: number;
  company_id: string;
  created_at: number;
  updated_at: number;
}

export interface CompanySetting {
  company_id: string;
  default_currency: string;
  default_tax_rate: number;
  invoice_prefix: string;
  invoice_suffix: string;
  quote_prefix: string;
  default_template_id: string | null;
  logo_url: string | null;
  signature_text: string | null;
  bank_details: string | null;
  terms_default: string | null;
  theme_color: string;
  units_enabled: string;
  tax_position: string;
  decimal_places: number;
  updated_at: number;
}

export interface Category {
  id: string;
  name: string;
  company_id: string | null;
  created_at: number;
}
