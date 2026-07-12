---
description: Verify React ↔ Rust type consistency across IPC boundary
---

## Type Sync Check

Verify that TypeScript IPC wrappers in the frontend match Rust command signatures in the backend.

### Steps

1. **Read `src/shared/services/db/db-invoke.ts` and `src/shared/services/commands.ts`** — extract all typed IPC wrapper definitions (camelCase request DTOs).
2. **Read `src-tauri/src/commands/mod.rs`** — find all registered `#[tauri::command]` functions and their parameter/return types across `src-tauri/src/commands/*`.
3. **Cross-reference**:
   - For each Tauri command in Rust, check that its TypeScript wrapper in `db-invoke.ts` / `commands.ts` matches (name, params, return).
   - For each IPC event, check that its payload type matches between Rust `emit()` (in `src-tauri/src/events/`) and the frontend `listen()` / event-bus handler.
   - Check serde renames: Rust `snake_case` columns vs frontend `camelCase` DTOs.
4. **Report mismatches**:
   ```json
   {
     "command": "db_get_account",
     "rust_signature": "fn db_get_account(account_id: String) -> Result<Account, String>",
     "ts_signature": "dbGetAccount: { accountId: string } => Account",
     "match": true/false,
     "issue": "description if mismatch"
   }
   ```
5. **Report type drift** — any commands/wrappers in one side that don't exist in the other

Do NOT make changes. This is a diagnostic command.
