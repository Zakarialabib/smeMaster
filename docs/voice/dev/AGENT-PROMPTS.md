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

---

## Prompt F — docs / UX / mockup pass (fill gaps, don't rewrite)

```
Repo: C:\laragon\www\smeMaster · branch private/voice-agent-client

You are improving an EXISTING documentation + design set. It is committed and
internally consistent. Your job is to FILL GAPS and raise quality — NOT to
restructure or rewrite it. Read these first, in order, and change nothing until
you have:

  docs/voice/README.md                  folder map (client/ dev/ design/) + gate map
  docs/voice/design/WIREFRAMES.md       §13 = 9 gaps ⚠️ · §14 = 8 opportunities 💡
  docs/voice/design/UX.md               §13 = 5 open UX questions
  docs/voice/design/FRONTEND.md         mount point, speech abstraction, stores
  docs/voice/design/BACKEND.md          topology, seams, data model, endpoints
  docs/voice/dev/PERFORMANCE.md         editorial note at top = adjudicated claims
  docs/voice/dev/CALL-FLOW.md · OPS-ASSISTANT.md · SELF-HOSTING.md
  docs/voice/design/mockups/*.html      5 existing mockups — match their discipline
  docs/01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md

NON-NEGOTIABLE CONTEXT (violating any of these makes the work wrong, not bold)
- No console code exists. This is design, not implementation. Do not invent
  features that contradict settled decisions:
    * no audio is retained anywhere  -> no play button, waveform or "listen" UI, ever
    * no live-call barge-in           -> never add a control that implies one
    * no provider SDK on the desktop  -> keys live only in agent-core
    * no tenant id sent by the client -> tenant comes from the token, server-side
    * no prompt editing in the console
    * voice is FR/EN only. The UI ships 5 locales (en/fr/ar/ja/it).
      UI locale is NOT voice locale — never imply Arabic voice support.
- Mockups must stay: self-contained (no CDN, no external font/JS), JS-free
  (use <details>/<summary> for disclosure), responsive, and driven by the REAL
  token hexes from src/styles/globals.css (+ src/shared/styles/ui-tokens.ts).
- Reuse the app's shared vocabulary — DataTable, Avatar, AiSuggestionBanner,
  frost-surface, and --color-ai (#9333ea) for anything the assistant INFERRED.
  A transcript is a FACT (neutral). A summary/judgement is an INFERENCE (purple).
  Do not invent a new component, a new colour, or a second table.
- RTL: logical properties only (ms-*/me-*, text-start/end, inset-inline-*).
- Never promote an UNVERIFIED vendor number to a fact. Keep the existing markers.

TASKS

A. Broken links (mechanical — do this first, separately)
   1. Repair these pre-existing broken links by finding the real target. They are
      NOT voice-related: fix the link, do not restructure the other docs.
        docs/01-ARCHITECTURE/03-data-model.md   -> 04-FEATURES/Invoicing-ERP/01-company-tenant.md
        docs/03-FRONTEND/12-ui-super-app-spec.md-> ../../plans/DESIGN_UI_UX_SPEC.md
        docs/03-FRONTEND/15-shared-components.md-> ../../05-DEVELOPMENT/05-reuse-patterns.md
        docs/05-DEVELOPMENT/05-reuse-patterns.md-> ../../03-FRONTEND/15-shared-components.md
      If a target genuinely does not exist, mark the reference
      "MISSING — <reason>" the way 00-INDEX.md already marks
      36-onboarding-reboot-plan.md. Do not silently delete a row.
   2. Leave docs/00-INDEX.md -> 04-FEATURES/36-onboarding-reboot-plan.md alone —
      it is an intentional "spec not written yet" placeholder.

B. Wireframes — raise the uncovered surfaces to full depth
   WIREFRAMES §0 lists 11 surfaces but 8–11 have no layout, no region→action and
   no per-surface gaps. Write each at the SAME depth as surfaces 1–7, using the
   repo's per-surface structure: Route·Source · ASCII layout (≤76 cols) ·
   region→action table · entry/exit · gating · gaps ⚠️ · UX opportunities 💡.
     - Agent config        (/agent/config)
     - Knowledge scope     (/agent/knowledge)
     - Cost                (/agent/cost)
     - Mobile variants     (one-handed, 390px, thumb reach)

C. Mockups — add the 4 missing screens
   Same discipline as 01–05 (read 01 and 02 first and match them).
     docs/voice/design/mockups/06-agent-config.html
     docs/voice/design/mockups/07-knowledge.html
     docs/voice/design/mockups/08-cost.html
     docs/voice/design/mockups/09-mobile-digest.html   (its own width IS the viewport)
   Each must render its own degraded states (UX.md §7), not only the happy path:
   config -> offline model / capability unavailable · knowledge -> nothing
   published yet · cost -> over model + which calls · mobile -> agent-core
   unreachable, which must NEVER render as "no calls".
   The cost screen carries the same UNVERIFIED marker as client/COST-MODEL.md.

D. UX.md
   - Take §13's 5 open questions and either RESOLVE the ones that are ours (write
     the decision and its risk) or make the owner and the blocking gate explicit.
   - Add a keyboard-interaction table (per surface, per control), the focus-order
     spec, and the RTL/locale matrix for console strings.
   - Add the notification-escalation design as an explicitly-marked PROPOSAL
     (P1 unacknowledged -> escalate to whom, after how long), with the
     thresholds marked as placeholders awaiting pilot data.

E. FRONTEND.md
   - Add the concrete type listing an implementer can copy, the store selector
     list per surface, the WS reconnect state machine (states, transitions, and
     exactly what the UI shows in each — a silently dead transcript looks like a
     caller who stopped talking), and a concrete delta-coalescing rule.
   - Confirm every structural claim against the real repo and cite path:line:
     src/shared/components/layout/shell/navConfig.ts (NAV_GROUPS,
     INSIGHT_WIDGETS, getActiveNavFromPath) and src/router/routeTree.tsx.
     If a claim does not hold, correct it — do not keep it because it reads well.

F. BACKEND.md
   - Add a JSON payload schema per endpoint, a DDL sketch per table, and the
     migration numbering convention.

G. PERFORMANCE.md Parts 1–5 — all still vendor-sourced
   - Add a source-class column: PRIMARY / VENDOR / COMPETITOR-BLOG / UNVERIFIED.
   - Re-verify the three decision-relevant claims if you have web access:
     the Deepgram EU endpoint hostname, the Cartesia TTFA figure, and integrated
     end-of-turn detection. If you cannot verify one, KEEP the flag and write the
     exact Gate 4 test that would settle it.
   - Do not remove Part 6 and do not reopen the RAG fork or self-hosting
     decisions — those are signed.

H. Glossary (docs/glossary/glossary-voice-agent.md)
   - Add every term the design set introduces: SpeechEngine, Capabilities,
     ExecutionProvider, RTF, digest, containment, stage marks, ops snapshot,
     transcript delta, self-hosted tier. Define each as used in THIS repo, not as
     the vendor's page defines it.

I. docs/voice/README.md
   - Link the mockups as DIRECT file links (a bare directory link is not clickable
     in most markdown renderers) and include the 4 new ones.

VERIFY — paste the real output, never a summary of it
  1. Every relative link in every docs/**/*.md:
       python - <<'PY'
       import os,re,glob,urllib.parse
       bad=[];n=0
       for f in glob.glob("docs/**/*.md",recursive=True):
           b=os.path.dirname(f)
           for m in re.finditer(r'\]\(([^)\s]+?)\)',open(f,encoding="utf-8").read()):
               t=urllib.parse.unquote(m.group(1))
               if t.startswith(("http","#","mailto:")) or not t: continue
               t=t.split("#")[0]
               if not t: continue
               n+=1
               if not os.path.exists(os.path.normpath(os.path.join(b,t))): bad.append(f"{f} -> {t}")
       print(f"checked={n} broken={len(bad)}")
       [print("  ",x) for x in bad]
       PY
     Target: only the intentional 36-onboarding placeholder remains.
  2. Per mockup: balanced tags (ignoring void elements), zero mismatched closers,
     zero duplicate ids, zero external local src/href, and the token hexes still
     byte-identical to globals.css.
  3. Paste the EMPTY result of the forbidden-list greps:
       grep -rniE 'listen|playback|audio-player|<audio' docs/voice/design/mockups
       grep -rniE 'href="[^"#]*\.(css|js|woff)' docs/voice/design/mockups
       grep -rnE 'text-left|text-right|\bml-|\bmr-' docs/voice/design
  4. git status --short   (expect only the files you touched)

RULES
- Run `git status --short` FIRST. Concurrent agents work in this tree. Never
  modify a file that is already modified and is not yours from this pass.
- Commit with EXPLICIT pathspecs — never `git add -A`, never a bare directory on a
  shared branch (it absorbs other agents' in-flight work). No push.
  Three commits: A · B-C · D-I.
- No backwards-compat shims, no "interim" state, no TODOs left unowned.
- Report: files changed (count + list), the verification output verbatim, and any
  claim you could NOT verify. Say so plainly rather than smoothing it over.
```
