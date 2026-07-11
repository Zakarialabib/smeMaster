# State Management

> Current state ownership model across feature stores, shared stores, and preference hooks.

## Scope

This page explains how state is organized today without freezing old store counts or stale inventories.

It covers:

- the difference between shared stores and feature stores
- where persistent preferences live
- how state and persistence relate
- what contributors should check before adding a new store

## Current Model

The app uses Zustand, but not every state concern belongs in one store.

The current model is split across:

- shared app-level stores under `src/shared/stores/`
- feature-specific stores under `src/features/*/stores/`
- view-preference hooks and small state helpers where a dedicated store would be overkill

## Ownership Layers

### Shared state

Shared stores hold app-wide concerns such as:

- notifications
- layout-shell behavior
- sync or global status
- UI state that crosses multiple features

### Feature state

Feature stores live close to the feature they serve, such as:

- accounts
- contacts
- mail threads and composer
- tasks
- campaigns
- dashboard
- automation
- vault

### Preference state

Not every persistent preference belongs in the same active store that drives a feature. Some preference behavior is better represented through dedicated hooks or settings-restoration flows.

Contributors should model the ownership around behavior, not around a desire to centralize everything.

## Persistence Relationship

Important rule:

- stores own frontend state
- persistence is handled through service or settings layers
- Rust/SQLite remain the durable source of truth for persisted application data

That means a store should not become an undocumented second database.

## Practical Guidance

Before creating a new store, ask:

1. is the state feature-local or app-wide?
2. is the state durable or ephemeral?
3. does an existing store already own this concern?
4. would a hook or derived selector be simpler than a new store?

## Related Docs

- `03-service-layer.md`
- `11-typed-ipc.md`
- `../01-ARCHITECTURE/03-data-model.md`
