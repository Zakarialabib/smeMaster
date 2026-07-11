# Schema Relationships

> **What you need to know:** 65+ foreign key relationships across 11 domains. Everything connects through `accounts.id`. Most query coverage is ~27% — we build JOINs as features need them, not ahead of time.

---

## The Central Hub

Every domain connects back to `accounts`:

```
Account ── hasMany ── Labels, Threads, Messages, Calendars, Campaigns,
                      Filters, Templates, Signatures, PGP Keys, Workflows,
                      Tasks, Compliance Checks, Deliverability Config...
```

**37 of 65+ FK relationships** flow through `accounts.id`. If you have an `account_id`, you can reach anything.

---

## Core Domain

```
Account
  ├── hasMany(Label)           → labels.account_id
  ├── hasMany(Thread)          → threads.account_id
  ├── hasMany(Message)         → messages.account_id
  ├── hasMany(Calendar)        → calendars.account_id
  ├── hasMany(Campaign)        → campaigns.account_id
  ├── hasMany(FilterRule)      → filter_rules.account_id
  └── ... (25+ more)

Thread
  ├── belongsTo(Account)       → threads.account_id
  ├── hasMany(Message)         → messages.thread_id
  ├── belongsToMany(Label)     → entity_pivots (type='thread_label')
  ├── hasMany(Task)            → tasks.thread_id
  ├── hasMany(FollowUpReminder)→ follow_up_reminders.thread_id
  └── hasMany(AiCache)         → ai_cache.thread_id

Message
  ├── belongsTo(Thread)        → messages.thread_id
  ├── hasMany(Attachment)      → attachments.message_id
  ├── hasMany(FilterLog)       → filter_logs.message_id
  └── hasOne(LinkScanResult)   → link_scan_results.message_id
```

---

## CRM Domain

```
Contact
  ├── belongsToMany(Tag)       → entity_pivots (type='contact_tag')
  ├── belongsToMany(Group)     → entity_pivots (type='contact_group')
  ├── hasMany(EngagementLog)   → engagement_log.contact_id
  ├── hasMany(ContactFile)     → contact_files.contact_id
  ├── hasMany(Task)            → tasks.contact_id
  ├── hasMany(CampaignRecipient)→ campaign_recipients.contact_id
  └── hasMany(Thread) [via email] → messages.from_address = contact.email
```

---

## Query Coverage by Domain (The Honest Numbers)

| Domain         | FK Relationships | JOIN Queries | Coverage |
| -------------- | ---------------- | ------------ | -------- |
| Core           | 15               | 6            | 40%      |
| CRM            | 10               | 3            | 30%      |
| Comms          | 8                | 4            | 50%      |
| Campaigns      | 8                | 1            | 12%      |
| Deliverability | 8                | 0            | 0%       |
| Security       | 4                | 0            | 0%       |
| Tasks          | 5                | 1            | 20%      |
| Calendar       | 3                | 0            | 0%       |
| Workflows      | 3                | 1            | 33%      |
| **Total**      | **64**           | **16**       | **~27%** |

**Why not 100%?** Because we add JOIN queries when features need them, not ahead of time. Full coverage would mean queries that nobody calls. Every existing JOIN is justified by a feature spec.

**Recent additions (Phase 3):**

- `getTasksForAccountWithContacts()` — Task ↔ Contact JOIN (eliminated N+1)
- `getContactWithStats()` — Contact + task_count + email_count
- `getCampaignsWithDetails()` — Campaign + Template + Segment
- `getFollowUpsWithThreadSubject()` — FollowUp + Thread subject

---

## All 65+ FK Relationships (Reference)

```
accounts.id ← labels.account_id
accounts.id ← threads.account_id
accounts.id ← messages.account_id
accounts.id ← filter_rules.account_id
accounts.id ← templates.account_id
accounts.id ← signatures.account_id
accounts.id ← send_as_aliases.account_id
accounts.id ← scheduled_emails.account_id
accounts.id ← local_drafts.account_id
accounts.id ← ai_cache.account_id
accounts.id ← campaigns.account_id
accounts.id ← pgp_keys.account_id
accounts.id ← workflow_rules.account_id
accounts.id ← follow_up_reminders.account_id
accounts.id ← pending_operations.account_id
accounts.id ← calendars.account_id
accounts.id ← calendar_events.account_id
accounts.id ← snooze_presets.account_id
accounts.id ← tasks.account_id
accounts.id ← compliance_checks.account_id
accounts.id ← deliverability_config.account_id
accounts.id ← deliverability_events.account_id
accounts.id ← allowlists.account_id
accounts.id ← newsletter_bundles.account_id
accounts.id ← bundle_rules.account_id
accounts.id ← bundled_threads.account_id
accounts.id ← blacklist_checks.account_id
accounts.id ← arf_reports.account_id
accounts.id ← backup_schedules.account_id
accounts.id ← composer_presets.account_id
threads.(account_id, id) ← messages.(account_id, thread_id)
threads.(account_id, id) ← follow_up_reminders.(account_id, thread_id)
messages.(account_id, id) ← attachments.(account_id, message_id)
messages.(account_id, id) ← link_scan_results.(account_id, message_id)
contacts.id ← engagement_log.contact_id
contacts.id ← campaign_recipients.contact_id
contacts.id ← utm_clicks.contact_id
contacts.id ← tasks.contact_id
campaigns.id ← campaign_recipients.campaign_id
campaigns.id ← pending_operations.campaign_id
utm_links.id ← utm_clicks.link_id
calendars.id ← calendar_events.calendar_id
tasks.id ← tasks.parent_id              (self-referential)
```

---

## What Was Fixed (Critical Gaps)

| Gap                                              | Impact                        | Resolution                       |
| ------------------------------------------------ | ----------------------------- | -------------------------------- |
| `thread_categories` missing from schema.sql      | **HIGH** — app would crash    | Added DDL + TypeScript interface |
| Thread interface missing `is_pinned`, `is_muted` | **MEDIUM** — compile errors   | Fixed in schema.ts               |
| 22 missing TypeScript interfaces                 | **MEDIUM** — incomplete types | All added in Phase 1b            |
| N+1 on Task + Contact queries                    | **MEDIUM** — slow lists       | New JOIN query added             |

**All resolved.** No remaining gaps.
