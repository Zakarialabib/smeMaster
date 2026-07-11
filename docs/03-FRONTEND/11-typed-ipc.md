# Typed IPC

> Current guidance for frontend-to-Rust command calling and typed boundary management.

## Scope

This page describes the current IPC boundary as it exists today.

It covers:

- how frontend code calls Tauri commands
- where typed wrappers exist
- where raw `invoke()` still appears
- the naming and DTO rules that matter when changing command interfaces

## Current Model

The frontend does not rely on one perfect universal IPC abstraction.

Instead, the current model is mixed but structured:

- shared generic wrappers in `src/shared/services/commands.ts`
- DB-oriented wrappers in `src/shared/services/db/db-invoke.ts`
- direct `@tauri-apps/api/core` usage in specialized subsystems where that pattern already exists

This is normal for the current codebase. Contributors should extend the established pattern inside a subsystem instead of forcing one abstraction everywhere.

## Important Boundary Rules

The most important data-contract rules are:

- frontend request objects usually prefer `camelCase`
- Rust command DTOs can use serde renaming to preserve ergonomic frontend contracts
- column names and dynamic update maps often stay `snake_case`
- exact command names matter; mismatches become runtime failures

## Where To Look

When tracing an IPC flow, check:

1. `src/shared/services/commands.ts`
2. `src/shared/services/db/db-invoke.ts`
3. any feature-local service that still uses direct `invoke()`
4. `src-tauri/src/commands/mod.rs`
5. the owning Rust command module

## Practical Guidance

When adding or changing IPC:

1. always call commands through `invokeCommand`; do not import `invoke` from `@tauri-apps/api/core` in application code
2. when a typed, reusable family exists (e.g. DB helpers in `db/invoke/*.ts`), prefer the typed helper — it still routes through `invokeCommand`
3. keep request/response shapes consistent across Rust and TypeScript
4. prefer typed wrappers when the same command family is called from multiple places
5. update feature or backend docs only when user-visible behavior changes

## Related Docs

- `../02-BACKEND/06-commands-reference.md`
- `../01-ARCHITECTURE/03-data-model.md`
- `../05-DEVELOPMENT/04-agent-guide.md`
