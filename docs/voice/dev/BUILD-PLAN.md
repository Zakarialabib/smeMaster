# Build Plan — from prototype to product

> **Written:** 2026-09-28 · **For:** whoever implements Gate 3 onward, and any agent delegated a piece
> **Read first:** [`PROTOTYPE-HANDOVER.md`](PROTOTYPE-HANDOVER.md) · [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> [`12-voice-agent-topology-decision.md`](../../06-ROADMAP/12-voice-agent-topology-decision.md)
> **The screens are already decided.** This plan is only about building them.

---

## 1. The shape of the work

```
PHASE A  Skeletons          everything compiles, nothing works      ← start here
PHASE B  Contract           types + commands + migration, both sides agree
PHASE C  Wiring             the console talks to a real agent-core
PHASE D  Channels           WhatsApp sandbox, then telephony
PHASE E  Real data          metering, cost, ops snapshot
```

**Why skeletons first.** Every screen in the prototype runs on fixtures. Porting the screens
*before* the contract exists produces a UI that has to be reworked the moment the real payload
arrives. Porting the contract first means the screens port once.

**The rule that makes this work: build the skeleton with the real types and a fake transport.**
`agent-core` responds to the real `BACKEND.md` §13 shapes; only the provider calls are stubbed.
The console is therefore never written against a shape that does not exist.

## 2. PHASE A — Skeletons (1 day, and it de-risks everything) ✅ **CLOSED**

> Closed 2026-09-28. Evidence, gates and the three defects it caught:
> [`PHASE-A-COMPLETE.md`](PHASE-A-COMPLETE.md). Commits `88c44e8`, `c2e1e15`,
> `fb852a2`, `4837177`, `63b5c3c`.

<details><summary>the four steps (done)</summary>


Four directories, four commits, all compiling. **No behaviour.**

| # | Create | Contents | Done when |
|---|---|---|---|
| A1 | `services/agent-core/` | `pyproject.toml`, `agent_core/api.py` with `/healthz` returning `{"ok":true,"version":"…","startedAt":"…","db":"ok","providers":"ok"}`, `pyproject` deps: `fastapi`, `uvicorn`, `httpx`, `pydantic`, `pytest` | `python -m pytest -q` passes; `curl :8080/healthz` returns the shape above |
| A2 | `services/agent-core/migrations/` | `0001_tenants.sql` only — the `tenants` DDL from `BACKEND.md` §14, nothing else | `alembic`/`sqlx`-equivalent applies it on a scratch Postgres with `pgvector` |
| A3 | `src/features/agent/types/commands.ts` | **port `types.ts` from the prototype verbatim**, plus the two fields it does not yet carry | `tsc --noEmit` clean |
| A4 | `src/features/agent/stores/` | the five stores from the prototype, `useFilteredCalls` **fixed per §4 of the handover** | `tsc` clean; a unit test proves the selector does not loop |

**Commit per step. Stop for review after A4** — this is the cheapest possible point to be wrong.

**Non-negotiable in A3/A4:** no `tenantId` field; no provider SDK; no files under `src/core` or
`src/hooks`; derived arrays in `useMemo`, never in a store selector.

</details>

## 3. PHASE B — The contract (2–3 days)

Both sides agree on shapes before either side has behaviour.

| # | Do | Done when |
|---|---|---|
| B1 | The four provider traits + one impl each, all returning a fixture response | the **swap test**: a second impl swaps in by **config value alone**, no code change. This is the Gate 1 exit criterion. |
| B2 | `POST /session`, `WS /ws/transcript`, `GET /ops/snapshot` returning the §13 payloads | a contract test asserts each field the console reads exists and is the right type |
| B3 | `src-tauri/src/agent/{mod.rs,client.rs,models.rs}` — additive commands, `generate_handler![]` extended not reordered | `cargo check --workspace` clean; a `models.rs` ↔ pydantic diff test passes |
| B4 | The remaining migrations: `calls`, `turns`+`call_metrics`, `transfer_attempts`, `metering_events`, `alerts`, `kb_*`, `provider_health` | each applies on a scratch DB; `vector(1024)` comes from config, not a literal |

**`turns` has no audio column. That is the schema enforcing `CALL-FLOW.md` §2.** If you find
yourself adding one, stop.

## 4. PHASE C — Wiring the console (3–4 days)

Port the screens now. [`PROTOTYPE-HANDOVER.md`](PROTOTYPE-HANDOVER.md) §2 is the file-by-file map.

Order that works: **Topology → Settings → Config → Knowledge → Cost → Calls → Live → Ops → Alert detail.**
Rationale: the first two are static and prove the shell and the token classes; Ops is last because
it is the densest and benefits from everything the others have already forced into the type system.

Per screen, the port is:
1. Replace `React.CSSProperties` with the token classes (`ui-tokens.ts`). **No inline styles survive.**
2. Replace `Pill`/`Button`/`Panel`/`DataTable` with the shared app components.
3. Swap the fixtures for the real `client.ts` calls — **no `data.ts` in the product.**
4. Add the states the prototype could not: loading skeletons, error boundaries, and the WS
   reconnect machine from `FRONTEND.md` §12.4 (the prototype shows one state, the product needs six).
5. i18n every string. The prototype is English-only on purpose; the product is **not**.

**Verify per screen:** `tsc --noEmit` · `cargo check --workspace` · the four invariant greps from
the handover §3 · one Playwright pass over the real app.

## 5. PHASE D — Channels (7–11 days, the long pole)

| Step | Work | Gate |
|---|---|---|
| D1 | `ChannelAdapter` + the Baileys **sandbox**, with `normalize_e164()` **before** the allowlist | 2 |
| D2 | Telnyx inbound media stream, turn detection, transfer ladder, voicemail → WhatsApp | 4 |

**D1's security rule is not negotiable and is the one thing a reviewer must check.** `+33…`,
`0033…`, `…@c.us` and `0…` are one number; a raw string comparison is bypassed by formatting alone.
Test all four formats resolve to one entry, and a non-sandbox number is rejected in every format.
Under production config, a traffic run must show **zero** Baileys connections.

**D2 is one writer, 5–7 days, and everything collides there.** Telephony, orchestrator and consent
all touch the same files. If two agents are working, this is the gate that breaks.

## 6. PHASE E — Real data (3–4 days)

Metering events → `metering_events`; rollup → `GET /metering/rollup`; cost screen reads it.
**Reuse the existing invoicing module** — a second billing path is a defect, not a caution.
Ops snapshot feeds the digest in one round trip.

## 7. Verification — the commands that matter on this host

```bash
# Gate 1 / 2 / 4 — agent-core. Assert the SUMMARY LINE, not the exit code.
cd services/agent-core && python -m pytest -q
cd services/agent-core && python -m pytest -q tests/rag/retrieval_eval.py   # hit@3 >= 0.9

# Console — workspace, not -p <crate>
cd src-tauri && cargo check --workspace
cmd /c "node node_modules/typescript/bin/tsc --noEmit"

# Tests — the .bin shim CRASHES under git-bash. Invoke the real ESM entry,
# and gate on the "Tests" summary line: vitest false-greens here (exit 0 with
# hundreds of failures).
cmd /c "node node_modules/vitest/vitest.mjs run src/features/agent --no-file-parallelism"

# Invariants — all four must be empty
grep -rniE 'listen|playback|audio-player|<audio' src/features/agent
grep -rnE 'tenantId|tenant_id' src/features/agent/types/
grep -rniE 'text-left|text-right|\bml-|\bmr-' src/features/agent
grep -rniE 'from ["'"'"']@tauri-apps/api/core' src/features/agent
```

`cargo check --workspace` is the final arbiter, not `cargo check -p <crate>`: the workspace
inherits the app's full default features and compiles code `-p` skips.

## 8. Delegation brief — for whoever picks this up

**READ FIRST, in order:**
1. `docs/specs/2026-09-28-voice-agent.md` — the gates and the blocking decisions
2. `docs/voice/dev/PROTOTYPE-HANDOVER.md` — the port map and the four invariants
3. `docs/voice/design/BACKEND.md` §13–15 — payloads, DDL, migrations
4. `docs/voice/design/FRONTEND.md` §12 — types, selectors, WS machine, delta coalescing
5. `prototype/voice-console/src/` — the screens themselves. **Run them.**

**Non-breaking rules:**
- Additive serde. Existing Tauri command signatures never change.
- `generate_handler![]` is extended, never reordered.
- No new files under `src/core` or `src/hooks`.
- No provider SDK anywhere in `src/` — keys live in `agent-core` only.
- No `tenantId` from the client.
- No compat shims, no "interim" state, no TODOs left unowned.
- **Derived arrays in `useMemo`, never in a store selector.**

**Environment quirks you will hit:**
- The `node node_modules/.bin/<cli>` shim crashes under git-bash — use the real ESM entry.
- `search_files` fails on `/c/...` MSYS paths; use `terminal` grep.
- `cargo check --workspace`, not `-p`.
- Always `git status --short` first — concurrent agents work in this tree. Never commit with a
  bare directory on a shared branch.

**Report:** files changed with explicit pathspecs, the verification output pasted verbatim, and
anything you could **not** verify stated plainly.

## 9. What must not be built yet

| Not now | Why |
|---|---|
| Supervisor barge-in | the one item that can damage a real customer interaction |
| Prompt editing in the console | the assistant's "never" column |
| Outbound calls or WhatsApp templates | different consent and spam regime |
| CRM/calendar writes | explicitly out of v1 |
| Arabic/Darija voice | the `ar` UI locale is not a promise of Arabic speech |
| Key rotation UI | Settings' Keys tab is read-only in v1; rotation is a Gate 5 runbook action |
| A second billing path | the invoicing module already exists |
| A third model-download path | generalise the existing one or report and stop |

## 10. The honest risks

- **Gate 4 is one writer for 5–7 days.** It is the most likely cause of a slipped date.
- **Meta verification is the longest lead time and is not ours to control.** Start it before Gate 1.
- **The desktop embedder is English-only**, so French retrieval fails silently. It looks fixed the
  moment the UI exists and the agent is wrong. See `RAG-FORK.md`.
- **The local tier is gated on an unmeasured RTF.** Until it is measured on this host, the tier
  stays disabled with its reason shown.
- **The client is still blocking.** Four decisions and a signed cost model. None of this work
  needs them — but the pilot does.
