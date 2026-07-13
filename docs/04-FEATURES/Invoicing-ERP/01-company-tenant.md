# Company & ERP — Tenant Model

> SMEMaster is **multi-tenant**: almost every business row carries a
> `company_id`. This document explains what a "company" is, how switching works
> today, and where `company_id` is used.

---

## WHAT is a company?

A **company** is the tenant that owns business data — contacts, clients,
invoices, workflow rules, journal entries, inventory. It is identified by
`company_id` (a string UUID/key) and described by a small `Company` shape:

```ts
interface Company {
  id: string;     // company_id used across the DB
  name: string;   // display name, e.g. "Atlas Trading SARL"
  ice: string;    // Moroccan ICE (Identifiant Commun de l'Entreprise)
  role: string;   // current user's role in this company (mock)
}
```

The ERP module (General Ledger, Journal, Stock, Wallet, RBAC roles, Financial
Reports) lives under `src/features/erp/` and is the financial face of the active
company.

## WHY a company model?

- **Data isolation:** every query is scoped by `company_id`, so one install can
  serve multiple legal entities without cross-contamination.
- **Local-first compliance:** Moroccan businesses need ICE on invoices and
  per-company ledgers — the tenant key makes that natural.
- **Future multi-seat:** the same key underpins the eventual Platform-tier
  multi-company switching.

## WHERE is it?

- **State:** `useCompanyStore` (`src/features/erp/companyStore.ts`).
- **Switcher UI:** `CompanySwitcher` (`src/features/erp/CompanySwitcher.tsx`) —
  a dropdown in the shell showing the active company's initials, name, role and
  ICE, with a list to switch.
- **Shared constant:** `ACTIVE_COMPANY_ID` (`src/shared/constants/company.ts`)
  — single source of truth for the demo company key, imported by invoicing and
  contacts so they stay in sync.
- **Pages:** `ErpPage` + `FinancialReports`, `JournalView`, `StockView`,
  `WalletView`, `RbacRoles` (`src/features/erp/`).

## HOW switching works (current state)

> ⚠️ **Demo only.** The store ships with three `MOCK_COMPANIES`
> (`demo-company-1/2/3`). `setActiveCompany(id)` updates
> `activeCompanyId` in the Zustand store, and `getActiveCompany(...)` resolves
> the active record. The switcher UI explicitly states:
> *"Demo only — real multi-company switching ships with the Platform tier."*
>
> The `company_id` is therefore a **scoping key already wired through the data
> layer**; full multi-company data isolation + switching UX is a Platform-tier
> feature, not yet enforced at the auth/storage boundary.

### Where `company_id` is used

- `contacts` — every contact row carries `company_id` (the unification migration
  added it; previously the upsert omitted it, which blocked contact creation —
  now fixed).
- `clients` (legacy) and `invoices` — scoped by company.
- `workflow_rules` — `list(company_id)`, `list_by_trigger(company_id, ...)`.
- ERP tables (journal, stock, wallet) — tenant-scoped.

## WHEN to care

You care about `company_id` whenever you add a new business table: add the
column, scope every query by it, and use `ACTIVE_COMPANY_ID` (or the resolved
active company) as the value. Do **not** hard-code the id outside
`src/shared/constants/company.ts`.

## UX / design notes

- The switcher matches the app's flat/glass tokens (same as the account switcher
  and Contacts/Task toolbars).
- Active company is highlighted; non-active show a "Switch" affordance.
- A `DemoBadge` and an inline note make the mock status unmistakable to testers.

## Testing

- `companyStore.test.ts` — `getActiveCompany` fallback, `companyInitials`,
  switch behaviour.
