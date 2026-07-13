Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

This file is the enforceable companion to [`AGENTS.md`](../../AGENTS.md) (project root). It is auto-loaded as a workspace rule each session.

## **1. Step Phase Funnel (Core Methodology)**

**Every task must follow this sequential thinking process:**

1. **READ** → **Ingest context**: Relevant files + the matching `docs/` entry. Never assume.
2. **ANALYZE** → **Map impact**: Identify patterns, dependencies (Frontend ↔ Service ↔ Rust ↔ DB), and side effects.
3. **THINK** → **Sequential plan**: Formulate step-by-step approach. Consider offline-first and multi-window constraints.
4. **RECHECK** → **Architecture validation**: Cross-reference with existing patterns and system loops (orchestrator, EventBus, DomainEventProcessor).
5. **EXECUTE** → **Chunked implementation**: Small, verifiable steps. One component at a time.

---

## **2. Technical Stack & Architecture Rules**

SMEMaster is a **three-layer** app: React 19 UI → TypeScript Service Layer → Tauri v2 + Rust. Each layer has exactly one job (see `docs/01-ARCHITECTURE/01-overview.md`).

### Frontend (React 19) — DOs & DON'Ts
✅ **DO:**
- Use React 19 features (Actions, `useOptimistic`) when applicable
- Put UI in `src/features/*` and shared UI/contexts/hooks in `src/shared/*`
- Use TypeScript strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`) — fix type errors immediately
- Implement proper loading/error/empty states for all async operations
- Use Tailwind v4 utility classes consistently; reference design tokens per `docs/05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`
- Use `react-i18next` `t()` for ALL user-facing strings; never hardcode text (run `npm run translate:sync` after adding keys)
- **RTL:** Always use logical properties — `ms-*`/`me-*` not `ml-*`/`mr-*`, `text-start`/`text-end`, `inset-inline-start/end`. Never physical `left`/`right`
- **Styling tokens:** No hardcoded colors (`#fff`, `rgb(...)`). Use `hsl(var(--…))` tokens / theme variables from the design system
- **State:** Zustand stores split by domain; subscribe components to slices, no Redux boilerplate

### Backend (Tauri/Rust) — DOs & DON'Ts
✅ **DO:**
- Use `#[tauri::command]` for all backend commands; register them in `src-tauri/src/commands/mod.rs`
- Implement proper error propagation with `anyhow` / `thiserror`; return `Result<T, String>` (or the `SerializedError` type) across IPC
- Respect the orchestrator + background-service lifecycle (`src-tauri/src/orchestrator/mod.rs`) — don't block the main thread; use async runtimes / spawn where needed
- Own the SQLite schema via `sqlx` + migrations in `src-tauri/src/db/` (60+ migrations)
- Emit domain events through the EventBus for cross-cutting effects (cache invalidation, sync, notifications)

### **Cross-Platform & IPC Rules**
✅ **DO:**
- Keep React ↔ Rust types consistent across the IPC boundary (see `/sync-types`)
- Route all IPC through `src/shared/services/db/db-invoke.ts` or `src/shared/services/commands.ts` (`invokeCommand`) — never raw `invoke()` in app code
- Handle offline mode gracefully — queue operations, optimistic UI via `emailActions.ts`
- Implement proper cleanup in `useEffect` and for Tauri listeners (window/process lifecycle, `listen()` unsubscribes)

❌ **DON'T:**
- Call Rust functions directly from React (always use the IPC layer)
- Write direct SQL in TypeScript
- Mix web-only APIs without platform checks (`@tauri-apps/plugin-*` + feature flags)
- Assume internet connectivity (offline-first: local SQLite is the source of truth)
- Forget to handle window/process lifecycle events

---

## **3. AI Agent Workflow Directives**

### **Tool Usage Protocol**
- **SearchCodebase**: Use for understanding patterns before implementing
- **Sequential Thinking MCP**: Use for multi-step planning; reduces tokens on reasoning input/output
- **Grep**: Use for tracking down specific symbols or imports
- **Context7 MCP**: Use for crate/library docs and setup/config snippets before writing Rust or adding deps
- **Persistent Knowledge Graph MCP**: Document architecture decisions and session continuity to reduce tokens while working
- **File Operations**:
  - Read entire file before modifying
  - Use SearchReplace for targeted edits
  - Write in chunks (<200 lines) for large files

### **Memory (Persistent Knowledge Graph)**
1. **Memory Retrieval**: Begin sessions by retrieving relevant entities/relations/observations from your knowledge graph ("memory").
2. **Memory Update**: When new project info is gathered (architecture decisions, recurring modules, significant bugs), create entities, connect them with relations, and store facts as observations.

### **Error Handling Protocol**
1. **Detect**: Identify the error source (Frontend / Service / IPC / Backend).
2. **Trace**: Follow the error path through the stack (Component → Service → `db-invoke` → Rust command → sqlx).
3. **Fix**:
   - Frontend: Update error boundaries, add loading/error states
   - Backend: Ensure proper `Result` returns + error type
   - IPC: Check command-name / DTO / serde mismatches

---

### **Code Quality Enforcement**
- **Type Safety**: No `any` types. Use proper generics and utility types; respect `noUncheckedIndexedAccess`.
- **Performance**:
  - Memoize expensive computations with `useMemo`/`React.memo`
  - Debounce frequent events (resize, scroll, search)
  - Virtualize long lists (`@tanstack/react-virtual`); lazy-load non-critical components
- **Security**:
  - Sanitize all user input (DOMPurify for rendered HTML/email)
  - Validate IPC payloads; never trust client-supplied SQL
  - Use Tauri's secure APIs (`@tauri-apps/plugin-fs`, `plugin-dialog`) for file access

### **Documentation Requirements**
**Must document:**
- New architectural patterns
- Complex state-management logic
- Cross-platform synchronization (CRDT sync engine, offline queue)
- Database schema / migration changes
- Any deviation from existing patterns

**Update immediately in:**
- [`docs/00-INDEX.md`](../../docs/00-INDEX.md) (when adding a new doc)
- The relevant `docs/0X-…` architecture/feature file
- Component/function JSDoc where non-obvious

### **Improvement & Debt Tracking**
- **Identify**: While working on any file, if you find code that is confusing, poorly typed, or follows a deprecated pattern, **stop** and document it.
- **Record**: Add the entry to [`docs/02-BACKEND/12-diagnostics.md`](../../docs/02-BACKEND/12-diagnostics.md) (Backend/Types) or [`docs/03-FRONTEND/13-deprecations.md`](../../docs/03-FRONTEND/13-deprecations.md) (Frontend/Patterns).
- **Propose**: Include a brief "Plan" or "Migration" step in the documentation.
- **Never Ignore**: Do not "fix and forget" — always document the debt to ensure architectural consistency.
