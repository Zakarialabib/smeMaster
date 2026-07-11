# Automation

> Trigger/action rules, automation management, and automation-oriented routing.

## Scope

Automation is the canonical home for rule-based behavior in SMEMaster.

It covers:

- rule creation and editing
- trigger/action automation flows
- automation settings and routes
- preset-based automation starting points

The separate `../27-workflow-engine.md` page exists only as a compatibility note for legacy workflow naming.

## Current Ownership

Primary frontend ownership spans:

- `src/features/automation/`
- automation-related settings and workflow persistence helpers

Representative files:

- `src/features/automation/pages/AutomationPage.tsx`
- `src/features/automation/stores/automationStore.ts`
- `src/features/automation/components/`
- `src/features/settings/db/workflowRules.ts`

Backend ownership includes:

- `src-tauri/src/commands/workflows.rs`

## What It Does

### Rule management

Users can create, edit, toggle, and remove automation rules through the automation surface.

### Trigger/action model

Automation is based on a structured trigger/action model. This doc should describe the model at a product level without freezing stale trigger catalogs if the active list changes.

### Presets and builder flows

Automation includes preset-backed starting points and builder/editor flows. If the preset inventory changes, update this page from the maintained source rather than keeping duplicated counts elsewhere.

### Routing and naming

The product should prefer "Automation" as the active user-facing concept. Older workflow naming is preserved only where legacy code still exists.

## Boundaries

Keep these responsibilities separate:

- mail filtering belongs to `../28-filters.md`
- account cleaning belongs to `06-account-cleaning.md`
- template content belongs to `../24-templates.md`

Automation owns the cross-action orchestration model, not every rule-like subsystem in the app.

## Key Files

| Area                             | Files                                                    |
| -------------------------------- | -------------------------------------------------------- |
| Main page                        | `src/features/automation/pages/AutomationPage.tsx`       |
| Store                            | `src/features/automation/stores/automationStore.ts`      |
| Feature root                     | `src/features/automation/`                               |
| Settings-side persistence helper | `src/features/settings/db/workflowRules.ts`              |
| Legacy workflows settings tab    | `src/features/settings/components/tabs/WorkflowsTab.tsx` |
| Route                            | `src/router/routeTree.tsx`                               |
| Backend commands                 | `src-tauri/src/commands/workflows.rs`                    |

## Update Rules

Update this page when:

- automation trigger/action behavior changes materially
- the route and naming boundary with legacy workflows changes
- presets or automation builders become a larger subsystem with their own docs
