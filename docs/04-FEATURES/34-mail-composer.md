# Mail Composer

> Canonical doc for composing, drafting, scheduling, and sending email in SMEMaster.

## Scope

The composer owns the message-authoring experience:

- new message, reply, reply-all, and forward flows
- modal, full-page, and separate-window presentation
- draft persistence and restore
- undo-send and scheduled send
- attachments, signatures, aliases, and editor state
- integration points for templates, AI, and compliance checks

This page intentionally avoids duplicating the full behavior of:

- account/auth lifecycle: `Core/04-accounts.md`
- inbox/thread behavior: `Core/01-email-management.md`
- templates: `24-templates.md`
- AI behavior: `22-ai-integration.md`
- compliance checks: `23-compliance-engine.md`

## Runtime Shape

The composer shares one state model across multiple render paths:

- overlay or in-thread compose UI
- full-page composer mode
- separate Tauri window entrypoints

Primary code areas:

- `src/features/mail/stores/composerStore.ts`
- `src/features/mail/components/composer/`
- `src/ComposerWindow.tsx`
- `src/ThreadWindow.tsx`

The goal is one compose state system with multiple shells, not multiple competing composer implementations.

## Send Support Matrix

| Provider        | Status                                                 | Notes                                                                                             |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Gmail API       | Supported                                              | Uses the active Gmail provider path.                                                              |
| IMAP/SMTP       | Supported                                              | Uses IMAP/SMTP provider-backed send flows.                                                        |
| Microsoft Graph | Not yet supported for provider-backed send/draft flows | Current provider selection throws a descriptive unsupported error for `microsoft_graph` accounts. |

If provider support changes, update this matrix and `Core/01-email-management.md` together.

## Main Responsibilities

### Draft lifecycle

The composer is responsible for:

- opening with prefilled state from thread or route context
- tracking recipients, subject, body, attachments, and signature state
- persisting drafts through the mail data layer
- restoring compose state cleanly after reopen or window transitions

### Send flow

The composer coordinates the user-facing send path, then hands execution off to the email action layer.

High-level flow:

1. collect the current compose snapshot
2. build the outbound message payload
3. run validation or pre-send checks
4. dispatch through the email action/service layer
5. either send immediately or queue when offline
6. update UI state, draft state, and undo/schedule state

The canonical send execution code lives in:

- `src/features/mail/services/emailActions.ts`
- `src/features/mail/services/email/providerFactory.ts`

### Scheduled send and undo-send

These are compose features, not separate mail subsystems. Keep detailed scheduling semantics here and keep general mail behavior in `Core/01-email-management.md`.

### Presentation modes

The composer supports:

- standard overlay/modal compose
- expanded or full-page compose
- dedicated window compose via Tauri window entrypoints

All three should reflect the same underlying compose state and feature availability.

## Integrations

### Templates

The composer can apply templates and template shortcuts, but template taxonomy, counts, and reusable content rules belong in `24-templates.md`.

### AI

The composer consumes AI assistance where available, but model/provider capability, prompt strategy, and AI feature scope belong in `22-ai-integration.md`.

### Compliance

The composer can surface pre-send checks and policy-aware warnings, but compliance rules and regulatory logic belong in `23-compliance-engine.md`.

### Signatures and aliases

These are compose-facing controls whose configuration is managed elsewhere in settings and account-related modules.

## Key Files

| Area                        | Files                                                    |
| --------------------------- | -------------------------------------------------------- |
| Compose state               | `src/features/mail/stores/composerStore.ts`              |
| Compose UI                  | `src/features/mail/components/composer/`                 |
| Shared editor components    | `src/shared/components/editor/`                          |
| Provider dispatch           | `src/features/mail/services/email/providerFactory.ts`    |
| Email action execution      | `src/features/mail/services/emailActions.ts`             |
| Separate window entrypoints | `src/ComposerWindow.tsx`, `src/ThreadWindow.tsx`         |
| Settings tab                | `src/features/settings/components/tabs/ComposingTab.tsx` |

## Boundaries

Keep this page focused on the compose surface. Do not re-copy:

- template category counts
- AI feature inventories
- compliance rule catalogs
- stale provider claims
- dated refactor notes that belong in release notes

When those subsystems change, update their dedicated docs and keep only the integration touchpoint here.
