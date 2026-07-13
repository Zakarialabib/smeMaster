# Rust Workflow Rules (Cognitive Extension)

These rules optimize how the agent solves Rust problems in **SMEMaster** (`src-tauri/`, Tauri v2 + sqlx + many crates). They reflect the internal "thought process" required, mapped to the MCP servers that actually exist in this project's `mcp.json`: **context7** (crate/library docs), **Sequential Thinking** (planning), and the **Persistent Knowledge Graph** (memory).

> Note: There is **no `mcp_rustdoc` / `find_crates` server** configured for this project. Use **context7** for all crate documentation and **`cargo`/source reading** for everything else.

## 🧠 The "Holy Trinity" Workflow (Standard Operating Procedure)

For every Rust task, adhere to this data flow. Do not deviate unless the user provides the data.

### Phase 1: DISCOVERY (The "What")
*Goal: Identify the right tool/crate for the job.*
*   **Unknown crate API?** → `context7` `resolve-library-id` + `query-docs` for the crate (e.g. `sqlx`, `automerge`, `tauri`).
*   **Unknown concept?** → Read the relevant `src-tauri/src/**/mod.rs` and its `docs/02-BACKEND/` entry.
*   **Unknown type shape?** → `Grep` the crate usage in `src-tauri/src/` for existing examples.

### Phase 2: ANALYSIS (The "Context")
*Goal: Load the map before starting the journey.*
*   **New crate encountered?** → **MUST** pull its README + core types via `context7` `query-docs` (scope the prompt to the exact function/struct you need).
*   **Need implementation details?** → `Grep` for existing `impl` blocks / call sites in `src-tauri/src/` to see how the project already uses the crate.

### Phase 3: VALIDATION (The "How")
*Goal: Verify assumptions with ground truth.*
*   **Writing code?** → `context7` `query-docs` for the exact signature; cross-check against `Cargo.toml` version.
*   **Debugging logic?** → Read the source file (`Read` `src-tauri/src/.../mod.rs`) and the `docs/02-BACKEND/` module doc.
*   **Debugging macros?** → Read the macro definition + an existing expansion usage in the repo.

---

## ⚡ Cognitive Triggers (Intent Mapping)

| User Intent | Trigger Phrase | Required Action |
| :--- | :--- | :--- |
| **Crate docs** | "How do I use [crate]?", "What does [fn] do?" | `context7` `query-docs("[crate]", "...")` |
| **Concept learning** | "What is...", "How does X work?" | Read `docs/02-BACKEND/*.md` + module `mod.rs` |
| **API specifics** | "Args for [struct]", "signature of [fn]" | `context7` `query-docs` + `Grep` call sites |
| **Compiler error** | "Error E0382", "borrow checker" | Read the official rustc explanation, then fix; don't guess |
| **Missing feature** | "module not found", "unresolved import" | Check `Cargo.toml` features + `use` paths first |
| **Trait bounds** | "What implements Display?", "Can I use X here?" | `Grep` `impl ... for` in crate + repo |
| **Multi-step plan** | "Plan the sync engine", "Refactor IPC" | **Sequential Thinking** MCP before editing |

---

## 🤖 Agent Protocols (Internal Monologue)

### Protocol: `DEEP_DIVE` (When documentation is insufficient)
1.  **Trigger**: context7 docs are generic or lack examples.
2.  **Action 1**: `Read` the actual implementation in `src-tauri/src/<module>/`.
3.  **Action 2**: `Grep` for existing usages of the crate/API inside the repo.
4.  **Action 3**: `context7` `query-docs` scoped to a concrete example.
5.  **Synthesis**: Combine source logic + usage examples to form a complete mental model.

### Protocol: `ERROR_RECOVERY` (When code fails to compile)
1.  **Trigger**: `cargo check` / `cargo build` reports an error.
2.  **Check 1 (The "Feature" Trap)**: "unresolved import" / "could not find"?
    *   *Yes* → Check `Cargo.toml` `[features]` / optional deps. Most "not found" errors are missing features or wrong crate version.
3.  **Check 2 (The "Borrow" Trap)**: E0382 / E0502?
    *   *Yes* → Read the borrow explanation; prefer `Arc`/`RwLock`/`Clone` over fighting the checker.
4.  **Check 3 (The "Trait" Trap)**: "the trait bound `…` is not satisfied"?
    *   *Yes* → `Grep` `impl` to see what *is* implemented; adjust the type or add the impl.

---

## 📉 Token Economy & Efficiency
*   **Batching**: One `context7` `query-docs` call scoped to the exact symbol beats many generic ones.
*   **Precision**: Use fully-qualified paths (`tauri::async_runtime::spawn`) to avoid ambiguity loops.
*   **Truncation**: Trust tool truncation. Narrow with `Grep`/`Glob` to the specific `src-tauri/src/` submodule rather than asking for "everything".

## 🔮 Future-Proofing (Self-Correction)
*   **If `context7` fails**: The library id may be wrong — run `resolve-library-id` first; fall back to reading `src-tauri/Cargo.toml` + module source.
*   **If `Grep` is noisy**: Scope to `src-tauri/src/<module>/` and a specific symbol.
*   **If build is denied**: Some crates need the Android NDK target — verify via `cargo check` on the host target first.
