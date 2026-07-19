# Testing

> Current testing guidance for frontend, backend, and verification commands.

## Scope

This page is a contributor-focused testing guide, not a celebratory metrics dump.

It covers:

- the main test layers
- the commands contributors should run
- where special handling is needed

## Current Test Layers

The project currently relies on:

- TypeScript tests with Vitest
- Rust tests with `cargo test`
- TypeScript typechecking with `tsc --noEmit`
- targeted runtime verification where a live Tauri backend is required

Current repo-level numbers are tracked in `README.md`, `STATUS.md`, and `00-INDEX.md`. Keep those counts aligned from one source rather than duplicating them inconsistently here.

## Main Commands

| Command | Purpose |
| --- | --- |
| `npm run test` | Run the default frontend/unit test suite |
| `npx tsc --noEmit` | Run TypeScript typecheck |
| `cargo test` | Run backend tests |
| `cargo check` | Fast backend compile verification |

## Practical Guidance

When changing code:

- run the smallest relevant test set first
- run `npx tsc --noEmit` for TypeScript-affecting changes
- run `cargo check` or `cargo test` for backend-affecting changes
- add or adjust tests when the change meaningfully alters behavior or contracts

## Special Cases

Some flows depend on a live Tauri/runtime environment or native integration behavior. Those should be treated as integration or manual verification scenarios rather than forcing them into lightweight unit-test runs.

## Test Placement

The project uses a mixed approach:

- colocated frontend tests near source files
- backend tests near Rust modules or in relevant domain test helpers
- feature- or service-specific tests where behavior is easiest to verify

## Related Docs

- `01-quickstart.md`
- `../AGENTS.md` (agent contributor guide)
- `../../PRODUCTION-READINESS.md`

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| `../PRODUCTION-READINESS.md` | PRODUCTION-READINESS.md lives at repo root → `../../PRODUCTION-READINESS.md` from `docs/05-DEVELOPMENT/` | `ls PRODUCTION-READINESS.md` |
