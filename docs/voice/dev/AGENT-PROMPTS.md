# Voice & Messaging Agent — Agent Prompts (copy-paste handoff)

> **Purpose:** the copy-paste prompt for each gate, so the next agent starts from the
> decided state instead of re-deriving it. One prompt per gate, self-contained.
> **Read first (every gate):** [`ADR-001`](../../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> [`spec`](../../specs/2026-09-28-voice-agent.md) ·
> [`OSS landscape`](../../06-ROADMAP/10-voice-agent-oss-landscape.md) ·
> [`glossary`](../../glossary/glossary-voice-agent.md)
> **Last updated:** 2026-09-28

## Rules that apply to every gate below

- **Reuse before build.** A capability that exists in the repo is an **adapter**. Check
  `docs/00-INDEX.md` before adding a file. Invariant 1 in the spec.
- **Assert the summary line, not the exit code.** `python -m pytest` and vitest both
  false-green on this host — read the `passed`/`failed` counts.
- **`git status --short` first.** Concurrent agents work in this tree; never touch another
  agent's uncommitted files.
- **No secrets.** `.env.example` gets keys, never values.
- **No backwards-compat shims, no "interim" state** (spec invariant 6).

---

## Prompt A — Send the client packet (no code, ~1h)

```
Docs first. Repo: C:\laragon\www\smeMaster, branch private/voice-agent-client.
Read docs/voice/client/CLIENT-QUESTIONNAIRE.md and docs/voice/client/VENDOR-QUOTE-REQUEST.md.

Both are marked SEND-AS-IS and were corrected on 2026-09-28 (four corrupted French
strings in the questionnaire; a non-word in the CALL-FLOW spoken script). Verify the
French reads correctly, then send:
  1. CLIENT-QUESTIONNAIRE.md §1-4 to the client (4 blocking answers).
  2. VENDOR-QUOTE-REQUEST.md to MessageBird, Twilio, 360dialog and Telnyx. Include §1.3b
     (owner-notification path: is a missed-call summary to the owner user-initiated/free
     or business-initiated/template-priced?). That answer decides whether the
     voicemail->WhatsApp path is EUR0 or a per-call cost.

Also start Meta business verification for the client's FR entity NOW - it is the longest
lead time we do not control, and it gates the pilot, not just Gate 7.
Record the send date in both docs (they have a "Date sent" field). Do not commit secrets.
```

**Answer routing:** questionnaire §1 → `CLIENT-QUESTIONNAIRE` §1 · §2 → the two-channel
split · §3 → `COST-MODEL.md` §3 shape · §4 → `CALL-FLOW.md` §2 consent. RFQ answers →
`VENDOR-QUOTE-REQUEST.md` "Internal: what we do with the answers".

---

## Prompt B — Gate 1 (`agent-core` skeleton + four seams), 3–4 days

```
Repo: C:\laragon\www\smeMaster, branch private/voice-agent-client. Read these first, in
order: docs/01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md,
docs/specs/2026-09-28-voice-agent.md (Gate 1), docs/06-ROADMAP/10-voice-agent-oss-landscape.md
(§5.1, §5.5, §7), docs/glossary/glossary-voice-agent.md.

Build GATE 1 only.

FENCE: services/agent-core/** ONLY. Nothing under src/ or src-tauri/. Not a Cargo
workspace member (ADR-001 D1) - do not add it to src-tauri/Cargo.toml.

New: services/agent-core/ with pyproject.toml (livekit-agents pinned to an exact version,
fastapi, uvicorn, httpx, asyncpg, pytest, pytest-asyncio).

providers/base.py - FOUR async-streaming ABCs, no more no less:
  LLMProvider, TTSProvider, STTProvider, EmbeddingProvider.
provider config = model id, dims, prefix/instruction, normalize, distance. Swapping any
of them must be a config value, never a code change (ADR-001 D3).

Impls: openrouter.py (google/gemini-3.x-flash), elevenlabs.py (FR+EN voices),
deepgram.py (Nova streaming), scribe.py (batch, voicemail), local_embed.py (bge-m3).
Port PATTERNS from LiveKit Agents / Pipecat - do NOT vendor their field names or types.

orchestrator.py: stub only.
API: GET /healthz, POST /session, WS /ws/transcript - all three behind the per-tenant
bearer token from ADR-001 D4a. Authenticate the WS at the HTTP upgrade handshake and
reject an unauthenticated upgrade before sending a byte. Tenant identity comes from the
token, NEVER from a request argument.

Also: tests/rag/retrieval_eval.py - 25-50 FR/EN question -> expected-chunk pairs, pytest
gate at hit@3 >= 0.9. This settles bge-m3 vs arctic-embed-l-v2.0 empirically.
Also: a provider-swap test proving a second impl of each of the four seams swaps in by
config alone. That is the Gate 1 exit criterion.
Also: THIRD-PARTY-NOTICES for the Apache-2.0 / BSD-2 / MIT deps (landscape §3).

DAY 1: re-verify the OpenRouter model figures and the RAG-FORK embedder licence table
(both drift quarterly).

VERIFY: cd services/agent-core && python -m pytest -q   <- ASSERT THE SUMMARY LINE, vitest
and pytest both false-green on this host. Gate on the passed/failed counts, not on $?.

Report the real pytest summary. Do not claim a gate passed without it.
```

**Gate 1 exit:** four seams, one swap test, one retrieval eval at hit@3 ≥ 0.9, notices,
and the pytest summary line. The knowledge-scope guardrail (`RAG-FORK.md` §Decision
record) is still client-pending — build the ingestion shape against a **curated KB** and
treat the mail/contact corpus as out of scope until told otherwise.

---

## Prompt C — Gate 2 (WhatsApp sandbox) · Prompt D — Gate 3 (console + Rust IPC) · Prompt E — Gate 5 (tiers)

Not written yet. Gate 2 needs **only** the sample-format normalisation test the spec
already specifies (spec Gate 2) — write it before the sandbox path, because a
non-normalising allowlist is bypassable by formatting alone. Gate 3 must use
`agent_get_ops_snapshot` (ADR-001 D4b) for the ops reads and add its commands to
`generate_handler![]` without reordering existing entries.

**Gate 5 addition (2026-09-28):** add a `selfhosted` tier to the `ProviderTier` chain
(sherpa-onnx, Apache-2.0 — see
[`Optimizing Voice Agent Performance.md`](PERFORMANCE.md) §6.6).
It is gated on one measurement first, §6.7: **max concurrent calls at RTF < 1.0** with the
streaming FR zipformer + a Piper FR voice on our 4-vCPU box. Below the client's expected
peak, the tier is closed and nothing else in Gate 5 changes. Also adopt **TTS caching** for
the greeting, the AI-disclosure line and confirmations — it is the cheapest lever on the
line that is 88% of variable cost.
