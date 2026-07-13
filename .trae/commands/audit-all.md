---
description: Full project health check — TypeScript, Rust, LSP, lint, tests
tools: Read, RunCommand, GetDiagnostics
---

## SMEMaster Full Audit

Run all quality checks across the entire stack:

1. **Frontend TypeScript**: Run `npx tsc --noEmit` to check for type errors
2. **Frontend lint**: Run `npx eslint src --max-warnings=0` for code quality
3. **Frontend tests**: Run `npx vitest run --exclude integration` (2,470 tests)
4. **Rust backend**: Run `cargo check` in `src-tauri/` for compilation errors
5. **Rust clippy**: Run `cargo clippy -- -D warnings` in `src-tauri/` for lint
6. **Rust tests**: Run `cargo test` in `src-tauri/` (735 tests)
7. **LSP diagnostics**: Check all open files for LSP errors

Report results in this format:
```
## Audit Results
- TypeScript: ✅ PASS / ❌ FAILED (N errors)
- Frontend lint: ✅ PASS / ❌ FAILED (N warnings)
- Frontend tests: ✅ PASS / ❌ FAILED (N failures)
- Rust check: ✅ PASS / ❌ FAILED (N errors)
- Rust clippy: ✅ PASS / ❌ FAILED (N warnings)
- Rust tests: ✅ PASS / ❌ FAILED (N failures)
- LSP: ✅ CLEAN / ❌ HAS ISSUES
```

If any check fails, list the first 3 errors with file paths and suggested fixes.
Do NOT auto-fix — this is a diagnostic command.
