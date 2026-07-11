# Dependencies

> Current dependency overview for the frontend and Rust runtime.

## Scope

This page is a practical inventory of the important packages and crates that shape the app today.

It is not meant to be an exhaustive changelog of every version bump. It should explain the major building blocks and the dependency choices that affect architecture.

## Frontend Runtime

Current key frontend dependencies include:

| Package | Purpose |
| --- | --- |
| `react` / `react-dom` | UI runtime |
| `typescript` | Static typing |
| `zustand` | State management |
| `@tanstack/react-router` | Routing |
| `@tanstack/react-query` | Query and async state orchestration |
| `@tanstack/react-virtual` | Virtualized lists |
| `@tiptap/*` | Rich-text editing |
| `@dnd-kit/core` | Drag-and-drop interactions |
| `@xyflow/react` | Automation/workflow-style graph UI |
| `i18next` / `react-i18next` | Localization |
| `recharts` | Charting |
| `dompurify` | HTML sanitization |

## Tauri Frontend Plugins

The current frontend uses modern Tauri v2 packages rather than the old SQL plugin-centered model.

Representative plugins:

- `@tauri-apps/plugin-dialog`
- `@tauri-apps/plugin-fs`
- `@tauri-apps/plugin-notification`
- `@tauri-apps/plugin-opener`
- `@tauri-apps/plugin-store`
- `@tauri-apps/plugin-global-shortcut`
- `@tauri-apps/plugin-updater`
- `@tauri-apps/plugin-window-state`
- `@tauri-apps/plugin-biometric`
- `@tauri-apps/plugin-clipboard-manager`
- `@tauri-apps/plugin-deep-link`

## Rust Runtime

Important backend crates include:

| Crate | Purpose |
| --- | --- |
| `tauri` | Native app/runtime framework |
| `sqlx` | SQLite access and typed queries |
| `tokio` | Async runtime |
| `async-imap` | IMAP support |
| `lettre` | SMTP support |
| `pgp` | PGP operations |
| `reqwest` | HTTP and OAuth-related requests |
| `trust-dns-resolver` | DNS queries |
| `aes-gcm` | Encryption primitives |
| `automerge` | CRDT/sync-related work |
| `mdns-sd` | Local discovery for sync/pairing scenarios |

## Design Notes

A few dependency choices matter architecturally:

- virtualization uses `@tanstack/react-virtual`, not `react-window`
- persistence is Rust-owned via `sqlx`, not a frontend SQL plugin model
- Tauri plugin usage is narrower and more deliberate than older docs implied
- mail, crypto, and sync features are spread across both frontend packages and Rust crates

## Update Rules

Update this page when:

- a dependency choice changes architecture in a meaningful way
- a plugin is added or removed and affects contributor behavior
- a foundational runtime library is swapped out
