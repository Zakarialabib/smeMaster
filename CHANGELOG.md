# Changelog

## [v1.0.0-rc.2] — 2026-07-16

This release merges the `dev` branch into `main` (36 commits) and adds the
largest feature drop since rc.1: a full CRM Deals/Pipeline module, a data-cache
control surface, Phase B email UX parity, calendar drivers, campaign scheduling

- Microsoft Graph send, and a large documentation/IA reconciliation pass.

### CRM — Deals & Pipeline (new module)

- **Schema + migrations**: `032_deals_pipeline.sql` adds deals, pipelines,
  stages, and pipeline-stage tables; migrations `030_sender_credentials.sql`
  and `031_thread_importance_score.sql` also land in this cycle.
- **Rust DAL + commands**: `src-tauri/src/db/tables/crm/deals.rs` (450 LOC) and
  `scoring.rs` (lead-scoring engine) plus `src-tauri/src/commands/deals.rs`
  (218 LOC) implement full CRUD, stage moves, and weighted pipeline value.
- **Frontend**: `DealCard`, `DealColumn`, `PipelineBoard` Kanban components,
  `DealsPage`, `dealStore.ts` (single-writer core), and `deals.ts` service
  wrappers wired into `CrmPage` + nav config.
- **Seeds**: default CRM pipeline + stages seeded on first run.
- **Contacts**: score column, segment filter, Kanban nav fix (`/people?tab=deals`),
  dead segment operator removed, drop errors surfaced.

### Data cache control surface

- **Settings → Cache tab**: live status, hit-rate, benchmark button, and
  clear-cache action (`CacheTab.tsx`, 252 LOC).
- **Rust**: `data-cache` control commands + `Cache::benchmark` exposed via IPC
  (`src-tauri/src/commands/core.rs`, `src-tauri/src/data_cache/cache.rs`).

### Email — Phase B UX parity

- **Hover rail + bulk toolbar** in `EmailList`, **Focused inbox**, **NL snooze**
  parsing (`parseSnooze.ts` + tests), and an expanded **command palette**
  (`CommandPalette.tsx`, 336 LOC).
- **Microsoft Graph provider**: `microsoftGraphProvider.ts` (441 LOC) + Graph
  send client; provider factory wired for Graph delivery.
- **Backend**: importance score + auto-categorize (`src-tauri/src/db/tables/core/threads.rs`),
  expanded Rust demo seeds (Gmail/Outlook-grade category tabs).

### Calendar drivers

- **CalDAV driver** (`src-tauri/src/calendar/drivers/caldav.rs`, 734 LOC) plus
  driver registry (`driver.rs`, `drivers/mod.rs`, `mod.rs`) and `calendar.rs`
  commands. Calendar operations refactored onto the new driver layer.

### Campaigns

- **Scheduling + analytics**: `029_campaign_scheduling.sql`, campaign schema
  extensions, `campaignService` scheduling, `analyticsService` enhancements, and
  template search wired into `CampaignTemplatePicker`.

### Settings & a11y

- **Reset / data-wipe** routed through `db_reset_and_reseed`; empty task table
  and dev-server termination fixes; soft reset corrected.
- **a11y**: `FocusOrderManager`, `SkipLink`, and focus-order utilities added;
  feature flags / settings registry / help center made translation-ready;
  rules-of-hooks ESLint errors fixed.
- **i18n**: 12 failing vitest files fixed; missing validation i18n keys added
  across en/fr/ar/ja/it.

### Docs & IA reconciliation

- New specs: `14-navigation-ia-spec.md`, `37-settings-redesign-spec.md`,
  `06-release-pipeline.md`, navigation-redesign proposals, `DEALS-PIPELINE-
LEAD-SCORING-PLAN.md`, `MVP_LAUNCH_PLAN.md`, `SETTINGS-IA-PROPOSAL.md`.
- `STATUS.md` + `PRODUCTION-READINESS.md` reconciled with source truth; IPC /
  migration / store metrics corrected; stray working docs archived/merged.

### CI

- `daily-pr.yml`: daily `dev → main` PR workflow with auto-release chain.

### Quality

- Full vitest suite green with real fixes (not glue); `tsc --noEmit` zero errors;
  2,470+ TS tests + 735 Rust tests passing; dead-code warnings reduced 13 → 0
  (12 previously-unused APIs wired up).

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
