# UI Test & Improve — Master Agent Prompt (SMEMaster)

> Purpose: a single, copy-paste prompt for an AI agent to launch the app locally,
> walk through **every page/component top-to-bottom**, verify functionality,
> fix issues, and keep the documentation in sync at each step.
>
> This file is project-grounded (routes, features, and stores are taken from the
> real `src/` tree). Run it after any layout/behavior change — e.g. the recent
> reading-pane + email-list deduplication work.

---

## 0. Context the agent MUST read first (do not skip)

SMEMaster is an **offline-first Tauri v2 + React 19 + Rust + SQLite** desktop app.
Three strict layers: **React UI → TypeScript Service Layer → Rust IPC → SQLite**.
Hard rules (from `AGENTS.md` / `.trae/rules/`):

- UI never touches the DB. Services never render. Rust never imports React.
- All DB access goes through Rust — **zero direct SQL in TypeScript**.
- Route IPC through `src/shared/services/db/db-invoke.ts` / `commands.ts`
  (`invokeCommand`), never raw `invoke()`.
- `react-i18next` `t()` for ALL user-facing strings; no hardcoded text.
  After adding keys run `npm run translate:sync`.
- RTL: use logical props (`ms-*`/`me-*`, `text-start/end`, `inset-inline-*`), never `left/right`.
- No hardcoded colors — use `hsl(var(--…))` design tokens.
- TypeScript strict (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- Follow the **Step Phase Funnel**: READ → ANALYZE → THINK → RECHECK → EXECUTE.

Read these before starting:
- `docs/00-INDEX.md`, `docs/STATUS.md`
- `docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`
- `docs/03-FRONTEND/10-rtl-audit.md`
- `src/router/routeTree.tsx` (the canonical page list below)
- Current open todos / `docs/02-BACKEND/12-diagnostics.md` (known debt)

---

## 1. Environment setup

```powershell
cd c:\laragon\www\smeMaster
npm run dev          # Vite dev server (web mode), default http://localhost:1420/
```

- The app runs in a **browser** for UI testing (no Tauri native needed).
- If a stale/inconsistent DB is suspected, run the Rust command
  `db_reset_and_reseed` (drops tables → re-runs migrations → re-seeds
  `demo-company-1`) from the dev console, OR delete the app SQLite file to force
  a fresh migrate + seed on next launch.
- Run the quality gates after EACH page's changes:
  ```powershell
  npx tsc --noEmit
  npx eslint src --max-warnings=0
  npm run build
  ```

---

## 2. The caching-vs-DB rule (critical — apply on every page)

Before testing any page, classify its data into **two buckets** and verify each
is handled correctly:

| Bucket | Examples | Storage | Behavior |
|---|---|---|---|
| **Session / volatile cache** | reading-pane position, sidebar collapse, theme, accent, last-selected folder, command-palette history, onboarding step, in-flight optimistic UI | `localStorage` / Zustand (in-memory) / `sessionStorage` | Fast, per-device, **not** synced, safe to drop |
| **Persistent domain data** | accounts, emails/threads, contacts, deals, invoices, automation rules, settings, PGP keys, vault items | **SQLite via Rust IPC** (`db-invoke.ts`) | Source of truth, offline-first, must survive restart |

Check for these recurring mistakes:
1. **Domain data wrongly kept in cache** — e.g. a form that only saves to
   `localStorage` and never calls the DB invoke. → Fix: persist via the service
   layer; cache only for UX speed.
2. **Volatile UI state wrongly written to DB** — e.g. theme/accent stored in a
   DB table instead of `themeStore`/`layoutStore`. → Fix: move to the store.
3. **No optimistic update / no offline queue** for mutations. → Follow
   `emailActions.ts` pattern (optimistic + offline-aware).
4. **Missing `react-query` invalidation / Zustand refresh** after a mutation.
5. **Cross-tab/process sync missing** — native side must emit domain events
   through the EventBus so other windows update.

→ For each page, **explicitly state** which keys are cached vs DB-persisted and
confirm both survive a full page reload.

---

## 3. Page-by-page walkthrough (top → bottom, component by component)

Navigate to each route, exercise every interactive element, and improve as you
go. Use the real route paths from `src/router/routeTree.tsx`.

### 3.1 Onboarding (`src/features/onboarding/OnboardingScreen.tsx`)
Steps: `WelcomeStep` → `ToolsStep` → `AccountSetupStep` → `CompletionStep`.
- Verify progress is restored from `sessionStorage` on crash (`smemaster.onboarding.step`).
- Verify completion sets `localStorage["smemaster.onboarding.done"]` (cache, not DB).
- Verify demo presets (`demoPresets.ts`) actually seed data via DB invokes, not just state.
- Check `FeatureGateBanner` shows/hides correctly.
- Account setup must create a real account through the service layer (DB), not cache.

### 3.2 Dashboard (`/dashboard`, `DashboardPage.tsx` + `dashboardStore.ts`)
- Widgets load from DB; layout/card order (if user-customizable) is cache.
- Mobile variant `/dashboard/mobile` (`MobileDashboardPage.tsx`) renders without desktop chrome.

### 3.3 Mail (`/mail/$label`, `MailLayout` → `MailTopBar`, `EmailList`, `ReadingPane`)
- **MailTopBar**: search (incl. `from:`, `to:`, `has:attachment` tokens), refresh,
  label + count, Focused/All toggle, read filter (All/Unread/Read).
- **EmailList**: filter row (sort only — read filter already in top bar),
  view modes **List / Kanban / Calendar / Agenda**.
  - RULE: Kanban / Calendar / Agenda must be **full-page** (no reading-pane split).
  - `SavedViews` chips only render in **split-inbox** mode (they duplicate sidebar folders otherwise).
- **ReadingPane** (single source of truth now in `WindowTitleBar`):
  - Hidden when **no account** OR **no email selected**.
  - Shown when an email is selected.
  - The reading-pane **selector (Right / Bottom / Hidden / Expanded)** lives ONLY
    in the header dropdown — must NOT appear inside `ReadingPane` (no back/position bar).
  - Empty state uses `email.selectAnEmailToRead` / `email.selectAnEmailHint`.

### 3.4 People / CRM (`/people`, `CrmPage.tsx`; `/people/$contactId`, `ContactDetailPage.tsx`)
- Contacts list + detail; deal board (`DealsPage.tsx`) — verify deals query by
  `ACTIVE_COMPANY_ID` and return data (not just empty state).
- Campaigns surface inside automation.

### 3.5 Tasks / Schedule (`/tasks`, `SchedulePage.tsx`)
- Calendar + task list; create/edit/complete tasks; recurrence; reminders.

### 3.6 Automation (`/automation`, `AutomationCampaignsPage.tsx`)
- ⚠️ Known fix applied: must use `ACTIVE_COMPANY_ID` (NOT `activeAccountId`) for
  `companyId` when loading/saving rules (FK to `companies(id)`).
- Verify rule list loads, create-from-template + AI-create persist to DB.
- Workflows (`/workflows`) and campaigns (`/campaigns`) redirect here.

### 3.7 Invoicing (`/invoicing`, `InvoicingDashboard`; `/invoicing/new`, `/invoicing/edit/$id`, `InvoiceEditor.tsx`)
- DGI-compliant Morocco invoicing. Verify invoices load/save under `ACTIVE_COMPANY_ID`.
- Line items, totals, PDF/print, client picker from contacts.

### 3.8 POS (`/pos`, `POSPage.tsx`) and ERP (`/erp`, `ErpPage.tsx`)
- POS cart/checkout; ERP modules. Verify stock + transactions persist to DB.

### 3.9 Attachments (`/attachments`, `AttachmentLibrary.tsx`)
- Grid of attachments; filter by account; open/preview; delete (DB mutation + cache refresh).

### 3.10 Vault (`/vault`, `VaultPage.tsx`)
- Encrypted secrets; create/read/update/delete; PGP integration.

### 3.11 AI Assistant (`/ai-assistant`, `AiAssistantPage.tsx`)
- Chat; RAG over local data; verify it reads from DB, not stale cache.

### 3.12 Settings (`/settings/$tab`) — every tab
Tabs (from `src/features/settings/components/tabs/`):
`GeneralTab, AccountsTab, MailRulesTab, ComposingTab, PresendTab, TemplatesTab,
PgpTab, NotificationsTab, CalendarTab, AiTab, HardwareTab/HardwareSettings,
QueueTab, BackupTab, CacheTab, ShortcutsTab, DeliverabilityTab, ComplianceTab,
LicenseTab, FeatureFlagsTab, DeveloperTab, AccountCleaningTab, AboutTab`.
Plus `/settings/device-pairing` (`DevicePairingPage.tsx`) and `/help/$topic`.

For EACH settings tab:
- Identify cache vs DB fields (e.g. `themeStore`/accent = cache; account config,
  rules, PGP keys = DB).
- **Fill in / recheck every input, toggle, and select** — do not leave blanks.
- Verify changes persist across reload (DB) and that volatile prefs (cache) behave.
- `CacheTab`: verify cache can be cleared without corrupting DB data.
- `BackupTab`: verify export/import path.

### 3.13 Forms (cross-cutting)
For every form across the app (onboarding, account setup, contact, deal, invoice,
automation rule, settings):
- Controlled inputs with proper types; required-field validation + inline errors.
- Submit → optimistic UI + DB invoke → error/loading/success states.
- Cancel/reset restores prior state.
- No raw SQL; all via service layer.
- All labels/placeholders/errors via `t()`.

---

## 4. Improvement checklist (apply per page)

For each page/component, evaluate and fix where missing:
- [ ] **Loading / empty / error** states present for every async surface.
- [ ] **Accessibility**: ARIA roles, labels, live regions, full keyboard nav
  (WCAG AA). Focus visible; modals trap focus.
- [ ] **RTL**: no physical `left/right`, use logical props; test with `ar` locale.
- [ ] **i18n**: zero hardcoded strings; run `npm run translate:sync` after edits;
  clear any `[TODO]`-prefixed auto-translated keys.
- [ ] **Responsive**: desktop ≥1024px panes correct; mobile single-pane.
- [ ] **Performance**: `useMemo`/`React.memo` for heavy lists; virtualize long
  lists (`@tanstack/react-virtual`); debounce search/resize.
- [ ] **Security**: DOMPurify for rendered email/HTML; validate IPC payloads.
- [ ] **Type safety**: no `any`; respect `noUncheckedIndexedAccess`.
- [ ] **No duplication**: controls appear once (e.g. reading-pane selector only
  in header). Remove redundant bars that mirror the sidebar.

---

## 5. Per-step workflow (the loop)

For each route in §3, in order:

1. **READ** — open the page in the browser; screenshot; read the relevant
   component file + its store/service + matching `docs/` entry.
2. **ANALYZE** — map each data field to cache vs DB (§2). Note missing/complex/
   broken UI, dead controls, missing states, RTL/i18n violations.
3. **THINK** — plan minimal, verifiable fixes (one component at a time).
4. **RECHECK** — validate against existing patterns + system loops
   (orchestrator, EventBus, DomainEventProcessor). Confirm IPC command names/DTOs
   match Rust.
5. **EXECUTE** — implement; run `npx tsc --noEmit` + `npx eslint src --max-warnings=0`.
6. **VERIFY** — reload the page; re-test the fixed flow; confirm cache+DB survive reload.
7. **DOCUMENT** — update docs for that step (see §6), commit the doc update,
   then move to the next route.

Do NOT proceed to the next page until the current one passes the gates and its
doc is updated.

---

## 6. Documentation updates (every step, mandatory)

After finishing each page, update the relevant doc files:
- `docs/00-INDEX.md` — add/refresh entries if a new doc was created.
- The matching `docs/0X-…` architecture/feature file (e.g. `docs/04-FEATURES/*`,
  `docs/03-FRONTEND/*`).
- New architectural patterns → document in the right module doc.
- Found confusing/poorly-typed/deprecated code → **stop, document** (don't
  fix-and-forget) in `docs/02-BACKEND/12-diagnostics.md` (backend/types) or
  `docs/03-FRONTEND/13-deprecations.md` (frontend/patterns). Include: title,
  file:line, severity, issue, future plan, how discovered.
- Component/function JSDoc where non-obvious.

Keep a running log at the top of this file (or a `UI_TEST_LOG.md`) with:
`[date] page — tested: ✓/✗ — fixed: … — docs updated: …`.

---

## 7. Final reporting

When all routes are done, produce a summary for the user:
- Pages tested (✓ working / ✗ broken → fixed) with route paths.
- Cache-vs-DB findings (any misclassification corrected).
- Forms/rechecked settings (which were empty/blank and now filled).
- Known remaining debt (linked to `docs/…/12-diagnostics.md` /
  `13-deprecations.md`).
- Quality-gate status: `tsc`, `eslint`, `build` all green.

---

## 8. Quick reference — route → component map

| Route | Component |
|---|---|
| `/` → `/dashboard` | redirect |
| `/dashboard` | `DashboardPage` |
| `/dashboard/mobile` | `MobileDashboardPage` |
| `/mail/$label` | `MailLayout` (MailTopBar / EmailList / ReadingPane) |
| `/label/$labelId`, `/smart-folder/$folderId` | `MailLayout` |
| `/people` | `CrmPage` |
| `/people/$contactId` | `ContactDetailPage` |
| `/tasks` (Calendar → here) | `SchedulePage` |
| `/automation` (Workflows/Campaigns → here) | `AutomationCampaignsPage` |
| `/invoicing` | `InvoicingDashboard` |
| `/invoicing/new`, `/invoicing/edit/$id` | `InvoiceEditor` |
| `/erp` | `ErpPage` |
| `/pos` | `POSPage` |
| `/vault` | `VaultPage` |
| `/ai-assistant` | `AiAssistantPage` |
| `/attachments` | `AttachmentLibrary` |
| `/settings/$tab` | `SettingsPage` (tabs in `settings/components/tabs/`) |
| `/settings/device-pairing` | `DevicePairingPage` |
| `/help/$topic` | `HelpPage` |
| `*` | 404 |

---

## 9. Running Log — UI Test & Improve pass (2026-07-16)

Environment: Vite dev server `http://localhost:1420/` (browser mode, **no Tauri backend** —
every IPC `invoke()` throws `TauriUnavailableError` by design, so DB-backed pages render
graceful "Data is available in the desktop app." / "Failed to load … Retry" states). This mode
is used for pure-UI verification (layout, i18n, graceful degradation), not backend behavior.

**Tooling note (important):** `browser_navigate` returns a FRESH accessibility tree, but
`browser_snapshot` / `browser_vision` / `browser_console` frequently return STALE DOM after a
SPA hash navigation or the `about:blank` navigation race. Reliable verification used
`browser_navigate` snapshots + live `document.body.innerText` reads via `browser_console`
(before the session's document binding corrupted). Onboarding storage does NOT persist across
full `browser_navigate` reloads, so each fresh load shows the wizard; dismissing in-session via
the live Quick Start button works but subsequent vision/console reads can go stale.

### Pages tested (✓ working / ✗ broken → fixed), route → component
- `/dashboard` `DashboardPage` — ✓ now human-readable (Business Health, Email Activity, compliance/backup cards). Fixed: `businessHealth.notScheduled/nextBackup/title` self-refs, `dashboard.updatedSeconds/Minutes/Hours` (was `{{count}}` unpopulated; code passed `{n}` → changed to `{count}`), and raw-error leak in 3 widgets.
- `/mail/$label` `MailLayout` — ✓ nav + folder labels human-readable. Reading pane/list/empty states render (loading skeletons, no backend).
- `/people` `CrmPage` — ✓ tabs (Contacts/Deals/Tasks/Calendar/Invoices) human-readable.
- `/automation` `AutomationCampaignsPage` — ✗ `automation.templates` raw key → fixed (→ "Templates").
- `/invoicing` `InvoicingDashboard` — ✗ `invoicing.failedToLoad` raw key → fixed (added key, `{{tab}}`).
- `/pos` `POSPage` — ✓ graceful "Failed to load POS products … Retry" (no backend).
- `/erp` `ErpPage` — ✗ `erp.subtitle` raw key → fixed (added key, `{{company}}`).
- `/vault` `VaultPage` — ✓ "Set Vault PIN …" human-readable.
- `/ai-assistant` `AiAssistantPage` — ✓ "Local RAG is Disabled" human-readable.
- `/tasks` `SchedulePage` — ✓ Tasks/Calendar/List/Kanban/Priority/Group labels human-readable.
- `/attachments` `AttachmentLibrary` — ✗ 15 raw filter keys (`attachments.images/pdf/documents/…`, `anyTime/today/pastWeek/…`, `anySize/small/medium/large`) → fixed (added all keys to 5 locales).
- Sidebar nav (`navConfig.ts` / `WindowTitleBar.tsx`) — ✗ `nav.dashboard/automation/vault/aiAssistant/invoicing/erp/deals/pos/productivity/about` + `nav.keyboardNavHint` self-ref → fixed (added keys to all 5 locales).

### i18n fixes (systematic, all 5 locales)
- Root cause: code calls `t("nav.dashboard")` etc. but locale `nav` objects only had un-prefixed keys; many `self-ref` values (`"x.y": "x.y"`) and `[TODO]`/`KEY` auto-translation placeholders.
- Backfilled 1,123 entries fr/ar/ja/it from `en`; fixed 29 `en` self-refs; cleared ALL `[TODO]`/`KEY` placeholders.
- Scripted audit (`check_i18n_keys.py`): scanned every `t('a.b.c')` in `src/**` (1,500 keys) against `en/translation.json` → **0 missing** (was 42 before fix). Added the 42 missing keys (incl. `campaign.*`, `contact.*`, `modals.csvImport.*`, `nav.nMore/nPending`, `pgp.algorithms`, `thread.nMessagesInThread`, `tasks.selectedCount`, `updater.description`, etc.).
- `translate:sync` re-run: added 217 keys, reports 0 `[TODO]` remaining.

### Widget error-leak fix (graceful degradation)
- `EmailVolumeWidget`, `ContactGrowthWidget`, `EmailHeatmapWidget` rendered raw `String(err)`
  (`TauriUnavailableError: …`) in a red box. Routed them through the existing `WidgetError`
  helper ("Data is available in the desktop app.") for consistent backend-missing messaging.

### Quality gates
- `npx tsc --noEmit` → **0 errors** ✅
- `npx eslint src --max-warnings=0` → **24 warnings, 0 errors** (all pre-existing
  `react-hooks/exhaustive-deps` noise in files NOT touched by this task — e.g. `TasksPage`,
  `ComposerTab`, `ThreadView`; orchestrator-owned). My changed files are lint-clean.
- `npm run build` → **green** ✅

### Known remaining debt (not introduced here; surfaced for orchestrator)
- 24 pre-existing eslint `react-hooks/exhaustive-deps` warnings across unrelated modules.
- Browser-test environment cannot run the Tauri backend, so DB-mutation flows (forms, settings
  persistence, automation rule save under `ACTIVE_COMPANY_ID`, etc.) are NOT exercisable here —
  verified only for graceful offline/error handling and i18n, per the doc's caching-vs-DB §2.
- `ErpPage.tsx:142` has a pre-existing "unused eslint-disable directive" warning.
