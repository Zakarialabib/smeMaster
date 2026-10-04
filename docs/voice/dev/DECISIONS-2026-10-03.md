# Decisions Record — Phase C+D re-baseline (grill session 2026-10-03)

> **Canonical input for every doc rewrite on 2026-10-03.** Produced by an adversarial
> grilling session over the whole `docs/voice/` set. Where an older doc contradicts
> this file, **this file wins** until code proves otherwise.
>
> Status: ✅ decided (client-owned items still open are listed in §9).

---

## 1. Scope — what changed

| Before (as documented) | After (decided 2026-10-03) |
| --- | --- |
| Phase C = console wiring (3–4 d), Phase D = channels (7–11 d, OUT of scope) | **Phase C+D merged**: one backend batch (all endpoints + real channels) → Config UI complete → Ops/Calls/Live parity UI as a later phase |
| One WhatsApp channel + one PSTN number | **Multi-channel, customer chooses from config**: Baileys (fast dev/testing), Twilio, official WhatsApp Business API — all **real**, trial/free tiers only |
| Channels stubbed first (Phase B seam pattern) | **Real channel integration now** — Phase D pulled forward |
| Server-side persistence = Postgres (Gate 1) | **Two databases**: desktop keeps its Rust migrations for console data; **agent-core gets its own up/down SQL files**, SQLite in dev, PG-shaped schema. Config tables first |
| Effort estimate 3–4 d for Phase C | **10–14+ d** for the merged batch, strictly single-writer |

**Batch sequence (decided, in order):**

1. Pre-flight: **disk cleanup only** (free 15+ GB). Toolchain workaround (direct
   `TC` path) stays until it blocks; Docker installs when the FreeSWITCH step arrives.
2. **Config endpoints + config tables first** (full BACKEND.md §13/14 schema, minus Postgres).
3. Remaining endpoints — calls list, alerts, shadow, spam, replay (migrations land with
   their endpoints, not before).
4. **Real channels**: FreeSWITCH loopback → Twilio trial → Baileys → official WA API.
5. **Full CALL-FLOW consent implementation** — announce-first disclosure, no audio
   recording, emergency policy + transfer ladder (resolves the two DRAFT items that
   blocked Gate 4).
6. **Config UI complete** — review existing Settings+Config → extend Config with the
   cost simulator (UNVERIFIED flags preserved) → enhancement of Settings
   voice/local-model tabs based on Config.
7. **Later phase:** Ops/Calls/Live parity UI (endpoints already built in the batch).

## 2. Execution rules

- **Strict global single writer** until the backend batch lands. No parallel console
  work. (Rationale: BUILD-LOG hotspot incident 2026-09-30 — two agents swept the same
  uncommitted files.)
- **Verification gate per endpoint group = full §7**: `tsc --noEmit` +
  `cargo check --workspace` + the four invariant greps + one Playwright pass +
  pytest summary-line green + TS↔Python contract-drift check (B5 fixture pattern) +
  every new route covered by a `test_camel_acceptance`-style contract test.
  **Docs updated before commit** (docs-first convention).
- Fix tools when they break (user mandate); the MCP/tauri cargo-check path and `tsc`
  are the standing fallbacks.

## 3. Architecture decisions

### 3.1 Surfaces
- **Extend the tabbed console** at `/agent-console` (`AgentConsolePage`, tabs
  Ops · Calls · Live · Config). NOT the PROTOTYPE-HANDOVER 9-route split.
  Detail views (call detail, alert detail) become **nested routes only when needed**.
- **i18n at write time**: every touched string gets a `t()` key with en+fr+ar filled.
  AGENTS.md rule outranks the feature's existing English-only precedent.

### 3.2 Settings ↔ Config boundary
- **Settings** owns hardware/model runtime: local tier, RTF gate, model downloads.
- **Config** owns agent behaviour: provider mix/routing, consent copy variant,
  bilingual toggle, channel selection + per-channel enablement, cost-sim inputs.
- **No data duplicated** between them.

### 3.3 Storage & migrations
- **Two databases, deliberately:**
  - Desktop app → existing Rust `src-tauri` migrations (console data).
  - agent-core → **its own up/down SQL files** in `services/agent-core/migrations/`
    (already numbered 0001–0004 per BACKEND.md §15), applied at startup to a
    server-side SQLite for dev. Schema written **PG-shaped** so the Gate 1 Postgres
    swap is driver + runner, not redesign.
- **Config-related tables first**; calls/turns/metering/knowledge migrations land with
  their endpoints (incremental, not one atomic batch).
- agent-core had **no persistence precedent at all** (in-memory fixtures only) —
  this storage module is the first; keep it the single storage home.

### 3.4 Config schema
- **Full BACKEND.md §13/14 as designed** (minus Postgres): typed schema mirroring
  ConfigPage state. Credentials are **NOT** in config; persona data is **NOT** in config.

### 3.5 Credentials
- **`.env` on the server** — Baileys session creds, Twilio SID/token, Meta app token.
  Simplest path; **no rotation story yet** (accepted, recorded as open in §9).
  Settings Keys tab stays read-only display in v1. **Never commit `.env`/secrets.**

### 3.6 Channels
- **All channels fully real this batch** — Baileys, Twilio voice, official WA API —
  live against **trial/free tiers only**: Twilio trial, Meta test app, Baileys free.
  Zero spend this batch; trial caps accepted (Meta test-mode 24h tokens, Twilio
  no-inbound-from-unverified-numbers).
- **Channel selection lives in config/settings** — the customer chooses
  (baileys / twilio / official / none); capability flags show what's actually
  configured (never fake success).
- **Ban-risk containment:** Baileys is unofficial — run against a dedicated test
  WhatsApp number, never a client's or our main number.

### 3.7 Telephony
- **FreeSWITCH** (not Asterisk): better SIP/media flexibility (WebRTC, codecs).
- **Testing = native FreeSWITCH on this Windows host** (no Docker/WSL here today;
  Docker Desktop was explicitly deferred). **Migration = new dedicated VPS with
  Docker** — production telephony never shares the Contabo panel box
  (86.48.1.182 runs the production SaaS panel; no Docker daemon; not a telephony host).
- **Acceptance test = FreeSWITCH loopback** (two FS endpoints calling each other,
  no softphone, no paid numbers).

### 3.8 Consent (resolves CALL-FLOW's DRAFT blockers)
- **Full CALL-FLOW consent implementation in this batch**: announce-first disclosure,
  **no audio recording** (schema enforces it — `turns` has no audio column),
  emergency policy + transfer ladder implemented now, not at Gate 4.
- Dev calls exercise the same disclosure path the pilot needs.

### 3.9 Auth
- **Deferred to Gate 1.** New endpoints ship open on loopback; the known
  "any non-empty bearer token" hole is accepted for now and must be closed before
  anything leaves loopback. Recorded as a Gate 1 gating item.

## 4. Content decisions

- **Cost simulator:** port the structure from `prototype/voice-console/src/data/costPresets.ts`
  with **every `UNVERIFIED` flag and `source` string preserved**. Real numbers land
  when the vendor RFQ returns (COST-MODEL §6 gates signature).
- **Personas:** **no persona cards anywhere.** The persona study
  (`client/Personas, Scopes & Innovations.md`) informs workflow / business-type
  **conditions** in agent logic only. Surfaces do not render persona widgets.
- **Parity bar:** full numbered prototype innovations per surface (minus persona
  widgets), but **only after each feature's endpoint exists** — backend-first.
  No fixture-faking success; where a capability is absent the UI shows the
  mockup-06 "capability unavailable" pattern.

## 5. External / lead-time posture

- **Clients (CH/FR/BE) run their own Meta business verification and ARCEP number
  porting** when they start — we provide step-by-step guidance guides per country.
- We build on **dev accounts** meanwhile. No company-card spend this batch.
- The 4 client questionnaire answers are still outstanding — they **block the pilot,
  not the build**. For planning, the docs' recommended defaults are used as flagged
  assumptions.

## 6. Doc-maintenance policy (decided)

- **One new decisions doc only** (this file). README / BUILD-PLAN / BUILD-LOG rows
  are updated **lazily, when each phase actually starts** — not upfront.
- Doc rewrites on 2026-10-03 align the prose with this record; they do not invent
  new decisions.

## 7. Explicitly OUT of scope / deferred

| Item | Deferred to |
| --- | --- |
| Postgres + pgvector bring-up, 5 unskipped migration tests | Gate 1 |
| Real auth (token validation on all routes) | Gate 1 |
| Paid Twilio account, chosen carrier/BSP, real pricing | Vendor RFQ (COST-MODEL §6) |
| rustup proxy repair + running the ~200 unexecuted Rust tests | CI / when workaround breaks |
| Docker Desktop + WSL2 install | When the FreeSWITCH migration-to-VPS step arrives |
| Production number porting + Meta business verification | Per-client, with our guidance |
| Mockups 01–05 degraded states (WIREFRAMES G9) | Tracked, not forgotten |
| PROTOTYPE-HANDOVER port-map completion (post-A+ surfaces) | Superseded in part by the tabbed-console decision |
| Key rotation UI | Gate 5 runbook (unchanged) |

## 8. Risks introduced by these decisions (honest list)

1. **Single-writer + merged batch size = serial 2–4+ weeks.** Biggest schedule
   exposure in the plan; the original Phase D was already the long pole.
2. **Trial-tier caps** may block parts of official-API/Twilio testing
   (24h tokens, no inbound to unverified numbers). FreeSWITCH loopback is the
   safety net for telephony acceptance.
3. **`.env` secrets with no rotation story** — acceptable for dev, must be
   revisited before the pilot (ties to Gate 1 auth).
4. **Baileys ban risk** — contained by the dedicated test number rule (§3.6).
5. **Two-database surface** — double migration bookkeeping; kept deliberately for
   clean boundaries.

## 9. Open questions — deferred to the phase that needs them

| Question | Blocks | Ask when |
| --- | --- | --- |
| Which carrier/BSP does the pilot use? | Pilot pricing | RFQ responses arrive |
| Metering endpoints in-batch or Gate 5? | Batch end-definition | Start of endpoint work |
| Credentials rotation mechanism? | Pilot security | Gate 1 auth work |
| Which channel does the client pick? | Pilot config | Client answers Q2 |
| Paid accounts provisioning owner? | Post-dev testing | Before pilot |
| Consent copy variant A/B/C final text? | Pilot launch | Client answers Q4 |
