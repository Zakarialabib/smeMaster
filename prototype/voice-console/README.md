# Voice Console — high-fidelity prototype

**Design artifact, not product code.** It exists to settle layout, copy and
behaviour before Gate 3 builds the real console in `src/features/agent/`.

```bash
cd prototype/voice-console
npm install
npm run dev          # http://localhost:5199
```

## What it is

A React 19 + Zustand + Vite prototype of the Voice & Messaging Agent console,
covering all nine surfaces from `docs/voice/design/WIREFRAMES.md`:

| Key | Surface |
|---|---|
| `1` | Calls (`/calls`) |
| `2` | Live monitor (`/calls/live/:id`) |
| `3` | Ops digest (`/ops`) |
| `4` | Config (`/agent/config`) |
| `5` | Knowledge (`/agent/knowledge`) |
| `6` | Cost (`/agent/cost`) |
| `7` | Topology & capabilities |
| `8` | Settings — providers, local hardware, keys, about |
| `?` | Shortcut help · `f` flagged-only · `Esc` back to Ops |

## Grounding — nothing here is invented

| Concern | Source |
|---|---|
| Colour, radius, elevation, blur | `src/styles/globals.css` (`@theme`), copied verbatim into `index.html` |
| Token class vocabulary (`BTN_PRIMARY`, `CARD_BASE`, `FOCUS_RING`, `ROW_GAP_*`) | `src/shared/styles/ui-tokens.ts` |
| App rail + console nav | `src/shared/components/layout/shell/navConfig.ts` (`NAV_GROUPS`, `INSIGHT_WIDGETS`) |
| Types and payload shapes | `docs/voice/design/BACKEND.md` §13 |
| Stores, selectors, WS states | `docs/voice/design/FRONTEND.md` §12.2–12.5 |
| Alerts, matrix, digest rules | `docs/voice/dev/OPS-ASSISTANT.md` §3, §5 |
| Call states, stage marks, metrics | `docs/voice/dev/CALL-FLOW.md` §1, §3 |
| Keyboard map, focus order, RTL matrix | `docs/voice/design/UX.md` §14–16 |
| Provider per seam, licences, key placement | `docs/voice/design/BACKEND.md` §3, §6 |
| Local engine + RTF gate | `docs/voice/dev/SELF-HOSTING.md` |
| Topology and the key-placement question | `docs/06-ROADMAP/12-voice-agent-topology-decision.md` |

## The invariants it demonstrates, not just describes

- **No audio, anywhere.** No play button, no waveform. The transcript is the record.
- **No barge-in control.** The live view says so in as many words.
- **"Cannot reach the agent" never renders as "no calls."** Break the socket on the
  Live surface, or simulate an offline agent-core on Topology.
- **Purple = inferred, neutral = fact.** Summaries and judgements use the AI purple;
  transcripts and tables stay neutral.
- **Thresholds carry provenance.** Provisional thresholds are tagged, and the digest
  will show you why on demand.
- **Provider keys are per-tier and the screen says which machine holds them.**

## Screenshots

Captured from the running app at 1440×1000 (see `shot.cjs`):
`ops` (digest + provider health), `calls`, `live` (transcript + stage marks),
`config`, `cost`, `topology` (the two nodes side by side).

## Known limits of this artifact

- **Routing is a `switch`, not `@tanstack/react-router`** — the real console uses
  `createRoute` (`src/router/routeTree.tsx`). Adding a router to a prototype buys
  nothing and would add a dependency.
- **No i18n.** The real console ships 5 locales with logical properties only; here
  the copy is hardcoded English so the screens stay readable.
- **State is fixture data** shaped like the real payloads (`src/data.ts`).
- **This is not the product.** Do not promote any file in here into `src/`.
