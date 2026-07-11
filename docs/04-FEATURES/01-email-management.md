# Email Management

> Canonical overview of the mail surface: inbox, accounts in use, sync, labels, thread actions, and offline-safe send flows.

## Scope

This page covers the live email product surface in SMEMaster:

- unified inbox and thread handling
- Gmail API and IMAP/SMTP account support
- local-first sync and queued operations
- labels, folders, search, and thread actions
- how email connects to composer, templates, and automation

This page does **not** duplicate deep implementation details that already have their own docs:

- account setup and auth: `04-accounts.md`
- composing and sending: `../34-mail-composer.md`
- templates: `../24-templates.md`
- rules and scheduled automations: `05-automation.md`

## Current Product Boundary

SMEMaster's email feature is built from a few cooperating modules:

- `src/features/mail/` owns inbox UI, message/thread data access, composer wiring, labels, filters, drafts, quick replies, templates, and send actions.
- `src/features/accounts/` owns account records, onboarding, and provider-aware setup flows.
- `src/features/settings/` hosts account, signature, shortcut, compliance, and related settings tabs.
- `src-tauri/src/commands/` and adjacent Rust modules own secure operations, provider integration, persistence, exports, and background services.

At runtime the app is local-first:

- message and thread state is mirrored into SQLite
- destructive or network-bound actions can be queued when offline
- frontend stores mirror backend state through typed IPC and domain events

## Provider Status

| Provider        | Status                                                              | Notes                                                                                              |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Gmail API       | Supported                                                           | OAuth-backed account flow and Gmail provider implementation are active.                            |
| IMAP/SMTP       | Supported                                                           | Generic and self-hosted accounts use IMAP/SMTP flows.                                              |
| Microsoft Graph | Account type exists, provider not yet active for send/draft actions | Current provider resolution throws a descriptive unsupported error for `microsoft_graph` accounts. |

The account lifecycle, OAuth handling, and credential storage rules live in `04-accounts.md`. This page stays focused on the email surface after an account exists.

## Main User Flows

### Inbox and thread triage

Core mail views support:

- thread listing and selection
- thread reading
- archive, delete, read/unread, and starring flows
- labels and filtering
- optimistic UI updates where appropriate

Key code areas:

- `src/features/mail/`
- `src/shared/services/db/threads.ts`
- `src/shared/services/db/messages.ts`
- `src/shared/services/events/`

### Compose and send

The composer is part of the email feature, but its detailed behavior is documented separately in `../34-mail-composer.md`.

Email management is responsible for the surrounding workflows:

- opening compose from inbox and thread contexts
- associating replies with the active thread/account
- surfacing drafts, pending operations, and queue status
- syncing the final result back into thread state

### Offline and retry behavior

When the app cannot complete a network action immediately, mail workflows can fall back to queued operations rather than failing permanently. This keeps email behavior aligned with the rest of the app's local-first model.

Relevant areas:

- `src/features/mail/services/emailActions.ts`
- `src/shared/services/db/db-invoke.ts`
- `src-tauri/src/services/offline_queue.rs`

## Data and Security

Mail state relies on SQLite plus Rust-managed secure operations.

Important rules:

- account secrets are not documented as plaintext feature behavior
- credential encryption and token handling are owned by backend/account docs
- email docs should describe user-facing behavior, not repeat stale token thresholds

If you need auth, token, or credential specifics, use `04-accounts.md` as the source of truth.

## Integrations

Email management integrates with several feature layers:

- `../34-mail-composer.md` for draft, send, schedule, attachments, and signatures
- `../24-templates.md` for reusable content
- `../22-ai-integration.md` for AI-assisted writing and related helpers
- `../23-compliance-engine.md` for pre-send and policy-aware checks
- `05-automation.md` for rule-based email reactions
- `08-tasks.md` when email activity creates follow-up work

## Key Files

| Area                             | Files                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mail feature root                | `src/features/mail/index.ts`, `src/features/mail/`                                                                                                                      |
| Account-aware provider selection | `src/features/mail/services/email/providerFactory.ts`                                                                                                                   |
| Email action execution           | `src/features/mail/services/emailActions.ts`                                                                                                                            |
| Shared DB access                 | `src/shared/services/db/messages.ts`, `src/shared/services/db/threads.ts`, `src/shared/services/db/labels.ts`                                                           |
| Native/backend mail commands     | `src-tauri/src/commands/imap.rs`, `src-tauri/src/commands/smtp.rs`, `src-tauri/src/commands/sync.rs`, `src-tauri/src/commands/comms.rs`, `src-tauri/src/commands/db.rs` |
| Backend mail DB domain           | `src-tauri/src/db/mail/`                                                                                                                                                |

## What To Update Here

Update this doc when any of the following changes:

- a provider becomes newly supported or deprecated
- the inbox/thread surface changes materially
- offline queue semantics change for mail actions
- the ownership boundary between email, accounts, composer, or automation moves

Do **not** add detailed token-refresh numbers, old component paths, or speculative provider claims here. Keep those details in the canonical subsystem docs or in code comments close to the implementation.
