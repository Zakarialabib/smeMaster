# Phase A — COMPLETE ✅

> Closed 2026-09-28 · commits `88c44e8` (A1), `c2e1e15` (A2), `fb852a2` (A2 lint),
> `4837177` (A3), `63b5c3c` (A4)
> Build plan: [`BUILD-PLAN.md`](BUILD-PLAN.md) §2

**What "complete" means here:** four steps that all compile and do nothing. The
point was to stop at the cheapest possible moment to be wrong, before any screen
is ported and before a single provider is wired.

| # | Deliverable | State |
|---|---|---|
| A1 | `services/agent-core/` — pydantic contract, `/healthz`, error envelope | ✅ 19 tests |
| A2 | `migrations/0001_tenants.sql` — one table, the no-silent-failure CHECK | ✅ 26 pass, 5 skip |
| A3 | `src/features/agent/types/commands.ts` — the TS wire contract | ✅ parity tests |
| A4 | `src/features/agent/stores/` — four stores, selector rule enforced | ✅ 34 tests |

## Gates, as run

```
agent-core:  26 passed, 5 skipped
ruff:        All checks passed
mypy:        Success: no issues found in 3 source files
tsc:         TSC_EXIT=0   (whole repo)
vitest:      Test Files  2 passed (2)
             Tests      34 passed (34)
```

## What is real, and what is deliberately not

**Real now, and must stay real:**
- The wire contract, on both sides, with **parity tests** between them.
- `answering ⇒ transfer_target IS NOT NULL`, in the schema. A bad write cannot
  produce a tenant that drops callers.
- `caller_override` guarded to `test_call` only. A test endpoint is not a
  call-placement primitive.
- `ClientFrame` has one variant: `ping`. There is no frame that acts on a call.
- No `tenantId` and no audio field anywhere, asserted by tests on both sides.

**Not yet, by design:** no provider SDK, no database connection, no channel, no
Tauri command, no screen. Those are B, C, D.

## Three defects Phase A caught

Worth recording, because all three were invisible on inspection:

1. **`Health` was a plain `BaseModel`** and emitted `started_at` where the
   contract says `startedAt` — exactly the mismatch that breaks the console the
   first time it calls `/healthz`. Caught by a test asserting the exact key set.
2. **The stores imported types that existed only in the prototype.** Caught by
   `tsc`, not by reading — the file looked complete.
3. **`useConfigBlockers` called `getState()` inside `useMemo`** — not reactive,
   so it would render once and never update — and read a field that did not
   exist. Caught while writing the fix, not by a test. There is now a test for
   the store but not for this specific bug; it is a reminder that a hook which
   never updates fails silently.

## The one thing to carry into Phase B

**A derived array belongs in `useMemo`, never inside a store selector.**

The prototype shipped `useFilteredCalls` that filtered inside the zustand
selector. Fresh array identity on every call, `useSyncExternalStore` re-renders
forever, React error #185 — and it stayed hidden until the alert drill-down was
the first thing to actually render the list. The first test in
`stores/index.test.ts` renders the hook and counts renders to make that
impossible to reintroduce silently.

## Phase B — next (2–3 days)

The contract exists; now both sides agree on shapes *and* can be wrong in the
same way. B is:

| Step | Work | Gate |
|---|---|---|
| B1 | Four provider traits + one impl each, all returning a fixture response | **the swap test**: a second impl swaps in by a config value alone, no code change. This is the Gate 1 exit criterion. |
| B2 | `/session`, `/ws/transcript`, `/ops/snapshot` returning the real payloads | a contract test asserts every field the console reads exists and is the right type |
| B3 | `src-tauri/src/agent/{mod,client,models}.rs`, `generate_handler![]` extended not reordered | `cargo check --workspace` |
| B4 | Remaining migrations: `calls`, `turns`+`call_metrics`, `transfer_attempts`, `metering_events`, `alerts`, `kb_*`, `provider_health` | each applies on a scratch DB; `vector(1024)` from config, never a literal |

**`turns` has no audio column.** That is the schema enforcing `CALL-FLOW.md` §2.
If you find yourself adding one, stop.

**Requires Postgres** for the migration tests: set `AGENT_CORE_TEST_DATABASE_URL`
to run the 5 that currently skip. This host has no Postgres (no docker, no
psql), so those 5 are **skipped, not passing** — say so rather than implying
coverage.
