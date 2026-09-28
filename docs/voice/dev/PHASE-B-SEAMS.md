# Phase B — provider seams and the console surface

> Closes the Gate 1 exit criterion. Plan: [`BUILD-PLAN.md`](BUILD-PLAN.md) §3

## What this phase actually proves

Phase B exists for one claim: **a provider can be swapped by a config value alone.**
Everything else here is in service of making that claim testable rather than
aspirational.

It is worth being precise about what B is and is not:

- **Is:** the four seams are real traits, two implementations of each exist, the
  registry is the only construction site, and a test swaps between them with
  nothing but a dict changing.
- **Is not:** any vendor code. There is no ElevenLabs client, no Deepgram client,
  no carrier SDK. `alpha` and `beta` are genuine implementations of the traits
  that make no network call, so the chain, the fallback path and metering are
  exercisable before a single API key exists.
- **Is not:** a working call. `/session` and `/ops/snapshot` return fixture data
  behind a real HTTP surface. `/providers/registry` says `fixture_data: true`
  rather than implying a live pipeline.

## The four seams

| Seam | Trait | What it abstracts | v1 candidates (unverified prices) |
|---|---|---|---|
| LLM | `LLMProvider` | completion + streaming | OpenRouter (any model), or a direct key |
| TTS | `TTSProvider` | streaming audio out, FR/EN voices | ElevenLabs, Cartesia |
| STT | `STTProvider` | streaming audio in, VAD events | Deepgram Nova, Mistral Voxtral |
| Embedding | `EmbeddingProvider` | vectors + dimensions | `bge-m3`, arctic-embed-l-v2.0 |

`EmbeddingProvider` is the fourth seam, added after the desktop RAG review. It
carries `dimensions` in its capabilities, and **1024 (server) and 384 (desktop)
are different vector spaces that must never be merged** — see
[`RAG-FORK.md`](RAG-FORK.md).

### Capabilities are a property of the host

`Capabilities` exists because "supported" is a property of *this machine*, not
of the project. A VPS reports `cpu` and no `gpu`; the desktop may report
`gpu=rtx4070` and a local model. The console renders that difference instead of
the app failing at capture time.

Two shapes in `base.py` are ported from the sherpa-onnx RN wrapper because they
are worth having regardless of runtime: an engine facade and a capability view.
What is **not** taken is the dependency, its field names, or its transport.

## The chain, and why fallback is loud

`run_chain` returns which provider **actually** answered, what was attempted,
and whether a fallback engaged. That single field is the design: it turns "it
works" into "it works, and I know what it is costing me."

A silent failover is listed under **Never** in `BACKEND.md` §8. `ChainExhausted`
carries seam, the attempted list, and each error, because chain exhaustion is a
P1 with a blast radius — not something to retry quietly.

## The defect worth reading about

`SessionRequest` inherited `BaseModel` instead of `Camel`. `BaseModel` accepts
snake_case and silently **ignores** camelCase, so `callerOverride` was dropped on
the way in, defaulted to `None`, and `assert_caller_allowed` — itself correct —
never fired. A live session accepted a caller override through the one endpoint
whose purpose was to refuse it.

Nothing about it was visible: the field was declared, the guard implemented, the
docstring accurate. Every existing test posted snake_case, which is precisely
what the broken class accepted. It surfaced only because the endpoint test was
written in the shape the **console** sends rather than the shape the code
happened to accept.

The permanent fix is a test class, not a comment:
`tests/test_camel_acceptance.py` parametrises over every inbound contract and
fails if any stops being a `Camel` subclass.

## Gates

```
ruff     All checks passed
mypy     Success: no issues found in 8 source files
pytest   98 passed, 5 skipped      (the 5 are the Postgres migration tests)
tsc      TSC_EXIT=0
vitest   2 files, 34 passed
cargo    agent module compiles; 4 commands registered
```

The 5 skips need Postgres, which this host does not have. They run in CI with
`AGENT_CORE_TEST_DATABASE_URL` set.

## Still open before Gate 1 can be *signed off*

B proves the seams swap with **fixtures**. Three things remain, and none are
optional:

1. **One real provider per seam**, behind the same trait, with its key from the
   environment and never from the desktop.
2. **Metering that survives a real swap** — a token count from a real provider is
   the first honest number for `COST-MODEL.md`.
3. **The RAG-FORK decision** — `bge-m3` vs arctic-embed-l-v2.0 is still
   `☐ pending`, and it gates the embedding implementation.
