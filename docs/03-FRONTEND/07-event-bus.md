# Frontend Event Bus

> Current frontend event routing for Rust-emitted events and app-level reactivity.

## Scope

This page documents the frontend side of event handling.

It covers:

- the `core-event` channel
- the frontend `eventBus.ts` layer
- replay and heartbeat behavior
- how frontend consumers should subscribe

## Current Model

Frontend event handling is centered on:

- `src/shared/services/events/eventBus.ts`

Rust emits events through a shared Tauri event channel, and the frontend event bus routes them by `kind`.

The important thing to understand is that this is not the same thing as the Rust internal event system. The frontend bus is the WebView-side routing layer for events that cross the Tauri boundary.

## What It Does

The frontend event bus currently provides:

- one central listener for the `core-event` channel
- dispatch by event `kind`
- registration/unregistration of handlers
- last-event replay buffers by kind
- heartbeat monitoring helpers

## Typical Consumers

Typical frontend consumers include:

- sync-related UI
- notification flows
- composer-opening flows
- share-handling flows
- startup/init state observers

Consumers should subscribe through the shared bus rather than inventing duplicate ad hoc listeners for the same event family.

## Boundaries

Keep this distinction clear:

- frontend bus: routes Rust-emitted events after they reach the WebView
- Rust event system: internal backend event production, processing, and bridging

The backend side is documented in `../02-BACKEND/11-event-system.md`.

## Practical Guidance

When adding a new event:

1. define or update the Rust event source
2. ensure it is bridged to the frontend as needed
3. update the frontend event bus or consumer typing where appropriate
4. subscribe in the owning UI/store layer instead of scattering one-off listeners

## Related Docs

- `../02-BACKEND/11-event-system.md`
- `11-typed-ipc.md`
- `../01-ARCHITECTURE/01-overview.md`
