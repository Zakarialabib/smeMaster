# Event System

> Current Rust-side event model for backend communication, processing, and frontend bridging.

## Scope

This page documents the backend event system.

It covers:

- Rust-side event production and subscription
- backend event processing
- bridging events to the frontend
- the distinction between internal backend events and frontend event routing

## Current Ownership

Primary code lives in:

- `src-tauri/src/events/`
- orchestrator/init bridging code
- app initialization wiring in `src-tauri/src/lib.rs`

Important modules include:

- `src-tauri/src/events/mod.rs`
- `src-tauri/src/events/processor.rs`
- `src-tauri/src/events/emit.rs`

## Current Model

The backend uses a Rust-side event bus so subsystems can emit and react to typed events without tight coupling.

Typical roles include:

- producers such as sync, commands, or lifecycle systems
- subscribers such as processors and monitoring services
- a bridge layer that forwards selected events to the frontend/WebView

## Important Distinction

There are two related but different systems:

1. the Rust event system inside the backend
2. the frontend event bus that receives bridged events through Tauri

This page is about the first one. The frontend side is documented in `../03-FRONTEND/07-event-bus.md`.

## What It Does

The backend event system currently supports:

- typed app-event style messages
- subscriber-based backend processing
- bridging to frontend listeners
- lifecycle and health-style events such as init and heartbeat
- domain events that can be emitted from frontend or backend paths

## Practical Guidance

When changing backend event behavior:

1. update the Rust event definitions
2. update the processor or subscriber logic
3. verify whether the event must also be bridged to the frontend
4. update frontend event consumers if the payload contract changes

## Related Docs

- `../03-FRONTEND/07-event-bus.md`
- `06-commands-reference.md`
- `../01-ARCHITECTURE/01-overview.md`
