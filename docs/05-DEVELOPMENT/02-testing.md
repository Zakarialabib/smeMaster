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

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `bun run test`      | Run the default frontend/unit test suite |
| `bunx tsc --noEmit` | Run TypeScript typecheck                 |
| `cargo test`        | Run backend tests                        |
| `cargo check`       | Fast backend compile verification        |

### ⚠️ Three host-specific traps — gate on output, not exit codes

1. **`vitest` false-greens on this host** (exit 0 with hundreds of failures). Gate on the
   `Tests` summary line. Under git-bash the `.bin` shim also crashes — invoke the real ESM
   entry: `cmd /c "node node_modules/vitest/vitest.mjs run <path> --no-file-parallelism"`.
2. **`python -m pytest` false-greens too.** Always assert the `passed`/`failed` summary line.
3. **`cargo test` compiles and links but the binary will not execute here**
   (`STATUS_ENTRYPOINT_NOT_FOUND 0xc0000139` — Windows DLL/UCRT mismatch). The Rust suite is
   _written and compiling_, **not passing**. Run it in CI. Details: [`dev/BUILD-LOG.md`](dev/BUILD-LOG.md)
   ("⚠️ Rust test binary will not launch on THIS host") and the toolchain warning in
   [`01-quickstart.md`](01-quickstart.md).

#### Workaround — verify pure logic with a standalone binary

`cargo test` being unable to launch does **not** mean pure Rust logic is unverifiable. A plain
`rustc` binary **does** run on this host (verified — `rustc --edition 2021 x.rs -o x.exe && ./x.exe`
prints and exits 0). So for functions with no DB, no async and no Tauri — parsers, scope checks,
calculators, state machines — extract them into a standalone harness and gate on its verdict:

```bash
bun run verify:agent-scope      # scripts/verify/agent-scope.sh
```

That script mirrors the `#[cfg(test)]` assertions in `db/tables/ai/agents.rs` and reports
**14 passed, 0 failed**. **If you change such a rule, change both copies** — the `cargo test`
version for CI, the standalone one so it is actually observed here.

Two traps when writing one:

- **Output path must be relative.** rustc is a native Windows binary and MSYS path conversion is
  disabled here, so `-o /tmp/x.exe` is passed through literally and the link fails with
  unresolved externals. Use `-o x.exe`.
- **Do not gate on a bare `/failed/`.** A passing run prints `14 passed, 0 failed`, which matches.
  Anchor on the verdict line and a non-zero failure count (`[1-9][0-9]* failed`). This bit the
  first version of the script — it reported FAILED on a fully passing run.

> **This is a workaround, not a substitute.** It covers pure logic only. Anything touching the DB,
> async or Tauri still needs a real `cargo test` run in CI on a properly provisioned host.

Use `cargo check --workspace`, never `cargo check -p <crate>`: the workspace inherits the
app's full default features and compiles code `-p` skips.

## Test layers (2026-10-05: TS + Rust only)

The former third layer — the Python suite under `services/agent-core/` — was
deleted with the dropped voice-call system (no archive, git history preserves
it). The gates are:

- `bun run test` — colocated TS unit tests (vitest)
- `cargo test` — Rust tests (`cd src-tauri`)

## Practical Guidance

When changing code:

- run the smallest relevant test set first
- run `bunx tsc --noEmit` for TypeScript-affecting changes
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
| IPC commands      | **868**               | literal `#[tauri::command]` (804) + `#[command]` (64) occurrences in `src-tauri/src` (recursive); parameterised forms such as `#[tauri::command(rename_all = ...)]` (7) are not counted                                                 |
| SQLite migrations | **34**                | `*.sql` files in `src-tauri/src/db/migrations/` (`001_core.sql` … `034_*.sql`, sequential, no gaps)                                                                                                                                     |
| Zustand stores    | **47**                | non-test (excludes `*.test.*`, `*.spec.*`, `__tests__/`) `.ts`/`.tsx` under `src/shared/stores/**`, `src/stores/**`, `src/features/*/stores/**` containing the token `create` → 39 `create<` stores + 5 `create*` slice-factory modules |

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
