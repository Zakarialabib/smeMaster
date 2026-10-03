# Architecture Decision Records — Index

> **Convention created:** 2026-09-28 (first ADR). Previously this repo had **no ADR
> directory** — architecture decisions lived implicitly in `docs/specs/`, the master
> plan, and `.trae/rules/`. Decisions that are expensive to reverse now get an ADR here.
>
> **Gates:** [`docs/PRODUCTION-READINESS.md`](../../PRODUCTION-READINESS.md) ·
> **Status source of truth:** [`docs/STATUS.md`](../../STATUS.md) ·
> **Roadmap:** [`docs/06-ROADMAP/09-master-plan.md`](../../06-ROADMAP/09-master-plan.md)

## When to write one

Write an ADR when reversing the decision later costs more than a config change:
a runtime boundary (sidecar vs in-process), a vector space / dimension, a data
residency commitment, an IPC auth model, a licence posture. Do **not** write one for
a library swap already behind a seam (that is a config value).

## Records

| ADR | Title | Status | Date | Scope |
|---|---|---|---|---|
| [ADR-001](ADR-001-voice-agent-integration-seams.md) | Voice agent — integration seams, embedding spaces, IPC surface | **Accepted** | 2026-09-28 | `services/agent-core/**`, `src/features/agent/**`, RAG |

## How an ADR is written here

1. Copy the structure of ADR-001: **Context → Decisions → Consequences → Open**.
2. One decision per numbered item, each stating *what is forbidden*, not just what is
   chosen. A decision that does not name the wrong turn it prevents is a preference.
3. Cite evidence as `path:line` against the working tree, with the date it was read.
   A claim of "verified" without a path is not verified.
4. Update this table in the same commit. An ADR not listed here is invisible.
