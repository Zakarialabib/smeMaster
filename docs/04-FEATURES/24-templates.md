# Templates

> Reusable message content, variables, and template-management workflows.

## Scope

Templates are the reusable content layer for email and campaign workflows.

This page covers:

- saved templates and template management
- variable-driven content
- template insertion points in compose and campaign flows
- related settings and editor surfaces

This page is the canonical place for template capability descriptions. Other docs should link here instead of duplicating category counts or preset lists.

## Current Ownership

Template functionality spans:

- mail data/storage
- settings management UIs
- compose and campaign insertion points

Representative code areas:

- `src/features/mail/db/templates.ts`
- `src/features/settings/components/TemplateManager.tsx`
- `src/features/settings/components/TemplateEditor.tsx`
- `src/features/settings/components/tabs/TemplatesTab.tsx`
- `src/features/mail/components/templates/`

## What It Does

### Reusable content

Templates let users store reusable message bodies and related metadata for repeated communication workflows.

### Variable support

Templates support variable-style content insertion so a template can adapt to recipient, sender, or workflow context.

### Insertion workflows

Templates are consumed in places such as:

- the composer
- campaign content flows
- settings-based management and editing surfaces

### Template Gallery (TemplateGallery)

The `TemplateGallery` component provides a grid/list view of available templates with filtering, search, and pagination. Pagination controls are rendered conditionally — only when there are filtered items and a positive total count. The gallery supports both grid (card) and list (row) view modes.

## Boundaries

Keep these responsibilities separate:

- full compose/send behavior belongs to `34-mail-composer.md`
- quick one-click snippets belong to `29-quick-replies.md`
- AI-assisted content generation belongs to `22-ai-integration.md`

This page owns reusable long-form template behavior and management.

## Key Files

| Area                          | Files                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Template storage              | `src/features/mail/db/templates.ts`                                          |
| Template UI                   | `src/features/settings/components/TemplateManager.tsx`, `TemplateEditor.tsx` |
| Template settings tab         | `src/features/settings/components/tabs/TemplatesTab.tsx`                     |
| Template insertion UI         | `src/features/mail/components/templates/`                                    |
| AI-related generation helpers | `src/shared/services/ai/templateGenerator.ts`                                |

## Documentation Rule

Do not repeat hardcoded template counts in multiple docs unless they are verified and maintained in one place. If counts, categories, or preset inventories change, update this file first and make other docs link here.
