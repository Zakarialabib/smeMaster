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

## Options

### Option A — Server-side index, pgvector + `bge-m3` (RECOMMENDED)
Agent's knowledge lives on the VPS alongside the agent.

- **Pros:** one system serving the agent; multilingual embeddings work; no coupling
  to desktop uptime; the desktop's local RAG is untouched and keeps its offline
  privacy promise for mail/contacts.
- **Cons:** a second index and a second embedding space in the product. Content
  that should reach the agent must be pushed to the server — which is a privacy
  decision, not just an engineering one.
- **New build:** ingestion endpoint, `bge-m3` embedder, pgvector schema, sync job.

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
