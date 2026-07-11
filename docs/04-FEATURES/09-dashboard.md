# Dashboard

> Cross-feature summary surface built from contacts, campaigns, tasks, workflow, and email-oriented metrics.

## Scope

The dashboard is the overview layer for the product. It combines data from multiple feature domains into a configurable summary experience.

This page covers:

- dashboard pages and widgets
- cross-feature aggregation
- dashboard state and layout behavior

It should not hardcode a stale widget list if the active widget inventory changes in code.

## Current Ownership

Primary frontend ownership lives in:

- `src/features/dashboard/`

Representative files:

- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/dashboard/stores/dashboardStore.ts`

Backend/dashboard data comes from multiple command modules rather than one single dashboard backend file.

Representative backend sources include:

- `src-tauri/src/commands/contacts.rs`
- `src-tauri/src/commands/crm.rs`
- `src-tauri/src/commands/tasks.rs`
- `src-tauri/src/commands/workflows.rs`

## What It Does

### Overview widgets

The dashboard presents summary widgets drawn from the rest of the app. The exact widget list should be kept aligned with the current store defaults and rendered page components.

### Cross-feature aggregation

Dashboard data is intentionally cross-cutting. It exists to summarize activity and health across multiple domains rather than introduce a separate business subsystem.

### Layout and visibility

The dashboard also owns widget layout and visibility behavior on the frontend side.

## Boundaries

Keep these responsibilities separate:

- detailed feature behavior remains owned by the feature-specific docs
- dashboard summaries should not become the canonical description of campaigns, contacts, tasks, or automation

## Key Files

| Area | Files |
| --- | --- |
| Main page | `src/features/dashboard/pages/DashboardPage.tsx` |
| Store | `src/features/dashboard/stores/dashboardStore.ts` |
| Feature root | `src/features/dashboard/index.ts` |
| Route | `src/router/routeTree.tsx` |
| Backend metric sources | `src-tauri/src/commands/contacts.rs`, `crm.rs`, `tasks.rs`, `workflows.rs` |

## Update Rules

Update this page when:

- the widget inventory changes materially
- dashboard layout/state ownership changes
- backend aggregation sources are restructured
