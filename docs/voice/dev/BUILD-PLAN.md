# Build Plan — from prototype to product

> **Written:** 2026-09-28 · **Re-baselined:** 2026-10-03 · **For:** whoever implements Gate 3 onward, and any agent delegated a piece
> **Read first:** [`DECISIONS-2026-10-03.md`](DECISIONS-2026-10-03.md) — canonical; where this plan
> contradicts it, that file wins — then [`PROTOTYPE-HANDOVER.md`](PROTOTYPE-HANDOVER.md) · [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md)
> (17-topology-decision removed 2026-10-03 — decisions captured in ADR-001; git history)
> **The screens are already decided.** This plan is only about building them.
>
> **Re-baseline 2026-10-03 (summary):** Phases **C and D are merged into one backend batch** —
> all endpoints + **real channels** → Config UI complete → Ops/Calls/Live parity UI as a later
> phase. **10–14+ days, strictly single-writer** (the old 3–4 d Phase C estimate is gone).
> Storage is **two databases** (desktop keeps its Rust migrations; agent-core gets its own up/down
> SQL files, SQLite in dev, PG-shaped). Channels are all real, trial/free tiers only. Consent is
> decided (announce-first, no audio, emergency + transfer ladder now — no longer Gate-4-blocking).
> Auth is deferred to Gate 1. Per-phase rows are still updated **lazily, when each phase actually
> starts** (DECISIONS §6) — this rewrite aligns prose, it does not invent decisions.

---

## 1. The shape of the work

```
PHASE A  Skeletons          everything compiles, nothing works      ← start here
PHASE B  Contract           types + commands + migration, both sides agree
PHASE C  Wiring             the console talks to a real agent-core   ⤫ merged with D (2026-10-03)
PHASE D  Channels           WhatsApp sandbox, then telephony         ⤫ merged with C (2026-10-03)
PHASE E  Real data          metering, cost, ops snapshot
```

**Why skeletons first.** Every screen in the prototype runs on fixtures. Porting the screens
_before_ the contract exists produces a UI that has to be reworked the moment the real payload
arrives. Porting the contract first means the screens port once.

**The rule that makes this work: build the skeleton with the real types and a fake transport.**
`agent-core` responds to the real `BACKEND.md` §13 shapes; only the provider calls are stubbed.
The console is therefore never written against a shape that does not exist.

**Re-baselined 2026-10-03 — C and D are one batch now** ([`DECISIONS-2026-10-03.md`](DECISIONS-2026-10-03.md) §1):

1. Pre-flight: **disk cleanup only** (free 15+ GB). The direct-`TC` toolchain workaround stays
   until it blocks; Docker installs when the FreeSWITCH step arrives.
2. **Config endpoints + config tables first** (full BACKEND.md §13/14 schema, minus Postgres).
3. Remaining endpoints — calls list, alerts, shadow, spam, replay (migrations land with their
   endpoints, not before).
4. **Real channels:** FreeSWITCH loopback → Twilio trial → Baileys → official WA API.
5. **Full CALL-FLOW consent implementation** — announce-first disclosure, no audio recording,
   emergency policy + transfer ladder (the two former DRAFT blockers, resolved).
6. **Config UI complete** — review existing Settings+Config → extend Config with the cost
   simulator (UNVERIFIED flags preserved) → enhancement of Settings voice/local-model tabs.
7. **Later phase:** Ops/Calls/Live parity UI (endpoints already built in the batch).

**Strict global single writer until that batch lands** — no parallel console work (DECISIONS §2,
rationale: the 2026-09-30 BUILD-LOG hotspot incident). Estimated **10–14+ d**.

## 2. PHASE A — Skeletons + A+ Prototype Enrichment ✅ **CLOSED**

> **A. Skeletons closed 2026-09-28 (morning).** Evidence, gates and the three defects it caught:
> [`PHASE-A-COMPLETE.md`](PHASE-A-COMPLETE.md). Commits `88c44e8`, `c2e1e15`,
> `fb852a2`, `4837177`, `63b5c3c`.
>
> **A+. Prototype enrichment closed 2026-09-28 (afternoon).** The 9-surface prototype
> at [`prototype/voice-console/`](../../../prototype/voice-console/) was expanded from
> 8 skeleton surfaces to 9 fully-populated surfaces covering every ranked innovation
> from [`Personas, Scopes & Innovations.md`](../client/Personas,%20Scopes%20&%20Innovations.md) §5.
> Evidence is the build output below (§7.1) — TypeScript strict 0 errors, Vite production build
> exit 0, 4 BUILD-PLAN invariants clean.

<details><summary>Phase A — the four skeleton steps (done)</summary>

Four directories, four commits, all compiling. **No behaviour.**

| #   | Create                                 | Contents                                                                                                                                                                                                      | Done when                                                                    |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A1  | `services/agent-core/`                 | `pyproject.toml`, `agent_core/api.py` with `/healthz` returning `{"ok":true,"version":"…","startedAt":"…","db":"ok","providers":"ok"}`, `pyproject` deps: `fastapi`, `uvicorn`, `httpx`, `pydantic`, `pytest` | `python -m pytest -q` passes; `curl :8080/healthz` returns the shape above   |
| A2  | `services/agent-core/migrations/`      | `0001_tenants.sql` only — the `tenants` DDL from `BACKEND.md` §14, nothing else                                                                                                                               | `alembic`/`sqlx`-equivalent applies it on a scratch Postgres with `pgvector` |
| A3  | `src/features/agent/types/commands.ts` | **port `types.ts` from the prototype verbatim**, plus the two fields it does not yet carry                                                                                                                    | `tsc --noEmit` clean                                                         |
| A4  | `src/features/agent/stores/`           | the five stores from the prototype, `useFilteredCalls` **fixed per §4 of the handover**                                                                                                                       | `tsc` clean; a unit test proves the selector does not loop                   |

**Commit per step. Stop for review after A4** — this is the cheapest possible point to be wrong.

**Non-negotiable in A3/A4:** no `tenantId` field; no provider SDK; no files under `src/core` or
`src/hooks`; derived arrays in `useMemo`, never in a store selector.

</details>

<details open><summary>Phase A+ — prototype enrichment steps (done 2026-09-28)</summary>

The prototype was upgraded in place as the **click-test ground for the brainstorm document**, per the
user's explicit constraint: _"test in the prototype the ideas and guardrails scenarios and actions,
as a testing ground first, then we see the real implementation inside our project."_

| # | Surface expanded | What was added · Personas doc reference | Lines |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| A+1 | **Calls (1) + Live (2)** · [CallsPage.tsx](../../../prototype/voice-console/src/pages/CallsPage.tsx) | Shadow-only + spam-only toolbar filters (#2, #16); WhatsApp summary side panel 4 examples (#3); "Why said that?" replay buttons per row (#20); Live: disclosure-first Option A badge (§3.3), emotion ladder 5-state (#11), Julie/P4 warm-transfer brief card (#4), degradation 5-state mode selector (#13), turn provenance expandable (chunks + scope + prompt + guardrailsChecked) | 445 |
| A+2 | **Ops (3)** · [OpsPage.tsx](../../../prototype/voice-console/src/pages/OpsPage.tsx) | Pilot scorecard (#8): 7 bars ownedBy P1/P2/P4/P5/P6 personas + WATCH pill + narrative paragraph; Consent receipt audit DataTable (#7): 4 rows (at, caller, option, exact disclosure text, accepted, callId link); two new alert groups (a_14 emotion_escalation, a_15 spam_detected) | ~380 |
| A+3 | **Config (5)** · [ConfigPage.tsx](../../../prototype/voice-console/src/pages/ConfigPage.tsx) | 7-tab nav (① Vertical 6 templates #1 · ② Consent A/B/C §3.3 + exact FR copy · ③ Personas #15 3FR+3EN · ④ Voice + languages #9 bilingual switching · ⑤ Availability #17 after-hours · ⑥ Tier T0–T3 · ⑦ Innovations #5 live cost simulator embedded). Cost simulator: 2 traffic sliders + 3 PricingShape radio + standard/premium toggle + 4 mix sliders auto-balancing + 3 result cards + 6 driver breakdown bars | 690 |
| A+4 | **Knowledge (6) — NEW** · [KnowledgePage.tsx](../../../prototype/voice-console/src/pages/KnowledgePage.tsx) | Three tabs (Scope matrix T0🔵/T1🟣/T2🟠/T3🔴 · 🧙 Scope wizard #6 12 questions progress bar T3 auto-lock · 🗂 Version history #20 draft+v3+v2+v1 snapshots with per-item enablement grids). T2 local-node requirement pill; T3 never-check +⛔confidential badge. 343 LOC new file | 343 |
| A+5 | **Scenarios (9) — NEW** · [ScenariosPage.tsx](../../../prototype/voice-console/src/pages/ScenariosPage.tsx) | 2-col layout: 8 scenarios list left → detail right: Run button → progressive playingTurn animation @650ms → transcript + guardrail fired pill → Pass/Fail panel → "Why it matters" explanation. Below: 11 Guardrail catalog DataTable (id, persona rule, refusal copy, severity). 335 LOC new file. Registered in Shell nav FlaskConical icon + App '9' keyboard shortcut | 335 |
| A+6 | **Type system** · [types.ts](../../../prototype/voice-console/src/types.ts) | New discriminated unions: `KnowledgeTier` T0/T1/T2/T3 (§3.2); `GuardrailId` enum 11 ids; `CallerEmotion` 5-state (#11); `TurnProvenance` (#20); `TransferBrief` (#4); `VerticalTemplate` (#1); `VoicePersona` (#15); `PilotScorecard` + `ScorecardBar` (#8 ownedBy expanded to P1/P2/P4/P5/P6); `PricingShape` + cost sim I/O (#5); `WhatsAppSummary` (#3); `ConsentReceipt` (#7); `DegradedMode` union now incl. `text_fallback` (#13); `ScopeVersion` with `snapshot:Record<string,boolean>` (#20) | +220 |
| A+7 | **Fixtures** · [data.ts](../../../prototype/voice-console/src/data.ts) | 10 CALLS (incl. 2 shadow / 1 spam / 2 transferBriefs / 5 callerEmotion); LIVE_TURNS incl. Turn 0 Option A disclosure; P2_ALERTS += a_14 emotion_escalation + a_15 spam_detected; SNAPSHOT += pilotScorecard()=Week2 WATCH + consentReceiptsIssued=124; KNOWLEDGE_SCOPE (12 items) + SCOPE_VERSIONS; CONSENT_RECEIPTS (4); GUARDRAILS (11) + GUARDRAIL_SCENARIOS (8); VERTICAL_TEMPLATES (6 scored); VOICE_PERSONAS (3FR+3EN); PILOT_SCORECARD fn; WHATSAPP_SUMMARIES (4). Plus 16 typed stub fixtures for phase-2 stores (PERSONAS, CLIENT_DECISIONS, LEAD_TIMES, VERTICAL_METRICS, SHADOW_SESSIONS, CALLBACK_PROMISES, LOCAL_NODES, VOICE_EXPERIMENTS, WIZARD_ANSWERS, RETENTION_POLICY, ERASURE_REQUESTS, BREACH_LOG, PILOT_CRITERIA, SCOPE_MATRIX, AFTER_HOURS_POLICY, SPAM_FILTER_DEFAULTS) | +520 |
| A+8 | **Zustand stores** · [store.ts](../../../prototype/voice-console/src/store.ts) | `useCallListStore` spamOnly/shadowOnly toggles (#2 #16); `useLiveCallStore` setDegraded DegradedMode (#13); `useConfigStore` 7-tab state + bilingualCodeSwitching renamed from CodeSwitch to match UI (#9); `useVertical()` selector; `useKnowledgeStore` rewritten (array + versions + wizard) §3.2; NEW `useScenarioStore` + GUARDRAIL_SCENARIO_LIST; NEW `useCostSimStore` + runCostSim() (#5). Fix: PersonaState duplicate `focus` key (field + method) renamed method → `setFocus: PersonaId                                                                                                                                                                                                                                                                                               | null => void` (TS2300 defect caught by prototype enrichment phase) | +260 |

**Bug defects caught by A+ before any product code was written (3):**

1. `PersonaState.focus` duplicate identifier — data field + same-named action method → TS2300. Would have crashed Phase B import.
2. Naming mismatch `bilingualCodeSwitch` vs `bilingualCodeSwitching` between store field and ConfigPage toggle label → would have silently failed render.
3. `useFilteredCalls` memoisation bug confirmed + PROTOTYPE-HANDOVER §4 fix pattern validated.

</details>

## 3. PHASE B — The contract (2–3 days) ✅ **CLOSED 2026-09-28**

Both sides agree on shapes before either side has behaviour.

| #   | Do                                                                                                                                     | Done when                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| B1  | The four provider traits + one impl each, all returning a fixture response                                                             | the **swap test**: a second impl swaps in by **config value alone**, no code change. This is the Gate 1 exit criterion. |
| B2  | `POST /session`, `WS /ws/transcript`, `GET /ops/snapshot` returning the §13 payloads                                                   | a contract test asserts each field the console reads exists and is the right type                                       |
| B3  | `src-tauri/src/agent/{mod.rs,client.rs,models.rs}` — additive commands, `generate_handler![]` extended not reordered                   | `cargo check --workspace` clean; a `models.rs` ↔ pydantic diff test passes                                              |
| B4  | The remaining migrations: `calls`, `turns`+`call_metrics`, `transfer_attempts`, `metering_events`, `alerts`, `kb_*`, `provider_health` | each applies on a scratch DB; `vector(1024)` comes from config, not a literal                                           |

**`turns` has no audio column. That is the schema enforcing `CALL-FLOW.md` §2.** If you find
yourself adding one, stop.

## 4. PHASE C — Wiring the console (3–4 days) → 🟡 **merged into the C+D batch (2026-10-03)**

> **Re-baseline 2026-10-03:** the standalone 3–4 d console-wiring phase is gone. Console work now
> rides the merged batch order in §1: **Config UI completes inside the batch** (step 6); Ops/Calls/Live
> **parity UI is a later phase** (step 7) with all endpoints already built. C1 (console state
> primitives + Ops screen) landed 2026-09-30 and survives. Two rules that changed how a screen is
> ported: the console is the **existing tabbed `/agent-console`** (Ops · Calls · Live · Config — not a
> 9-route split; see [`PROTOTYPE-HANDOVER.md`](PROTOTYPE-HANDOVER.md)), and **i18n at write time** —
> every touched string gets a `t()` key with en+fr+ar filled (DECISIONS §3.1).

Port the screens with [`PROTOTYPE-HANDOVER.md`](PROTOTYPE-HANDOVER.md) §2 as the file-by-file map.

Order that works: **Topology → Settings → Config → Knowledge → Cost → Calls → Live → Ops → Alert detail.**
Rationale: the first two are static and prove the shell and the token classes; Ops is last because
it is the densest and benefits from everything the others have already forced into the type system.
**Re-baseline note:** inside the batch, **Config is the first screen to finish** (step 6) — the rest
of this order runs in the later parity phase, each screen only after its endpoint exists.

Per screen, the port is:

1. Replace `React.CSSProperties` with the token classes (`ui-tokens.ts`). **No inline styles survive.**
2. Replace `Pill`/`Button`/`Panel`/`DataTable` with the shared app components.
3. Swap the fixtures for the real `client.ts` calls — **no `data.ts` in the product.**
4. Add the states the prototype could not: loading skeletons, error boundaries, and the WS
   reconnect machine from `FRONTEND.md` §12.4 (the prototype shows one state, the product needs six).
5. i18n every string. The prototype is English-only on purpose; the product is **not**.

**Verify per screen:** `tsc --noEmit` · `cargo check --workspace` · the four invariant greps from
the handover §3 · one Playwright pass over the real app.

## 5. PHASE D — Channels (7–11 days, the long pole) → 🟡 **pulled forward into the C+D batch (2026-10-03)**

> **Re-baseline 2026-10-03:** channels are **real in this batch**, not a stubbed-then-real sequence —
> Phase D was pulled forward and merged (DECISIONS §1/§3.6). All channels run against **trial/free
> tiers only** (Twilio trial, Meta test app, Baileys free) — zero spend this batch. **Channel
> selection lives in config** (the customer picks baileys / twilio / official / none; capability
> flags show what is actually configured — never fake success). Telephony is **FreeSWITCH**
> (not Asterisk/Telnyx-first): acceptance test = **FreeSWITCH loopback** (two FS endpoints calling
> each other — no softphone, no paid numbers), tested as native FreeSWITCH on this Windows host;
> Docker + a dedicated VPS arrive only at the migration step (production telephony never shares
> the Contabo panel box).

| Step | Work                                                                                         | Gate |
| ---- | -------------------------------------------------------------------------------------------- | ---- |
| D1   | `ChannelAdapter` + **real Baileys**, with `normalize_e164()` **before** the allowlist        | 2    |
| D2   | FreeSWITCH loopback → Twilio trial inbound, turn detection, transfer ladder, voicemail → WhatsApp | 4    |

**D1's security rule is not negotiable and is the one thing a reviewer must check.** `+33…`,
`0033…`, `…@c.us` and `0…` are one number; a raw string comparison is bypassed by formatting alone.
Test all four formats resolve to one entry, and a non-sandbox number is rejected in every format.
Under production config, a traffic run must show **zero** Baileys connections.

**Ban-risk containment (2026-10-03):** Baileys is unofficial — run it against a **dedicated test
WhatsApp number**, never a client's or our main number (DECISIONS §3.6).

**D2 remains the collision point — but single-writer now covers the WHOLE batch, not just D2.**
Telephony, orchestrator and consent all touch the same files; DECISIONS §2 makes that a global
rule until the batch lands.

## 6. PHASE E — Real data (3–4 days) 🟡 **OPEN**

Metering events → `metering_events`; rollup → `GET /metering/rollup`; cost screen reads it.
**Reuse the existing invoicing module** — a second billing path is a defect, not a caution.
Ops snapshot feeds the digest in one round trip.

> **Open question (DECISIONS §9):** are metering endpoints **in-batch** or Gate 5? Decided at the
> start of endpoint work — it changes the batch's end-definition. Until then Phase E stands.

## 7. Verification — the commands that matter on this host

### 7.1 Prototype verification — **ran 2026-09-28, all ✅ exit 0 / empty**

The prototype is a standalone Vite React 19 app under `prototype/voice-console/`. Run these
**before** starting Phase B/C — they confirm the prototype still compiles after any edits during
click-testing sessions.

```powershell
# TypeScript strict — gate on EXIT CODE 0
cd prototype/voice-console
bunx tsc --noEmit
# 2026-09-28 actual output: EXIT 0 (0 errors, cleaned from 112 → 0 in 3 passes)

# Vite production build — gate on "built in" line
bun run build
# 2026-09-28 actual output:
#   vite v7.3.6 building client environment for production...
#   ✓ 1720 modules transformed.
#   dist/index.html                  3.38 kB │ gzip:   1.40 kB
#   dist/assets/index-*.js         933.95 kB │ gzip: 176.71 kB │ map: 1,509.53 kB
#   ✓ built in 2m 11s
#   EXIT 0
```

**Prototype 4 invariant greps (2026-09-28 actual outputs — 0 real violations).**
False positives documented inline so reviewers do not re-open.

```powershell
cd prototype/voice-console
# INV 1 — no audio UI widgets (listen/playback/<audio>/audio-player)
Select-String -Path (Get-ChildItem -Recurse src\*.tsx,src\*.ts | % FullName) `
  -Pattern 'listen|playback|audio-player|<audio' -CaseSensitive:$false
# 13 matches — ALL FALSE POSITIVES:
#   'listening' = Turn/Call status enum string, not audio widget
#   'addEventListener("keydown")' = keyboard shortcut handler, not audio
#   Comment/documentation strings about shadow mode

# INV 2 — no tenantId/tenant_id type declarations
Select-String -Path src\types.ts,src\pages\SettingsPage.tsx -Pattern 'tenantId|tenant_id'
# 2 matches — ALL FALSE POSITIVES (comments DOCUMENTING the invariant):
#   types.ts L4:   "* Note what is NOT here: tenantId. It comes from the token…"
#   SettingsPage L272: forbidden list "no tenantId from the client"

# INV 3 — no RTL physical direction classes/attrs (text-left, ml-, mr-)
Select-String -Path (Get-ChildItem -Recurse src\*.tsx,src\*.ts | % FullName) `
  -Pattern 'text-left|text-right|\bml-|\bmr-' -CaseSensitive:$false
# 1 match — FALSE POSITIVE string label:
#   ConfigPage L711: "{ ok: false, t: 'ml-sidecar — local tier…' }"
#   ("ml" here = "Moroccan local" sidecar label, NOT Tailwind `ml-*` margin-left class)

# INV 4 — no raw @tauri-apps/api/core imports in app code
Select-String -Path (Get-ChildItem -Recurse src\*.tsx,src\*.ts | % FullName) `
  -Pattern "from ['`"]@tauri-apps/api/core['`"]"
# 0 matches — CLEAN
```

### 7.2 Product (workspace) verification — for Phase B onward

Gate on SUMMARY LINE / exact match, not exit code — false greens exist here (see §10 risks).

**Verification gate per endpoint group (re-baselined 2026-10-03, DECISIONS §2)** — the whole set,
per group, before moving to the next group: `tsc --noEmit` · `cargo check --workspace` · the four
invariant greps · one Playwright pass over the real app · pytest summary-line green · the
TS↔Python contract-drift check (B5 fixture pattern) · a `test_camel_acceptance`-style contract
test covering **every new route** · **docs updated before commit** (docs-first).

```bash
# Gate 1 / 2 / 4 — agent-core. Assert the SUMMARY LINE, not the exit code.
cd services/agent-core && python -m pytest -q
cd services/agent-core && python -m pytest -q tests/rag/retrieval_eval.py   # hit@3 >= 0.9 — 🔲 not built yet

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

1. `docs/voice/dev/DECISIONS-2026-10-03.md` — **canonical re-baseline record; supersedes older plan text where they conflict**
2. `docs/specs/2026-09-28-voice-agent.md` — the gates and the blocking decisions
3. `docs/voice/dev/PROTOTYPE-HANDOVER.md` — the port map and the four invariants
4. `docs/voice/client/Personas, Scopes & Innovations.md` — §1 six-persona model, §3.2 T0–T3 knowledge tiers, §3.3 A/B/C consent copy (exact FR), §4 5 blocking decisions + cascading insight, §5 20 ranked innovations (#2/#3/#6 build first). **The innovations with numbers #1-20 are referenced inline throughout the prototype UI.** (⚠️ the persona *study* informs agent-logic conditions only — **no persona cards on any surface**, DECISIONS §4.)
5. `docs/voice/design/BACKEND.md` §13–15 — payloads, DDL, migrations (agent-core's own up/down SQL files, SQLite dev, PG-shaped — DECISIONS §3.3)
6. `docs/voice/design/FRONTEND.md` §12 — types, selectors, WS machine, delta coalescing
7. `prototype/voice-console/src/` — **9** surfaces (was 8 in handover). **Run `bun run dev` there before writing code.** The surfaces are:
   1 Calls · 2 Live · 3 Ops · 4 Alert · 5 Config · 6 Knowledge (NEW 2026-09-28) · 7 Cost · 8 Topology · 9 Scenarios (NEW 2026-09-28) · Settings

**Non-breaking rules (unchanged):**

- Additive serde. Existing Tauri command signatures never change.
- `generate_handler![]` is extended, never reordered.
- No new files under `src/core` or `src/hooks`.
- No provider SDK anywhere in `src/` — keys live in `agent-core` only.
- No `tenantId` from the client.
- No compat shims, no "interim" state, no TODOs left unowned.
- **Derived arrays in `useMemo`, never in a store selector.** (Prototype A+ confirmed this bug pattern.)

**Re-baselined rules (added 2026-10-03 — DECISIONS):**

- **Strict global single writer** until the C+D batch lands. No parallel console work (§2).
- **i18n at write time** — every touched string gets a `t()` key with en+fr+ar filled; the AGENTS.md
  rule outranks a feature's English-only precedent (§3.1).
- **Tabbed console, not 9 routes** — extend `/agent-console` (`AgentConsolePage`, tabs
  Ops · Calls · Live · Config); detail views are nested routes only when needed (§3.1).
- **Settings ↔ Config boundary** — Settings owns hardware/model runtime (local tier, RTF gate,
  model downloads); Config owns agent behaviour (provider mix/routing, consent variant, bilingual
  toggle, channel selection + per-channel enablement, cost-sim inputs). **No data duplicated** (§3.2).
- **Credentials live in `.env` on the server** (Baileys session, Twilio SID/token, Meta app token);
  never commit `.env`/secrets; Settings Keys tab stays read-only in v1 (§3.5).
- **Cost simulator ports with every `UNVERIFIED` flag and `source` string preserved** (§4);
  real numbers wait for the vendor RFQ.
- **No fixture-faked success** — parity only after an endpoint exists; absent capability renders the
  mockup-06 "capability unavailable" pattern (§4).

**Prototype-to-product porting note (added 2026-09-28 A+).**
When porting a screen from the prototype to `src/features/agent/`:

- **KnowledgePage.tsx (9 surfaces #6)** → split the wizard logic (`onAns`, T3 auto-lock pattern) into the wizard state machine from FRONTEND.md §12.5, not a local useState. Keep the T2-local-node / T3-never badges verbatim.
- **ScenariosPage.tsx (9 surfaces #9)** → the 8 scenarios + 11 guardrails are the Phase B contract test suite (B2). Keep "Why it matters" copy — it is the user-facing explanation for compliance.
- **ConfigPage.tsx 7-tab** → the cost simulator (Innovations tab) is pure client math until Phase E. Keep `runCostSim()` as the reference implementation; Phase E replaces `COST_ROWS` with DB-backed rollups.
- **CallsPage/LivePage** → `WhatsAppSummaries` panel (§3) is the contract test for D1 + voicemail bridge. Keep the 24h window / pill tone logic.
- **OpsPage** → PilotScorecard + ConsentAudit DataTables reference the real `ownedByPersona` union P1/P2/P4/P5/P6, not P1/P2/P5. Use the prototype's union shape — it caught the P4/P6 missing union gap.

**Environment quirks you will hit:**

- The `node node_modules/.bin/<cli>` shim crashes under git-bash — use the real ESM entry.
- `search_files` fails on `/c/...` MSYS paths; use `terminal` grep.
- `cargo check --workspace`, not `-p`.
- Always `git status --short` first. **Strict global single writer until the C+D batch lands**
  (DECISIONS §2 — the 2026-09-30 hotspot incident). Never commit with a bare directory on a shared
  branch; commit with explicit pathspecs.

**Report:** files changed with explicit pathspecs, the verification output pasted verbatim, and
anything you could **not** verify stated plainly.

## 9. What must not be built yet

| Not now                              | Why                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Supervisor barge-in                  | the one item that can damage a real customer interaction                   |
| Prompt editing in the console        | the assistant's "never" column                                             |
| Outbound calls or WhatsApp templates | different consent and spam regime                                          |
| CRM/calendar writes                  | explicitly out of v1                                                       |
| Arabic/Darija voice                  | the `ar` UI locale is not a promise of Arabic speech                       |
| Key rotation UI                      | Settings' Keys tab is read-only in v1; rotation is a Gate 5 runbook action |
| A second billing path                | the invoicing module already exists                                        |
| A third model-download path          | generalise the existing one or report and stop                             |

## 10. The honest risks

- **Single writer + merged batch size = serial 2–4+ weeks.** The old "Gate 4 is one writer for
  5–7 days" became a batch-wide rule on 2026-10-03 — biggest schedule exposure in the plan
  (DECISIONS §8.1).
- **Trial-tier caps may block parts of official-API/Twilio testing** (Meta test-mode 24h tokens,
  Twilio no-inbound-from-unverified-numbers). FreeSWITCH loopback is the safety net for telephony
  acceptance (DECISIONS §8.2).
- **`.env` secrets with no rotation story** — accepted for dev; must be revisited before the pilot
  (ties to Gate 1 auth). **Gate 1 also owns closing the "any non-empty bearer token" hole** — new
  endpoints ship open on loopback until then (DECISIONS §3.9/§8.3).
- **Baileys ban risk** — contained only by the dedicated test-number rule (§5, DECISIONS §3.6).
- **Two-database surface** — double migration bookkeeping (desktop Rust + agent-core SQL files);
  kept deliberately for clean boundaries (DECISIONS §8.5).
- **Meta verification and ARCEP porting are no longer our schedule** — per-client, started when
  each client starts, with guidance docs we provide; we build on dev accounts (DECISIONS §5).
  The lead time still gates *their* pilot.
- **The desktop embedder is English-only**, so French retrieval fails silently. It looks fixed the
  moment the UI exists and the agent is wrong. See `RAG-FORK.md`.
- **The local tier is gated on an unmeasured RTF.** Until it is measured on this host, the tier
  stays disabled with its reason shown. _ConfigPage Innovations tab already carries this banner
  with the exact copy the pilot client will see._
- **The client is still blocking the pilot, not the build.** Four questionnaire answers and a
  signed cost model; the docs' recommended defaults are used as flagged assumptions meanwhile
  (DECISIONS §5). Prototype A+ built the _live_ cost simulator (Config #5) to unblock Decision #1;
  prototype click-testing should unblock decisions #2–#5 before any signed
  document is required.
- **🛡 Derisked by Phase A+ (2026-09-28):** Store shape defects, type union gaps, naming
  mismatches, 4-invariant regressions, and UI information density are all de-risked. The
  prototype produced 3 concrete defect catches (§2 A+ footer) before a line of product code was
  written. Continue this pattern: prototype changes compile → product ports once.

---

## 11. 🎓 Lessons Learned — Phase A+ enrichment (2026-09-28)

These are non-obvious findings from the prototype expansion. They are not part of the brainstorm
doc and must be re-applied every session.

**1. Store `React.CSSProperties` pass-through on 3 shared UI components was 80% of type errors.**
Adding `style?: React.CSSProperties` to `Pill`, `Note`, `SectionTitle`, and widening
`Radio.label` + `Checkbox.label` from `string` to `ReactNode` eliminated **~37 of the initial
61 TS strict errors** in a single 15-LOC edit across [ui.tsx](../../../prototype/voice-console/src/components/ui.tsx).
Without this pass-through, every call site would have been wrapped in an extra `<span>` for a
8–12px marginBottom or fontSize tweak.

**2. Discriminated-union access on ad-hoc array maps needs a type-guard variable, not inline.**
KnowledgePage's ScopeHistory map mixes a `{draft:true}` first element with typed
`{note:string}` ScopeVersion entries. Inline `row.draft` triggers TS2339 7 times.
The fix pattern: `const isDraft = 'draft' in row && !!row.draft;` once at top of map callback,
then `isDraft` everywhere. 7 errors → 0.

**3. `Zustand` interface data-field and action-method name collisions DO happen.**
`PersonaState { focus: PersonaId|null; focus: (id) => void }` → TS2300 Duplicate identifier.
Convention for this codebase (per SMEMaster rules): state noun is `focus` / `filter`; action
verb is `setFocus` / `filter`. Caught _only_ because the enrichment forced TypeScript
compilation of 82 new fields across 16 second-pass stub fixtures.

**4. "Invariant grep" false positives MUST be documented inline at the run-location.**
The initial INV3 (no `ml-`) matched `ml-sidecar` (Moroccan local node label, not a CSS
class). Without the inline false-positive explanation, a future reviewer would delete the
label or — worse — weaken the regex. Document the false positives in the plan §7.1 so the
regex is never relaxed.

**5. `ownedByPersona` union expansion is required the moment scorecard bars reference P4/P6.**
The ScorecardBar interface initially declared only `P1|P2|P5`. But the 7-bar pilot scorecard
references P4 (Julie staff burden, 61% transfer target) and P6 (CNIL regulator, 100%
disclosure target). Union narrowing silently dropped the bars until expanded to
`P1|P2|P4|P5|P6`. Lesson: _when any persona ID appears in fixture data, it must appear in
the union the same commit — never "add later"._

**6. Bilingual toggle naming: store + UI IDs must match exactly.**
`bilingualCodeSwitch` (store) vs `bilingualCodeSwitching` (ConfigPage toggle id) → silent
no-op render. Renaming _both sides_ in the same commit (store.ts interface + default value
line, plus ConfigPage `label htmlFor` + `c.set(...)` calls) is the fix. Never widen the type
as a workaround.

---

## 12. 📋 Compact status index (what's done · what's left)

Last updated: **2026-10-03** (re-baseline). Phase status legend: ✅ CLOSED · 🟡 OPEN · 🔴 BLOCKED.

### Phase matrix

| Phase  | Title                                                 | Duration  | Status         | Last change          | Next action                                                           |
| ------ | ----------------------------------------------------- | --------- | -------------- | -------------------- | --------------------------------------------------------------------- |
| **A**  | Skeletons                                             | 1 day     | ✅ CLOSED      | 2026-09-28 morning   | —                                                                     |
| **A+** | Prototype enrichment (9 surfaces, all 20 innovations) | 1 session | ✅ CLOSED      | 2026-09-28 afternoon | —                                                                     |
| **B**  | Contract (types + migrations + provider traits)       | 2–3 days  | ✅ CLOSED      | 2026-09-28           | See `PHASE-B-COMPLETE.md`; real providers + auth + persistence remain |
| **C+D** | **Merged backend batch** (re-baselined): config endpoints + config tables → remaining endpoints → **real channels** (FreeSWITCH loopback → Twilio trial → Baileys → official WA API) → full CALL-FLOW consent → Config UI complete; Ops/Calls/Live parity UI is a **later phase** | 10–14+ days | 🟡 OPEN, batch not started | 2026-10-03 re-baseline | Start DECISIONS §1 step 1 (disk cleanup → config endpoints + tables); **STRICT single writer** |
| ~~**C**~~ | _Console wiring — absorbed into C+D above_          | —         | 🔲 merged      | 2026-10-03           | C1 (state primitives + Ops screen) landed 2026-09-30 and carries over  |
| ~~**D**~~ | _Channels — pulled forward into C+D above_           | —         | 🔲 merged      | 2026-10-03           | Real channels this batch, trial/free tiers only                       |
| **E**  | Real data (metering + cost rollups)                   | 3–4 days  | 🟡 OPEN        | never started        | Reuse invoicing module per §6 first; in-batch-vs-Gate-5 is DECISIONS §9 open |

### Prototype 9 surfaces coverage matrix

Each surface → maps to which brainstorm Personas-doc section is visibly testable by clicking
around `bun run dev`.

| Surface (key #)   | Brainstorm sections visible                                                                                         | 20 Innovations visible                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Calls           | §1 P1/P2 callers, §3.3 A copy pill (T0 disclosure check), §5 #20 replay                                             | #2 shadow, #3 WhatsApp, #16 spam, #20 replay                                                                                                  |
| 2 Live            | §1 P3 Camille, §3.3 A disclosure FIRST badge, §5 #4 Julie brief, #11 ladder, #13 degrade, #12 callback promise type | #4 transfer, #11 emotion, #12 callback, #13 degrade, #15 persona (speaker label), #18 multilingual (detect field)                             |
| 3 Ops             | §1 P5 operator, §1 P6 regulator (CNIL disclosure scorecard), §5 #7 audit, #8 pilot                                  | #7 consent, #8 scorecard, #10 provider seams (health), #11 emotion alerts, #16 spam alerts                                                    |
| 4 Alert           | §4 decision #2 (SLA / uptime)                                                                                       | a_14 emotion, a_15 spam (new A+)                                                                                                              |
| 5 Config          | §2 vertical matrix, §3.3 A/B/C exact copy, §4 decision #1 cost sim, §4 decisions #2–#5 toggles                      | #1 templates, #5 cost simulator LIVE, #9 bilingual switch, #15 personas 6-card, #17 after-hours, #6 knowledge wizard (link), #2 shadow toggle |
| 6 Knowledge (NEW) | §3.2 T0/T1/T2/T3 4-tier framework full matrix                                                                       | #6 wizard 12 questions, #14 local node T2, #20 version history drafts                                                                         |
| 7 Cost            | §4 decision #1 cost drivers                                                                                         | #5 cost shapes reference, #19 A/B test (stub)                                                                                                 |
| 8 Topology        | ADR-001 4 seams diagram                                                                                             | #14 local node (stub pill)                                                                                                                    |
| 9 Scenarios (NEW) | §4 decision #3 guardrail refusals + P3 persona rule copy                                                            | 11 guardrails, 8 progressive-play scenarios + "Why it matters" = #20 replay rationale                                                         |
| Settings          | §3 all invariants, §3.3 consent receipt keys (read-only)                                                            | Forbidden list recap                                                                                                                          |

> **Parity bar (2026-10-03, DECISIONS §4):** full numbered prototype innovations per surface —
> **minus persona widgets** (no persona cards anywhere; the persona study informs workflow /
> business-type *conditions* in agent logic only) — and **only after each feature's endpoint
> exists** (backend-first). No fixture-faked success: where a capability is absent the UI shows
> the mockup-06 "capability unavailable" pattern. Everything ports into the **tabbed
> `/agent-console`**, not a 9-route split.

### 3 concrete defects caught pre-product (Phase A+ — must not regress)

| #   | Defect                                                                                     | Location in prototype                                                                              | How it would have failed in Phase B                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TS2300 Duplicate identifier `PersonaState.focus` (field + method)                          | [store.ts](../../../prototype/voice-console/src/store.ts#L119-L125) → method renamed to `setFocus` | Phase B first `tsc` on `src/features/agent/stores/` would fail on first import                                                                      |
| 2   | `bilingualCodeSwitch` (store) ≠ `bilingualCodeSwitching` (Config toggle id) → silent no-op | [store.ts](../../../prototype/voice-console/src/store.ts) + ConfigPage toggle                      | Config tab "Bilingual" toggle would render, click, do nothing. No TS error — hard to catch.                                                         |
| 3   | ScorecardBar.ownedByPersona union too narrow (P1/P2/P5, not P1/P2/P4/P5/P6)                | [types.ts](../../../prototype/voice-console/src/types.ts#L345-L346)                                | Ops scorecard bars for Julie (P4 transfer) + CNIL (P6 disclosure) would render as `undefined` pill with no TS error (union narrowing drops element) |

---

_End of BUILD-PLAN.md (re-baselined 2026-10-03). Next section to write: the C+D batch progress
table with commit hashes per batch step — appended when step 1 actually starts, per DECISIONS §6
(rows updated lazily, when the phase starts). Its §7.2 contract-test block now covers every new
route (see the verification gate above)._
