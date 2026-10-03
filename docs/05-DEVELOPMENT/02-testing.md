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

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run test`     | Run the default frontend/unit test suite |
| `npx tsc --noEmit` | Run TypeScript typecheck                 |
| `cargo test`       | Run backend tests                        |
| `cargo check`      | Fast backend compile verification        |

### ⚠️ Three host-specific traps — gate on output, not exit codes

1. **`vitest` false-greens on this host** (exit 0 with hundreds of failures). Gate on the
   `Tests` summary line. Under git-bash the `.bin` shim also crashes — invoke the real ESM
   entry: `cmd /c "node node_modules/vitest/vitest.mjs run <path> --no-file-parallelism"`.
2. **`python -m pytest` false-greens too.** Always assert the `passed`/`failed` summary line.
3. **`cargo test` compiles and links but the binary will not execute here**
   (`STATUS_ENTRYPOINT_NOT_FOUND 0xc0000139` — Windows DLL/UCRT mismatch). The Rust suite is
   _written and compiling_, **not passing**. Run it in CI. Details: [`../voice/dev/BUILD-LOG.md`](../voice/dev/BUILD-LOG.md)
   ("⚠️ Rust test binary will not launch on THIS host") and the toolchain warning in
   [`01-quickstart.md`](01-quickstart.md).

Use `cargo check --workspace`, never `cargo check -p <crate>`: the workspace inherits the
app's full default features and compiles code `-p` skips.

## The voice agent's test layer (`services/agent-core/`)

A separate Python suite sits alongside the TS/Rust layers. It is **not** covered by
`npm run test` or `cargo test`.

```bash
cd services/agent-core
python -m pytest -q                                   # 156 passed, 5 skipped (2026-09-28)
# python -m pytest -q tests/rag/retrieval_eval.py     # 🔲 NOT BUILT YET — the hit@3 >= 0.9
#                                                      gate from RAG-FORK; file does not exist yet
```

- **5 skips are the Postgres migration tests.** They need
  `AGENT_CORE_TEST_DATABASE_URL`; there is no Postgres on this host, so migrations are
  verified _structurally_, not against a real database. Say "skipped", never "passing".
- **Two live-server checks** (server must be up on `:8788` — see
  [`../voice/dev/RUNNING-DEV.md`](../voice/dev/RUNNING-DEV.md)):
  `tests/live_swap.py --port 8788` (15 contract checks) and
  `tests/verify_fixtures.py --port 8788` (4 key-set drift checks — the one that catches a
  renamed field the console renders as `undefined` while every test still passes).
- Current gate state, including `ruff`/`mypy`/`tsc`/`eslint` lines, lives in
  **[`../voice/dev/BUILD-LOG.md`](../voice/dev/BUILD-LOG.md)** — treat that file, not this
  page, as the source of truth for "what is green right now".

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
- `03-manual-tests.md` — pre-release manual gates
- `../AGENTS.md` (agent contributor guide)
- `../../PRODUCTION-READINESS.md`
- `../voice/dev/BUILD-LOG.md` — live build/test state for `agent-core` + the Rust toolchain warning
- `../voice/dev/RUNNING-DEV.md` — starting `agent-core` and running its two live checks
- `../voice/dev/BUILD-PLAN.md` §7 — the verification commands that matter on this host

## Source reconciliation (2026-07-19)

| Claim (before)               | Verified reality                                                                                         | Evidence                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `../PRODUCTION-READINESS.md` | PRODUCTION-READINESS.md lives at repo root → `../../PRODUCTION-READINESS.md` from `docs/05-DEVELOPMENT/` | `ls PRODUCTION-READINESS.md` |

## Ground-truth metrics + summary-gated runs (2026-09-30)

Owner: **qa-guardian**. Shipped with `.github/workflows/ground-truth.yml`.

| File                             | Purpose                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/check-ground-truth.mjs` | Counts the three canonical metrics, gates them, cross-checks `docs/00-INDEX.md` |
| `scripts/ground-truth.json`      | Expected counts + the date/owner they were verified + the counting rules        |
| `scripts/run-tests-gated.ps1`    | Local Windows gate: summary-gated vitest, then tsc + eslint (trusted codes)     |
| `scripts/assert-summary.mjs`     | Summary-line parser used by CI (also understands pytest `=== N passed ===`)     |

### The checker

```bash
node scripts/check-ground-truth.mjs                        # exit 0 = PASS, exit 1 = mismatch
node scripts/check-ground-truth.mjs path/to/baseline.json  # optional baseline override
```

It prints a `metric | expected | actual | status` table plus a `docs/00-INDEX.md`
header cross-check, and exits non-zero if either side disagrees — that is the
automated docs-rot detector.

| metric            | expected (2026-09-30) | counting rule                                                                                                                                                                                                                           |
| ----------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IPC commands      | **841**               | literal `#[tauri::command]` (777) + `#[command]` (64) occurrences in `src-tauri/src` (recursive); parameterised forms such as `#[tauri::command(rename_all = ...)]` (7) are not counted                                                 |
| SQLite migrations | **32**                | `*.sql` files in `src-tauri/src/db/migrations/` (`001_core.sql` … `032_deals_pipeline.sql`, sequential, no gaps)                                                                                                                        |
| Zustand stores    | **44**                | non-test (excludes `*.test.*`, `*.spec.*`, `__tests__/`) `.ts`/`.tsx` under `src/shared/stores/**`, `src/stores/**`, `src/features/*/stores/**` containing the token `create` → 39 `create<` stores + 5 `create*` slice-factory modules |

### Re-baselining `scripts/ground-truth.json`

Only after a _verified_ change (new migration, new IPC command, new store):

1. Run the checker and read the `actual` column.
2. Update `commands` / `migrations` / `stores` + `verifiedOn` in
   `scripts/ground-truth.json` (and `countingRules` if the rule itself changed).
3. Update the same numbers in the `docs/00-INDEX.md` header — plus
   `docs/06-ROADMAP/09-master-plan.md` and `AGENTS.md` when they cite them.
4. Re-run the checker until it PASSes, then commit baseline + docs together.

Never edit only one side: the checker fails whenever the JSON baseline and the
docs header disagree with the source.

### Summary-line gating rule

**Do not trust a test runner's exit code on this host.** vitest (and pytest)
have false-greened here — exit 0 while tests fail. The verdict comes from the
runner's own summary line:

- vitest — `Tests  N failed | M passed …`: any `failed` > 0 = FAIL, and a
  missing summary line (runner crashed / no tests) = FAIL.
- pytest — `=== N failed, M passed in T ===`: same rule.

Local run (logs land in `%TEMP%\smemaster-gate\`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-tests-gated.ps1           # vitest + tsc + eslint
powershell -ExecutionPolicy Bypass -File scripts\run-tests-gated.ps1 -WithRust # + cargo check only
```

`tsc --noEmit` and `eslint src --max-warnings=0` still gate on their exit codes
(those are trustworthy), `cargo test` is never run on this host (the binaries
link but do not launch — see the traps above), and the script ends with a
GATE PASS/FAIL block exiting 0/1.

In CI, `.github/workflows/ground-truth.yml` runs the metrics job and pipes
vitest output through `scripts/assert-summary.mjs <log>`; typecheck, lint, and
cargo stay in `ci.yml` (`lint-and-test`) and are deliberately not duplicated.
