# Accounts

> Account setup, authentication, provider selection, and account-management flows.

## Scope

This page is the canonical account-management doc for SMEMaster.

It covers:

- account records and provider-aware setup
- OAuth and credential-backed account flows
- account settings and management UI
- provider support boundaries that affect the product surface

It should remain the source of truth for provider status and account lifecycle behavior.

## Current Ownership

Primary frontend ownership spans:

- `src/features/accounts/`
- account-management settings UI under `src/features/settings/components/tabs/AccountsTab.tsx`

Representative files:

- `src/features/accounts/db/accounts.ts`
- `src/features/accounts/stores/accountStore.ts`
- `src/features/accounts/components/`
- `src/features/settings/components/tabs/AccountsTab.tsx`

Backend ownership includes:

- `src-tauri/src/commands/core.rs`
- account import and scan support in `src-tauri/src/commands/account_import.rs`

## Provider Status

Current product-facing provider reality:

| Provider        | Status                                                 | Notes                                                                                                                            |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Gmail API       | Supported                                              | Active account flow and provider-backed mail/calendar integrations exist.                                                        |
| IMAP/SMTP       | Supported                                              | Generic provider path for standard mail accounts.                                                                                |
| Microsoft Graph | Partial account presence, not full mail-action support | Account records can exist, but current mail provider dispatch does not support full send/draft operations for `microsoft_graph`. |
| CalDAV          | Calendar-related integration, not a mail provider      | Calendar ownership belongs partly to `07-calendar.md`.                                                                           |

Do not reintroduce speculative provider claims or token-lifecycle rules unless they are verified in code.

## What It Does

### Account setup and management

Accounts provide the connection between user identity, provider configuration, and the rest of the product's email/calendar workflows.

The account surface includes:

- add/edit/remove account workflows
- provider-specific setup flows
- settings-backed account management
- account import or system scan support where available

### Authentication and credentials

Account flows can involve OAuth-backed providers or credential-driven setups. The important product rule is that security-sensitive operations are backend-owned and should not be documented with stale frontend-only assumptions.

### Account import and pairing-adjacent flows

This page may reference account import or device-aware onboarding flows, but it should only describe the active commands and user-facing capabilities that exist now.

## Boundaries

Keep these responsibilities separate:

- inbox/thread behavior belongs to `01-email-management.md`
- compose/send behavior belongs to `../34-mail-composer.md`
- calendar provider behavior belongs to `07-calendar.md`
- device pairing belongs to `../33-device-pairing.md`

## Key Files

| Area                     | Files                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Account DB layer         | `src/features/accounts/db/accounts.ts`                                                       |
| Account store            | `src/features/accounts/stores/accountStore.ts`                                               |
| Account UI               | `src/features/accounts/components/`, `src/features/settings/components/tabs/AccountsTab.tsx` |
| Routes/settings shell    | `src/router/routeTree.tsx`, `src/features/settings/components/SettingsTabRegistry.ts`        |
| Backend account commands | `src-tauri/src/commands/core.rs`                                                             |
| System import support    | `src-tauri/src/commands/account_import.rs`                                                   |

## Update Rules

Update this page when:

- provider support changes materially
- token/credential lifecycle behavior changes in code
- account import capabilities expand or contract
- account ownership moves between dedicated feature and settings surfaces
