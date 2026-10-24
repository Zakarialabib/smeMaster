# CRM & Contacts

> **Status:** Production — contacts, companies, deals pipeline, and Customer 360 timeline.
> **Stack:** React 19 + Zustand + Rust + SQLite

## Overview

CRM turns email people into managed relationships. Contacts link to companies, deals, invoices, and campaign memberships. The **Customer 360** timeline shows everything about a contact in one place.

## Architecture

```
CrmPage.tsx → dealStore.ts / contact wrappers
  → invokeCommand("db_*") → Rust (contacts, companies, deals domains)
  → SQLite (contacts, companies, deals, entity_pivots)
```

Contact–invoice–campaign links resolve through the `entity_pivots` polymorphic table and the `Relations` tab.

## Core Capabilities

| Area                     | What it does                                      | Key files                                                              |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **Contacts**             | CRUD, groups, segments, virtualized list          | `pages/CrmPage.tsx`                                                    |
| **Companies**            | Company records + switcher + `company_id` scoping | `components/` + `Invoicing-ERP/01-company-tenant.md`                   |
| **Deals pipeline**       | Kanban board, stages, drag-drop                   | `pages/DealsPage.tsx`, `stores/dealStore.ts`                           |
| **Deal cards**           | Per-deal view with stage + value                  | `components/deals/DealCard.tsx`, `DealColumn.tsx`, `PipelineBoard.tsx` |
| **Relationships**        | Contact ↔ company graph                           | `pages/PeopleRelationships.tsx`                                        |
| **Customer 360**         | Relations tab: company + invoices + campaigns     | `components/InvoicesTab.tsx` + mail `ContactSidebar`                   |
| **Contact intelligence** | Scoring and insight layer                         | `30-contact-intelligence.md`                                           |

## Deal Pipeline

Stages are configurable. Cards drag between columns (`@dnd-kit`). Each deal carries value, stage, company, and linked contact. Pipeline state lives in `dealStore.ts`.

## Customer 360

The mail `ContactSidebar` Relations tab shows:

1. Linked company (via `company_id`)
2. Company invoices (`listInvoices` by `company_id`)
3. Campaign memberships (`db_list_campaigns_by_contact`)

New Rust command `db_list_campaigns_by_contact` wraps `campaign_recipients::get_campaigns_for_contact`.

## Key Files

| Layer      | Path                                                        |
| ---------- | ----------------------------------------------------------- |
| Pages      | `src/features/crm/pages/` (Crm, Deals, PeopleRelationships) |
| Store      | `src/features/crm/stores/dealStore.ts`                      |
| Components | `src/features/crm/components/` (deals board, InvoicesTab)   |
| Rust       | `src-tauri/src/commands/` (contacts, companies, deals)      |

## Related Docs

- [Contact Intelligence](30-contact-intelligence.md) — scoring layer
- [Campaigns](02-campaigns-mail-merge.md) — campaign memberships
- [Invoicing](36-invoicing.md) — company invoices
- [Email Management](01-email-management.md) — ContactSidebar
