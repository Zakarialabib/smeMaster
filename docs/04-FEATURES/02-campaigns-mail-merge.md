# Campaigns

> Campaign composition, audience targeting, and analytics-oriented outreach workflows.

## Scope

The campaigns feature covers the product surface for planned outbound email campaigns:

- campaign creation and editing
- audience selection and mail-merge style personalization
- campaign analytics and reporting surfaces
- campaign-specific stores and services

This page documents the current shipped campaign surface. It should not promise scheduling, recurring delivery, or analytics tables that are not wired end to end in the current codebase.

## Current Ownership

Primary code lives in:

- `src/features/campaigns/`
- shared campaign persistence and store logic under the same feature
- Rust campaign and CRM command layers in the backend

Representative files:

- `src/features/campaigns/components/CampaignPage.tsx`
- `src/features/campaigns/components/CampaignComposer.tsx`
- `src/features/campaigns/components/CampaignAnalytics.tsx`
- `src/features/campaigns/services/campaignService.ts`
- `src/features/campaigns/stores/campaignStore.ts`
- `src/features/campaigns/stores/campaignComposerStore.ts`

Backend ownership includes:

- `src-tauri/src/commands/crm.rs`
- `src-tauri/src/db/campaigns/`

## What It Does

### Campaign authoring

The campaigns feature gives users a dedicated flow to:

- create a campaign record
- choose content and audience inputs
- manage campaign metadata and A/B-related state
- review campaign-level analytics surfaces

### Audience and merge workflows

Campaigns integrate with contact and segment data so content can be personalized against audience context. The mail-merge layer belongs here; reusable content itself belongs in `../24-templates.md`.

The contacts query in CampaignComposer now includes `display_name` and `company` fields (in addition to `name` and `email`). The AudienceStep renders a compact company badge (Building2 icon) next to each contact when the `company` field is populated, giving senders quick organizational context during audience selection.

### Analytics surfaces

Campaign analytics are part of the product surface, but this doc should describe only the analytics that are currently represented in the live UI and service layer. Do not reintroduce undocumented tables or speculative reporting pipelines.

## Boundaries

Keep these responsibilities separate:

- reusable templates belong to `../24-templates.md`
- general email sending and compose UX belong to `../34-mail-composer.md`
- deliverability and sender-health checks belong to `../21-deliverability.md`
- CRM audience data belongs to `03-crm-contacts.md`

## Key Files

| Area              | Files                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Main page         | `src/features/campaigns/components/CampaignPage.tsx`                         |
| Campaign editor   | `src/features/campaigns/components/CampaignComposer.tsx`                     |
| Analytics UI      | `src/features/campaigns/components/CampaignAnalytics.tsx`                    |
| Service layer     | `src/features/campaigns/services/campaignService.ts`                         |
| State             | `src/features/campaigns/stores/campaignStore.ts`, `campaignComposerStore.ts` |
| Route             | `src/router/routeTree.tsx`                                                   |
| Backend commands  | `src-tauri/src/commands/crm.rs`                                              |
| Backend DB domain | `src-tauri/src/db/campaigns/`                                                |

## Update Rules

Update this page when:

- campaign scheduling becomes a fully wired capability
- analytics ownership or schema changes materially
- campaign flows move out of the dedicated campaigns feature module
- audience/merge behavior changes in ways users should understand
