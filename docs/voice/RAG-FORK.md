# RAG Fork — Desktop Local vs Server-Side

> **Status:** OPEN — decision required at Gate 0, before any Gate 1 code.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)

## The problem

SMEMaster already ships a complete local RAG stack (verified complete
2026-07-11, `docs/04-FEATURES/ai-rag.md`):

- embeddings via **candle** (BERT)
- vector store via **LanceDB**
- knowledge assistant chat UI (`src/features/assistant/`)
- served by a **real** `ml-sidecar` process — `src-tauri/crates/ml-sidecar/src/main.rs`,
  JSON-RPC 2.0 over stdin/stdout, candle + lancedb + hf-hub, not a stub

The voice agent runs on **a VPS**, not in the desktop process. **A VPS cannot read
the desktop's LanceDB index.** These are two different machines with two different
lives. That is the whole fork.

## Constraint discovered on 2026-09-28 — the local embedder is English-only

`BAAI/bge-small-en-v1.5` is hard-coded in six places:

| File | Reference |
|---|---|
| `src/features/assistant/services/aiSidecar.ts:30` | `BGE_REPO_ID` |
| `src/features/assistant/stores/ragStore.ts:38` | `BGE_REPO_ID` |
| `src-tauri/crates/ml-sidecar/src/main.rs:575,747,754` | default repo_id |
| `src-tauri/src/ai/models.rs:37-39` | `get_bge_small()` |
| `src/features/assistant/services/aiSidecar.test.ts:141-142` | test expectations |

**`-en` in the model name means English-only.** A French query embedded with this
model retrieves nothing useful. This is not a tuning problem; it is the wrong model
for a bilingual agent. The repo's UI already ships `fr` (and `ar`, `ja`, `it`) — but
**UI locales are not embedding locales**, and shipping an `fr` interface over an
English-only embedder is the current state.

Any option below therefore requires either a multilingual embedder or a
cloud/server-side one. `bge-m3` is the multilingual candidate (also handles `ar`
should that ever open up).

### Three embedding spaces, not two

The desktop and the server embed in **different runtimes**, and the "which model"
question only applies to one of them. But the desktop has **two** sources behind a
user-facing toggle (`smemaster.rag.embeddingSource`, `rust_bge | provider | auto` —
`src/shared/services/ai/embeddingService.ts`, `src/features/assistant/stores/ragStore.ts:36`),
so there are three spaces in play, not two:

| | Desktop — `rust_bge` | Desktop — `provider` | Server (`agent-core`, Python) |
|---|---|---|---|
| Model | `bge-small-en-v1.5` | whatever the endpoint serves (LM Studio / Ollama / OpenAI-compatible) | **new embedder — no candle constraint** |
| Dim | **384** (fixed) | **N — config-dependent** | **1024** |
| Runtimes | candle only | provider HTTP | sentence-transformers, FlagEmbedding, ONNX — anything |
| In scope? | **No** — Option A leaves both desktop spaces alone | No | **Yes** — this is where the model choice lives |

The desktop's only *hard-coding* problem is that `BGE_REPO_ID` appears in 6 places: a
config refactor, not a model decision. But its **dimension is not a constant** — in
`provider` mode the index carries whatever the endpoint returns, so any code that
assumes 384 must read the dimension from the index metadata instead. The Python side
is unconstrained, which is why the server is not boxed into bge. **Consequence: the
server embedder can be self-hosted, which is what keeps the EU-residency story clean
(Q6).** See [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) D2.

## Options

### Option A — Server-side index, pgvector + `bge-m3` (RECOMMENDED)
Agent's knowledge lives on the VPS alongside the agent.

- **Pros:** one system serving the agent; multilingual embeddings work; no coupling
  to desktop uptime; the desktop's local RAG is untouched and keeps its offline
  privacy promise for mail/contacts.
- **Cons:** a second index and a second embedding space in the product. Content
  that should reach the agent must be pushed to the server — which is a privacy
  decision, not just an engineering one.
- **New build:** ingestion endpoint, `EmbeddingProvider` impl, pgvector schema,
  sync job, and `tests/rag/retrieval_eval.py` (see §Embedder decision below).

#### ⚠️ The three spaces can never be merged

Desktop-`rust_bge` is **384-dim** (`bge-small-en-v1.5`), desktop-`provider` is
**N-dim** (config-dependent), and the server is **1024-dim** (`bge-m3` /
`arctic-l-v2.0`). Different dimensions, different models, different spaces. **Write
this down so nobody "unifies" them in phase 2** — a dimension mismatch is a hard
failure at query time, and the tempting refactor is exactly the wrong move. Note that
"desktop = 384" is only true in one of the desktop's two modes; the merge hazard is
worse than the two-space version of this note suggests.

### Option B — Desktop publishes its index to the server
Desktop keeps authoring knowledge; it pushes an update on a schedule or on change.

- **Pros:** single source of truth for content; author in the desktop, consume on
  the server.
- **Cons:** **the desktop must be running and online for the agent's knowledge to
  be current.** An always-on phone agent that goes stale when someone closes a
  laptop is a bad product. Also a privacy transfer: mail/contacts PII leaving the
  machine by default, which contradicts the existing RAG doc's stated
  "no data leaves the device" promise.
- **Assessment:** rejected for a 24/7 agent.

### Option C — No RAG in v1; scripted FAQ
Agent answers from a curated, hand-written FAQ in the repo.

- **Pros:** fastest path to a demo; zero retrieval risk; nothing to keep in sync.
- **Cons:** containment will be poor on anything the client actually cares about,
  and containment is the pilot's headline success metric. Likely to fail the
  ≥60–70% target in [`PILOT-CRITERIA.md`](PILOT-CRITERIA.md).
- **Assessment:** viable only as a deliberate week-1 scope cut, not as the plan.

## Embedder decision — settled by eval, not by leaderboard

> **Verified 2026-09-28** against the HuggingFace API (`/api/models/{id}`).
> Licenses read from the model card, not the leaderboard. Re-verify inside Gate 1 —
> this space moves quarterly.

`bge-m3` is no longer the accuracy king, but it is still a defensible v1 default.
**The more important point: at receptionist-KB scale the embedder is a small part of
retrieval quality.** A 200–500-chunk curated KB with mediocre embeddings beats a
top-ranked embedder over a badly chunked corpus. **Curation and chunking move the
≥60–70% containment metric far more than any model swap.** Do not let a leaderboard
argument delay the KB work.

| Model | License | Dims | FR quality | Hybrid | Runtime | Verdict |
|---|---|---|---|---|---|---|
| **bge-m3** | **MIT** ✅ | 1024 | very good | ✅ native (dense+sparse+colbert) | Python, ONNX-friendly | **v1 default** — zero-risk, 8k ctx, cross-lingual |
| **snowflake-arctic-embed-l-v2.0** | **Apache-2.0** ✅ | 1024 | better on BEIR/MIRACL-style retrieval | ❌ dense only | same XLM-R arch | **the drop-in upgrade** — identical deployment path, a bge-m3 fine-tune |
| Qwen3-Embedding-0.6B | **Apache-2.0** ✅ | 1024 | top of MTEB-multilingual at release | ❌ dense only | sentence-transformers | newest leader, dense-only and young — **benchmark, don't bet v1** |
| multilingual-e5-large-instruct | **MIT** ✅ | 1024 | very good | ❌ | Python | ⚠️ 512 ctx only; **requires `query:`/`passage:` prefixes — omitting them silently tanks retrieval** |
| gte-multilingual-base | **Apache-2.0** ✅ | 768 | good | ❌ | light | CPU-latency option |
| jina-embeddings-v3 | **CC-BY-NC-4.0** ⛔ | 1024 | very good | ❌ | Python | **REJECT — non-commercial license** |
| Cohere embed-multilingual-v3/v4 | API | — | excellent | ✅ | API | EU residency available; acceptable API path |
| OpenAI text-embedding-3-large | API | 3072 | very good | ❌ | API | ⚠️ US processing — **only via Azure OpenAI West Europe** for EU residency |
| Gemini embedding-001 | API | 3072 | top-tier | ❌ | API | adds a Google dependency |

**Recommendation: self-host, then choose between `bge-m3` and
`arctic-embed-l-v2.0` — they deploy identically** (same XLM-R architecture, same
1024 dims, so swapping is a config change).

- `bge-m3` if you want the zero-risk default. Its native hybrid genuinely helps a KB
  full of product names, prices, and opening hours — exact-term queries where
  dense-only misses.
- `arctic-embed-l-v2.0` if you want the measurable upgrade. Pair it with a Postgres
  `tsvector` leg (French + English dictionaries) instead of bge-m3's native sparse —
  `tsvector` + RRF is less fiddly than pgvector `sparsevec` plumbing, and Postgres
  is already in the stack for metering.

**Reject API embeddings on residency.** Q6 committed to EU managed inference.
Sending the client's business KB to a US endpoint contradicts the pitch we are
selling. Azure-West-Europe or Cohere-EU are the only acceptable API paths, and at
this scale they add a vendor for near-zero quality gain.

### Gate 1 addition: the retrieval eval

Stop arguing from a leaderboard. `tests/rag/retrieval_eval.py`: **25–50 FR/EN
questions → expected chunk, pytest gate at hit@3 ≥ 0.9.** Then "which embedder"
becomes a 30-minute experiment on *our* KB. Same discipline as the latency
instrumentation in Gate 4 — a number you measured beats an opinion about a chart
someone else read.

### Cross-lingual consequence — a real sales point

With `bge-m3` / `arctic-l-v2.0`, **a French query retrieves English documents.** The
client authors the KB once, and callers in either language are served from it. That
is a selling point — and it means the "agent knowledge scope" decision in §0 below
just got cheaper, because the curated scope is small.

### Optional, probably v2

`bge-reranker-v2-m3` (Apache-2.0 ✅), top-20 → top-5. At <1,000 chunks this is
likely over-engineering for v1. Revisit only if the eval or the pilot transcripts
show retrieval misses.

## Recommendation

**Option A**, with one honesty guardrail: define *what content the agent is allowed
to know* before building the ingestion path. That is a product decision the client
owns. The likely answer is a small curated knowledge base (services, hours, pricing,
booking rules) rather than the full mail/contact corpus — which also keeps the
privacy story clean and makes `bge-m3` cheap.

## Decision record

| Field | Value |
|---|---|
| Decided by | ☐ pending |
| Date | ☐ |
| Chosen option | ☐ |
| Agent knowledge scope (what content is allowed to reach the server) | ☐ |

Once decided, this file is updated with the chosen option and the spec's Gate 0
checklist is ticked. Do not start Gate 1 with this open — the ingestion path shapes
the provider traits, and retrofitting it is more expensive than deciding now.
