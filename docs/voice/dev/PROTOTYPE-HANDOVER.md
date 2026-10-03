# Prototype → Product Handover

> **Written:** 2026-09-28 · **Prototype:** [`prototype/voice-console/`](../../../prototype/voice-console/)
> **Purpose:** the prototype is the **visual and behavioural source of truth**. This file is the
> map from it to the product. It exists so an implementer never has to decide *what the screen
> looks like* — that is already settled and runnable — and instead only decides *how it is built*.
> **Read with:** [`BUILD-PLAN.md`](BUILD-PLAN.md) (sequence) · [`BACKEND.md`](../design/BACKEND.md) (contract)

---

## 1. What the prototype is, precisely

A React 19 + Zustand 5 + Vite 7 app, **2,040 lines**, that runs the whole console against fixture
data. It is not a mockup and not a product: it is a **running specification**.

```bash
cd prototype/voice-console && npm install && npm run dev   # :5199
```

**Its authority:** layout, copy, interaction, state transitions, the invariants, the degraded
states. Where the prototype and a doc disagree, **the prototype is newer** — it was written after
the docs and encodes decisions the docs only described.

**Its limit:** it has no backend, no Tauri, no i18n, and no real providers. It is not deployable
and nothing in it should be copied wholesale into `src/`.

## 2. Port map — prototype file → product file

Nothing is copied as-is. Each row states what carries over and what must change.

| Prototype | Product | Carries over | Must change |
|---|---|---|---|
| `index.html` `:root{}` | `src/styles/globals.css` `@theme` | **nothing** — the tokens already exist in the app | delete entirely; import the real tokens instead |
| `index.html` `.focus-ring` | `FOCUS_RING` in `src/shared/styles/ui-tokens.ts` | the *behaviour* (`:focus-visible` → 1px accent ring) | use the shared class, do not re-declare |
| `src/types.ts` | `src/features/agent/types/commands.ts` | **all of it** — it already mirrors `BACKEND.md` §13 | add the fields the prototype does not yet exercise (`transferAttempts`, `containmentReason`) |
| `src/data.ts` | **deleted** | the *shape* of each fixture, kept as a contract test | fixtures never ship; convert to MSW/fixture-server for tests only |
| `src/store.ts` | `src/features/agent/stores/*.ts` | the store split, the selector names, the drill/filter semantics | see §4 — the selector bug is already fixed here, do not reintroduce it |
| `src/components/ui.tsx` | **mostly deleted** | the *compositions* (see below) | `Pill`, `Button`, `Panel`, `DataTable` are all **existing app components** — use those, do not port these |
| `src/components/Shell.tsx` | `src/shared/components/layout/shell/*` | the two-tier nav relationship (app rail hosts a console nav) | wire to `NAV_GROUPS` / `getActiveNavFromPath` (`navConfig.ts:101,242`) |
| `src/pages/OpsPage.tsx` | `src/features/agent/pages/AgentOpsPage.tsx` | **the whole design** — digest, P1 section, P2 grouped by rule, P3 disclosure, provider-health table, alert detail | swap `React.CSSProperties` for the token classes; the logic maps 1:1 to `OPS-ASSISTANT.md` §3 |
| `src/pages/CallsPage.tsx` | `AgentCallsPage.tsx` | filters, drill banner + Clear, AI callout, masked numbers | column config → shared `DataTable` config objects |
| `src/pages/ConfigPage.tsx` | `AgentConfigPage.tsx` | sticky footer, dirty-state guard, tier cards, **read-only behaviour notice** | — |
| `src/pages/SettingsPage.tsx` | `AgentSettingsPage.tsx` | four tabs: Providers / Local hardware / Keys / About | the Keys tab writes nothing in v1 — read-only + rotate is a Gate 5 action |
| `src/App.tsx` | `src/router/routeTree.tsx` | the surface list and the key map | `createRoute` with **relative** `path` (`routeTree.tsx:208-212`); drop the `switch` |

## 3. The four invariants, as implemented (not as documented)

These are enforced in the prototype and must survive the port. Each is also a review checklist item.

| # | Invariant | Where it lives in the prototype | How to check after porting |
|---|---|---|---|
| 1 | **No audio, anywhere** | there is no play/waveform control in any file; the config tier table has no audio option | `grep -rniE 'listen\|playback\|<audio' src/features/agent` → empty |
| 2 | **No barge-in control** | the live view's read-only notice is prose, not a disabled button | no control on `/calls/live/:id` mutates the call |
| 3 | **Offline ≠ no calls** | `DegradedBanner` on Ops, Live and Topology; the Live view dims the transcript and shows last-seen | break the socket in dev; the banner appears and the transcript is labelled stale |
| 4 | **Purple = inferred, neutral = fact** | `AiBanner` is used only for summaries, judgements, knowledge gaps and capability probes | transcripts and tables never use `--color-ai` |

Plus the two that catch people out:
- **No `tenantId` anywhere in the client** — `types.ts` has no such field, deliberately.
- **Voice is FR/EN only** — the config page shows `AR — permanently off` with a reason.

## 4. The one bug the prototype found, and the lesson

`useFilteredCalls` originally built a new array *inside* the zustand selector. That re-renders
forever under `useSyncExternalStore` — **React error #185, "Maximum update depth exceeded"** — and
it was invisible until a navigation path actually reached that screen.

**Rule for the port: a derived array belongs in `useMemo` over primitive selector results, never
inside the store selector.** This is now `FRONTEND.md` §12.3 and it applies to every derived
selector in the product, not just this one.

The second, softer lesson: **the build is unminified on purpose.** The minified build reported
"React error #185" with a symbol name; the readable one named the store frame. Keep source maps
on in any prototype used to debug behaviour.

## 5. What the prototype proved, and what it cannot prove

**Proved:** every screen renders; the alert → call-log drill-down filters correctly; the offline
states are visually distinct; the key-placement story reads clearly; TypeScript strict passes;
the build is clean.

**Cannot prove — these need the real thing:**

| Unproven | Needs |
|---|---|
| That a real transcript renders fast enough | the virtualised list + `useMemo`d rows (`FRONTEND.md` §8) |
| That the WS reconnect states look right under real latency | `agent-core` with a real socket drop |
| That the cost figures mean anything | `metering_events` and real vendor rates (`COST-MODEL.md` §6) |
| That RTL looks right | `dir="rtl"` in all 5 locales (`UX.md` §16) |
| That a 390 px phone is usable | a real device, not a resized window |
| That the local tier is viable | **RTF measured on this host** — the tier is gated on it |

## 6. The copy contradiction the prototype review caught

The Keys tab said the VPS holds the provider keys *and* that a compromised VPS yields only
transcripts. Both were true of different things and read as a contradiction. The shipped copy
separates **where the credential sits** from **blast radius**, and says plainly that a compromised
VPS *does* allow spending against a vendor account until rotation.

Keep that distinction in the product. It is the difference between a security claim and a
security posture.
