# Simplified Unified Core Specification
## smeMaster Billing / ERP / Marketing Core — Stripped to Essentials

**Version:** 1.2
**Date:** July 2026
**Architect:** Zakaria Labib
**Philosophy:** One client, one product, one document, one campaign. No roles, no complexity, no separate ops.
**Target stack:** smeMaster runtime — Tauri v2 + React 19 + TypeScript + Rust (`sqlx`/SQLite) + SQLite/WAL.

---

> **Stack reality check (read first).**
> This spec describes a *new Billing/ERP/Marketing module* to be built on top of the **existing smeMaster application**, not a greenfield project. smeMaster is already a local-first desktop (and Android) workspace: Tauri v2 shell, React 19 frontend, a Rust backend with 650+ typed IPC commands, and a Rust-owned SQLite + WAL schema evolved through additive migrations. There is **no Laravel, no PostgreSQL, and no separate API server** in this product. Previous drafts described a "Laravel → Rust/PostgreSQL" migration path; that path is removed here. Everything below is expressed in the stack that actually exists, so the plan is buildable as-is.
>
> What the platform already gives us for free (reuse, don't rebuild):
> - **Schema & migrations** — `src-tauri/src/db/migrations/*.sql` + `db/tables/<domain>` modules; additive, Rust-owned.
> - **IPC & typing** — `#[tauri::command]` handlers in `src-tauri/src/commands/*.rs`, mirrored by TS interfaces in `src/shared/services/db/`.
> - **State** — Zustand (UI) + TanStack Query (server) + an event-driven cache.
> - **Routing/i18n** — `@tanstack/react-router`, `i18next` (en/fr/ar/ja/it, RTL-ready).
> - **PDF** — Rust already ships `lopdf` + `pdf_report.rs`; reuse for invoice rendering.
> - **Email/Send** — existing SMTP (`lettre`) + PGP (`sequoia`) infra; reuse to email invoices and campaigns.
> - **Campaign foundation** — existing `campaigns`, `templates`, `contacts`, `segments`, `pending_operations` queue; reuse for email marketing.
> - **Offline / Mobile / Sync** — already local-first (SQLite + WAL), Android via Tauri, and a sync/queue engine exists. "Offline mode" and "mobile app" are mostly *done*, not future work.

---

## 1. Design Philosophy

### The Problem with Current Systems
- **myStockMaster** is inventory-heavy, light on invoicing flexibility.
- **smeMaster** has multi-role complexity, separate sales/purchase operations, and feature bloat.
- **Both** lack per-document customization (currency, template, tax position) without diving into settings panels.
- **Marketing tools** are usually a separate SaaS or over-engineered; SMEs need one campaign email tool tied to their contacts and invoices.

### The Solution: Unified Core
A single-document engine where:
- **One client table** serves as both customer and supplier (role flag).
- **One document table** handles invoices, quotes, purchases, expenses, delivery bills, credit notes (type enum).
- **One line-item engine** calculates everything: qty × unit × discount × tax = total.
- **All settings live on the page** — currency, prefix/suffix, template, tax position, units.
- **One campaign email tool** tied to contacts/templates, feature-gated as Pro.
- **No complex RBAC** — owner, editor, viewer. That's it. (Note: smeMaster currently has *no* RBAC; these three roles are net-new and introduced only at the ERP stage, not day one.)

---

## 2. Simplified Entity Model

### 2.1 Core Tables (8 Tables Total)

```
┌─────────────────────────────────────────────────────────────────┐
│                          COMPANIES                               │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ name              │ legal_name             │
│ email              │ phone             │ address                │
│ city / country     │ logo_url          │ signature_text         │
│ bank_details       │ terms_default     │ theme_color            │
│ ice (Morocco)      │ tax_id / IF       │ rc (Morocco)           │
│ cnss (Morocco)     │ updated_at        │                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ name              │ email                  │
│ phone              │ address           │ city / country         │
│ tax_id (ICE/IF)    │ role (customer|supplier|both)            │
│ credit_limit       │ payment_terms (days)│ notes               │
│ created_at         │ updated_at        │ deleted_at (soft)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          ITEMS                                   │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ name              │ description            │
│ type (product|service)│ sku / ref        │ category_id           │
│ unit (pc|kg|m|hr|session|box) │ buy_price │ sell_price        │
│ stock_qty          │ stock_alert       │ tax_rate (default %)   │
│ barcode            │ image_url         │ active                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        INVOICES / DOCUMENTS                      │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ type (invoice|delivery_bill|shipping_print) │
│ status (draft|sent|paid|partial|cancelled)                    │
│ client_id          │ document_number   │ date | due_date         │
│ currency (MAD|USD|EUR|...) │ currency_symbol │ symbol_position (before|after)│
│ tax_rate (%)       │ subtotal          │ tax_amount             │
│ discount_total     │ shipping          │ grand_total            │
│ paid_amount        │ balance_due       │ notes / terms          │
│ template_id        │ peppol_xml_path   │ pdf_path               │
│ company_id         │ created_by        │ created_at             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      INVOICE_ITEMS / DOCUMENT_LINES              │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ invoice_id        │ item_id (nullable)      │
│ description        │ qty               │ unit (override item)    │
│ unit_price         │ tax_rate (%)      │ tax_amount             │
│ line_total         │ sort_order        │ created_at             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      COMPANY_SETTINGS                            │
├─────────────────────────────────────────────────────────────────┤
│ company_id         │ default_currency  │ default_tax_rate        │
│ invoice_prefix     │ invoice_suffix    │ quote_prefix            │
│ default_template   │ logo_url          │ signature_text          │
│ bank_details       │ terms_default     │ theme_color             │
│ units_enabled (JSON)│ tax_position     │ decimal_places          │
│ updated_at         │                   │                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        TEMPLATES                                 │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ name              │ template_type          │
│ origin             │ content_html      │ compliance_profile_id  │
│ is_default         │ company_id        │ created_at             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        CATEGORIES   (lightweight item lookup)    │
├─────────────────────────────────────────────────────────────────┤
│ id (UUID str)      │ name              │ company_id │ created_at │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Existing Marketing Tables (Reuse, Not Rebuild)

The campaign email feature reuses the already-implemented tables:

- `contacts`, `contact_groups`, `contact_group_pivot`, `contact_segments`, `contact_tags` (migration `003_contacts.sql`)
- `campaigns`, `campaign_recipients`, `utm_links`, `utm_clicks` (migration `004_campaigns.sql`)
- `templates` (migration `002_mail.sql`) — reused for both mail and campaigns
- `pending_operations` (migration `008_workflows.sql`) — the offline send queue

No new marketing tables are required for the campaign email feature gate.

### 2.3 Why This Works

**No multi-role complexity:**
- Instead of `customers` and `suppliers` tables, one `clients` table with `role` enum.
- When creating a document, you pick the client and the document type auto-determines the role context. `client_role` is **computed in the Rust command layer** (business rule), not a database generated column — this matches smeMaster's "Rust owns schema and logic" convention and keeps migrations additive.
- A client can be both — no duplication, no sync issues.

**No separate sales/purchase ops:**
- No `sales_orders` vs `purchase_orders` tables.
- One `documents` / `invoices` table with `type` enum.
- Same UI, same calculation engine, different label and stock impact.

**No complex settings navigation:**
- Every document page has a slide-out settings panel.
- Changes are scoped: per-document → per-company → global (cascade).
- You never leave the invoice to change the currency.

**Marketing is built-in, not bolted-on:**
- Campaigns are just templates + contacts + a queue. Reuse the existing `templates` and `pending_operations` infrastructure.
- Feature-gated as Pro so the free tier stays simple.

---

## 3. Calculation Engine (One Algorithm, All Documents)

### 3.1 The Universal Formula

Money is stored as **integer minor units** (e.g. centimes) to avoid floating-point error. All arithmetic in Rust uses a `Decimal` type (`rust-decimal`); results are converted to minor units for storage. Qty and tax *rates* are real numbers.

```
FOR EACH line:
    line_subtotal = qty × unit_price
    line_discount = line_subtotal × (discount_% / 100)   -- OR discount_fixed, never both
    line_taxable  = line_subtotal - line_discount
    line_tax      = line_taxable × (tax_rate / 100)
    line_total    = line_taxable + line_tax

DOCUMENT TOTALS (net = everything before tax):
    net = SUM(line_subtotal) - SUM(line_discount) + shipping

    # Tax-EXCLUDED (default, VAT-style — tax added on top):
    tax_amount  = net × (tax_rate / 100)
    grand_total = net + tax_amount

    # Tax-INCLUDED (tax-inclusive pricing — total is fixed, derive tax):
    #   grand_total is given; back out the tax component:
    #   tax_amount  = grand_total - grand_total / (1 + tax_rate/100)
    #   net         = grand_total - tax_amount

    balance_due = grand_total - paid_amount
```

> **Why the original "before/after" wording was removed:** the earlier draft's two branches both ended by *adding* tax to the grand total, making "before" and "after" indistinguishable. The real distinction is **tax-excluded vs tax-included**. We keep a single `tax_mode` enum with those two clear values.

### 3.2 Document Type Variants (Same Engine, Different Behavior)

| Type | Client Role | Stock Impact | Revenue Impact | Cash Impact |
|------|------------|-------------|---------------|-------------|
| **Invoice** | customer | -stock | +revenue | +cash (when paid) |
| **Quote** | customer | none | +opportunity | none |
| **Purchase** | supplier | +stock | none | -cash (when paid) |
| **Expense** | supplier | none | -expense | -cash (when paid) |
| **Delivery** | customer | -stock | none | none (linked to invoice) |
| **Credit Note** | customer | +stock | -revenue | -cash (refund) |

**Key insight:** The calculation engine is identical. Only the `type` field changes the label, the stock journal entry, and the accounting classification. No separate code paths.

### 3.3 Unit Flexibility

Units are not hardcoded. The system ships with:
- `pc` (piece), `kg` (kilogram), `m` (meter), `m²` (square meter)
- `hr` (hour), `session` (service session), `box` (package)
- `l` (liter), `m³` (cubic meter)

Users can add custom units. The unit is stored as a string on the line item — no unit conversion logic (keep it simple). If you sell by kg, you enter qty in kg. No complexity. The enabled unit list lives as a JSON array on `company_settings.units_enabled`.

---

## 4. Per-Page Settings Panel

### 4.1 Settings Cascade (Priority Order)

When a user opens a document, settings resolve in this order:

```
1. Document-level override (saved with the document)
2. Company default (from company_settings table)
3. Global system default (first-run wizard / Business Profile)
```

This means:
- You can create a USD invoice for an international client while your default is MAD.
- You can use a different template for quotes vs invoices.
- You can override tax rate per document for special cases.

### 4.2 Settings Categories (All on One Panel)

| Category | Fields | Scope |
|----------|--------|-------|
| **Document** | Number, prefix, suffix, reference | Per-document |
| **Currency** | Code (MAD/USD/EUR), symbol, position (before/after), decimal places | Per-document |
| **Calculation** | Tax rate (%), tax position (excluded/included), rounding mode | Per-document |
| **Units** | Default unit, available units list | Per-company |
| **Template** | Layout (classic/modern/minimal), color, logo, footer, signature | Per-document |
| **Client** | Type (auto), credit limit, payment terms | Per-client |
| **Dates** | Issue date, due date (+N days), delivery date | Per-document |
| **Status** | Current status, auto-reminder toggle, reminder days | Per-document |
| **Business Profile** | Legal name, ICE, IF, RC, CNSS, address, bank | Per-company |

### 4.3 UI Pattern: Slide-Out Drawer

```
┌────────────────────────────────────────┬──────────────────────────┐
│  INVOICE #INV-2026-001                 │  ⚙️ SETTINGS             │
│  ───────────────────────────────────── │  ─────────────────────── │
│  Client: Acme Corp                     │  Document                │
│  Date: 2026-07-11    Due: 2026-08-10  │  Number: INV-2026-001   │
│  ───────────────────────────────────── │  Prefix: INV-            │
│  Line Items:                           │  Suffix: -CAS            │
│  1. Widget A    10 × 50.00 = 500.00   │                          │
│  2. Service B    5 × 100.00 = 500.00  │  Currency                │
│  ───────────────────────────────────── │  Code: MAD               │
│  Subtotal: 1,000.00                   │  Symbol: DH              │
│  Tax (20%):   200.00                  │  Position: After         │
│  Total:     1,200.00                 │  Decimals: 2             │
│  ───────────────────────────────────── │                          │
│  [Save] [Send] [PDF] [Print]          │  Calculation             │
│                                        │  Tax Rate: 20%           │
│                                        │  Position: Excluded      │
│                                        │  Rounding: 0.01          │
│                                        │                          │
│                                        │  Template                │
│                                        │  Layout: Classic A4      │
│                                        │  Color: #CE422B          │
│                                        │  Logo: [uploaded]        │
│                                        │  Footer: Custom text...  │
│                                        │                          │
│                                        │  Business Profile        │
│                                        │  ICE: 001234567000089    │
│                                        │  IF: 12345678            │
│                                        │  RC: 12345               │
│                                        │  CNSS: 1234567           │
│                                        │                          │
│                                        │  [Save as Default]       │
└────────────────────────────────────────┴──────────────────────────┘
```

The drawer is a React component driven by Zustand (open/close + draft overrides) and writes through TanStack Query mutations to Tauri commands. Changes preview live; "Save as Default" persists to `company_settings`. Morocco legal identifiers are managed here and saved to the `companies` table.

---

## 5. From Small CRM to ERP + Marketing: Evolution Path

> The smeMaster *platform* (runtime, DB, IPC, state, PDF, email, offline, Android, sync) already exists. Each stage below adds a **domain**, not a new app. Effort estimates are relative, not calendar months, because there is no greenfield foundation to build first.

### 5.1 Stage 1: Billing Core
**Goal:** Manage clients and send quotes/invoices.

Features:
- Client list (name, contact, role) — new `clients` table + `commands/billing.rs`.
- Quote & invoice creation (one-click quote→invoice convert).
- PDF export (reuse Rust `lopdf`/`pdf_report`).
- Email send (reuse existing SMTP/PGP command).
- Dashboard widgets: open quotes, unpaid invoices, client count (reuse dashboard infra).
- **Morocco legal identifiers** (ICE, IF, RC, CNSS) on `companies` + Business Profile settings tab.
- **PEPPOL/UBL 2.1 XML** generation and visual PDF generation for invoices.
- **Invoice Editor** and **Invoice Dashboard** full-page routes.
- **Invoicing integration** into CRM and Email Composer (insert invoice card, attach PDF/XML).

### 5.2 Stage 2: Payments & Reminders
**Goal:** Track money moving.

Features:
- Payment tracking (cash, bank transfer, check) — `paid_amount`/`balance_due`.
- Partial payment support.
- Overdue auto-flag (status transition in Rust).
- Basic reporting: revenue this month, unpaid invoices.

### 5.3 Stage 3: Inventory
**Goal:** Add stock tracking to purchases and sales.

Features:
- Product catalog (`items`: SKU, buy/sell price, stock qty).
- Purchase bills (buy stock, +qty) / Sales invoices (sell stock, -qty).
- Stock alert (low stock warning).
- Single warehouse first (one location column on `items`).

### 5.4 Stage 4: ERP Core
**Goal:** Add accounting backbone.

Features:
- Chart of accounts (simplified: assets, liabilities, equity, revenue, expenses).
- Journal entries (auto-generated from documents).
- Expense tracking (rent, utilities, salaries — beyond just purchases).
- P&L (revenue - expenses = profit); Balance sheet (assets = liabilities + equity).
- **Simple roles (owner, editor, viewer)** — net-new; smeMaster has no RBAC today, so this is introduced here, not earlier.

### 5.5 Stage 5: Marketing Campaign Email
**Goal:** Let the SME send targeted campaigns from the same workspace.

Features:
- **Campaign list** and **Campaign composer** (4-step wizard: audience, template, schedule, review).
- Reuse existing `templates` table with a `template_type` filter.
- Feature gate as **Pro** via `campaigns` feature flag.
- Audience from contacts, groups, and dynamic segments.
- Send through the existing `pending_operations` queue so it works offline and syncs.
- Mobile: view campaigns, quick stats, and send/retry queued operations.
- **Not a separate marketing platform** — no complex automation builder, no landing pages, no CMS.

### 5.6 Stage 6: Platform
**Goal:** Scale.

Features:
- Multi-company (one login, switch companies) — `company_id` is already on every table.
- REST/CLI API surface (optional; the app is local-first, so this is opt-in, not required).
- Mobile create/scan — **already largely solved**: Android ships via Tauri; reuse the existing barcode/scan + offline paths.
- Banking import, AI flags (overdue clients, stock needs) — build on the existing AI/RAG + deliverability surfaces.

---

## 6. Build Plan on the Existing Stack (No Migration)

Because there is no Laravel and no separate server, there is no "migration" — only incremental addition of `billing` and `invoicing` domains to the single Tauri/Rust/SQLite binary. **Campaign email reuses existing migrations and commands and adds a Pro feature gate.**

### 6.1 Phase 1 — Schema + Domain Layer (Foundation)
**Where:** `src-tauri/src/db/migrations/020_invoicing.sql` (additive) + `src-tauri/src/db/tables/invoicing/*.rs` + `src-tauri/src/invoicing/calc.rs` + `src-tauri/src/invoicing/peppol.rs`.

Actions:
- Add the `companies` legal identifier columns (`ice`, `tax_id`, `rc`, `cnss`) in `020_invoicing.sql`.
- Add the `invoices` and `invoice_items` tables (multi-document type: `invoice`, `delivery_bill`, `shipping_print`).
- Implement `db/tables/invoicing/{invoices,items}.rs` CRUD modules (follow existing `db/tables/<domain>` pattern).
- Implement **pure** calculation functions in `invoicing/calc.rs` (`calculate_line`, `calculate_invoice`) — no DB, no side effects, fully unit-tested.
- Implement **PEPPOL/UBL 2.1 XML** generator in `services/invoicing/peppol.rs`.
- Implement visual PDF generator using `lopdf` (replace the stub in `services/invoicing/pdf.rs`).
- Enable `PRAGMA foreign_keys = ON` on the connection (already standard for the app).

### 6.2 Phase 2 — Commands + Calculation Wiring
**Where:** `src-tauri/src/commands/invoicing.rs`, registered in `commands/mod.rs` `generate_handler!`.

Actions:
- Expose typed commands: `create_invoice`, `update_invoice`, `add_invoice_item`, `remove_invoice_item`, `calculate_invoice`, `send_invoice`, `generate_invoice_documents`, `list_invoices`, `get_client`, etc.
- Compute `client_role` from `type` in Rust before insert.
- Persist computed totals (subtotal, tax_amount, grand_total, balance_due) on save.
- Fix the `create_invoice` command to use its transaction (`&mut tx`) instead of `&pool`.
- Make `Company` Rust struct include `ice`, `tax_id`, `rc`, `cnss`.
- Add `get_company` and `update_company` commands/frontend helpers if missing.

### 6.3 Phase 3 — React Frontend
**Where:** new feature under `src/features/invoicing/` + routes in `@tanstack/react-router`.

Actions:
- `InvoiceList` (filter by type/status) — TanStack Query list query.
- `InvoiceEditor` (header, line-item spreadsheet table, totals, actions) — auto-save draft every 30s.
- `SettingsDrawer` (slide-out, Zustand state, "Save as Default" → `company_settings`).
- `LineItemsTable` (inline edit, Tab-to-next, no modals).
- `BusinessProfileTab` (legal identifiers) — registered in `SettingsTabRegistry` and linked from `company_settings`.
- `ClientList` / `ClientForm` / `ItemList` / `ItemForm`.
- `formatMoney(amount, currency, symbol, position, decimals)` — one shared util, used everywhere (incl. RTL via i18n).
- All data flows through typed IPC (`db-invoke` pattern) wrapped in TanStack Query mutations — **no REST/fetch**.
- Add the Invoicing item to the sidebar nav (`navConfig.ts`).
- Wire the CRM page with an Invoices tab and the Email Composer with an "Insert Invoice" modal that can also attach PDF/XML.

### 6.4 Phase 4 — PDF, Email, Dashboard
- PDF: `generate_invoice_documents` reuses `lopdf` + template HTML/CSS.
- Email: `send_invoice` reuses the existing SMTP + PGP command.
- Dashboard: add invoicing widgets (unpaid, revenue, total invoiced) reusing the existing dashboard framework.

### 6.5 Phase 5 — Campaign Email Feature Gate
**Where:** `src/features/campaigns/` + `src/constants/featureFlags.ts`.

Actions:
- Reuse the existing `campaigns` table and `templates` table.
- Reuse the existing `CampaignComposer` 4-step wizard.
- Add a `campaigns` Pro feature flag (`basicLimit: 0`, `proLimit: null`) already present in `featureFlags.ts`; wire it to gate the composer and list page.
- Reuse `pending_operations` queue so campaigns send offline and sync across desktop/tablet/mobile.
- Mobile: show campaign status cards, allow retry of failed queued operations, and read-only review of scheduled campaigns.
- No new backend tables; no new queue system.

### 6.6 Phase 6 — Inventory, ERP, Multi-company
- Add stock update logic in the `invoices` command (purchase +qty, sale -qty).
- Add journal/accounts tables + auto-entries from documents.
- Add `owner/editor/viewer` role gating (net-new, minimal).
- Multi-company switching is a UI concern over the already-present `company_id`.

### 6.7 Risk Notes (realistic, no Laravel-to-Rust gap)

| Risk | Mitigation |
|------|-----------|
| **Money precision** | Store as integer minor units; compute with `rust-decimal`; round only at display. |
| **SQLite has no arrays/UUID types** | `units_enabled` is JSON text; UUIDs are canonical strings from the `uuid` crate. |
| **No RBAC yet** | Defer roles to Stage 4; ship single-owner first. |
| **PDF fidelity** | Reuse `lopdf`; validate against 3 real templates before beta. |
| **Scope creep** | Every feature is deferrable except the core document engine and per-page settings. |
| **Campaign feature gate** | Pro flag; free tier shows upsell. |
| **Mobile parity** | Ship mobile as read/review + quick capture first; full editing stays desktop/tablet. |
| **Offline send queue** | Reuse `pending_operations`; campaign send is queued, not synchronous. |

---

## 7. Mobile, Offline, and Sync Strategy

### 7.1 Core Principle: Offline First

smeMaster is local-first. The source of truth is the SQLite database on the device. All writes succeed locally; sync happens when the device is online. The user should never be blocked because the network is down.

### 7.2 Device Capability Matrix

| Feature | Desktop | Tablet | Mobile (Android) |
|---------|---------|--------|------------------|
| **Invoice creation / full editor** | Full | Full | View only + quick status change |
| **Invoice line-item editing** | Full | Full | Read only |
| **PDF generation** | Full | Full | View generated PDF, no creation |
| **PEPPOL/UBL XML generation** | Full | Tablet (download) | Read only |
| **Campaign creation / wizard** | Full | Full | View only + duplicate from template |
| **Campaign send / schedule** | Full | Full | Trigger send if queue is ready |
| **Campaign stats / analytics** | Full | Full | Cards + summary |
| **Contact/segment management** | Full | Full | Add quick contact, view only |
| **Offline queue review/retry** | Full | Full | Full |
| **Quick capture (scan, share intent)** | No | No | Yes |
| **Multi-company switch** | Full | Full | Full |
| **Settings / Business Profile** | Full | Full | Basic view/edit |
| **Email composer (rich text)** | Full | Tablet (simplified) | Quick reply only |

### 7.3 Sync Architecture

- **smeMaster desktop** is the canonical coordinator. It can push/pull to tablet and mobile apps.
- **Conflict resolution** is last-write-wins for independent records (contacts, invoices, campaigns); append-only for logs (payments, queue operations).
- **Queue operations** (`pending_operations`) are the offline unit of work. A campaign send on mobile creates pending operations that execute when online, even if the desktop processes them.
- **Sync commands** (`src-tauri/src/commands/sync.rs`) provide full sync and delta sync over the existing provider registry.
- **Background services** (`src-tauri/src/services/background_services.rs`) start the `QueueService` and `PreCacheService` so sync and sends happen without keeping the UI open.
- **No separate cloud backend** required; peer-to-peer or existing provider sync is reused.

### 7.4 Campaign Email on Mobile

- Campaigns are created on desktop/tablet.
- Mobile shows campaign status, recipient counts, and open/click stats.
- Mobile can **retry failed queued operations** and **approve scheduled sends**.
- Mobile receives share intents (e.g. share a photo into a new campaign draft) but does not render the full wizard.

---

## 8. Database Schema (SQLite — Target)

> SQLite conventions used here: UUIDs as `TEXT` (canonical string), money as `INTEGER` minor units, qty/rates as `REAL`, booleans as `INTEGER` (0/1), timestamps as ISO-8601 `TEXT` (`datetime('now')`), arrays as JSON `TEXT`. `CHECK` and `UNIQUE` constraints are supported. `client_role` is a normal column set by Rust, **not** a generated column.

### 8.1 Billing/Invoicing Tables

```sql
-- Companies: legal identifiers added for Morocco compliance
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'MA',
    logo_url TEXT,
    signature_text TEXT,
    bank_details TEXT,
    terms_default TEXT,
    theme_color TEXT DEFAULT '#CE422B',
    ice TEXT,                    -- Morocco ICE
    tax_id TEXT,                 -- Morocco IF / tax identifier
    rc TEXT,                     -- Morocco RC
    cnss TEXT,                   -- Morocco CNSS
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Clients (customers AND suppliers)
CREATE TABLE clients (
    id TEXT PRIMARY KEY,                       -- UUID v4 string (uuid crate)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'MA',                -- ISO-3166 alpha-2
    tax_id TEXT,                              -- ICE in Morocco
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'supplier', 'both')),
    credit_limit INTEGER DEFAULT 0,           -- minor units (e.g. centimes)
    payment_terms INTEGER DEFAULT 30,         -- days
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT                           -- soft delete
);

-- Items (products and services)
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'product' CHECK (type IN ('product', 'service')),
    sku TEXT,
    category_id TEXT REFERENCES categories(id),
    unit TEXT DEFAULT 'pc',
    buy_price INTEGER DEFAULT 0,              -- minor units
    sell_price INTEGER DEFAULT 0,             -- minor units
    stock_qty REAL DEFAULT 0,                 -- fractional qty (kg, m, l...)
    stock_alert REAL DEFAULT 0,
    tax_rate REAL DEFAULT 20,                 -- percent
    barcode TEXT,
    image_url TEXT,
    active INTEGER DEFAULT 1,                 -- bool
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoices / Documents (multi-document type)
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'delivery_bill', 'shipping_print')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'cancelled')),

    client_id TEXT NOT NULL REFERENCES clients(id),
    client_role TEXT,                         -- SET IN RUST from type; not generated

    document_number TEXT NOT NULL,
    prefix TEXT,
    suffix TEXT,
    date TEXT DEFAULT (date('now')),
    due_date TEXT,

    currency TEXT DEFAULT 'MAD',
    currency_symbol TEXT DEFAULT 'DH',
    symbol_position TEXT DEFAULT 'after',
    decimal_places INTEGER DEFAULT 2,

    tax_rate REAL DEFAULT 20,

    subtotal INTEGER DEFAULT 0,
    discount_total INTEGER DEFAULT 0,
    tax_amount INTEGER DEFAULT 0,
    shipping INTEGER DEFAULT 0,
    grand_total INTEGER DEFAULT 0,
    paid_amount INTEGER DEFAULT 0,
    balance_due INTEGER DEFAULT 0,

    notes TEXT,
    terms TEXT,
    footer_text TEXT,
    template_id TEXT,

    peppol_xml_path TEXT,                     -- generated UBL 2.1 XML
    pdf_path TEXT,                            -- generated visual PDF

    company_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,

    UNIQUE(company_id, document_number)
);

-- Invoice Items / Document Lines
CREATE TABLE invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES items(id),        -- nullable for free-text lines
    description TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'pc',
    unit_price INTEGER NOT NULL DEFAULT 0,    -- minor units
    tax_rate REAL DEFAULT 20,
    tax_amount INTEGER DEFAULT 0,
    line_total INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Company Settings (per-tenant config)
CREATE TABLE company_settings (
    company_id TEXT PRIMARY KEY,
    default_currency TEXT DEFAULT 'MAD',
    default_tax_rate REAL DEFAULT 20,
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_suffix TEXT DEFAULT '',
    quote_prefix TEXT DEFAULT 'QUO-',
    default_template_id TEXT,
    logo_url TEXT,
    signature_text TEXT,
    bank_details TEXT,
    terms_default TEXT,
    theme_color TEXT DEFAULT '#CE422B',
    units_enabled TEXT DEFAULT '["pc","kg","m","hr"]',  -- JSON array as TEXT
    tax_position TEXT DEFAULT 'excluded',
    decimal_places INTEGER DEFAULT 2,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Templates (reused for mail, campaigns, and invoices)
CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template_type TEXT DEFAULT 'email',       -- email | campaign | invoice
    origin TEXT DEFAULT 'custom',
    content_html TEXT,
    header_html TEXT,
    body_html TEXT,
    footer_html TEXT,
    css TEXT,
    compliance_profile_id TEXT,
    is_default INTEGER DEFAULT 0,
    company_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Categories (lightweight item lookup)
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 8.2 Reused Marketing Tables (Already Implemented)

These tables already exist in migrations `002_mail.sql`, `003_contacts.sql`, `004_campaigns.sql`, and `008_workflows.sql`. They are reused for the campaign email feature gate.

```sql
-- Existing contacts / groups / segments
-- Existing campaigns / campaign_recipients / utm_links / utm_clicks
-- Existing templates (above)
-- Existing pending_operations (offline queue)
```

### 8.3 Key Design Decisions

1. **UUID as TEXT:** No native UUID type in SQLite. Store canonical UUID v4 strings (generated by the `uuid` crate in Rust). Safe for offline/CIDR sync and future sharding.
2. **Money as INTEGER minor units:** No `DECIMAL` in SQLite. Store cents/centimes as integers; compute with `rust-decimal` in Rust; round only at display. Eliminates float errors.
3. **Soft deletes:** Always `UPDATE deleted_at`. Audit trail is free; matches the app's no-destructive-defaults rule.
4. **`client_role` set in Rust:** The command layer enforces the business rule, keeping migrations additive and logic in one place (Rust owns schema + rules).
5. **Document number unique per company:** `UNIQUE(company_id, document_number)` — not globally unique. Small companies don't need global uniqueness.
6. **Nullable `item_id` on lines:** Invoice "Consulting services" without creating a product first. Freedom.
7. **JSON for `units_enabled`:** SQLite has no array type; store a JSON array string, parse to `Vec<String>` in Rust.
8. **Morocco legal identifiers on `companies`:** ICE, IF, RC, CNSS are plain TEXT columns. No foreign keys. They are required for PEPPOL generation and shown in the Business Profile tab.
9. **Campaigns reuse `templates`:** A single template table with `template_type` keeps the schema simple. No separate campaign_template table.
10. **Offline queue is `pending_operations`:** Campaign sends are queued, not synchronous. The same table is used for mail and other async work.

---

## 9. Rust Module Structure (Target — real layout)

### 9.1 Layout (matches smeMaster conventions)

```
src-tauri/src/
├── commands/
│   ├── invoicing.rs        # #[tauri::command] handlers (create_invoice, add_item, calculate, send, generate_documents...)
│   ├── billing.rs          # future unified billing commands
│   └── mod.rs              # generate_handler! registers invoicing commands
├── db/
│   ├── tables/
│   │   └── invoicing/
│   │       ├── invoices.rs
│   │       ├── items.rs
│   │       └── tests.rs
│   ├── migrations/
│   │   └── 020_invoicing.sql   # additive schema
│   ├── invoicing/
│   │   └── schema.rs         # Invoice, InvoiceItem, InvoiceWithItems
│   └── ...
├── services/
│   └── invoicing/
│       ├── mod.rs            # declares peppol, pdf
│       ├── peppol.rs         # UBL 2.1 XML generator
│       └── pdf.rs            # lopdf visual PDF generator
└── invoicing/                # pure domain logic (no DB, no Tauri)
    ├── calc.rs               # calculate_line, calculate_invoice (pure fns, tested)
    ├── money.rs              # Money/minor-unit helpers, format_money
    └── mod.rs
```

### 9.2 Key Rust Types

```rust
// Document type enum
enum InvoiceType {
    Invoice,
    DeliveryBill,
    ShippingPrint,
}

// Status enum
enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Partial,
    Cancelled,
}

// Tax mode — the corrected, unambiguous pair
enum TaxMode {
    Excluded,  // tax added on top (VAT-style, default)
    Included,  // total is tax-inclusive; derive tax component
}

// Currency symbol position
enum SymbolPosition {
    Before,
    After,
}

// Money stored as integer minor units; computed with Decimal
#[derive(Copy, Clone)]
struct Money(i64); // minor units (e.g. centimes)

// The calculation input
struct LineInput {
    qty: Decimal,
    unit_price: Money,
    discount_pct: Option<Decimal>,
    discount_fixed: Option<Money>,
    tax_rate: Decimal,
}

// The calculation output
struct LineOutput {
    subtotal: Money,
    discount: Money,
    taxable: Money,
    tax_amount: Money,
    total: Money,
}

// Pure function — no DB, no side effects
fn calculate_line(input: LineInput) -> LineOutput {
    let subtotal = Money::from_decimal(input.qty * input.unit_price.to_decimal());
    let discount = input.discount_pct
        .map(|pct| Money::from_decimal(subtotal.to_decimal() * (pct / Decimal::from(100))))
        .or(input.discount_fixed)
        .unwrap_or(Money::ZERO);
    let taxable = subtotal - discount;
    let tax_amount = Money::from_decimal(taxable.to_decimal() * (input.tax_rate / Decimal::from(100)));
    let total = taxable + tax_amount;

    LineOutput { subtotal, discount, taxable, tax_amount, total }
}
```

### 9.3 Why This Rust Structure

- **Pure calculation functions:** Testable, cacheable, parallelizable. No DB access in `invoicing/calc.rs`.
- **Integer minor units + `rust-decimal`:** No floating-point errors in money. Critical. (Add `rust-decimal` to `Cargo.toml`.)
- **Enum-driven:** Document type, status, tax mode are enums, not strings. Compiler-enforced correctness.
- **Table-module separation:** Each table owns its CRUD/query ops (matches `db/tables/<domain>` convention), independently testable.
- **Commands at the edge:** `commands/invoicing.rs` is the only place touching Tauri; domain + table logic stay framework-free.
- **Services/invoicing holds PDF/XML:** Keeps document generation separate from database logic.

---

## 10. React Frontend Structure

### 10.1 Component Hierarchy

```
App (Tauri shell)
├── Layout (sidebar + header)            # existing shell
│   ├── Dashboard (invoicing + campaign widgets)  # reuse dashboard framework
│   ├── Invoicing / Billing
│   │   ├── Clients
│   │   │   ├── ClientList (table, search, filters)
│   │   │   ├── ClientForm (create/edit)
│   │   │   └── ClientDetail (history, invoices)
│   │   ├── Items
│   │   │   ├── ItemList
│   │   │   ├── ItemForm
│   │   │   └── ItemDetail (stock history)
│   │   └── Invoices
│   │       ├── InvoiceList (all types, filter by type/status)
│   │       ├── InvoiceEditor (the core UI)
│   │       │   ├── InvoiceHeader (client, dates, status)
│   │       │   ├── LineItemsTable (qty, unit, price, discount, tax, total)
│   │       │   ├── InvoiceTotals (subtotal, tax, total, paid, balance)
│   │       │   ├── SettingsDrawer (slide-out panel incl. Business Profile)
│   │       │   └── Actions (save, send, PDF, print, duplicate)
│   │       └── DocumentPreview (XML/PDF preview)
│   ├── CRM
│   │   ├── MergedCRMPage (Contacts, Campaigns, Tasks, Calendar, Invoices)
│   │   └── CampaignComposer (4-step wizard)
│   ├── Mail
│   │   ├── Composer (with InvoiceSelectionModal + PDF/XML attachment)
│   │   └── Templates
│   └── Settings
│       ├── CompanySettings
│       ├── BusinessProfileTab (ICE, IF, RC, CNSS)
│       ├── Templates
│       └── Users (simple: owner, editor, viewer) — Stage 4
└── (routing via @tanstack/react-router)
```

### 10.2 State Management (matches smeMaster)

- **TanStack Query:** Server state. All billing/invoicing data goes through typed IPC commands wrapped in `useQuery`/`useMutation` (list invoices, save item, send invoice). Campaigns already use the same pattern.
- **Zustand:** UI state only — settings drawer open/closed, current filter, draft overrides, theme.
- **No Redux.** Zustand + TanStack Query is the app's established pattern.

### 10.3 Key UI Patterns

| Pattern | Implementation |
|---------|---------------|
| **Data flow** | Tauri IPC (`db-invoke`) → TanStack Query, **not** REST/fetch. |
| **Document form** | Single-page, no wizard. All fields visible. Auto-save draft every 30s. |
| **Line items** | Spreadsheet-like table. Tab to next cell. Inline editing. No modal popups. |
| **Settings drawer** | Right-side slide-out, 400px. Changes preview live. "Save as Default" → `company_settings`. |
| **Currency display** | `formatMoney(amount, currency, symbol, position, decimals)` — one function, everywhere (RTL-aware via i18n). |
| **Status badge** | Color-coded: draft(gray), sent(blue), paid(green), overdue(red), partial(orange). |
| **Search** | Reuse the existing global command surface / search where available; scope to clients, items, invoices. |
| **Campaign feature gate** | `FeatureGate` component reads `campaigns` flag; Pro tier unlocks full composer. |
| **Mobile responsive** | Desktop/tablet show full editor; mobile shows list/cards + quick actions. |

---

## 11. Feature Comparison: Simplified vs. Full ERP/Marketing

| Feature | Simplified Core (This Spec) | Full ERP/Marketing (Future) |
|---------|------------------------------|-------------------|
| **Clients** | One table, role flag | Separate CRM with leads, opportunities, campaigns |
| **Documents** | 6 types, one table | 20+ types, separate workflows |
| **Roles** | Owner, editor, viewer (Stage 4) | RBAC with permissions matrix |
| **Inventory** | Single warehouse, basic qty | Multi-warehouse, FIFO/LIFO, batches, serials |
| **Accounting** | Auto journal entries | Full double-entry, reconciliation, bank feeds |
| **Tax** | Single rate per document | Multi-tax, compound tax, tax groups, e-invoicing |
| **Currency** | One per document | Multi-currency with exchange rates |
| **Users** | 3 roles | SSO, LDAP, departments, teams |
| **API** | Optional/CLI | Webhooks, rate limiting, SDKs, partner portal |
| **Mobile** | View + basic create (Android already via Tauri) | Full feature parity, offline sync, barcode scanning |
| **AI** | None (reuse existing AI surface later) | Predictive inventory, fraud detection, smart reminders |
| **Integrations** | Email (SMTP/PGP), PDF | 50+ integrations (Shopify, WooCommerce, Stripe, etc.) |
| **Campaign Email** | List, 4-step composer, templates, segments, queue, Pro gate | Automation builder, landing pages, advanced analytics, scheduling worker |
| **Compliance** | Morocco legal identifiers + Business Profile | Multi-country profiles, mandatory field validation, e-invoicing networks |

**The strategy:** Ship the simplified billing/invoicing core as a new domain in 1–2 iterations, fix the wiring left undone by the last branch, and gate the campaign email feature as Pro. Get real SMEs using invoices/quotes and campaigns. Then evolve based on what they actually use, not what you think they need. The platform (offline, Android, PDF, email, sync, queue) is already there.

---

## 12. Implementation Checklist

### 12.1 Last Branch Wiring Fixes (Do These First)

These items are blockers from the previous branch; they must be fixed before the feature is usable.

- [x] Register migration `020_invoicing.sql` in `src-tauri/src/db/migrations/mod.rs`.
- [x] Add `ice`, `tax_id`, `rc`, `cnss` fields to the Rust `Company` struct in `src-tauri/src/db/core/schema.rs`.
- [x] Add `ice`, `tax_id`, `rc`, `cnss` fields to the TypeScript `Company` interface in `src/shared/services/db/schema.ts`.
- [x] Add `getCompany` / `updateCompany` frontend helpers in `src/shared/services/db/db-invoke.ts` (re-exported from `invoke/invoicing.ts`).
- [x] Declare `pub mod invoicing;` in `src-tauri/src/commands/mod.rs` and register commands in `generate_handler!`.
- [x] Declare modules in `src-tauri/src/services/invoicing/mod.rs` (`pub mod peppol; pub mod pdf;`).
- [x] Declare `pub mod schema;` in `src-tauri/src/db/invoicing/mod.rs`.
- [x] Fix `create_invoice` to use `&mut tx` for all inserts instead of `&pool`.
- [ ] Align frontend/backend command names: `generate_invoice_documents` vs `generate_invoice_xml` — ⚠ partial: canonical backend command is `db_generate_invoice_documents` (correct in `shared/services/db/invoke/invoicing.ts`); but `features/invoicing/services/invoicing-invoke.ts` still calls the non-existent `generate_invoice_xml`.
- [x] Add Invoicing item to `src/shared/components/layout/shell/navConfig.ts`.
- [x] Register `BusinessProfileTab` in `src/features/settings/components/SettingsTabRegistry.ts`.

### 12.2 Iteration 1: Billing/Invoicing Foundation

- [x] Migration `020_invoicing.sql` (companies legal identifiers, invoices, invoice_items)
- [x] Table modules: `db/tables/invoicing/{invoices,items}.rs`
- [ ] `invoicing/calc.rs` pure functions (`calculate_line`, `calculate_invoice`) + unit tests — ⚠ partial: `calculate_line` exists with unit tests; the invoice-level fn is named `calculate_document_totals` (not `calculate_invoice`); `db/tables/invoicing/tests.rs` references an undefined `format_money` and a `DocumentTotals.net/.tax_amount/.balance_due` that don't exist → that test module currently fails to compile.
- [ ] `invoicing/money.rs` (minor-unit `Money`, `format_money`) — ⚠ partial: `Money(i64)` exists inside `calc.rs`; `format_money` is referenced by tests but never implemented (no `money.rs` file).
- [x] `services/invoicing/peppol.rs` PEPPOL/UBL 2.1 XML generator (real implementation)
- [x] `services/invoicing/pdf.rs` visual PDF generator using `lopdf` (real implementation, not a stub)
- [x] Commands: `commands/invoicing.rs` (`create_invoice`, `add_invoice_item`, `calculate_invoice`, `list_invoices`, `get_client`, `generate_invoice_documents`, `send_invoice`) + register in `generate_handler!`
- [ ] `client_role` computed in Rust from `type` — not done: `client_role` is only a DB column in `020_invoicing.sql`; no Rust code derives it from invoice `type`.
- [x] Business Profile tab registered and functional (ICE/IF/RC/CNSS fields wired)

### 12.3 Iteration 2: Document Engine + UI

- [x] `InvoiceEditor` + `LineItemsEditor` (inline edit, auto-save draft) — ✅ built: `InvoiceEditor.tsx` (functional, not a stub) + `LineItemsEditor.tsx` with inline line-item editing.
- [x] `InvoiceTotals` (subtotal, tax, discount, total, paid, balance) — ✅ built: `InvoiceTotals.tsx` with full breakdown.
- [x] `SettingsDrawer` (slide-out, Zustand, "Save as Default", Business Profile) — ✅ built: `SettingsDrawer.tsx`.
- [x] `InvoiceList` (filter by type/status) — ✅ built: `InvoiceList.tsx` with type/status filters backed by `useInvoicingStore`.
- [x] `ClientForm` / `ItemForm` / lists — ✅ built: `ClientList`/`ClientForm` and `ItemList`/`ItemForm`.
- [x] Status workflow (draft → sent → paid → partial) — ✅ built: `InvoiceStatusPill.tsx` + status flow transitions wired to `changeStatus`.
- [x] Sidebar navigation to `/invoicing` (route + nav item present)

### 12.4 Iteration 3: PDF, Email, Dashboard, CRM Integration

- [x] `generate_invoice_documents` reusing Rust `lopdf` + template HTML/CSS — ✅ wired: store `generateDocuments` → `db_generate_invoice_documents`.
- [ ] `send_invoice` reusing existing SMTP/PGP command (attach PDF/XML) — ⚠ partial: frontend `sendInvoice` is wired to `db_send_invoice`, but the backend command is still a stub (only flips status; no SMTP/PGP dispatch). Real email delivery remains TODO.
- [x] Dashboard invoicing widgets (unpaid, revenue, total invoiced) — ✅ built: `InvoicingDashboard.tsx` tabbed shell aggregates invoice state.
- [x] Currency formatting (all positions, all symbols, RTL-aware) — ✅ built: `features/invoicing/utils/format.ts` `formatMoney`/`formatMoneyCompact` with symbol table (MAD→DH, EUR→€, USD→$) and RTL-aware formatting.
- [ ] Template system (classic, modern, minimal) — not done / not verified for invoices.
- [x] CRM page Invoices tab — ✅ built: `InvoicesTab` in `MergedCRMPage` (+ `ReceiptText` tab).
- [ ] Email Composer "Insert Invoice" modal + PDF/XML attachment — ⚠ partial: `InvoiceSelectionModal` exists and inserts an HTML snippet, but real PDF/XML file attachment is not wired (depends on `db_send_invoice` dispatch).
- [ ] Beta with a few Moroccan SMEs

### 12.5 Iteration 4: Campaign Email Feature Gate

- [x] Reuse existing `campaigns` table, `templates` table, and `pending_operations` queue.
- [ ] Wire `campaigns` Pro feature flag (`basicLimit: 0`, `proLimit: null`) into `FeatureGate` — ⚠ partial: flag exists and gates the composer/list via `useFeatureFlagStore` + `UpgradeBanner`; the generic `<FeatureGate>` component is not used by the campaigns feature.
- [x] `CampaignComposer` 4-step wizard (audience, template, schedule, review) on desktop/tablet.
- [x] Mobile campaign view: status cards, recipient counts, quick stats, retry queued operations.
- [x] Campaign templates filtered from `templates` table by `template_type = 'campaign'`.
- [x] No new backend tables; no new queue system (reuses existing `pending_operations`).

### 12.6 Iteration 5: Inventory → ERP → Platform

- [ ] Stock update logic in `invoices` command (purchase +qty, sale -qty) — not done.
- [ ] Low-stock alerts — not done.
- [ ] Journal/accounts tables + auto-entries from invoices — ⚠ partial: `JournalView.tsx` UI exists (mock data), but no backend journal tables or auto-entries from invoices yet.
- [x] P&L + balance sheet widgets — ✅ built: `FinancialReports.tsx` (computed from invoice state).
- [ ] `owner/editor/viewer` role gating (net-new) — ⚠ partial: `RbacRoles.tsx` UI exists, but no RBAC enforcement model in code yet.
- [x] Multi-company switching over `company_id` — ✅ built: `CompanySwitcher.tsx` + `useCompanyStore` (`setActiveCompany`/`getActiveCompany`) with `MOCK_COMPANIES` (3 demo companies). Real per-company DB scoping still pending backend support.

### 12.7 Mobile / Offline / Sync Checklist

- [ ] Device capability matrix implemented (desktop full, tablet full, mobile read/review + quick capture) — ⚠ partial: campaign composer & queue are responsive; invoice editor has no mobile summary view.
- [ ] Invoice editor responsive: mobile hides spreadsheet editing, shows summary cards — not done.
- [x] Campaign composer responsive: desktop/tablet full wizard, mobile view-only + retry.
- [x] Offline queue review page accessible on all devices (`QueueInspector`).
- [ ] smeMaster desktop coordinates sync to tablet/mobile — ⚠ partial: background `QueueService` + sync commands exist; no verified end-to-end multi-device coordination test.
- [x] Background services run on desktop to process queue and sync (`background_services.rs`).

---

## 13. Success Metrics

| Metric | Iter 1 | Iter 2 | Iter 3 (beta) | Iter 4+ |
|--------|--------|--------|---------------|---------|
| **Beta companies** | 0 | 2 | 10 | 50 |
| **Invoices created** | 0 | 50 | 500 | 3,000 |
| **Campaigns sent (Pro)** | 0 | 0 | 20 | 200 |
| **Command latency (IPC)** | — | <20ms | <15ms | <10ms |
| **Mobile usage (Android)** | 0% | 5% | 20% | 40% |
| **User retention (30d)** | — | — | 60% | 80% |
| **NPS** | — | — | +20 | +50 |
| **Offline queue success rate** | — | — | 95% | 99% |

---

*This specification prioritizes shipping speed over perfection. The goal is a working billing/invoicing core as a new smeMaster domain in 1–2 iterations, plus a Pro-gated campaign email feature, not a perfect system in 12 months. Every feature is deferrable except the core document engine, the wiring fixes from the last branch, and the per-page settings. The platform (Tauri/React/Rust/SQLite, offline, Android, PDF, email, sync, queue) is already built — we are adding domains, not a product.*

**Next Steps:**
1. Fix the last-branch wiring blockers (migration registration, command registration, module exports, Company fields, navigation, settings tab registration).
2. Replace the `services/invoicing/pdf.rs` stub with a real `lopdf` implementation.
3. Wire `InvoiceEditor` and `InvoicingDashboard` buttons to real commands.
4. Align frontend/backend command names and add missing `getCompany`/`updateCompany` helpers.
5. Wire the `campaigns` Pro feature gate and verify mobile responsive layout.
6. Beta test with 2–3 Moroccan SMEs.
