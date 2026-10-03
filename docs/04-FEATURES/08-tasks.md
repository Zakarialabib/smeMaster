# Tasks

> **Status:** Production — priorities, recurrence, linked work, and four views.
> **Stack:** React 19 + Zustand + Rust + SQLite

## Overview

Tasks handle personal and linked work: priorities, recurrence, kanban, calendar overlay, and AI extraction from email. The workflow engine drives state transitions.

## Architecture

```
TasksPage.tsx → taskStore.ts → taskManager.ts / taskWorkflowEngine.ts
  → invokeCommand("db_*") → Rust (tasks domain)
  → SQLite (tasks table)
```

View prefs (list/kanban/calendar/agenda) persist per user via `useTaskViewPrefs`.

## Core Capabilities

| Area                | What it does                                        | Key files                                                                     |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Task CRUD**       | Create modal, detail panel, quick-add, mobile sheet | `components/TaskCreateModal.tsx`, `TaskDetailPanel.tsx`, `TaskQuickAdd.tsx`   |
| **List view**       | Virtualized, density-aware, smart filters           | `components/TaskListView.tsx`, `SmartFilterBar.tsx`                           |
| **Kanban view**     | Columns + cards + drag-drop                         | `components/TaskKanbanView.tsx`, `TaskKanbanColumn.tsx`, `TaskKanbanCard.tsx` |
| **Calendar view**   | Tasks on calendar grid                              | `components/TaskCalendarView.tsx`, `TaskCalendarDay.tsx`                      |
| **Agenda view**     | Day agenda drawer                                   | `components/TaskAgendaView.tsx`, `DayAgendaDrawer.tsx`                        |
| **Sidebar**         | Filters + navigation                                | `components/TaskSidebar.tsx`                                                  |
| **Workflow engine** | State machine for task lifecycle                    | `services/taskWorkflowEngine.ts`, `hooks/useTaskWorkflowEngine.ts`            |
| **AI extraction**   | Extract tasks from email body                       | `components/AiTaskExtractDialog.tsx`, `AiTaskSuggestionBanner.tsx`            |
| **Schedule page**   | Combined plan view                                  | `pages/SchedulePage.tsx`                                                      |

## Views

| View         | Component          | Best for             |
| ------------ | ------------------ | -------------------- |
| **List**     | `TaskListView`     | Triage, bulk actions |
| **Kanban**   | `TaskKanbanView`   | Pipeline, drag-drop  |
| **Calendar** | `TaskCalendarView` | Due-date planning    |
| **Agenda**   | `TaskAgendaView`   | Day-at-a-glance      |

## AI Integration

- **AI task extraction:** `AiTaskExtractDialog` parses email bodies into task candidates
- **AI suggestions:** `AiTaskSuggestionBanner` surfaces follow-ups
- Both route through the shared AI provider layer (`22-ai-integration.md`)

## Key Files

| Layer      | Path                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| Store      | `src/features/tasks/stores/taskStore.ts`                                              |
| Services   | `src/features/tasks/services/` (manager, workflowEngine, errorHandler)                |
| Hooks      | `src/features/tasks/hooks/` (`useTasks`, `useTaskViewPrefs`, `useTaskWorkflowEngine`) |
| DB wrapper | `src/features/tasks/db/tasks.ts`                                                      |
| Components | `src/features/tasks/components/` (views, modals, filters)                             |

## Related Docs

- [Calendar](07-calendar.md) — tasks on calendar
- [Email Management](01-email-management.md) — extraction source
- [AI Integration](22-ai-integration.md) — provider layer
- [Keyboard Shortcuts](31-keyboard-shortcuts.md) — task shortcuts
