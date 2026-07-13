---
description: Plan a multi-layer feature across React → Tauri IPC → Rust backend
argument-hint: <feature-name> [description]
---

## Feature Planning: ${1:-unnamed}

Description: $ARGUMENTS

### Process

Follow the Step Phase Funnel from project rules ([`AGENTS.md`](../../AGENTS.md) / `.trae/rules/project_rules.md`):

1. **READ** — Ingest context from these layers:
   - `docs/01-ARCHITECTURE/01-overview.md` for the three-layer model
   - `src/shared/services/db/db-invoke.ts` and `src/shared/services/commands.ts` for IPC type definitions
   - `src-tauri/src/commands/mod.rs` for registered Rust command patterns
   - `src/features/` and `src/shared/` for frontend patterns
   - Relevant docs in `docs/04-FEATURES/` and `docs/05-DEVELOPMENT/`

2. **ANALYZE** — Map impact across layers:
   - **Rust backend**: New commands in `src-tauri/src/commands/`? New events in `src-tauri/src/events/`? New DB migrations in `src-tauri/src/db/migrations/`?
   - **Type bridge**: Wrappers to add to `db-invoke.ts` / `commands.ts` (camelCase request DTOs)
   - **Frontend**: New hooks? New components (in `src/features/*` or `src/shared/components`)? New stores?
   - **Cross-cutting**: Offline handling? RTL/logical properties? Error + loading states? i18n `t()` keys? Lifecycle/permission changes?

3. **THINK** — Detailed implementation plan:
   - File-by-file changes needed (new files + modifications)
   - Dependencies to add (npm, Cargo, Tauri plugins)
   - Migration path (backward compatibility, offline-safe)
   - Test strategy (colocated `*.test.ts(x)`, Rust unit tests)

4. **RECHECK** — Validate against existing patterns:
   - Do new commands follow `#[tauri::command]` + registration in `commands/mod.rs`?
   - Do new components follow existing component patterns?
   - Are types consistent across the IPC boundary (camelCase ↔ snake_case via serde)?

### Output
```markdown
## Feature Plan: <name>

### Impact Map
| Layer | Files | Change Type |
|-------|-------|------------|
| Rust | src-tauri/src/commands/... | New/Modify |
| IPC | src/shared/services/db/db-invoke.ts | Modify |
| Frontend | src/features/... | New/Modify |

### Implementation Order
1. ...
2. ...

### Risks
- ...
```
