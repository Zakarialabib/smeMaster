# ADR-001 — Voice agent: integration seams, embedding spaces, IPC surface

> **Status:** Accepted · **Date:** 2026-09-28 · **Decided by:** Zakaria (engineering)
> **Supersedes:** nothing (first ADR). **Amends:** `docs/specs/2026-09-28-voice-agent.md`,
> `docs/voice/RAG-FORK.md`, `docs/voice/OPS-ASSISTANT.md` (corrections applied in-place)
> **Anchor spec:** [`docs/specs/2026-09-28-voice-agent.md`](../../specs/2026-09-28-voice-agent.md)
> **Evidence read:** working tree @ `private/voice-agent-client` — `1c738db`, 2026-09-28

## Context

A grill of `docs/voice/**` + the spec against the actual tree found four classes of
gap: **licensing**, **integration mode**, **IPC/API surface**, and **embedding-space
ownership**. Three of the four were real holes in the plan; one factual claim in the
spec was wrong. This ADR resolves them so Gate 1 can start without re-litigating.

What the tree actually contains (verified, not read from docs):

| Claim in the docs | Status against the tree |
|---|---|
| `ml-sidecar` is a real candle+lancedb sidecar | ✅ `src-tauri/crates/ml-sidecar/Cargo.toml:33-38`, `src/main.rs:33-44` — JSON-RPC 2.0 over stdio, real |
| Workspace members | ⚠️ `src-tauri/Cargo.toml` `members = ["crates/ml-sidecar"]` — **one member** |
| `BAAI/bge-small-en-v1.5` hard-coded in 6 places | ✅ all 6 confirmed (`aiSidecar.ts:30`, `ragStore.ts:38`, `ml-sidecar/src/main.rs:575,747,754`, `ai/models.rs:37-39`, `aiSidecar.test.ts:141-142`) |
| `services/agent-core/` exists | ✅ absent — consistent with "no code written" |
| Provider seam exists | ✅ `src/shared/services/ai/providerFactory.ts`, `providerManager.ts` |
| `reqwest` is a new main-crate dep for Gate 3 | ❌ **already present** — `src-tauri/Cargo.toml:54` (0.13.4, rustls). Gate 3 adds no dependency weight. |
| Vocode rejected because "repo 404" | ❌ **wrong** — `vocodedev/vocode-core` resolves: MIT, 3.8k★, last push **2024-11-15** |

## Decisions

### D1 — `agent-core` is a network sidecar; `ml-sidecar` is precedent for the contract, not the process model

`services/agent-core/` is a 24/7 service on our VPS. It is **not** launched or
supervised by Tauri, has no stdio JSON-RPC transport, and is **not** a Cargo workspace
member. `ml-sidecar` is cited in the spec only for the *lifecycle/health/watchdog
contract shape* it already proves in this repo.

**Forbidden:** adding `agent-core` to `src-tauri/Cargo.toml` `members`, or wrapping the
Python turn loop in a Tauri-managed child process. The desktop being closed must not
stop the phone from ringing; a Tauri-supervised agent violates that by construction.

### D2 — There are **three** embedding spaces, not two, and the desktop's dimension is config-dependent

`RAG-FORK.md` states "two embedding runtimes" and an invariant "**Desktop is 384-dim**
(`bge-small-en-v1.5`)". That is only true in one of the desktop's two modes.
`src/shared/services/ai/embeddingService.ts` + `src/features/assistant/stores/ragStore.ts:36`
implement a **user-selectable embedding source** persisted under
`smemaster.rag.embeddingSource`, with values `rust_bge | provider | auto`:

| Space | Runtime | Dim | Selected by |
|---|---|---|---|
| A | desktop, candle `bge-small-en-v1.5` | **384** (fixed) | `embeddingSource = "rust_bge"` |
| B | desktop, active provider embeddings endpoint (LM Studio / Ollama / OpenAI-compatible) | **N — whatever the endpoint serves** | `embeddingSource = "provider"` |
| C | server, `agent-core` `EmbeddingProvider` (`bge-m3` / `arctic-embed-l-v2.0`) | **1024** | server config |

**Consequences.** (1) The invariant to record is *"the three spaces are never merged"*,
not *"desktop = 384"* — a phase-2 refactor that trusts the latter will produce a
dimension-mismatch hard failure at query time. (2) Space B means the desktop index
dimension is **not a constant**; any code that assumes 384 must read it from the index
metadata, not hard-code it. (3) `RAG-FORK.md`'s call-site inventory is correct as far as
it goes but misses the *source toggle*, which is the thing that actually decides the
dimension.

**Forbidden:** writing `384` as a literal anywhere in the agent-core path; treating the
desktop index as a fixed-dimension target for ingestion.

### D3 — The server embedder is the 4th provider seam; the desktop keeps its own source toggle

`EmbeddingProvider` joins `LLMProvider` / `TTSProvider` / `STTProvider` as a
**server-side** seam (`services/agent-core/providers/base.py`), swapping by config only:
model id, dims, prefix/instruction, normalize, distance. The desktop's
`embeddingSource` toggle is a **separate, pre-existing desktop seam** and is not
replaced, migrated, or unified by this work.

**Forbidden:** "unifying" the desktop source toggle with the server seam. They are in
different runtimes on different machines and one is user-facing.

### D4 — Console↔agent-core IPC: bearer token, server-derived tenant, one ops-read command ✅ **DECIDED**

Gate 3 named five additive commands (`agent_start_session`, `agent_end_session`,
`agent_list_calls`, `agent_get_transcript`, `agent_set_provider_tier`) — sufficient for
the *call log* UI, insufficient for `OPS-ASSISTANT.md` §6, which requires per-tenant
**tier**, **provider health**, **fallback-chain state**, and **block-rate trend** to be
readable by the console. No command covered those reads. Two further defects existed in
the named surface. All three are resolved here rather than deferred, because renaming a
Tauri command later is a break (invariant 7).

**a. Auth — per-tenant bearer token, tenant derived server-side only.**

`agent-core` mints one bearer token per tenant at provisioning. The desktop stores it in
the Tauri store (key added to `.env.example`, value never committed). Every HTTP and WS
call carries it; **`WS /ws/transcript` is authenticated at the HTTP upgrade handshake and
an unauthenticated upgrade is rejected before a single transcript byte is sent.**

**Forbidden:** a tenant id in any Tauri command argument or HTTP body/query. Tenant
identity is derived server-side from the token and is never a client-supplied value — a
client-supplied tenant id on a multi-tenant console is an escalation path. Also forbidden:
tokens in WS query strings (they land in access logs).

**b. Ops reads — one command, not four.** `agent_get_ops_snapshot` returns the §6 minimum
field list (tier, provider health, fallback-chain state, block-rate trend) for the token's
tenant, in one round trip and one shape. This is the read path that was missing.

**c. `agent_set_provider_tier` is per-tenant, and the name stands.** Gate 5 defines
`ProviderTier` as per-tenant config; the command sets the **tenant's** tier and a running
session reads it at session start. **A live call is never hot-swapped** — that matches
`OPS-ASSISTANT.md` §3's "never change agent behaviour mid-shift". No rename is needed; the
ambiguity was in the prose, not the name.

### D5 — The licence gate applies to `agent-core` as a **network-service** rule, not a binary-linking rule

The repo's gate table (`grill-with-docs`, `LICENSE` = Apache-2.0) is written for Rust:
"permissive = linkable, copyleft = sidecar only". `agent-core` is Python and is never
linked into the Tauri binary, so **the linking test does not select anything there**.
The rule that does apply is the **network clause**: an AGPL/SSPL dependency inside a
SaaS-facing service reaches users over the network, so the copyleft obligation
triggers even though nothing is "linked".

**Forbidden:** reading the Rust gate table as "anything goes on the Python side because
nothing is linked". Every `agent-core` dependency is checked against the network-clause
rule, and permissive licences (Apache-2.0 / MIT / BSD) are used wherever OSS is pulled
in, so no copyleft reaches the service at all.

### D6 — Factual and copy corrections applied to the source docs

Applied in place, same commit as this ADR:

| Doc | Defect | Correction |
|---|---|---|
| spec §4.2 | Vocode rejected as "repo 404, unmaintained" | Rejected as **abandoned** — MIT, resolves, last push 2024-11-15 |
| spec §4.2 / Gate 1 | "Three traits" above a 4-row table; "the three ABCs" | **Four** seams / four ABCs |
| spec Gate 0 | "Remaining: … index + roadmap registration" | Already registered (`00-INDEX.md:143-150`, master plan `10.1` ✅) — removed |
| `CALL-FLOW.md` §4 | Spoken script "`relation,remainez en ligne`" — missing space, non-word | "`relation, restez en ligne`" |
| `CALL-FLOW.md` §5.1 | €0 claim rests on "inbound-initiated service conversation" for a message **we** send to the owner | Flagged as **unverified + internally contradictory** (see Open) |
| `PILOT-CRITERIA.md` | Disclosure audited via "audio/transcript audit" | Transcript audit — §2 records no audio |
| `CLIENT-QUESTIONNAIRE.md` | Corrupted French: "golfs", "proposedons", "Seasonsrecommandons", "n'engage financially" | Repaired (SEND-AS-IS doc; not yet sent) |
| `OPS-ASSISTANT.md` §4 | "≈ 27 engineer-days" | 27.5 build + 3d reuse-mapping = 30.5 total; build subtotal labelled |

## Consequences

- Gate 1 is unblocked on the engineering side: four seams, one runtime, one transport.
- `RAG-FORK.md`'s Option A recommendation survives unchanged — the 1024-dim server space
  is independent of both desktop spaces, so ingestion is clean. Only its *reasoning table*
  needed the third row.
- The desktop's config-dependent dimension (D2) is a latent defect **independent of the
  voice agent**: any French query under `rust_bge` retrieves nothing today.
- D4 is **decided rather than deferred**, so Gate 3 can add its commands without a
  later naming or re-scoping break (invariant 7).
- The RAG fork is **signed off** — Option A, server-side pgvector + `bge-m3`
  (`RAG-FORK.md` decision record, 2026-09-28). Gate 1 may proceed with the ingestion path.

## Open — must be closed before the gate that needs it

| # | Open item | Owner | Blocks |
|---|---|---|---|
| 1 | WhatsApp voicemail→owner trigger direction and its €0 claim (D6 row 5) | vendor (BSP) | `COST-MODEL.md` sign-off |
| 2 | Agent knowledge scope — what content is allowed to reach the server | **client** | RAG ingestion (Gate 1) — the guardrail in `RAG-FORK.md` §Recommendation |
| 3 | Desktop index written under `provider` mode will not match a later `rust_bge` switch — **deferred by decision 2026-09-28, filed as debt** (`docs/03-FRONTEND/13-deprecations.md`, `docs/02-BACKEND/12-diagnostics.md`) | us | desktop RAG (pre-existing, not voice-agent scope) |
