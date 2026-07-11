# Account Cleaning

> Retention, cleanup, and account-maintenance workflows exposed through settings.

## Scope

Account cleaning covers the settings-driven cleanup surface for mailbox maintenance and related retention workflows.

This includes:

- cleanup rule management
- cleanup history and execution UI
- account-level maintenance actions exposed to users

## Current Ownership

This feature is primarily settings-hosted.

Representative files:

- `src/features/settings/components/tabs/AccountCleaningTab.tsx`
- `src-tauri/src/commands/workflows.rs` for cleanup-related commands

The cleanup system has dedicated storage and commands. It should not be documented as merely a synonym for generic automation rules.

## What It Does

The account-cleaning surface allows users to define or run cleanup-oriented rules for mailbox maintenance, such as retention and cleanup actions that apply to account data.

Important product rule:

- cleanup behavior is user-configured and settings-driven
- do not document a global built-in cleanup schedule unless one is actually enforced by the running product

## Boundaries

Keep these responsibilities separate:

- general trigger/action automation belongs to `05-automation.md`
- inbox/thread behavior belongs to `01-email-management.md`

Account cleaning is a specialized maintenance subsystem with its own UI and backend command path.

## Key Files

| Area | Files |
| --- | --- |
| Settings UI | `src/features/settings/components/tabs/AccountCleaningTab.tsx` |
| Settings registry | `src/features/settings/components/SettingsTabRegistry.ts` |
| Backend commands | `src-tauri/src/commands/workflows.rs` |

## Update Rules

Update this page when:

- cleanup rules move into or out of generic automation
- cleanup scheduling semantics change materially
- the settings UI gains major new maintenance capabilities
