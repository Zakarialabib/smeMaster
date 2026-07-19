# Frontend / Patterns — Deprecations & Technical Debt

> Auto-target of the `document-debt` postTask hook and the `/debt-doc frontend` command.
> Append new entries (newest at bottom) using the format in [`.trae/commands/debt-doc.md`](../../.trae/commands/debt-doc.md).

## Format

### YYYY-MM-DD: [Brief Title]

- **File**: `src/features/...` or `src/shared/...` (line N)
- **Severity**: WARNING / INFO
- **Issue**: What is wrong, deprecated, or off-pattern
- **Plan**: How to fix it in the future
- **Found during**: Context of how this was discovered

---

## Entries

### 2026-07-16: `workflowStore` deprecated — superseded by automation

- **File**: `src/features/workflows/stores/workflowStore.ts` (line 87, `useWorkflowStore`)
- **Severity**: WARNING
- **Issue**: The file is marked `@deprecated` ("This feature has been merged into @features/automation. Import from @features/automation instead."). It is still imported by `src/features/workflows/pages/WorkflowsPage.tsx` and `src/features/workflows/components/WorkflowEditor.tsx`, duplicating the automation feature's store (`automationStore`).
- **Plan**: Migrate `WorkflowsPage` / `WorkflowEditor` to `@features/automation` and delete `src/features/workflows/stores/workflowStore.ts` (and its `.test.ts`) once consumers are cut over.
- **Resolution (2026-07-19)**: DONE. `WorkflowsPage`, `WorkflowEditor`, `WorkflowStepCard`, `WorkflowList`, `WorkflowCard` now consume `useAutomationStore` from `@features/automation/stores/automationStore`; the deprecated `workflowStore.ts` + `workflowStore.test.ts` were deleted, and `WorkflowsPage.test.tsx` was repointed to mock `useAutomationStore`. `saveRule` serializes the step list only in `editorMode: "steps"`, so `WorkflowEditor.handleSave` now forces `editorMode: "steps"` before saving. Zustand store count dropped 43 → 42.
- **Found during**: audit of duplicate/dead Zustand stores.

### 2026-07-16: `useNotificationsStore` is a re-export alias, not a separate store

- **File**: `src/stores/index.ts` (line 36)
- **Severity**: INFO
- **Issue**: `useNotificationsStore` is re-exported as an alias of `useNotificationStore` from `@shared/stores/notificationStore` (singular). There is no `src/stores/shared/notificationsStore.ts` file — callers importing `useNotificationsStore` resolve to the canonical `@shared/stores/notificationStore`. Avoid adding a second `notificationsStore` file; prefer the canonical name.
- **Plan**: Standardize on `useNotificationStore` (canonical) and drop the `useNotificationsStore` alias when convenient.
- **Found during**: audit of duplicate/dead Zustand stores (verifying the `src/stores/shared/notificationsStore.ts` path, which does not exist).

### 2026-07-16: `useUIStore` lives in `src/stores/core`, not `src/shared/stores`

- **File**: `src/stores/core/uiStore.ts` (line 32, `useUIStore`)
- **Severity**: INFO
- **Issue**: The canonical UI store is `useUIStore` in `src/stores/core/uiStore.ts`, actively used by `useKeyboardShortcuts`, `useSettingsRestorer`, and others. There is no `src/shared/stores/uiStore.ts`. The `src/shared/stores/layoutStore.ts` header notes a migration path (`useLayoutStore` instead of `useUIStore(s => s.sidebarCollapsed)`), but `useUIStore` itself is not tests-only.
- **Plan**: Keep `useUIStore` in `src/stores/core`; route new layout state through `useLayoutStore` per the layoutStore migration note.
- **Found during**: audit of duplicate/dead Zustand stores (verifying the `src/shared/stores/uiStore.ts` path, which does not exist).

### 2026-07-16: `useCampaignsStore` canonical path is `src/features/campaigns`

- **File**: `src/features/campaigns/stores/campaignStore.ts` (re-exported via `src/stores/campaigns/index.ts` → `src/stores/index.ts` line 29)
- **Severity**: INFO
- **Issue**: The campaign store is the canonical `useCampaignsStore` under `src/features/campaigns/stores/`. There is no `src/stores/campaigns/campaignStore.ts` file (only `campaignStore.test.ts` and `index.ts` exist under `src/stores/campaigns/`). It is not a duplicate of another campaigns store.
- **Plan**: No action — documented to correct the mistaken `src/stores/campaigns/campaignStore.ts` path from the audit.
- **Found during**: audit of duplicate/dead Zustand stores (verifying the `src/stores/campaigns/campaignStore.ts` path, which does not exist).
