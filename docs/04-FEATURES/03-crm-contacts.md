# CRM And Contacts

> Contact management, groups, tags, segments, and contact-centric business context.

## Scope

This page is the canonical contact and CRM surface for SMEMaster.

It covers:

- contact CRUD
- groups and tags
- segment-oriented workflows
- contact detail and activity context
- contact import/export-adjacent workflows where contacts are the primary focus

Insight-oriented scoring and ranking belong to `../30-contact-intelligence.md`.

## Current Ownership

Primary code lives in:

- `src/features/contacts/`

Representative files:

- `src/features/contacts/pages/ContactsPage.tsx`
- `src/features/contacts/pages/ContactDetailPage.tsx`
- `src/features/contacts/stores/contactStore.ts`
- `src/features/contacts/db/contacts.ts`
- `src/features/contacts/services/groups.ts`
- `src/features/contacts/services/tags.ts`
- `src/features/contacts/services/segments.ts`
- `src/features/contacts/services/merge.ts`

Backend ownership includes:

- `src-tauri/src/commands/contacts.rs`
- CRM/contact tables under `src-tauri/src/db/tables/crm/`

## What It Does

### Contact management

The CRM layer lets users manage contact records and related metadata used throughout email, campaigns, tasks, and dashboard views.

### Groups, tags, and saved segmentation

The contact surface supports organizational structures such as:

- groups
- tags
- saved or refreshable segment workflows

This page should describe the active contact segmentation model and avoid mixing legacy segment terminology into the main user-facing description unless both systems remain intentionally supported.

### Contact context

The contact experience also includes context around the person or organization, such as related activity, linked records, and merge/dedup workflows.

### CSV import enhancements (2026-07-07)

The CsvImportWizard now includes a **downloadable CSV template** button showing the expected format (`email,display_name` columns) with a live preview. Users can download a pre-formatted `.csv` file to fill in before uploading.

### Company field on contacts

Contacts now carry an optional `company` field. When populated, the company name is displayed as a compact badge (Building2 icon) alongside the contact in:

- CampaignComposer AudienceStep contact selection
- Composer address chips (via `getContactByEmail` lookup)
- InlineReply expanded reply header

## Boundaries

Keep these responsibilities separate:

- engagement scoring and intelligence layers belong to `../30-contact-intelligence.md`
- campaign authoring belongs to `02-campaigns-mail-merge.md`
- general email/thread handling belongs to `01-email-management.md`

## Key Files

| Area                  | Files                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| Main pages            | `src/features/contacts/pages/ContactsPage.tsx`, `ContactDetailPage.tsx`          |
| Store                 | `src/features/contacts/stores/contactStore.ts`                                   |
| DB layer              | `src/features/contacts/db/contacts.ts`                                           |
| Services              | `src/features/contacts/services/groups.ts`, `tags.ts`, `segments.ts`, `merge.ts` |
| Route                 | `src/router/routeTree.tsx`                                                       |
| Backend commands      | `src-tauri/src/commands/contacts.rs`                                             |
| Backend schema/tables | `src-tauri/src/db/tables/crm/`, `src-tauri/src/db/contacts/`                     |

## Update Rules

Update this page when:

- the active segment model changes materially
- filtering/grouping behavior becomes substantially more capable
- CRM ownership moves out of the contacts feature
- contact detail pages gain major new responsibilities
