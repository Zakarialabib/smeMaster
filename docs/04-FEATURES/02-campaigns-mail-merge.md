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

### Block-based email editor (2026-07-13)

The template step of the `CampaignComposer` wizard is now powered by a Paperling-grade
block editor instead of a free-text body field. The editor is built on a small, typed
content model (`EmailBlock`) and a pure renderer (`renderEmailHtml`) so the same block
array drives both the live preview and the persisted `body_html`.

Components (all under `src/features/campaigns/components/editor/`):

- `CampaignBuilder` — assembles the editor + config panel + live preview + AI copilot.
- `EmailEditor` — scrollable block canvas with an inline `BlockPalette` (+ block) trigger.
- `BlockList` / `BlockWrapper` — `@dnd-kit` drag-to-reorder, click-to-select, duplicate, delete.
- Block components: `HeadingBlock`, `ParagraphBlock`, `ImageBlock`, `ButtonBlock`, `DividerBlock`, `SpacerBlock`.
- `config/` — `BlockConfigPanel` + `TypographyConfig` / `ColorConfig` / `AlignmentConfig` / `LinkConfig`.
- `Preview/EmailPreview` — `<iframe srcDoc>` live preview with desktop/mobile width toggle.
- `ai/AIPanel` — AI copilot wired to the real provider (`callAi`); subject/body/rewrite/tone/translate.
- `VaultFilePicker` — inserts images from the real Vault storage into Image blocks.
- `starterTemplates.ts` — welcome / newsletter / promo starter block sets shown when empty.
- Block types: `heading`, `paragraph`, `image`, `button`, `divider`, `spacer`, plus
  `card` (image + title + body + button promo card) and `columns` (two side-by-side
  raw-HTML columns); each has its own component, renderer branch, and config panel.
- A/B testing panel (in `CampaignBuilder`) — toggle A/B, set variant A/B **subjects**
  and split ratio; persisted via the store's `abEnabled` / `variantA` / `variantB` /
  `splitRatio` and the `ab_test_config` column on send.
- Saved-template gallery — when empty, the editor lists existing campaign templates
  (`getCampaignTemplateList`); `htmlToBlocks()` reverse-parses a template's `body_html`
  into editable blocks so stored templates become editable, not just insertable.

State lives in `campaignComposerStore`: `blocks`, selection, `addBlock` / `removeBlock` /
`duplicateBlock` / `moveBlock` / `updateBlock`, and an undo/redo history stack. On save,
`store.getBodyHtml()` is persisted as `body_html` through `campaignService` → Rust
`db_create_campaign_with_recipients` (the `campaigns` table now stores `body_html`).

Save-as-template persists the rendered HTML as a `templates` row (`template_type =
`'campaign'`) via `db_create_campaign_template`, so it reappears in the existing
`CampaignTemplatePicker` gallery.

> Note: the legacy `TemplateStep.tsx` (free-text A/B body editor) was removed when the
> block editor replaced it; A/B subject testing now lives in the `CampaignBuilder` panel.

### Audience and merge workflows

Campaigns integrate with contact and segment data so content can be personalized against audience context. The mail-merge layer belongs here; reusable content itself belongs in `../24-templates.md`.

The contacts query in CampaignComposer now includes `display_name` and `company` fields (in addition to `name` and `email`). The AudienceStep renders a compact company badge (Building2 icon) next to each contact when the `company` field is populated, giving senders quick organizational context during audience selection.

### Analytics surfaces

Campaign analytics are part of the product surface, but this doc should describe only the analytics that are currently represented in the live UI and service layer. Do not reintroduce undocumented tables or speculative reporting pipelines.

### Feature access (Simplified Core, Iteration 4)

Campaigns are gated behind the **Pro** feature flag (`campaigns`: `basicLimit: 0`, `proLimit: null`). The gate is enforced in the campaigns feature via `useFeatureFlagStore` + the `UpgradeBanner` (the composer/list surface is shown read-only to non-Pro tiers); the generic `<FeatureGate>` component is not used by this feature. The `CampaignComposer` wizard (audience → template/editor → schedule → review) ships on desktop/tablet; the template step is the block editor described above, with a mobile view-only card layout (status, recipient counts, retry queued operations). Campaign templates are filtered from the `templates` table by `template_type = 'campaign'`, and the feature reuses the existing `campaigns` / `templates` / `pending_operations` tables — no new backend tables are introduced.

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
| Block editor       | `src/features/campaigns/components/editor/` (CampaignBuilder, blocks, config, Preview, ai, VaultFilePicker) |
| Block model        | `src/features/campaigns/components/editor/types.ts`, `src/features/campaigns/services/emailRenderer.ts`, `blockDefaults.ts` |
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

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| Block model `emailRenderer.ts` under `components/editor/` | Actual path `src/features/campaigns/services/emailRenderer.ts` | `find src/features/campaigns -iname '*render*'` → only `services/emailRenderer.ts` + `editor/EmailEditor.tsx` |
