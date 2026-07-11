# Tasks

> Task management, task views, and task-linked workflow support.

## Scope

The tasks feature covers:

- task CRUD
- list, board, agenda, and related task views
- recurrence and date-oriented workflows
- task detail and linked-entity context
- task integrations with mail and automation

This page should describe the active task product surface without over-claiming always-on AI behavior that is not currently wired.

## Current Ownership

Primary frontend ownership lives in:

- `src/features/tasks/`

Representative files:

- `src/features/tasks/components/TasksPage.tsx`
- `src/features/tasks/stores/taskStore.ts`
- `src/features/tasks/hooks/useTaskViewPrefs.ts`
- `src/features/tasks/components/AiTaskExtractDialog.tsx`

Backend ownership includes:

- `src-tauri/src/commands/tasks.rs`
- `src-tauri/src/db/tasks/`

## What It Does

### Task management

The tasks feature gives users a dedicated task surface with multiple ways to view and manage work items.

### View modes and preferences

Task display preferences are not owned solely by the main task store; view-related state can live in dedicated hooks or preference layers. Keep this page aligned with the actual ownership split between task state and task-view preferences.

### Linked work context

Tasks can surface linked business context, making the feature useful as part of a larger workflow rather than a standalone todo list.

### AI-assisted task extraction

AI support in the current product should be described carefully:

- task-related AI assistance exists
- extraction/review flows are present
- do not document it as a fully autonomous always-on task system unless the code proves that behavior

## Boundaries

Keep these responsibilities separate:

- automation rules belong to `05-automation.md`
- contact intelligence belongs to `../30-contact-intelligence.md`
- general AI platform behavior belongs to `../22-ai-integration.md`

## Key Files

| Area             | Files                                                   |
| ---------------- | ------------------------------------------------------- |
| Main page        | `src/features/tasks/components/TasksPage.tsx`           |
| Store            | `src/features/tasks/stores/taskStore.ts`                |
| View preferences | `src/features/tasks/hooks/useTaskViewPrefs.ts`          |
| AI extraction UI | `src/features/tasks/components/AiTaskExtractDialog.tsx` |
| Feature root     | `src/features/tasks/index.ts`                           |
| Route            | `src/router/routeTree.tsx`                              |
| Backend commands | `src-tauri/src/commands/tasks.rs`                       |
| Backend DB       | `src-tauri/src/db/tasks/`                               |

## Update Rules

Update this page when:

- task-view ownership changes
- AI task behavior becomes substantially more autonomous
- task-linked entity support changes materially
- the tasks feature gains major new workflow responsibilities
