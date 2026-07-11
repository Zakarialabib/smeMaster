# Service Layer

> Current frontend service model: shared services, feature-local services, and the Rust boundary.

## Scope

This page describes how non-UI frontend logic is organized today.

It covers:

- shared services
- feature-local services
- database and command wrappers
- background-service observation from the frontend side

## Current Model

The service layer is feature-first, not one giant flat directory that owns everything equally.

Service code currently lives in two main places:

- `src/shared/services/` for cross-feature concerns
- `src/features/*/services/` for feature-specific behavior

This keeps behavior closer to the domain that uses it while still allowing shared infrastructure where needed.

## Major Service Buckets

### Shared services

Shared services usually own:

- AI helpers consumed by multiple features
- command wrappers
- DB wrapper access
- event infrastructure
- i18n and other app-wide utilities

### Feature-local services

Feature-local services usually own:

- mail provider and sync helpers
- campaign services
- contacts/segment/scoring helpers
- calendar provider logic
- task extraction or task-specific helpers
- deliverability analysis

## DB And Command Boundary

The frontend does not treat raw SQL as the normal access path.

Important pieces:

- `src/shared/services/db/db-invoke.ts`
- `src/shared/services/commands.ts`

These wrappers sit between frontend code and the Rust command surface. Contributors should extend the local pattern already used by the subsystem they are touching.

## Background Services

Background service lifecycle is backend-owned.

The frontend observes that state through hooks such as:

- `src/shared/hooks/init/useBackgroundServices.ts`

That hook should be understood as observational rather than as a service orchestrator.

## Practical Guidance

When adding logic:

1. put feature-specific behavior inside the owning feature first
2. move logic to `src/shared/services/` only when multiple domains truly share it
3. keep Rust-boundary concerns near existing wrappers
4. avoid inventing parallel service entrypoints for the same subsystem

## Related Docs

- `02-state-management.md`
- `11-typed-ipc.md`
- `../02-BACKEND/06-commands-reference.md`
