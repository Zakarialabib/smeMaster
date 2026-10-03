# Email Management

> **Status:** Production — the core of SMEMaster. Inbox, threads, sync, triage, compose, search, and automation all live here.
> **Stack:** React 19 + Zustand + Rust (`async-imap`, `lettre`) + SQLite (WAL)

## Overview

Email is the hub. Everything else (CRM, campaigns, tasks, calendar) branches off the people and messages in the inbox. The mail feature handles:

- Multi-account inbox with threading
- Delta sync (Gmail, Microsoft Graph, IMAP/SMTP)
- Triage (star, snooze, labels, smart folders, filters)
- Compose (drafts, send, schedule, undo-send)
- Search (full-text + structured query + smart-folder queries)
- Offline-first queue (compose offline → outbox → auto-flush)

## Architecture

```
React UI (src/features/mail/)
  │ hooks: useEmailThreads, useEmailMutations, useLabels, useUndoSend
  │ stores: threadStore, labelStore, composerStore, smartFolderStore
  ▼
Service layer (src/features/mail/services/)
  │ threading, search, filters, snooze, queue, gmail, microsoft, imap
  ▼
invokeCommand("db_*") → Rust commands (src-tauri/src/commands/)
  ▼
SQLite (threads, messages, labels, smart_folders, signatures, templates)
```

All mutations go through `useEmailMutations` (optimistic + offline-aware). No direct SQL in TypeScript.

## Core Capabilities

| Area                        | What it does                                                | Key files                                                                             |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Inbox & threads**         | Threaded list, virtualized, density-aware rows              | `stores/threadStore.ts`, `hooks/useEmailThreads.ts`                                   |
| **Sync**                    | Gmail delta sync, Graph sync, IMAP IDLE + reconnect backoff | `services/gmail/sync.ts`, `services/imap/imapSync.ts`, `services/microsoft/client.ts` |
| **Triage**                  | Star, snooze, labels, archive, trash, spam                  | `hooks/useEmailMutations.ts`, `services/snooze/snoozeManager.ts`                      |
| **Compose**                 | Drafts, send, schedule, aliases, undo-send (5s window)      | `stores/composerStore.ts`, `hooks/useUndoSend.ts`, `hooks/useAutoDraft.ts`            |
| **Search**                  | Full-text + structured parser + smart-folder queries        | `services/search/searchParser.ts`, `services/search/searchQueryBuilder.ts`            |
| **Filters**                 | Rule-based filtering with test mode                         | `services/filters/filterEngine.ts`, `services/filters/filterTester.ts`                |
| **Smart labels**            | Auto-labeling, backfill, rule manager                       | `services/smartLabels/smartLabelService.ts`, `db/smartLabelRules.ts`                  |
| **Smart folders**           | Saved queries as virtual folders                            | `db/smartFolders.ts`, `stores/smartFolderStore.ts`                                    |
| **Snooze & scheduled send** | Snooze manager + deferred-send worker                       | `services/snooze/snoozeManager.ts`, `services/snooze/scheduledSendManager.ts`         |
| **Attachments**             | Vault integration, pre-cache, categorization                | `services/attachments/vaultService.ts`, `services/attachments/cacheManager.ts`        |
| **Templates**               | Render pipeline + campaign variables                        | `services/templates/renderPipeline.ts`, `db/templates.ts`                             |
| **Follow-up**               | Follow-up manager + scheduled nudges                        | `services/followup/followupManager.ts`                                                |
| **Offline queue**           | Outbox with exponential backoff flush                       | `services/queue/queueProcessor.ts`                                                    |

## Email Providers

| Provider              | Transport               | Auth              | Sync                                      |
| --------------------- | ----------------------- | ----------------- | ----------------------------------------- |
| **Gmail**             | Gmail API               | OAuth2 PKCE       | Delta sync (`syncManager.ts`)             |
| **Microsoft 365**     | Graph API               | OAuth2 PKCE       | Graph delta (`microsoftGraphProvider.ts`) |
| **Generic IMAP/SMTP** | `async-imap` / `lettre` | Password / OAuth2 | IMAP IDLE + reconnect                     |

Provider auto-discovery lives in `services/imap/autoDiscovery.ts` and `services/gmail/auth.ts`.

## Offline-First Behavior

1. Compose offline → message queued in outbox (`queueProcessor.ts`)
2. Reconnect → outbox flushes automatically (1s → 60s backoff)
3. `OfflineIndicator` + `OfflineQueueIndicator` show queue state
4. All list queries paginated (`LIMIT/OFFSET`, PAGE_SIZE=50)

## AI Integration

| Capability                 | Where                                              |
| -------------------------- | -------------------------------------------------- |
| Smart-label suggestions    | `services/smartLabels/` + `services/autoLabeling/` |
| Writing-style profiles     | `db/writingStyleProfiles.ts`                       |
| AI copilot in composer     | `34-mail-composer.md`                              |
| Task extraction from email | `AiTaskExtractDialog` (tasks feature)              |
| Refreshable AI cache       | `hooks/useRefreshableAiCache.ts`                   |

## Key Files

| Layer         | Path                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Stores        | `src/features/mail/stores/` (thread, label, composer, smartFolder, contextMenu)                                 |
| Hooks         | `src/features/mail/hooks/` (`useEmailThreads`, `useEmailMutations`, `useLabels`, `useUndoSend`, `useAutoDraft`) |
| Services      | `src/features/mail/services/` (gmail, microsoft, imap, search, filters, snooze, queue, templates, attachments)  |
| DB wrappers   | `src/features/mail/db/` (threads, labels, smartFolders, signatures, templates)                                  |
| Rust commands | `src-tauri/src/commands/` (mail, sync, labels domains)                                                          |

## Related Docs

- [Composer](34-mail-composer.md) — drafting, send, schedule
- [Templates](24-templates.md) — reusable content
- [Filters](28-filters.md) — rule-based filtering
- [Automation](05-automation.md) — trigger/action rules
- [AI Integration](22-ai-integration.md) — providers and helpers
