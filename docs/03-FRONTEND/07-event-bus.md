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

---

## The `uiBus` (cross-component UI signals)

> **File:** `src/shared/services/events/uiBus.ts`

In addition to the Rust-bridged `eventBus.ts` (domain data-sync events), the
frontend has a second, lighter bus for **cross-component UI signals** — "open
the command palette", "toggle the shortcuts help", "local data changed,
refresh". These are not domain events and never cross the Tauri boundary.

### Why `uiBus` exists

The codebase previously used stringly-typed `window.dispatchEvent(new Event("smemaster-*"))`
calls. That pattern was removed because:

- No compile-time safety on event names or payload shapes.
- Listeners leak if cleanup is missed.
- Scattered one-off `window.addEventListener` calls are hard to audit.

`uiBus` replaces it with a small, fully-typed emitter backed by a single
`EventTarget`. One import, one typed contract, automatic listener cleanup via
`uiBus.on(...)` returning an unsubscribe function.

### Event contract

The typed event map (`UiBusEventMap`) currently defines:

| Event                    | Payload                                        | Replaces                           |
| ------------------------ | ---------------------------------------------- | ---------------------------------- |
| `data:changed`           | `void`                                         | `smemaster-sync-done`              |
| `toggle:command-palette` | `void`                                         | `smemaster-toggle-command-palette` |
| `toggle:shortcuts-help`  | `void`                                         | `smemaster-toggle-shortcuts-help`  |
| `toggle:ask-inbox`       | `void`                                         | `smemaster-toggle-ask-inbox`       |
| `toggle:template-demo`   | `void`                                         | `smemaster-toggle-template-demo`   |
| `move-to-folder`         | `{ threadIds: string[] }`                      | `smemaster-move-to-folder`         |
| `restore-onboarding`     | `{ step: number }`                             | `smemaster-restore-onboarding`     |
| `inline-reply`           | `{ mode: "reply" \| "replyAll" \| "forward" }` | `smemaster-inline-reply`           |
| `extract-task`           | `{ threadId: string }`                         | `smemaster-extract-task`           |
| `view-raw-message`       | `{ messageId: string }`                        | `smemaster-view-raw-message`       |
| `navigate-help`          | `{ topic: string }`                            | `smemaster-navigate-help`          |
| `calendar:sync:done`     | `void`                                         | `smemaster-calendar-sync-done`     |
| `toast:show`             | `{ message: string }`                          | `smemaster-toast-show`             |
| `edit-template`          | `{ templateId: string }`                       | `smemaster-edit-template`          |

### Usage

```ts
import { uiBus } from '@shared/services/events/uiBus';

// Subscribe (returns an unsubscribe fn — call it in a cleanup/effect return)
const off = uiBus.on('data:changed', () => refetch());

// Emit
uiBus.emit('data:changed');
uiBus.emit('move-to-folder', { threadIds: ['t1', 't2'] });
```

### Rules

- **UI signals only.** Domain data-sync events stay on `eventBus.ts`.
- **Never** add a new `window.dispatchEvent(new Event("smemaster-*"))`. Add an
  entry to `UiBusEventMap` and emit via `uiBus` instead.
- Storage keys like `smemaster-invoice-defaults` and `smemaster-auth://` deep
  links are intentionally **not** part of `uiBus` — they are persistence keys,
  not events.
