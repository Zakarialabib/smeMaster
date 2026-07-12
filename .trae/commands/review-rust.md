---
description: Review Rust/Tauri code — cargo check, clippy, tests, safety audit
argument-hint: <module-path>
---

## Rust Code Review

Focus on: `$ARGUMENTS`

### Steps

1. **Read the target files** specified in arguments (or last modified `.rs` files if no arguments) under `src-tauri/src/`
2. **Run `cargo check`** in `src-tauri/` — report any errors
3. **Run `cargo clippy -- -D warnings`** in `src-tauri/` — report any warnings
4. **Run `cargo test`** in `src-tauri/` — report any failing tests (do not fix)
5. **Safety audit checklist**:
   - No `unsafe` blocks without `// SAFETY:` comment
   - All IPC commands return `Result<T, String>` (or the `SerializedError` type) and are registered in `src-tauri/src/commands/mod.rs`
   - Shared state uses `Mutex<T>` / `RwLock<T>` / `Arc<T>` — no `static mut`
   - Error propagation uses `anyhow` / `thiserror`
   - No blocking the main thread (use `tauri::async_runtime::spawn` where needed)
   - DB access only through `sqlx` + migrations in `src-tauri/src/db/`
6. **Pattern check**: Review naming, module structure, imports match 3 nearest sibling files in the same `src-tauri/src/` submodule

### Output format
```
## Rust Review: <module-path>
- cargo check: ✅ / ❌
- clippy: ✅ / ❌
- tests: ✅ / ❌ N failures
- Safety: ✅ / ⚠️ N issues
- Patterns: ✅ / ⚠️ N issues

### Issues found:
1. [SEVERITY] file:line — description
```

Do NOT auto-fix any issues. This is a review command.
