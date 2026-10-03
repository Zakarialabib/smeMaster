# Phase B — CLOSED

> 2026-09-28 · commits `1d4bf3c` … `63c41cf` · server running on `:8788`

## Gates, as measured

```
agent-core   ruff clean · mypy clean (10 files) · 156 passed, 5 skipped
frontend     tsc TSC_EXIT=0 · eslint clean · vitest 5 files, 60 passed
live server  live_swap.py 15/15 · verify_fixtures.py 4/4 · /healthz 200
rust         STILL BUILDING (see below)
```

The 5 skips need Postgres (`AGENT_CORE_TEST_DATABASE_URL`); there is none on this
host, so migrations are verified structurally, not against a real database.

## What Phase B actually proves

The claim under test is one sentence: **a provider can be swapped by a config
value alone.** It is now executable rather than aspirational.

- `providers/base.py` — the four seams as ABCs (LLM, TTS, STT, embedding),
  `Capabilities`, `ProviderConfig`, `ProviderRegistry`. The registry is the
  **only** construction site; if something else builds a provider, the swap test
  stops meaning anything.
- `providers/fixtures.py` — **two** real implementations per seam (`alpha`,
  `beta`) plus a `down` that always raises. Two, because one cannot demonstrate
  a swap. Not stubs: real trait implementations making no network call.
- `providers/chain.py` — `run_chain` returns which provider _actually_ answered,
  what was attempted, and whether a fallback engaged. A silent failover is a
  "Never" in `BACKEND.md` §8; this is what prevents it.
- `tests/test_swap.py` **is** the Gate 1 exit criterion, executed. Alpha and beta
  are real, neither is stubbed to fail, and the only thing that changes between
  runs is a dict in a config object.

## Endpoints, live

`POST /session` · `WS /ws/transcript` · `GET /ops/snapshot` ·
`GET /ops/snapshot/dev` · `GET /providers/registry` · `GET /session/{id}/demo-turn`

The demo turn emits real frames from the real chain. It is a turn with no
carrier, no microphone and no vendor key, and `/providers/registry` says
`fixture_data: true` rather than implying a live pipeline.

## Three defects this phase caught

**1. A security guard that was silently inert.** `SessionRequest` inherited
`BaseModel` instead of `Camel`. `BaseModel` accepts snake_case and _ignores_
camelCase, so `callerOverride` was dropped on the way in, defaulted to `None`, and
`assert_caller_allowed` — itself correct — never fired. A live session accepted a
caller override through the one endpoint whose purpose was to refuse it.

Invisible on inspection, and invisible to the existing tests, which all posted
snake_case — precisely what the broken class accepted. The permanent fix is
`tests/test_camel_acceptance.py`, which fails if any inbound contract stops being
a `Camel` subclass. Now demonstrated in three independent places: the unit test,
the TestClient test, and a live `curl`.

**2. A licence that would have shipped.** A research brief recommended
`mistralai/Voxtral-4B-TTS-2603` in its summary, its diagram, and its
recommendation — 70 ms TTFB, purpose-built for call centres, native French. Its
own §4 correctly noted the licence. The summary outranked the detail.

Verified at the HF API: `license: cc-by-nc-4.0`. **Non-commercial**, and this
project bills a client. The fastest option on the list is the one we cannot ship.

`providers/licensing.py` is the response, and the reasoning matters: the failure
was not reading the licence, it was that a _summary_ is what people act on. So
the summary is what gets gated. An allowlist, not a blocklist, so unknown fails
closed. Voxtral stays in `catalogue.py` under `DISQUALIFIED` with its rejection
written down, and `test_voxtral_stays_out_of_the_allowlist` fails if someone
"fixes" it by allowlisting `cc-by-nc-4.0`.

**3. An infinite reconnect loop.** `onopen` reset the retry counter, so a server
that completed the handshake and then immediately closed was retried forever.
Measured, not assumed: 12 accept-then-die cycles produced 13 sockets and kept
going. The counter now resets in `connect()` and nowhere else.

## Data model

Migrations `0002_calls`, `0003_metering`, `0004_knowledge`, each encoding a
decision rather than just holding data: masked-by-default caller, `test_call`
separable from live, money as `NUMERIC` with a `price_list_version` on every
row, `dim`/`space` as columns so two vector spaces cannot be silently mixed, and
**no audio column anywhere** — enforced by a test that fails if one appears.

One real defect surfaced here: `usage_events.price_list_version` had no
`ON DELETE`, so deleting a rate card would orphan historical costs. Now
`ON DELETE RESTRICT`. Retire a rate card; do not delete it.

## Console

`api/client.ts` (one error parser, `status 0` = unreachable, no `tenantId` on any
signature) and `api/transcriptSocket.ts` (read-only; `send()` accepts only
`ping`, so no barge-in can arrive without a contract change on both sides).

Two things worth remembering:

- The first client test built a `node:http` fake re-implementing the four
  routes. That tested the fake. A duplicated fake is worse than no test, because
  it looks like coverage.
- The test then set `import.meta.env.VITE_AGENT_CORE_URL` at runtime, which does
  nothing — Vite **inlines** `VITE_*` at build time. The test passed for the
  wrong reason: still hitting the real server. There is now a test whose entire
  job is to fail if that override is ever inert again.

## Still open

1. **Rust is not compiled.** `cargo check --workspace` has never completed.
   `config.toml` pointed `PROTOC` at a vendored binary that is not in the repo
   (fixed), then the `ml-sidecar` build ran the disk to 100 %. Retrying now with
   20 G free. Until it is green, the Rust module's signatures are unconfirmed.
2. **One real provider per seam.** Phase B proves the swap with fixtures.
3. **Real auth.** The WS accepts any non-empty bearer token. This is the gating
   item before anything is exposed beyond loopback.
4. **`RAG-FORK` decision** — ✅ **signed 2026-09-28, Option A** (server pgvector +
   `bge-m3`). It gates the embedding implementation and the HNSW index, which
   are still to be built.
5. **Postgres.** Nothing persists; 5 migration tests skip.
