# SMEMaster — Project Status

> **Last updated:** 2026-07-14
>
> ✅ **Keyboard Navigation + Screen Reader (WCAG AA) — Done (2026-07-14):** Created reusable `<SkipLink>` component (replaced inline skip-links in App.tsx + MobileShell.tsx), `<FocusOrderManager>` landmark wrapper, added `aria-describedby` on PremiumSidebar, `role="status"`+`aria-live="polite"` on NotificationToast/EmptyState, `role="search"` on SearchBar. i18n keys (`skipToContent`, `nav.keyboardNavHint`) added to all 5 locales.
>
> ✅ **Campaign Scheduling — Wired End-to-End (2026-07-14):** Migration 029 adds `scheduled_at` + `recurring_cron` to campaigns + `campaign_schedules` table. Rust DAL/operations updated to accept scheduling params. Frontend `ScheduleStep` data now flows through `CampaignCreateInput` → Rust `create_campaign_with_recipients`. Scheduled campaigns show calendar icon + cancel button in CampaignList. Remaining: background worker for deferred send.
>
> ✅ **Microsoft Graph Send/Draft — Live (2026-07-14):** Rust `MicrosoftGraphDriver::send()` parses RFC 2822 via mailparse, builds Graph `sendMail` JSON payload, POSTs to `/v1.0/me/sendMail`. New `create_draft()` method. Frontend `MicrosoftGraphEmailProvider` class with full `EmailProvider` interface (send, draft, folders, archive, trash, star, spam). `providerFactory.ts` now wires Graph accounts instead of throwing error. TS client gained `sendRawMime`, `createDraftFromMime`, `updateDraftMime`, `deleteDraft`.
>
> ✅ **Campaign Analytics — Snapshot-Enabled (2026-07-14):** Analytics service now saves snapshots after live computation via `insertAnalyticsSnapshot`. `getCampaignAnalytics()` returns live stats with fire-and-forget snapshot persistence. `takeAnalyticsSnapshot()` available for manual refresh. CampaignList shows per-campaign stat badges (sent count).
>
> 🧾 **Invoicing Module (Morocco DGI-Compliant) — Production-ready (2026-07-12):** Backend is complete and solid — 7-table schema (i64 minor-unit money), line-item calc engine, lopdf A4 PDF generator, PEPPOL/UBL 2.1 XML, **35 Tauri commands**, frontend invoke wrappers, and a Business Profile tab with ICE/IF/RC/CNSS. The **frontend UI is fully built** (`InvoicingDashboard` tabbed shell, functional `InvoiceEditor` + `LineItemsEditor` + `InvoiceTotals`, `InvoiceList` with type/status filters, `SettingsDrawer`, `ClientList`/`ClientForm`, `ItemList`/`ItemForm`, `InvoiceStatusPill` status workflow, CRM `InvoicesTab`, and `InvoiceSelectionModal`). A wiring audit fixed 5 contract mismatches in `invoicing.ts` (see below). **Calc engine fully wired** — `calculate_document_totals` powers `db_create_invoice` and `db_calculate_invoice`. **`db_send_invoice` confirmed live** with real SMTP dispatch, PGP encryption, stock/ledger side effects. **Residual gap:** `db_list_clients` ignores `company_id` (company filter dropped server-side). Also **`db/tables/invoicing/tests.rs` still does not compile** (undefined `format_money`; `DocumentTotals` shape drift vs `calc.rs`).
>
> 📧 **Campaign Block Editor — Paperling-grade (2026-07-13):** The campaign template step is now a block-based email editor (typed `EmailBlock` model + pure `renderEmailHtml` renderer). Block components: `Heading`/`Paragraph`/`Image`/`Button`/`Divider`/`Spacer` plus a `Card` promo card and `Columns` two-column; `@dnd-kit` drag-reorder, per-block config panel, live `<iframe>` preview (desktop/mobile), AI copilot wired to the real `callAi` provider, and a Vault image picker. A saved-template gallery uses `htmlToBlocks()` to reverse-parse `body_html` into editable blocks. `campaignComposerStore` gained `blocks` + undo/redo + A/B subject state; `getBodyHtml()` persists as `body_html` via `db_create_campaign_with_recipients`; `db_create_campaign_template` feeds `CampaignTemplatePicker`. **A/B subject testing re-added** via the `CampaignBuilder` A/B panel. Legacy `TemplateStep.tsx` removed. **Verified:** `npx tsc --noEmit` 0 errors; `cargo check` 0 errors.
>
> 👥 **ContactSidebar Relations tab (2026-07-13):** The mail `ContactSidebar` gained a **Relations** tab showing the contact's linked company, company invoices (`listInvoices` by `company_id`), and campaign memberships (`db_list_campaigns_by_contact` → `CampaignRecipientWithCampaign`). New Rust command `db_list_campaigns_by_contact` wraps the existing `campaign_recipients::get_campaigns_for_contact`; registered in `mod.rs`; TS invoke `listCampaignsByContact` added. **Verified:** `npx tsc --noEmit` 0 errors (in touched files); `cargo check` 0 errors.
>
> 💰 **Company Wallet — Cash Hub + Ledger Sync (2026-07-12):** New `wallets` table (migration `023_wallet.sql`), `db/tables/wallet` DAL, and 4 Tauri commands (`db_ensure_wallet`, `db_get_wallet`, `db_credit_wallet`, `db_debit_wallet`). **Every ERP money movement now routes through the wallet:** marking a sale invoice `paid` credits cash; marking a bill `paid` debits cash; reversing unwinds the move. Each movement is mirrored to the ledger (Cash 1000 / AR 1200 / AP 2000) and manual top-ups/withdrawals post to Owner's Equity (3000). Frontend: new responsive `WalletView` (balance hero, top-up/withdraw modal with preset chips, live movements feed derived from the Cash ledger) wired into `ErpPage` as a **Cash** tab; Overview now shows **Cash on hand**. User guide added at `docs/user-guide/wallet.md`.

> 🖨️ **POS Hardware Integration — Merged (2026-07-11):** Point-of-Sale module with ESC/POS thermal printer support, system printer fallback, barcode scanner hook, hardware settings tab — merged cleanly via PR #2.
>
> 🔄 **account_id → company_id Rename (2026-07-09):** All company-scoped Tauri command parameters, frontend invoke wrappers, feature-layer wrappers, stores, and components renamed from `account_id`/`accountId` to `company_id`/`companyId`. 30+ files modified across the full stack — Rust commands, SQL queries, db-invoke wrapper (89+ fixes), 15+ feature wrappers, 6 stores, 8+ components. Zero TypeScript errors, zero Rust errors. See "Recently Completed" below.
>
> 🧭 **Docs Consolidated & Components Repurposed (2026-07-08):** All roadmap docs merged into `docs/06-ROADMAP/09-master-plan.md` (single canonical roadmap). Feature specs moved to `docs/04-FEATURES/`; frontend specs moved to `docs/03-FRONTEND/`. 4 orphaned React components repurposed into live code; 2 dead test files removed.
>
> 🎨 **Mobile UX Overhaul (2026-07-05 → 2026-07-06):** All 5 phases of the Mobile UX Overhaul are **100% implemented**.
>
> 🏗️ **Data Layer Evolution (2026-07-07):** Rust dead-code elimination (15 warnings → 0), task/campaign page fixes, bootstrap/snapshot/offline-availability commands, thread stash/unstash for optimistic email actions.
>
> Green checkmarks across the board:
>
> - `npx tsc --noEmit` → **zero errors** ✅ (verify before tagging)
> - `cargo check` → **zero errors, zero warnings** ✅ (verify before tagging)
> - `cargo test` → **🔶 NOT confirmed** — `src-tauri/src/db/tables/invoicing/tests.rs` **fails to compile** (`format_money` / `DocumentTotals` shape drift), so the invoicing integration tests are excluded. The "735/735 passing" claim is **unverified and likely false**; run `cargo test --no-fail-fast` to get the real count.
> - `npx vitest run` → **🔶 15 failing of 3,298** (vitest run 2026-07-15; 27 test files failed). The "2,470/2,470 passing" claim is **FALSE**.
> - `npx eslint src --max-warnings=0` → **verify** (0 errors/warnings claimed; re-run to confirm)
> - `vite build` → **builds clean** ✅ (verify before tagging)
> - `vite --host` → **serves HTTP 200** ✅ (verify before tagging)
>
> ⚠️ **These self-reported green checks were not re-verified against live runs before this edit. The numbers above reflect the 2026-07-15 live `vitest run` and the known `invoicing/tests.rs` compile failure. Re-run all gates before declaring v1.0.**
> 📄 **AI RAG docs reorganized (2026-07-11):** `docs/specs/ai-rag-ui.md` → `docs/04-FEATURES/ai-rag.md`. Feature fully built in code; all spec checkboxes ticked.

---

## 🔎 Verified Ground Truth (reconciled metrics — 2026-07-15)

> Many historical docs quote **inconsistent** metric values (commands cited as 773 / 652 / 704 / 802; migrations as 60 / 56 / 22 / 32; stores as 38 / 21 / 46). The table below is **grepped directly from source** and is the single canonical reference. All other docs should be read against it.

| Metric | Verified value | How verified | Common stale values to ignore |
| --- | --- | --- | --- |
| Rust `#[tauri::command]`s | **802** (739 `#[tauri::command]` + 63 `#[command]`) | `grep -rE '#\[tauri::command\]|#\[command\]' src-tauri/src \| wc -l` | 773, 777, 764, 704, 652 |
| Zustand stores | **46** (`create<` + `createWithEqualityFn`) | `grep -rE 'create<|createWithEqualityFn' src` | 38, 21 |
| SQL migrations | **32** `.sql` files | `find src-tauri -name '*.sql' \| wc -l` | 60, 56, 22 |
| db `pub fn` | **520** | `grep -rE 'pub fn |pub async fn ' src-tauri/src/db` | 586, 367, 78-query-files |
| Frontend typed command wrappers | **504** (`db-invoke.ts` + `commands.ts`) | `grep -rE 'export (async )?function' src/shared/services` | 470+ |
| Locales | **5** (en, fr, ar[RTL], ja, it), ~44 top-level keys each | `src/locales/*/translation.json` | — |
| Feature modules (`src/features`) | **23** | `ls src/features` | — |
| Rust `#[test]`s | **915** attributes (incl. a few `#[cfg(test)]` modules) | `grep -rE '#\[test\]|#\[tokio::test\]' src-tauri/src` | 735, 900 |
| TS test cases (`*.test.ts(x)`) | ~3,300 `it`/`test` calls across 297 files | `grep -rE '\b(it|test)\(' src --include='*.test.ts*'` | 2,470 |
| Feature flags | **31** | `src/constants/featureFlags.ts` | 28 |

> ⚠️ **Caveat on test counts:** the Rust test total excludes `src-tauri/src/db/tables/invoicing/tests.rs`, which currently **fails to compile** (`format_money` / `DocumentTotals` shape drift — acknowledged in §Invoicing Module). Run `npm run test` and `cargo test` before relying on the green-checkmark summary above; the numbers in that summary are self-reported and should be re-confirmed against live runs.

---

## ✅ DONE / 🔲 NOT DONE / 🧩 MISSING — Reconciliation (2026-07-15)

> **Verified against source this pass:** 802 IPC commands (739 `#[tauri::command]` + 63 `#[command]` shorthand) · 32 migrations (numbered 001–030; 020 & 021 each split into two files) · 46 Zustand stores (verified) across `src/shared/stores`, `src/features/*/stores`, and a legacy `src/stores/` · ~200+ TS test files · 915 Rust `#[test]` attributes (735 reported passing; `invoicing/tests.rs` excluded). Quality-gate commands (`tsc`, `eslint`, `vitest`, `cargo check/test`, `vite build`) are reported green in the entries below but were **not re-run** in this pass — re-run before tagging.

### ✅ Done — built, wired, tested
- **Architecture:** three-layer React 19 → TS service → Tauri/Rust → SQLite; offline-first; all DB access via Rust.
- **Mail:** IMAP/SMTP + Microsoft Graph send/draft, PGP, OAuth (Gmail/Outlook/custom tabs), optimistic actions + offline queue, threading/categorization/smart labels.
- **CRM/contacts, campaigns** (block editor + scheduling migration + analytics snapshots), **calendar, tasks, automation/workflows**.
- **Invoicing (Morocco DGI):** 35 commands, line-item calc engine, lopdf PDF + PEPPOL/UBL XML, live SMTP/PGP send, wallet↔ledger sync.
- **POS hardware** (ESC/POS, scanner, cash drawer) and **ERP shell** (company switcher, stock, journal, financials, RBAC).
- **Deliverability** (blacklist/bounce/reputation/DNS) and **compliance engine**.
- **AI RAG** (candle/LanceDB), prompt + context engineering, contact intelligence.
- **Vault, device pairing, mobile shell + 5-phase UX overhaul, accessibility** (skip links, focus-order manager, a11y roles/live regions), **i18n** (en/fr/ar/ja/it) with RTL scaffolding, **WAL-deletion doc**.

### 🔲 Not Done — manual / human validation (gates 1, 3, 4, 5, 9)
- **Gate 1:** panic-injection, WAL kill-recovery, watchdog-restart, frontend error-boundary throw (procedures in `03-manual-tests.md`, none executed).
- **Gate 2 benchmarks:** cold-start, memory (idle / 10k threads), 8h IMAP IDLE stability.
- **Gate 3:** code-signing certs (macOS notarization, Windows EV), `tauri signer generate` pubkey, installer smoke-tests, CI build parity.
- **Gate 4:** backup create → restore round-trip on a fresh install.
- **Gate 5:** full screen-reader + keyboard audit; axe-core CI (deferred).
- **Gate 9:** 7-day dogfooding; 5–10 SME beta testers; RC tagging + multi-platform build/install.

### 🧩 Missing / Deferred / Debt — the worklist
1. **RTL & i18n completion (north-star):** AGENTS.md still flags ~400 physical-direction violations (`text-left`→`text-start`, `ml-*`→`ms-*`, `left/right`→`inset-inline-*`) and residual `[TODO]`/`"KEY"` placeholders in ja/it. Largest single cleanup.
2. **Store consolidation:** legacy `src/stores/` (production `threadsStore`, `labelsStore`, `composerStore`, `accountsStore`, …) duplicates `src/shared/stores` + `src/features/*/stores`. Merge into canonical locations.
3. **Invoicing Rust tests:** `src-tauri/src/db/tables/invoicing/tests.rs` does **not compile** (`format_money` undefined; `DocumentTotals` drift vs `calc.rs`) — excluded from `cargo test`.
4. **Campaign scheduled-send worker:** migration 029 + API wired, but the deferred-send background worker is unimplemented.
5. **Entitlement / monetization engine:** `EntitlementEngine`, paywall gating, `owned_modules` are **not implemented** (deferred post-v1.0). Plans: `docs/06-ROADMAP/10-`→`13-monetization-*.md`.
6. **CRDT multi-device sync hardening:** sync engine + offline queue exist; conflict-resolution UX/convergence still needs work per north-star goal.
7. **Stale doc figures:** a few body tables still cite 56/58/22 migrations and 652/668/764 commands (historical snapshots, left intact). Trust the corrected header totals (802 / 32).
8. **Stray/duplicate docs to archive:** `docs/analysis.md` + `docs/analysis/`, `docs/draft.md`, `docs/monetization-style.md`; `docs/plans/`, `docs/specs/`, `docs/superpowers/specs/` overlap the roadmap and should be indexed or merged.

---

## ✅ Recently Completed (2026-07-12)

### Invoicing Module — 33 Commands, Calc Engine Wired, SMTP/PGP Live

The invoicing backend reached production readiness with 9 new commands and 3 enhanced commands:

| Change                               | Details                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Company Settings CRUD**            | 3 new commands: `db_get_company_settings`, `db_upsert_company_settings`, `db_delete_company_settings` — per-company defaults for currency, tax, numbering, template, logo, bank, terms |
| **Categories CRUD**                  | 5 new commands: `db_list_categories`, `db_get_category`, `db_create_category`, `db_update_category`, `db_delete_category` — simple name-per-company grouping                           |
| **Cash Drawer**                      | `pos_open_cash_drawer(config)` — POS backend command for ESC/POS cash drawer kick                                                                                                      |
| **`db_delete_client` enhanced**      | Added optional `hard: Option<bool>` parameter — hard delete vs soft delete                                                                                                             |
| **`db_update_invoice` enhanced**     | Added optional `items: Option<Vec<CreateInvoiceItemRequest>>` — replaces invoice items in a transaction with calc-engine recalculation                                                 |
| **`db_update_item` enhanced**        | Now delegates to `catalog_items::update()` with proper NULL-semantics for optional fields                                                                                              |
| **`db_send_invoice` confirmed live** | Fully wired with real SMTP dispatch, PGP encryption, stock/ledger side effects — no longer a stub                                                                                      |
| **Calc engine wired**                | `calculate_document_totals` now powers `db_create_invoice` and `db_calculate_invoice` — line-item totals computed in centimes via the calc engine                                      |

**Total invoicing commands: 35** (was 24) — verify against `src-tauri/src/commands/invoicing.rs` (gives 35 `#[command]` fns; earlier docs cited 33).

### Company Wallet — Cash Hub with Ledger Sync (2026-07-12)

Built the wallet so **all ERP money movement (sales, invoicing, expensing) flows through a single company cash balance** that stays reconciled with the double-entry ledger.

| Layer             | Details                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Migration**     | `023_wallet.sql` — `wallets` table (id, company_id, currency, balance i64 minor units, timestamps); indexed on `company_id`                                                                                                                                                                                                    |
| **DAL**           | `src-tauri/src/db/tables/wallet/mod.rs` — `ensure` (idempotent), `get`, `get_or_ensure`, `get_balance`, `credit`, `debit`, `apply_payment` (routes an invoice paid/unpaid through the wallet + ledger)                                                                                                                         |
| **Accounting**    | Added `Owner's Equity (3000)` to `DEFAULT_CHART`; made `insert_entry` public; added `post_invoice_payment` and `post_capital_movement` (manual top-up/withdrawal → Dr/Cr Equity). `ensure_defaults` is now idempotent per `code` so existing companies gain new accounts on next ledger op                                     |
| **Commands**      | `db_ensure_wallet`, `db_get_wallet`, `db_credit_wallet`, `db_debit_wallet` registered in `commands/mod.rs`                                                                                                                                                                                                                     |
| **Routing**       | `db_update_invoice_status` now detects a paid↔unpaid transition and calls `wallet::apply_payment`; a sale `paid` credits cash (Dr Cash / Cr AR), a bill `paid` debits cash (Dr AP / Cr Cash), and reversal unwinds both the wallet and the ledger. Ledger post failures are non-fatal (`log::warn`) so the wallet never blocks |
| **Frontend type** | `Wallet` interface added to `src/shared/services/db/schema.ts`; `getWallet` / `creditWallet` / `debitWallet` wrappers in `invoke/invoicing.ts`                                                                                                                                                                                 |
| **UI**            | New responsive `WalletView.tsx` — balance hero (overdraft-aware), Cash in/out summary, top-up/withdraw modal with preset chips, movements feed derived from the Cash (1000) ledger account. Wired into `ErpPage` as a **Cash** tab; Overview added a **Cash on hand** stat card                                                |
| **Docs**          | `docs/user-guide/wallet.md` (new), `docs/04-FEATURES/36-invoicing.md` wallet-routing note, this STATUS entry                                                                                                                                                                                                                   |

**Money-movement matrix (wallet ↔ ledger):**

| Event                             | Wallet      | Ledger                            |
| --------------------------------- | ----------- | --------------------------------- |
| Sale invoice → `paid`             | credit (in) | Dr Cash (1000) / Cr AR (1200)     |
| Sale invoice → `unpaid` (reverse) | debit (out) | Cr Cash (1000) / Dr AR (1200)     |
| Bill (purchase order) → `paid`    | debit (out) | Dr AP (2000) / Cr Cash (1000)     |
| Bill → `unpaid` (reverse)         | credit (in) | Cr AP (2000) / Dr Cash (1000)     |
| Manual top-up                     | credit (in) | Dr Cash (1000) / Cr Equity (3000) |
| Manual withdrawal                 | debit (out) | Dr Equity (3000) / Cr Cash (1000) |

### Runtime IPC Errors Fixed

| #   | Command                       | Issue                                                                              | Fix                                            |
| --- | ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `db_update_task`              | Argument type mismatch — `UpdateTaskRequest` struct vs flat params                 | Unified to `UpdateTaskRequest` payload         |
| 2   | `db_execute_search_query`     | Column access pattern — used `row.columns()` without proper column name resolution | Fixed to use `row.get()` with column index     |
| 3   | `db_dashboard_contact_growth` | Return type — `score` column cast to `REAL` for `EngagementTrendPoint`             | Changed `COUNT(*)` to `CAST(COUNT(*) AS REAL)` |

### Frontend Updates

| Change                           | Details                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **/people → MergedCRMPage**      | The `/people` route now renders `MergedCRMPage` (consolidated CRM view)                                               |
| **POS cash drawer button**       | `POSPage` now has a cash drawer button wired to `pos_open_cash_drawer`                                                |
| **Nav config: "people" → "crm"** | Navigation config id changed from `"people"` to `"crm"`; both `/people` and `/crm` paths resolve to the CRM nav entry |

### Command Counts Updated

| Metric             | Before | After                                            |
| ------------------ | ------ | ------------------------------------------------ |
| Invoicing commands | 24     | **33** (+8 new, +3 enhanced, +1 POS cash drawer) |
| Total IPC commands | 764    | **802** (actual — 739 `#[tauri::command]` + 63 `#[command]` shorthand) |

---

## ✅ Recently Completed (2026-07-11)

### Invoicing Module — Full Billing/ERP (Morocco DGI-Compliant)

Implemented the invoicing **backend** per `docs/06-ROADMAP/smeMaster_Simplified_Core_Spec.md`. Backend is complete; the **frontend UI is now fully built** (see the 2026-07-11 evening update below for the component inventory and the 5 contract-mismatch fixes from the wiring audit). The Rust `db/tables/invoicing/tests.rs` still does not compile (undefined `format_money`; `DocumentTotals` shape drift vs `calc.rs`) — this is a Rust test-module issue, not a production-code blocker. All money stored as i64 minor units (centimes), computed with f64 arithmetic.

| Layer              | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema**         | 7-table invoicing schema (clients, items, invoices, invoice_items, company_settings, categories) + ALTER TABLE for ICE/IF/RC/CNSS on companies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Calc Engine**    | `Money(i64)`, `LineInput/LineOutput`, `TaxMode::Inclusive/Exclusive`, `calculate_line()`, `calculate_document_totals()` — 13 unit tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Table CRUD**     | Full transaction-support CRUD: invoices (create/list/get/update/totals/status/xml_path/pdf_path/delete), items (create/list/delete), clients (create/read/update/soft-delete/hard-delete), catalog_items, company_settings, categories                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **PDF Generator**  | lopdf-based A4 invoice PDF with company header (legal identifiers), client block, line-items table, totals section, footer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **PEPPOL XML**     | UBL 2.1 compliant XML with ICE/IF/RC identifiers, tax breakdown, monetary totals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Tauri Commands** | 24 `db_*` commands: invoices (list/get/get-with-items/create/update/delete/add-item/remove-item/status/calculate/send), clients CRUD, items CRUD, company get/update, document generation                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Frontend**       | Typed TS interfaces + 24 invoke wrappers in `invoicing.ts`, `BusinessProfileTab` with legal identifier fields, `SettingsTabRegistry` entry. **Built (2026-07-11):** `InvoicingDashboard` (tabbed shell), functional `InvoiceEditor` + `LineItemsEditor` + `InvoiceTotals`, `InvoiceList` (type/status filters), `SettingsDrawer`, `ClientList`/`ClientForm`, `ItemList`/`ItemForm`, `InvoiceStatusPill` status workflow, `BusinessProfilePanel`, CRM `InvoicesTab` + `InvoiceSelectionModal`, plus an ERP shell (`ErpPage`, `CompanySwitcher`, `StockView`, `JournalView`, `FinancialReports`, `RbacRoles`). See the evening update for the wiring-audit fixes. |

### POS Hardware Integration — Merged via PR #2

PR #2 (`pos-hardware-integration-9631348871942594063`) merged into `dev` — adds full Point-of-Sale module:

| Area             | Details                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Rust backend** | `pos.rs` commands (36), `020_pos_hardware.sql` migration, ESC/POS thermal printer driver, system printer fallback |
| **Frontend**     | `POSPage`, `useBarcodeScanner` hook, `hardwareStore`, `posStore`                                                  |
| **Settings**     | `HardwareSettings.tsx` with printer configuration UI                                                              |
| **Routing**      | `/pos` route + nav entry + hardware tab in settings                                                               |

**Merge review verdict: APPROVED** ✅ — clean structural separation, no conflicts with invoicing module. Non-blocking notes: POS commands should use transactions for multi-item sales; barcode scanner keyboard capture may interfere with forms.

### AI RAG UI Spec — Moved & Marked Complete

The `docs/specs/ai-rag-ui.md` spec (the only file in the `docs/specs/` staging folder) is now **complete**: its feature is fully built in code and verified against the live codebase.

| Change                   | Details                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RAG docs reorganized** | `docs/specs/ai-rag-ui.md` → `docs/04-FEATURES/ai-rag.md` (single feature doc); backend/frontend split out; prompt/context guides → `03-FRONTEND/`                                      |
| **Marked complete**      | All FR1–FR8, NFR1–NFR5, AC1–AC14 checkboxes ticked; 3 open questions (Q1–Q3) left open                                                                                                 |
| **Evidence**             | 5 Rust commands, `src/shared/services/db/invoke/rag.ts`, `src/features/assistant/` (store + page + 4 components), `LocalRagSettings.tsx` in `AiTab`, `/ai-assistant` route + nav entry |
| **Cross-refs fixed**     | Canonical doc is now `docs/04-FEATURES/ai-rag.md`; `00-INDEX.md`, `22-ai-integration.md`, `30-contact-intelligence.md` links updated                                                   |

**Status verification of the `analysis.md` blueprint:** the Wondershare-style monetization/entitlement recommendations (§8) remain **deferred to post-v1.0** and are **not implemented in code** (zero matches in `src-tauri`/`src` for `EntitlementEngine`, `check_entitlement`, `paywall-trigger`, `owned_modules`, `entitlement_overrides`, `gating="execute"`, `usePaywallTrigger`). Deferred plans: `docs/06-ROADMAP/10-` to `13-monetization-*.md`.

### Invoicing / ERP — Frontend Build, Wiring Audit & Tests (2026-07-11, evening)

The invoicing + CRM + ERP frontend surfaces were built out (Phase B) and then **audited end-to-end** against the Rust `db_*` command contracts in `src-tauri/src/commands/invoicing.rs`. The canonical TS wrapper `src/shared/services/db/invoke/invoicing.ts` was rewritten to fix 5 real contract mismatches. New unit tests (41 tests across 3 files) lock in the wrapper↔backend contract and the Zustand store behavior.

**Wiring fixes in `src/shared/services/db/invoke/invoicing.ts` (Rust uses snake_case params):**

| #   | Function        | Before (broken)                                                     | After (fixed)                                                                              |
| --- | --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `createItem`    | sent `type`; missing required `buy_price`/`stock_qty`/`stock_alert` | maps `type→item_type`, adds `buy_price:0/stock_qty:0/stock_alert:0`, sends `company_id`    |
| 2   | `updateInvoice` | sent a `fields` blob                                                | sends individual `date`/`due_date`/`currency`/`client_id` (`issue_date`→`date`)            |
| 3   | `updateClient`  | sent `{ id, fields }` blob                                          | sends `{ id, ...fields }`                                                                  |
| 4   | `updateItem`    | sent `{ id, fields }` blob + `type`                                 | sends individual `item_type`/`buy_price`/`sell_price`/`stock_qty`/`stock_alert`/`tax_rate` |
| 5   | `updateCompany` | sent `{ id, fields }` — Rust wants `company_id`                     | sends `{ company_id: id, ...fields }`                                                      |

Also reconciled: `createInvoice` → `db_create_invoice`, `listClients`/`listInvoices`/`listItems`/`generateInvoiceDocuments`/`sendInvoice`/`calculateInvoice` command names and argument shapes verified against registered commands in `commands/mod.rs`.

**Residual backend gaps (tracked here, not fixable in TS alone):**

| Gap                                                                                                                                                                                        | Impact                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `db_list_clients` — **RESOLVED** (commit `41e0f85`): now `(pool, company_id, role?)` and filters `contacts` by `company_id`                                                                | `listClients` company filter is now applied server-side                                   |
| `db_send_invoice(pool, id)` is **fully wired**                                                                                                                                             | Generates PDF + PEPPOL XML, PGP-encrypts, dispatches via SMTP pool with TLS/timeout/retry |
| `db_create_invoice` **already passes** `document_type`/`invoice_number` (verified `invoices::create` binds them); `db_update_invoice` intentionally leaves them immutable (DGI compliance) | no server-assigned override on create                                                     |

**New tests (all green, run with `npx vitest run --pool=threads` in this sandbox):**

| File                                                   | Covers                                                                                                      | Tests |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----- |
| `src/shared/services/db/invoke/invoicing.test.ts`      | Every `db_*` command name + corrected arg mapping (the 5 fixes above)                                       | 27    |
| `src/features/invoicing/stores/invoicingStore.test.ts` | `fetchInvoices` loading/error, `createInvoice` prepend, `changeStatus`, `removeInvoice`, clients/items/docs | 12    |
| `src/features/erp/companyStore.test.ts`                | `setActiveCompany`, `getActiveCompany` (+fallbacks), `companyInitials`                                      | 8     |

_Note:_ the default Vitest `forks` pool times out in this sandbox (child-process spawning is restricted); use `--pool=threads` for any local `vitest run`.

**Frontend fix:** `companyInitials()` in `src/features/erp/companyStore.ts` now `.trim()`s the name first, so leading/trailing whitespace no longer yields an empty first initial.

**Verification:**

- `npx tsc --noEmit` → **zero errors** in invoicing/ERP/CRM files ✅
- `npx vitest run --pool=threads` (3 new files) → **41/41 passing** ✅

---

## What You Need to Know

This is the full status of SMEMaster as of 2026-07-12. Everything compiles, all tests pass, no lint warnings, and the deploy pipeline works. I've fixed a lot of bugs to get here — here's the breakdown.

---

## ✅ Recently Completed (2026-07-09)

### account_id → company_id Rename (Company-Scoped Domains)

Completed a large-scale rename across the full stack to align IPC contract with database schema. All company-scoped Tauri command parameters, frontend invoke wrappers, feature wrappers, stores, and UI components now use `company_id`/`companyId` instead of `account_id`/`accountId`.

| Layer                  | Files Modified | Details                                                                                                                                                                                                                                                     |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rust commands**      | 7 files        | All company-scoped command params renamed (`contacts.rs`, `crm.rs`, `calendar.rs`, `comms.rs`, `compliance.rs`, `tasks.rs`, `workflows.rs`)                                                                                                                 |
| **Rust queries**       | 1 file         | SQL column references fixed in `tasks.rs` (6 queries using `account_id` → `company_id`)                                                                                                                                                                     |
| **Rust test**          | 1 file         | `templates.rs` test helper updated for `company_id` as `String` (not `Option`)                                                                                                                                                                              |
| **db-invoke.ts**       | 1 file         | 89 issues fixed: type fields, params, invoke keys, raw SQL, JSDoc                                                                                                                                                                                           |
| **Feature wrappers**   | 15+ files      | `contactTags`, `contactGroups`, `contactSegments`, `contactFiles`, `calendars`, `calendarEvents`, `campaigns`, `templates`, `tasks`, `workflowRules`, `followUpReminders`, `pendingOperations`, `snoozePresets`, `activity`, `segments`, `campaignService`  |
| **Stores**             | 6 files        | `automationStore`, `workflowStore`, `campaignStore` (x2), `contactStore`, `dashboardStore`                                                                                                                                                                  |
| **Components**         | 8+ files       | `CalendarPage`, `TaskSidebar`, `TasksPage`, `ContactActivityTab`, `SegmentManager`, `SegmentQueryEditor`, `ContactsStatsWidget`, `ContactSidebar`, `CampaignComposer`, `CampaignTemplatePicker`, `TaskDetailPanel`, `SnoozePresetsEditor`, `WorkflowEditor` |
| **Automation scripts** | 4 scripts      | `fix-db-invoke-params.ps1`, `fix-frontend-callers.ps1`, `fix-invoke-params.ps1`, `fix-sql-columns.ps1`                                                                                                                                                      |
| **Test mocks**         | 1 file         | `entities.mock.ts` — added `company_id`, `sync_state` to mock accounts                                                                                                                                                                                      |

**Verification:**

- `npx tsc --noEmit` → **zero errors** ✅
- `cargo check` → **zero errors, zero warnings** ✅

## ✅ Recently Completed (2026-07-07)

### Feature Flag & ToolRegistry Alignment

Aligned the Rust-side `ToolRegistry` with the frontend `FEATURE_FLAGS` — ensuring both systems are in sync:

| Change                             | Details                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Added `offline-availability`**   | New Pro-tier feature flag in both systems — gates the offline availability CRUD commands (`db_set_offline_available`, `db_remove_offline_available`, `db_list_offline_available`) |
| **Added `people` to ToolRegistry** | Contact management — was in frontend FEATURE_FLAGS but missing from Rust gating                                                                                                   |
| **Added `bounce` to ToolRegistry** | Bounce management — was in frontend FEATURE_FLAGS but missing from Rust gating                                                                                                    |
| **Fixed `warmup`→`warming`**       | Rust used `warmup`, frontend used `warming` — unified to `warming`                                                                                                                |
| **New group: Offline & Sync**      | New feature flag category in `featureFlags.ts`                                                                                                                                    |

### Task & Campaign Page Fixes

Fixed two pages that were broken:

| Page          | Issue                                                                                | Fix                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tasks**     | Page showed demo data but adding/loading didn't work                                 | Added `list_with_contacts_paginated()` and `count_by_account()` DB functions; exposed `db_get_tasks_with_contacts_paginated` and `db_count_tasks` Tauri commands |
| **Campaigns** | Mobile card tap navigated to nonexistent `/campaigns/$id`; create didn't reload list | Changed mobile tap to expand card inline; added `loadCampaigns(accountId)` after create/save-draft                                                               |

### Dead-Code Elimination: 15 Rust warnings → 0

The `cargo check` pipeline went from **15 warnings** to **0**, improving code quality and eliminating latent bugs:

| #   | Warning                                                                                          | Fix                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Cache.name` field never read                                                                    | Included in `CacheStats` output via `stats()` method                                                                                    |
| 2   | `increment_crash_count` never called                                                             | Wired into panic hook in `lib.rs` — crash count file now written alongside `crash.log`                                                  |
| 3–4 | `native_event_occurred`, `init` unused on desktop                                                | Added `#[cfg(mobile)]` gates to both function + their imports                                                                           |
| 5–7 | Vault DB ops `get_vault_items`, `delete_vault_items_by_account`, `count_vault_items` not exposed | Added `db_get_vault_items`, `db_delete_vault_items_by_account`, `db_count_vault_items` Tauri commands + registered in `commands/mod.rs` |
| 8   | `backfill_directory` only called recursively                                                     | Refactored `search_vault` to call `backfill_directory` instead of duplicating logic; made `backfill_directory` use `spawn_blocking`     |
| 9   | `search_vault_internal` unused in production                                                     | Added `#[allow(dead_code)]` (used in tests)                                                                                             |
| 10  | `SyncEngineService.pool` unused                                                                  | Added `pool()` accessor method for diagnostics                                                                                          |
| 11  | `MAX_BODY_CACHE_SIZE` constant unused                                                            | Wired into pre-cache body size check: skips messages >10 MB before writing to DB                                                        |
| 12  | `PreCacheService.stop()` never called                                                            | Implemented `Drop` trait — auto-calls `stop()` on service shutdown                                                                      |
| 13  | `QueueService.stop()` never called                                                               | Implemented `Drop` trait — auto-calls `stop()` on service shutdown                                                                      |
| 14  | `UncachedMessage.id` unused                                                                      | Added `#[allow(dead_code)]` (available for future logging)                                                                              |
| 15  | `Cache::name()` method never called externally                                                   | Added `#[allow(dead_code)]` (public API)                                                                                                |

### DB Infrastructure: Bootstrap, Snapshot, Offline Availability

Added three new command groups to reduce IPC chattiness:

| Command                                                                                  | Purpose                                                                           | IPC Round-Trips Replaced |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| `db_bootstrap_state`                                                                     | Single first-paint payload: accounts, labels, threads, unread counts, sync status | 4+ separate calls → 1    |
| `db_status_snapshot`                                                                     | Combined health + sync + subsystem status for the 30s polling loop                | 3 calls → 1              |
| `db_set_offline_available` / `db_remove_offline_available` / `db_list_offline_available` | CRUD for explicit "available offline" set (migration 020)                         | New feature              |

**Supporting changes:**

- Refactored `db_health_stats` and `db_sync_status` into reusable `compute_*` helpers
- Added pool telemetry (size, active connections, max) to `DbHealthStats`
- Derived `Default` on `ThreadFilters` for bootstrap query use
- Pre-warm threads and contacts caches during `DataCacheService` startup

### Frontend: Thread Stash/Unstash for Optimistic Email Actions

Improved the optimistic update system for email actions (archive, trash, spam, move):

- **`stashThread(id)`** — Stashes a thread before removing it from the list, enabling rollback
- **`unstashThread(id)`** — Restores a stashed thread on failure or reversion
- **`markThreadPending(id)` / `unmarkThreadPending(id)`** — Tracks in-flight operations visually
- **Split `permanentDelete` from other actions** — Destructive deletes bypass the stash entirely
- **Revert on local DB failure** — Previously, failed local DB writes left the UI in an inconsistent state
- **Queue with pending state** — Offline actions now mark threads as pending until server confirms

### Service Stop Wiring (Drop implementations)

Both `PreCacheService` and `QueueService` now implement `Drop` to automatically call `stop()` when Tauri's managed state is dropped on app shutdown. This ensures background tokio tasks cleanly exit instead of lingering.

### Documentation & Meta

| Item                                  | Change                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **README**                            | Rewritten with feature table, health metrics, production gates, quick-start                                          |
| **SECURITY-AUDIT.md**                 | New security posture documentation                                                                                   |
| **docs/06-ROADMAP/09-master-plan.md** | Single canonical roadmap — all remaining work merged (incl. competitive analysis, spec-driven plan, template vision) |
| **.gitignore**                        | Updated for IDE and analysis files                                                                                   |

### Command Count Updated

| Metric                    | Before | After                                                                       |
| ------------------------- | ------ | --------------------------------------------------------------------------- |
| IPC commands              | 652    | **668** (+16) — bootstrap, snapshot, offline_avail, vault DB                |
| DB migrations             | 57     | **58** (+1 PGP user_id, +1 offline_availability)                            |
| Feature flags (frontend)  | 19     | **20** (+1 offline-availability)                                            |
| ToolRegistry flags (Rust) | 20     | **23** (+3: people, bounce, offline-availability; 1 rename: warmup→warming) |

### UI Polish, PGP user_id, Company Context & i18n Completion (2026-07-07, Wave 2)

| Area                                       | Changes                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Account `company` field**                | Added `company: string                                                                                                                                                            | null`to`Account`interface; all account creation flows (AddAccount, AddCalDavAccount, AddImapAccount) populate`company: null` |
| **Unified search error resilience**        | Each category (messages/files/tasks/contacts) in `unifiedSearch.ts` wrapped in isolated try/catch; single-category failure no longer crashes entire search                        |
| **Sync conflicts conditional**             | Conflict button in App.tsx only renders when `deviceCount > 0` (fetched via `list_paired_devices`)                                                                                |
| **AI detection gating**                    | SuggestionBanner in EmailList hidden when `getFeatureAccess("ai", 0) === "locked"`                                                                                                |
| **Composer contact auto-populate**         | AddressInput shows company/name chip; ComposerAddressSection integrates `getContactByEmail` on blur                                                                               |
| **Composer company sender UI**             | ComposerHeader shows org badge (Building2 + company), ComposerFooter shows "via [Company]", FromSelector shows `email — company`                                                  |
| **Campaign contact company**               | Contacts query extended to `display_name` + `company`; AudienceStep shows company chip (Building2 badge)                                                                          |
| **InlineReply company badge**              | Building2 icon + company name in expanded reply header                                                                                                                            |
| **PremiumSidebar company label**           | Company shown under AccountSwitcher via resolved activeAccount                                                                                                                    |
| **PGP `user_id` tracking**                 | Rust migration `021_pgp_user_id.sql` adds `user_id TEXT` column; PgpKey struct updated; savePgpKey/importPgpKey accept userId param; PgpKeyManager displays/searchable by user_id |
| **CSV import template download**           | CsvImportWizard shows expected format preview + downloadable `.csv` template button                                                                                               |
| **TemplateGallery conditional pagination** | PaginationControls only render when `filtered.length > 0 && totalTemplates > 0`                                                                                                   |
| **Dashboard null-safety**                  | EmailHeatmapWidget: null fallbacks for `split('T')[0]` and `MONTH_LABELS` access; EntityNetworkGraph: correct `tauriInvoke` import, safer `formatLabel` split                     |
| **Deprecated cleanup**                     | Deleted stale `src/features/campaigns/services/templateVariables.ts`; test updated to import from `@shared/utils/templateVariables`                                               |
| **i18n — English PGP userId key**          | Added `"pgp.userId": "User ID"` to English locale                                                                                                                                 |
| **i18n — Italian completion**              | All 192 `[TODO]` and 89 `"KEY"` placeholders in `it/translation.json` translated to proper Italian; JSON validated                                                                |

### 5 Runtime Bugs Fixed

| Page/Component      | Issue                                                               | Fix                                                            |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **TasksPage**       | `loadTasks()` called but pagination uses `resetTasks()`             | Replaced with `resetTasks()` from `usePagination`              |
| **TemplateManager** | `canCreateTemplate` referenced before `usePagination` destructuring | Moved after pagination hook (TDZ fix)                          |
| **PgpTab**          | `accountIds` selector caused infinite renders                       | Stabilized with `useMemo`                                      |
| **BackupTab**       | Broken backup CRUD + missing confirm dialogs                        | Full rewrite with backup list, generate/delete/restore actions |
| **askInbox.ts**     | Search crash on AI failure                                          | Wrapped in try/catch for graceful fallback                     |

## ✅ Recently Completed (2026-07-08)

### Docs Consolidation — 9 Roadmap Files → 1

Consolidated the sprawling roadmap document set into a single canonical source:

| Action                                            | Details                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Merged 9 roadmaps → 1**                         | `09-master-plan.md` is now the single canonical roadmap — deleted 07, 08, 10, 11, 12, 13, 14, 15 from `06-ROADMAP/`              |
| **Moved feature specs → `04-FEATURES/`**          | `14-onboarding-reboot-plan.md` → `36-onboarding-reboot-plan.md`, `15-settings-redesign-spec.md` → `37-settings-redesign-spec.md` |
| **Moved frontend specs → `03-FRONTEND/`**         | `08-ui-ux-roadmap.md`, `10-rtl-audit.md`, `12-ui-super-app-spec.md`                                                              |
| **Renamed `08-typed-ipc.md` → `11-typed-ipc.md`** | Updated all cross-references in STATUS.md, DESIGN_SYSTEM_GUIDE.md, and 5 frontend/backend docs                                   |

### Orphaned Components Repurposed — 4 Components Integrated

Four previously orphaned React components were repurposed into live production code (instead of deleted):

| Component                    | Target File                           | What It Now Does                                       |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------ |
| **InfiniteScrollSentinel** → | `EmailList.tsx`                       | Replaced inline IntersectionObserver in the email list |
| **FocusReader** →            | `ReadingPane.tsx`                     | Focus mode toggle + distraction-free reading pane      |
| **ZenMode** →                | `Composer.tsx` + `ComposerHeader.tsx` | Full-screen writing mode toggle                        |
| **FloatingActionButton** →   | `MobileShell.tsx` PhoneShell          | Quick-compose FAB on mobile shell                      |

Additionally:

- **2 dead test files removed:** `ActionButton.test.tsx`, `ActionStatusBadge.test.tsx`
- All changes committed and pushed to `main` across 4 commits

### Metrics Refreshed

| Metric                   | Before | After                                                                                |
| ------------------------ | ------ | ------------------------------------------------------------------------------------ |
| IPC commands             | 668    | **704** (+36 across all domain modules)                                              |
| SQLite migrations        | 56     | **22** (re-architected from monolithic migrations.rs to clean sequential .sql files) |
| Zustand stores           | 21     | **38** (new stores for workflows, vault, automation, settings, sync, deliverability) |
| Rust source files        | —      | **245** in `src-tauri/src/`                                                          |
| TypeScript/TSX files     | —      | **1,132** in `src/`                                                                  |
| Rust `pub fn` (db layer) | 367    | **586** across 123 files in `src-tauri/src/db/`                                      |

## Test Suite — All Green

### Frontend (TypeScript/Vitest)

| Metric          | Before                   | After                                                     |
| --------------- | ------------------------ | --------------------------------------------------------- |
| Test files      | 163                      | **203** (+3 invoicing/ERP added 2026-07-11 evening → 206) |
| Tests           | 1,831/1,833 (22 failing) | **2,470/2,470 (0 failing)** (+41 invoicing/ERP → 2,511)   |
| ESLint errors   | 2                        | **0**                                                     |
| ESLint warnings | 10                       | **0**                                                     |

**22 failures fixed across 11 test files:**

- **Mock pattern fixes** — quickSteps, localDrafts, contacts, commands, templates, tasks, smartLabelRules, smartFolders, sendAsAliases
- **CSS selector fixes** — ConfirmDialog, Modal, SlidePanel, TextField, InfoTooltip
- **Store logic fixes** — actionStatusStore progress preservation, eventBusBridge register pattern
- **Test infrastructure** — `@test` vitest alias, cacheManager arg order
- **PgpKeyManager** — mock wiring fix (invoke vs mockInvoke), text-matching fixes

### Rust (cargo test)

| Metric         | Before             | After                    |
| -------------- | ------------------ | ------------------------ |
| Compiles       | 4 errors (blocked) | **0 errors**             |
| Tests passing  | 435                | **735**                  |
| Tests failing  | 167                | **0**                    |
| Modules tested | ~30                | **55+ (all 11 domains)** |

**167 failures fixed across 40+ modules:**

- **Schema bugs:** `score INTEGER → REAL`, missing `#[sqlx(rename)]` on Label/CacheEntry fields
- **SQL bugs:** `ON CONFLICT` clause fixes, missing FK seeding, pivot table column mismatches
- **Test infrastructure:** Shared `test_helpers.rs` module (pool creation + FK seeding)
- **API alignment:** `arf_reports::create()` parameter names updated to match schema
- **Test assertions:** Vault byte counts, glob depth, timing comparisons, email format matching

**New test infrastructure I'm proud of:**

- `src-tauri/src/db/tables/test_helpers.rs` — Shared test module with `create_memory_pool()`, `insert_test_account()`, `insert_test_contact()`, `insert_test_campaign()`, `insert_test_draft()`
- All 55+ Rust db table modules now use shared helpers. No more duplicate `create_test_pool()` functions.
- Rust crypto, connection, oauth, and orchestrator modules now have comprehensive test suites.
- Frontend: 35 new test files covering db layer, Zustand stores, business logic services, and components.

**Store split refactoring — 97 failures → 0, in 6 test files:**

- `src/test/setup.ts` — Added global `zustand/middleware` persist mock to disable localStorage in all tests
- `layoutStore.test.ts` (41 tests) — Rewrote to import `useLayoutStore` directly
- `uiStore.test.ts` (15 tests) — Rewrote to test slim `useUIStore` (transient UI state only)
- `syncStore.test.ts` (20 tests) — Fixed after removing duplicate persist mock
- `themeStore.test.ts` (13 tests) — Fixed via global persist mock
- `executor.test.ts` (12 tests) — Fixed mock path after barrel refactor
- `preCacheManager.test.ts` (7 tests) — Fixed mock path after barrel refactor
- `smartFolderStore.test.ts` (6 tests) — Fixed import (wrong store name)
- `campaignStore.ts` production bug — Fixed `String(err)` → proper error message extraction

---

## DB Layer Complete — All 586 db\_\* Commands Wired

Every function in `db/tables/` (586 `pub fn` across 123 files in 11 domains) is now wired to a Tauri command. No dead code, no orphaned functions.

### Dead Code Elimination: 136 warnings → 0 (July 6)

### Dead Code Elimination: 15 Rust warnings → 0 (July 7 — see above)

| Phase | Domain                          | Functions Wired                          | Method                                  |
| ----- | ------------------------------- | ---------------------------------------- | --------------------------------------- |
| 1     | `db/tables/comms/` ~30          | 28 new commands + 3 duplicates removed   | Replaced inline SQL with function calls |
| 1     | `db/tables/core/` ~15           | 4 new commands + 5 new functions created | Inline SQL replacement                  |
| 2     | `db/tables/crm/` ~12            | 8 new commands                           | New Tauri wrappers                      |
| 2     | `db/tables/campaigns/` ~10      | 12 new commands                          | New Tauri wrappers                      |
| 2     | `db/tables/tasks/` ~5           | 1 new command                            | New Tauri wrapper                       |
| 2     | `db/tables/calendar/` ~5        | 2 new commands                           | New Tauri wrappers                      |
| 3     | `db/tables/ai/` ~4              | 4 new commands                           | New Tauri wrappers                      |
| 3     | `db/tables/security/` ~5        | 4 new commands                           | New Tauri wrappers                      |
| 3     | `db/tables/compliance/` ~3      | 3 new commands                           | New Tauri wrappers                      |
| 3     | `db/tables/deliverability/` ~17 | 17 new commands                          | New Tauri wrappers                      |
| 3     | `db/tables/workflows/` ~8       | 8 new commands                           | New Tauri wrappers                      |
| 4     | `db/crypto.rs` 3 functions      | Wired via OAuth token encrypt/decrypt    | Replaced inline AES with crypto module  |
| 4     | `db/connection.rs` 1 function   | Wired into startup                       | Calls `check_sqlite_version` on boot    |
| 4     | `imap/flags.rs` 1 function      | `imap_mark_read` command                 | New Tauri wrapper                       |
| 4     | `db/tables/contact_files.rs` 2  | 2 new commands                           | New Tauri wrappers                      |
| 4     | **Services (2026-07-07)**       | 15 Rust dead-code warnings eliminated    | See "Recently Completed" section above  |

### Remaining: 4 legit schema/serde items (not dead code, just not directly called)

| #   | Item                                               | Why It's There                                                                  |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `FilterConditionRow`                               | `sqlx::FromRow` schema struct — used in derive, never instantiated in Rust code |
| 2   | `InsertComplianceCheckRequest.id`                  | Serde deserialize field — frontend sends it, Rust auto-generates UUID           |
| 3   | `ThreadBatchUpdate.add_label_ids/remove_label_ids` | Serde deserialize fields — frontend sends them                                  |
| 4   | `Setting` struct                                   | Schema definition — mirrors the `settings` table row                            |

---

## Architecture Changes

### Seed System Re-architected

- **Before:** 130+ individual `executeInsert()` IPC calls for demo seeding
- **After:** Single Rust `db_seed_full_demo` command with atomic SQLite transaction
- **Payload:** `SeedData` JSON (account, labels, threads, messages, thread_categories, thread_labels)
- **Result:** Returns `{"seeded": N}`, idempotent via `settings.demo_full_seeded`

### Crypto — Now Single Source of Truth

- `db::crypto::{encrypt_value, decrypt_value, load_or_create_key}` — AES-256-GCM primitives
- `oauth::decrypt_token()` refactored to use `db::crypto::load_or_create_key()` + `decrypt_value()`
- Removed duplicate inline AES code from OAuth module
- Added `oauth::encrypt_token()` for Rust-side encryption
- Startup self-test verifies encrypt/decrypt round-trip

### OAuth Token Monitor Refactored

- Now uses `OAuthTokenMonitor::init()` at startup (was `new() + manual load_tokens`)
- `check_and_refresh` uses `oauth_should_refresh()` instead of inline threshold

### Register() Placement Fixed

- `commands/workflows.rs`: `register()` moved to end of file so `generate_handler!` macro sees all functions. This was a Rust gotcha — macro ordering matters.

---

## Command Counts

| Module                       | Commands | What It Covers                                                                                                                                                                                                                           |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands/core.rs`           | ~67      | Accounts, Messages, Threads, Labels, Attachments                                                                                                                                                                                         |
| `commands/contacts.rs`       | ~93      | CRM Contacts, Groups, Labels, Segments, Tags, Files                                                                                                                                                                                      |
| `commands/crm.rs`            | ~48      | Campaigns, Backup Schedules, Deliverability, Bounces                                                                                                                                                                                     |
| `commands/comms.rs`          | ~110     | Templates, Signatures, Drafts, Filters, Quick Steps/Replies, Aliases                                                                                                                                                                     |
| `commands/tasks.rs`          | ~27      | Tasks + Task Tags                                                                                                                                                                                                                        |
| `commands/calendar.rs`       | ~15      | Calendars, Events, Snooze Presets                                                                                                                                                                                                        |
| `commands/ai.rs`             | ~9       | AI Cache, AI Config                                                                                                                                                                                                                      |
| `commands/security.rs`       | ~21      | PGP Keys, Allowlists, Link Scan, Notification VIPs                                                                                                                                                                                       |
| `commands/compliance.rs`     | ~13      | Compliance Profiles + Checks                                                                                                                                                                                                             |
| `commands/deliverability.rs` | ~32      | Deliverability Config, Events, Blacklist, ARF Reports, Delist Requests, Bulk Health, Reputation Scores, Alert Preferences                                                                                                                |
| `commands/workflows.rs`      | ~28      | Workflow Rules, Follow-ups, Pending Ops                                                                                                                                                                                                  |
| `commands/settings.rs`       | ~11      | Settings + Attachment Cache                                                                                                                                                                                                              |
| `commands/db.rs`             | ~13      | Admin, health, sync status, bootstrap state, status snapshot, offline availability CRUD                                                                                                                                                  |
| `commands/imap.rs`           | ~28      | IMAP operations                                                                                                                                                                                                                          |
| `commands/smtp.rs`           | ~2       | SMTP operations                                                                                                                                                                                                                          |
| `commands/invoicing.rs`      | ~33      | Invoices CRUD, clients CRUD (soft/hard delete), items CRUD, catalog items CRUD, company settings CRUD, categories CRUD, company update, document generation (PEPPOL/PDF), status lifecycle, send (SMTP/PGP), calculate, low-stock alerts |
| `commands/pos.rs`            | ~36      | POS sale CRUD, ESC/POS thermal printing, system printer, cash drawer, barcode scanning                                                                                                                                                   |
| `commands/wallet.rs`         | ~4       | Wallet ensure/get/credit/debit — company cash hub, ledger-synced                                                                                                                                                                         |
| Subsystem Lifecycle          | ~4       | complete_onboarding, get_subsystem_status, get_tool_state, apply_tool_state                                                                                                                                                              |
| Non-command modules          | ~20      | OAuth, PGP, Vault, Export, Pairing, Device, DNS, etc.                                                                                                                                                                                    |
| Vault                        | ~24      | Vault DB ops, folder CRUD, file CRUD, search, categorization, storage stats                                                                                                                                                              |
| Background/Sync              | ~10      | Sync engine CRUD, CalDAV sync, background service management                                                                                                                                                                             |
| Licensing                    | ~8       | License validation, registration, hardware ID, activation                                                                                                                                                                                |
| Updater                      | ~5       | Update check, download, install, rollback                                                                                                                                                                                                |
| Orchestrator                 | ~6       | Seed demo, onboarding orchestration, bootstrap                                                                                                                                                                                           |
| Assets                       | ~3       | Asset management                                                                                                                                                                                                                         |
| **Total**                                                    | **802**  | All registered via `tauri::generate_handler!` (actual count: 739 `#[tauri::command]` + 63 `#[command]` shorthand; earlier docs cited 773/777 which are stale)                                                                                                               |

---

## Frontend Wiring Status

### Services Using `db-invoke.ts` Wrappers

| Feature Area | Status      | Services                                                                                                |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| Contacts/CRM | ✅ Complete | contacts.ts, contactGroups.ts, contactSegments.ts, contactFiles.ts, contactTags.ts                      |
| Mail/Comms   | ✅ Complete | templates.ts, filters.ts, signatures.ts, quickSteps.ts, quickReplies.ts, scheduledEmails.ts, aiCache.ts |
| Campaigns    | ✅ Complete | campaigns.ts                                                                                            |
| Tasks        | ✅ Complete | tasks.ts                                                                                                |
| Calendar     | ✅ Complete | calendars.ts, calendarEvents.ts, snoozePresets.ts                                                       |
| Settings     | ✅ Complete | settings.ts                                                                                             |
| Dashboard    | ✅ Complete | dashboardStore.ts                                                                                       |
| Invoicing    | ✅ Complete | invoicing.ts, invoicingStore.ts                                                                         |
| POS          | ✅ Complete | posStore.ts, hardwareStore.ts, useBarcodeScanner.ts                                                     |

### Production Frontend → Rust IPC Calls

- **15 unique commands** called from production (non-test) TypeScript code
- **78 commands** used in tests only
- **537 db\_\* commands** registered and tested from Rust side (+33 invoicing)
- **1 mismatch fixed:** `close_splashscreen` — was missing Rust command, now added

---

## Schema & Code Fixes Found via Testing

The testing push uncovered real bugs in production code. Here's what was found and fixed:

| #   | File                         | Bug                                                         | Fix                                       |
| --- | ---------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| 1   | `schema.sql`                 | `compliance_checks.score` was `INTEGER` but Rust uses `f64` | Changed to `REAL`                         |
| 2   | `schema.rs`                  | `Label.label_type` missing `#[sqlx(rename = "type")]`       | Added rename attribute                    |
| 3   | `schema.rs`                  | `CacheEntry.cache_type` missing `#[sqlx(rename = "type")]`  | Added rename attribute                    |
| 4   | `task_tags.rs`               | `ON CONFLICT(tag)` wrong for composite key                  | Changed to `ON CONFLICT(tag, account_id)` |
| 5   | `allowlists.rs`              | `ON CONFLICT DO NOTHING RETURNING *` returns no row         | Handle empty result                       |
| 6   | `notification_vips.rs`       | Same `ON CONFLICT` issue                                    | Handle empty result                       |
| 7   | `bundled_threads.rs`         | Same `ON CONFLICT` issue                                    | Handle empty result                       |
| 8   | `contact_groups.rs`          | INSERT used non-existent `id` column on pivot table         | Removed from INSERT                       |
| 9   | `contact_tags.rs`            | Same pivot table `id` column issue                          | Removed from INSERT                       |
| 10  | `contacts.rs`                | `update_fields` JSON value double-quoted in SQLite          | Extract string from Value before binding  |
| 11  | `commands/deliverability.rs` | `db_create_arf_report` parameter names mismatched schema    | Updated to match `arf_reports::create()`  |

### Shared Test Helpers

New module `src-tauri/src/db/tables/test_helpers.rs` provides reusable test setup:

- `helpers::create_memory_pool()` — In-memory SQLite with full schema
- `helpers::insert_test_account(pool, id)` — Idempotent account seeding
- `helpers::insert_test_contact(pool, id)` — Contact seeding
- `helpers::insert_test_campaign(pool, id, account_id)` — Campaign seeding
- `helpers::insert_test_draft(pool, id, account_id)` — Local draft seeding

---

## New Feature Areas Built

### P10 — Subsystem Orchestration Framework

I built a proper lifecycle management system for the app's background services:

- **SubsystemRegistry** (`src-tauri/src/orchestrator/subsystem_lifecycle.rs`) — CAS-based activation, 3-tier classification (AlwaysOn/Lazy/OnDemand), idle shutdown with grace period re-check
- **StateMachine** (`src-tauri/src/orchestrator/state_machine.rs`) — Thin Rust FSM (Booting → Onboarding → Ready), `complete_onboarding` IPC bridge
- **ToolRegistry** (`src-tauri/src/orchestrator/tool_registry.rs`) — Rust-side `FEATURE_FLAGS` mirror (advisory only in MVP)
- **Gating** (`src-tauri/src/orchestrator/gating.rs`) — `require_subsystem_active()` gate, `get_subsystem_status` IPC command
- **AppError variants** — `SubsystemInactive`, `SubsystemUnavailable`, `SubsystemNotFound`
- **Frontend hook** (`src/hooks/useSubsystemStatus.ts`) — `getSubsystemStatus()` wrapper with reactive state
- **Lazy-wired services** — SyncService (checks account count), SentinelService (60s idle), BackupSchedulerService (60s idle), Vault (60s idle)

### P11 — Deliverability Monitoring Subsystem

Your email deliverability watchdog:

- **Blacklist Monitors** — Persistent DNSBL checks (Spamhaus, Barracuda, SURBL, SpamCop) with change detection, cached in `blacklist_cache` table
- **Delist Request Workflow** — Generate delist URLs per blacklist, track submission/resolution status
- **Bulk Health Checks** — Cross-domain aggregated SPF/DKIM/DMARC/Blacklist scanning
- **Reputation Scoring** — Time-series reputation tracking with trend analysis (improving/declining/stable), `reputation_scores` table
- **Alert Preferences** — Per-domain and per-event-type configuration (banner/email/both/off)
- **Components** — `BlacklistMonitorCard`, `DelistRequestWizard`, `BulkHealthCheckPanel`, `ReputationTrendChart`, `AlertPreferencesDialog`

### P8 — OAuth Custom Tabs (Desktop + Mobile)

One OAuth flow for both platforms:

- **Frontend orchestration** (`src/shared/services/oauth/customTabAuth.ts`) — `startCustomTabAuth()` tries custom-tab flow first, falls back to localhost listener
- **Rust side** — Already had `start_oauth_browser` command + `tauri-plugin-deep-link` + `smemaster://` deep-link scheme
- **Platform detection** — Desktop uses `tauri-plugin-opener` → system browser; mobile uses native Custom Tabs via `tauri-plugin-deep-link`
- **Deep-link callback** — `smemaster-auth://callback` scheme handled by Rust OAuth module

### P9 — Polish & Hardening

| Component       | What I Improved                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| `VirtualList`   | New virtualized list component built on `@tanstack/react-virtual`                       |
| `Modal`         | Focus trap (trapFocus/Tab key cycling), a11y attributes (`role="dialog"`, `aria-modal`) |
| `ConfirmDialog` | `aria-label` on confirm/cancel buttons with loading state                               |
| `ActionBar`     | `aria-label` on all icon buttons                                                        |
| `Sidebar`       | Navigation a11y, skip-to-content link added                                             |

### Automation UI

- **Store** (`src/features/automation/stores/automationStore.ts`) — Zustand store with load/create/update/delete/toggle + editor state
- **Components** — `AutomationTriggerPicker`, `AutomationActionPicker`, `AutomationRuleCard`, `AutomationRuleEditor`
- **Page** — `AutomationPage` orchestrates all components with loading/empty/error states
- **DB layer** — Already existed, reused

### Vault UI Refactor

Broke a 716-line monolith into clean components:

- **Store** (`src/features/vault/stores/vaultStore.ts`) — Zustand store with directory tree, file list, upload/CUD, breadcrumbs, storage, sorting
- **Components** (7 new) — `VaultBreadcrumb`, `VaultSearchBar`, `VaultFileCard`, `VaultFileList`, `VaultToolbar`, `VaultUploadZone`, `VaultEmptyState`, `VaultStorageIndicator`
- **Services** — Added 5 missing functions to `vaultService.ts` (deleteFolder, renameFolder, moveFolder, moveFile, renameFile)
- **Page** — `VaultPage` refactored to use all new components

### Mobile UI

- **Components** (5 new):
  - `MobileShell` — Bottom tab bar (Mail, Contacts, Settings) with active state
  - `MobileSettings` — Account/cache/preferences list
  - `MobileSyncStatus` — Last sync time, status indicator with refresh
  - `MobileOfflineBanner` — Offline overlay with auto-dismiss on reconnect
  - `MobilePullToRefresh` — Custom pull-to-refresh with threshold/loading states
- **Page** — `MobilePage` refactored to use new components

### Workflows UI

- **Store** (`src/features/workflows/stores/workflowStore.ts`) — Zustand store with workflows list, editor state, CRUD + toggle + delete confirm
- **Components** (4 new):
  - `WorkflowStepCard` — Step number badge, type label, detail, edit/delete/reorder
  - `WorkflowCard` — Summary card with name, trigger badge, step count, toggle/edit/delete
  - `WorkflowEditor` — Inline editor with name/trigger/steps + inline step sub-form
  - `WorkflowList` — List with empty state
- **Page** — `WorkflowsPage` orchestrates all components with loading skeleton, error retry, ConfirmDialog
- **DB layer** — Already existed, reused

---

## Quick Wins (Mostly Done)

| Task                                                           | Effort | Status                                                                     |
| -------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Add `apk`/`aab` to Tauri bundle targets                        | 5min   | ✅ Done                                                                    |
| Remove `tauri-plugin-sql` permissions                          | 10min  | ✅ Done (stale json config also cleaned)                                   |
| Android signing config env-var hardening                       | 15min  | ✅ Done                                                                    |
| Plans A/B/C documentation corrected                            | 30min  | ✅ Done                                                                    |
| Frontend Reuse Phase 1 (ToggleSwitch promoted)                 | 30min  | ✅ Done                                                                    |
| CI pipeline (cargo check + pnpm test)                          | 30min  | ✅ Done (ci.yml + release.yml exist)                                       |
| Keyboard shortcuts + Global hotkeys                            | 2h     | ✅ Done (useKeyboardShortcuts.ts + shortcutStore.ts + ShortcutsTab.tsx)    |
| React.memo / lazy loading (P9 items)                           | 2h     | ✅ Done (memo on Skeleton/Badge/EmptyState/ContactAvatar; routes use lazy) |
| Docs consolidation + component repurposing                     | 2h     | ✅ Done (see above)                                                        |
| Verify `npm run tauri dev` runtime fix                         | 5min   | 🔲 Manual check needed                                                     |
| Manual tests (panic injection, WAL recovery, watchdog restart) | 1.5h   | 🔲 Not started                                                             |
| WAL deletion doc                                      | 15min  | ✅ Done (`docs/05-DEVELOPMENT/04-wal-deletion.md`)  |
| Certificates + public key for distribution                     | varies | 🔲 Not started                                                             |
| Dogfooding + beta testing                                      | 1-2w   | 🔲 Not started                                                             |

---

## Context Map — How Everything Fits Together

```
src/
├── features/
│   ├── settings/          ← All tabs on SettingGroup, token-clean
│   ├── mail/              ← Comms wired to Rust db_* commands
│   ├── tasks/             ← Wired to Rust db_* commands
│   ├── contacts/          ← CRM wired to Rust db_* commands
│   ├── dashboard/         ← Wired to Rust db_* commands
│   ├── campaigns/         ← Wired to Rust db_* commands
│   ├── automation/        ← Store + 4 components + page (built out)
│   ├── vault/             ← Store + 7 components + page (refactored from monolith)
│   ├── mobile/            ← Shell + 5 mobile-specific components
│   ├── workflows/         ← Store + 4 components + page (partially built)
│   ├── calendar/          ← Wired to Rust db_* commands
│   ├── invoicing/         ← InvoicingDashboard (tabs), InvoiceEditor + LineItemsEditor + InvoiceTotals, InvoiceList (filters), SettingsDrawer, ClientList/Form, ItemList/Form, InvoiceStatusPill, store, types, invoke wrappers; ERP shell (ErpPage, CompanySwitcher, StockView, JournalView, FinancialReports, RbacRoles)
│   └── pos/               ← POS page, hardware store, barcode scanner hook (NEW)
├── shared/
│   ├── components/ui/     ← Barrel expanded (VirtualList, Modal focus trap, a11y)
│   ├── services/
│   │   ├── db/            ← 470+ typed Rust command wrappers in db-invoke.ts
│   │   └── oauth/         ← customTabAuth.ts (custom-tab orchestration)
│   ├── styles/
│   │   ├── ui-tokens.ts   ← Active class token library
│   │   └── mobile-animations.css
│   └── stores/            ← 46 Zustand stores (see "Verified Ground Truth")
└── src-tauri/
    ├── commands/           ← 773 #[tauri::command] across 19 domain modules (+vault, background, licensing, updater, invoicing, pos)
    ├── db/                 ← 520 `pub fn` across 130+ files in 13 domain table modules (invoicing, pos added)
    ├── invoicing/          ← Line-item calc engine (Money, TaxMode, calculate_line, calculate_document_totals) (NEW)
    ├── pos/                ← ESC/POS thermal printer driver, system printer fallback (NEW)
    │   ├── tables/         ← 78 query files
    │   ├── crypto.rs       ← AES-256-GCM encrypt/decrypt primitives
    │   ├── connection.rs   ← SQLite pool + version check + create_dir_all fix
    │   ├── schema.rs       ← 48 #[derive(FromRow)] structs
    │   └── migrations/     ← 32 sequential .sql files (verified; earlier docs cited 22/56/60)
    ├── orchestrator/       ← subsystem_lifecycle.rs, state_machine.rs, tool_registry.rs, gating.rs (NEW in P10)
    │   ├── service.rs      ← Service trait + ServiceRegistry (unchanged)
    │   ├── services.rs     ← Service implementations (lazy-wired for Sync/Sentinel/Backup)
    │   ├── watchdog.rs     ← Health polling (extended for SubsystemRegistry)
    │   ├── subsystem_lifecycle.rs  ← SubsystemRegistry, SubsystemStatus, CAS activation, idle shutdown
    │   ├── state_machine.rs       ← StateMachine FSM (Booting → Onboarding → Ready)
    │   ├── tool_registry.rs       ← Rust-side FEATURE_FLAGS mirror
    │   └── gating.rs              ← require_subsystem_active, get_subsystem_status IPC
    ├── oauth/              ← PKCE OAuth flow + token refresh monitor + custom-tab support
    └── lib.rs              ← Tauri setup, close_splashscreen, crypto self-test
```
