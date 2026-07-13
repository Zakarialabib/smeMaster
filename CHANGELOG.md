# Changelog

## [v1.0.0-rc.1] — 2026-07-13

### Highlights

- **Settings UI overhaul**: All 24 settings tabs redesigned with premium card layout,
  stats rows (DeliverabilityDashboard pattern), step-by-step setup wizards
- **RTL + i18n cleanup**: 164 physical-direction CSS violations fixed across 48 files
  using Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`);
  1,685 `[TODO]` translation prefixes cleared across fr/ar/ja/it locales
- **Onboarding rework**: Standalone page after splash; auto-skips if email accounts
  or demo data exist; root redirect changed from `/mail/inbox` to `/dashboard`
- **Onboarding data-check**: Uses `db_has_email_accounts` and `is_system_initialized`
  IPC to skip onboarding when accounts or demo data already exist

### Settings tabs redesigned

- ComposingTab: Stats row (4 cards), Quick Setup Guide stepper with 6-step progress
- TemplatesTab: Stats row (template count, categories, AI ready, demo presets)
- DeveloperTab: Stats row (system status, features, database, updates); consolidated health pane
- AboutTab: Premium gradient hero with app icon, tech stack badges, 8-feature highlights grid
- GeneralTab: 4 HelpCards for appearance/language/privacy/advanced sub-tabs
- FeatureFlagsTab, AccountCleaningTab, HardwareSettings: Added HelpCard education content
- LicensePage, DevicePairingPage: Added HelpCard education content

### Quality

- TypeScript: `tsc --noEmit` — zero errors
- ESLint: zero warnings
- 2,470+ TS tests + 735 Rust tests passing

## [Unreleased] — account_id → company_id rename (company-scoped domains)

### Scope

Renamed all company-scoped Tauri command parameters and frontend invoke wrapper
signatures from `account_id`/`accountId` to `company_id`/`companyId`. This aligns
the IPC contract with the database schema, where company-scoped tables use a
`company_id` foreign key to `companies(id)` rather than `account_id`.

### Company-scoped domains affected

- CRM: contacts, contact labels, contact groups, contact tags, segments, dynamic
  segments, contact files, contact activity
- Campaigns, backup schedules
- Templates / template categories
- Tasks / task tags
- Workflows: rules, follow-up reminders, pending operations, cleanup rules/history
- Calendar: calendars, events, snooze presets
- Compliance checks

### Account-scoped domains (intentionally unchanged)

threads, messages, mail labels, attachments, folder sync state, signatures,
aliases, scheduled emails, local drafts, filter rules, smart folders, quick steps,
quick replies, PGP keys, allowlists, deliverability, AI config/cache, settings,
warming, suppression, bundle rules, writing-style profiles, thread categories.

### `thread_account_id` (kept unchanged)

The `thread_account_id` column on `tasks` is a thread-ownership field, not a
company scope. It was intentionally left as-is.

### Changes

- **Rust commands** (`src-tauri/src/commands/*.rs`): all company-scoped command
  parameters renamed `account_id` → `company_id`.
- **Rust query layer** (`src-tauri/src/db/tables/tasks/tasks.rs`): fixed SQL column
  references (`account_id` → `company_id`) in `list`, `create`, `list_by_account`,
  `count_by_account`, `list_with_contacts*`, `count_incomplete`. Fixed `create()`
  INSERT column list (`account_id` → `company_id`).
- **Rust test** (`src-tauri/src/db/tables/comms/templates.rs`): `Template.company_id`
  is `String` (not `Option<String>`); test helper updated accordingly.
- **Frontend invoke wrapper** (`src/shared/services/db/db-invoke.ts`): 89 issues
  fixed — type-field renames, param-name renames, invoke-key renames, raw SQL
  column fix in `listDynamicSegments`, and JSDoc comment updates.
- **Frontend feature wrappers**: `contactTags.ts`, `contactGroups.ts`,
  `contactSegments.ts`, `calendars.ts`, `calendarEvents.ts` updated to use
  `companyId` for company-scoped operations.

### Frontend callers (additional fixes, 2026-07-09 batch)

- **Stores**: `automationStore.ts`, `workflowStore.ts`, `campaignStore.ts` (x2),
  `contactStore.ts` — all `loadCampaigns`/`loadRules`/`loadWorkflows`/`createCampaign`
  `/`createWorkflow`/`createTag`/`createSegment`/`deleteSegment`use`companyId`.
- **Components**: `ContactActivityTab.tsx`, `SegmentManager.tsx`,
  `SegmentQueryEditor.tsx`, `ContactsStatsWidget.tsx`, `ContactSidebar.tsx`,
  `TaskSidebar.tsx`, `TasksPage.tsx`, `TaskDetailPanel.tsx`,
  `SnoozePresetsEditor.tsx`, `WorkflowEditor.tsx`, `CampaignComposer.tsx`,
  `CampaignTemplatePicker.tsx` — fixed object-literal keys, property accesses,
  and variable references.
- **Service wrappers**: `followUpReminders.ts`, `pendingOperations.ts`,
  `workflowRules.ts`, `snoozePresets.ts`, `vaultService.ts`, `syncManager.ts`,
  `queueProcessor.ts` — fixed `accountId`→`companyId` keys and `account_id`→`company_id`
  property access.
- **Wrappers**: `campaigns.ts`, `workflows.ts`, `workflowRules.ts`,
  `snoozePresets.ts` — param names and internal calls updated.
- **db-invoke.ts**: Fixed `clearFailedOperations`, `retryFailedOperations`,
  `cancelFollowUpForThread` — invoke objects now pass `companyId`.
- **Test mocks**: `entities.mock.ts` — `sync_state` and `company_id` added to
  `createMockDbAccount`.

### Verification

- `npx tsc --noEmit` → **zero errors** ✅
- `cargo check` → **zero errors, zero warnings** ✅

### Migration note

Frontend callers that previously passed `accountId` to company-scoped functions
must now pass `companyId`. No database migration was required — the schema already
used `company_id` on these tables.
