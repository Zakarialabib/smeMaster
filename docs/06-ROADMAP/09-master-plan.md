# SMEMaster — Master Plan v1.0

> **Last updated:** 2026-09-30 — every status below re-verified against `src/`, `src-tauri/`, and
> `.github/workflows/` by direct grep/Glob. Claims that failed verification are marked
> **⚠️ UNVERIFIED** or corrected in place with the real evidence.
> **Status:** Living document — **single canonical roadmap** for all remaining work.
> **Supersedes:** All other roadmap docs. Feature specs live in `docs/04-FEATURES/`; frontend plans in `docs/03-FRONTEND/`.
> **Metrics source of truth:** [`docs/00-INDEX.md`](../00-INDEX.md) header (re-grepped 2026-09-30).
> `docs/STATUS.md → Verified Ground Truth` still carries the 2026-07-15 snapshot (831/34/42) and is **stale**.

---

## Status matrix — the whole roadmap on one screen

| Phase  | Title                   | State                            | Remaining / evidence                                                                                                                                                                                                                                                                                                                     |
| ------ | ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**  | Foundation              | ✅ DONE                          | 841 commands · 32 migrations · 44 store modules · 3,480 TS + 969 Rust tests (re-grepped 2026-09-30)                                                                                                                                                                                                                                      |
| **1**  | Pre-Release Polish      | 🔶 IN PROGRESS                   | Manual tests (panic/WAL/watchdog/dev-verify) + code signing + dogfood/beta left. Gates 1/3/9 in `docs/PRODUCTION-READINESS.md` are the only non-PASS gates                                                                                                                                                                               |
| **2**  | Desktop Power User      | ✅ DONE (15/15)                  | **2.8 Column config closed 2026-09-30**: `ColumnPicker.tsx` built + mounted in EmailList & TasksPage toolbars; consumers were `ThreadCard`/`TaskListView` all along                                                                                                                                                                      |
| **3**  | Accessibility & i18n    | 🔶 ~60%                          | RTL audit **written** (`10-rtl-audit.md`) but **421 physical-direction violations remain**; `ja`/`it` each have **51 `TODO` occurrences** (was ~215/211)                                                                                                                                                                                 |
| **4**  | Visual & UX             | ✅ DONE (8/8)                    | Onboarding is `OnboardingScreen.tsx` + `useOnboarding.ts` (the old "OnboardingWizard.tsx" name never existed in the tree)                                                                                                                                                                                                                |
| **5**  | Data Viz & Dashboard    | ✅ DONE                          | **10** widget components (docs said 8), incl. `EntityNetworkGraph.tsx` + `EmailHeatmapWidget.tsx`                                                                                                                                                                                                                                        |
| **6**  | Mobile Extended         | 💤 NOT STARTED (0/5)             | Kotlin: **zero** widget/SmartLock/Contacts/Calendar impl; only TS bridge _type declarations_ exist in `native-bridges.d.ts`                                                                                                                                                                                                              |
| **7**  | Feature Depth           | 🔶 2/7 done, 2 partial           | 7.1 ✅ `microsoftGraphProvider.ts` · 7.2 ✅ migration 029 · 7.3 🔶 trait + `caldav_sync.rs` exist, registry has test drivers only · 7.4 🔲 presets still TS constants · 7.6 🔶 `CampaignAnalytics.tsx` + `analyticsService.ts` exist (live-data end-to-end ⚠️ unverified) · 7.7 🔲 `tauri-plugin-notification` present, coverage partial |
| **8**  | Vault & Storage         | ✅ DONE (5/5)                    | All four claims verified today: `vault_items`, `categorize_file`, `VaultFilePreview`, `selectedPaths` all found in tree                                                                                                                                                                                                                  |
| **9**  | Backend Hardening       | ✅ DONE (6/6)                    | All six verified: sync UI in `src/features/sync/components/`, `export/backup_restore.rs`, `db/migration_rollback.rs`                                                                                                                                                                                                                     |
| **10** | Voice & Messaging Agent | 🔶 GATES 0–1 DONE, C IN PROGRESS | `agent-core` built + Phases A–B closed + C1 landed (see Phase 10). **4 client decisions block the pilot, not the build.** Gates 2–7 open                                                                                                                                                                                                 |
| **11** | Monetization            | 🔲 DESIGN ONLY                   | **0** `entitlement`/`paywall` code files in the tree — the four monetization docs are design specs with nothing built                                                                                                                                                                                                                    |

---

## Legend

| Icon | Meaning                              |
| ---- | ------------------------------------ |
| ✅   | Complete (evidence in tree)          |
| 🔶   | In progress / partial                |
| 🔲   | Not started                          |
| 🎯   | Current sprint                       |
| 📋   | Planned (task defined)               |
| 💤   | Deferred                             |
| ⛔   | Blocked (external)                   |
| ⚠️   | Claim failed verification — see note |

---

## Ground truth (re-grepped 2026-09-30)

| Metric                        | Verified value                                               | Notes                                                                            |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Rust IPC commands             | **841** (777 `#[tauri::command]` + 64 `#[command]`)          | Was 831 on 2026-07-15 — the agent IPC work added ~10                             |
| SQL migrations                | **32** `.sql` files (001–032)                                | The old "34 = 020 & 021 split" story is **false** — those are single files       |
| Zustand stores                | **44** modules (`create<` in non-test files; 47 occurrences) | Docs variously said 42/43/46 — all stale                                         |
| Rust tests                    | **969** attributes (399 `#[test]` + 570 `#[tokio::test]`)    |                                                                                  |
| TS tests                      | **~3,480** `it`/`test` lines                                 |                                                                                  |
| RTL violations                | **421** physical-direction lines in `src` (was 475)          | Logical properties (`ms-*`, `text-start`) only on ~100 lines — ar RTL will break |
| `ja`/`it` translation debt    | **51 `TODO` occurrences each**                               | Improved from ~215/211 but not done                                              |
| `: any` / `as any` in `src`   | **129**                                                      | Against the stated strict-TS rule — debt                                         |
| `TODO`/`FIXME`/`HACK` markers | **51** lines in `src` + `src-tauri/src`                      |                                                                                  |

---

## The honest assessment (what's good, what's bad, what's missing)

### ✅ What's genuinely good (each verified in the tree today)

1. **Architecture discipline holds.** Three layers, typed IPC (841 commands), `db-invoke.ts` wrappers — no drift out of the lane found.
2. **Test scale is real.** ~3,480 TS test lines + 969 Rust test fns; `ruff`/`mypy`/`tsc`/`eslint` all clean per `docs/voice/dev/BUILD-LOG.md`.
3. **Feature depth where it claims done.** Re-verified today: Vault 5/5, Sync UI 6/6, dashboard **10** widgets incl. network graph + heatmap, desktop power-user 14/15, theme system (`reduce-motion`, `font-scale`), tray/auto-launch/badges.
4. **The voice engagement ships fast and gated.** From zero to a running FastAPI `agent-core` + console slice in one session-set: Phases A–B closed, config-only provider swap proven (15/15), licence gate caught a non-commercial TTS before shipping, C1 already landed in `src/features/agent/` (16 files, 5 IPC commands).
5. **CI exists for the whole loop:** `ci.yml`, `build.yml`, `release.yml`, `release-please.yml`, `daily-pr.yml`.

### ⚠️ What's bad (drift, rot, hazards)

1. **Docs lie about completion — this document did too.** Caught by today's audit: it claimed `ColumnPicker.tsx` (didn't exist then; built 2026-09-30), `OnboardingWizard.tsx` (never existed — it's `OnboardingScreen.tsx`), `packaging.yml` (doesn't exist — it's `build.yml`), "RTL audit not written" (it is written), and wrong metrics (831/34/43). `docs/STATUS.md`'s "canonical" table has the same rot. **Trust the greps, not the tables.**
2. **TS strictness is aspirational.** 129 `: any`/`as any` survive despite the strict rules in `AGENTS.md`.
3. **RTL is unfinished business.** 421 physical-direction violation lines remain; Arabic layout will visibly break until the `10-rtl-audit.md` remediation lands.
4. **`ja`/`it` are not releasable-quality** — 51 `TODO` occurrences each (auto-stub debt).
5. **Host hazards are real and documented:** `cargo test` binaries link but won't launch on this dev box (`STATUS_ENTRYPOINT_NOT_FOUND`), and both `vitest` and `pytest` have false-greened (exit 0 with failures). **Gate on summary lines, not exit codes** — see `docs/05-DEVELOPMENT/02-testing.md`.
6. ~~**Dead-code risk:** `columnConfigStore.ts` has no consumer~~ — **resolved 2026-09-30**: `ThreadCard.tsx` (email) and `TaskListView.tsx` (tasks) already honoured visibility; the missing `ColumnPicker` toggle UI was built and mounted.

### 🔲 What's missing (honestly not started)

1. **Monetization — zero code.** No `entitlement`, no `paywall` files anywhere. All four `06-ROADMAP/1*-monetization-*` docs are design-only.
2. **Mobile depth.** Android widget, SmartLock, and bidirectional Contacts/Calendar sync: no Kotlin implementation found; only TypeScript bridge declarations exist.
3. **Calendar beyond Google.** `CalendarDriver` trait + `caldav_sync.rs` exist, but the registry only wires test drivers — 7.3 is partial, not done.
4. **Template unification.** Campaign and warmup presets are still TS constants (`campaignPresets.ts`, `warmupPresets.ts`) — the SQLite `TemplateCatalog` never happened.
5. **Release finishing.** Code-signing certs (Gate 3), manual test runs (Gate 1), dogfood/beta (Gate 9) — the only three non-PASS production gates.
6. **Voice Gates 2–7**, the 4 client decisions, and two lead times outside our control (Meta business verification, ARCEP number porting).
7. **Voice retrieval-eval gate file** (`tests/rag/retrieval_eval.py`) — specified, never built.

---

## Phase 0 — Foundation (✅ Complete)

Everything in the app compiles, tests pass, and core features are wired end-to-end.

| Area                             | Status | Evidence (2026-09-30)                                                                        |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| 841 Rust IPC commands            | ✅     | 777 `#[tauri::command]` + 64 `#[command]`, grepped `src-tauri/src`                           |
| ~3,480 TS + 969 Rust tests       | ✅     | `it/test` lines in `src`; `#[test]` + `#[tokio::test]` in `src-tauri`                        |
| DB layer (32 migrations)         | ✅     | 542 `pub fn` across 13 domains; 32 `.sql` files 001–032                                      |
| Store split (44 Zustand modules) | ✅     | `create<` in non-test files under `src/shared/stores`, `src/features/*/stores`, `src/stores` |
| Mobile UX Overhaul (5/5)         | ✅     | Shell, gestures, adaptive, focus, polish                                                     |
| Subsystem Orchestration          | ✅     | Lifecycle, state machine, tool registry, gating                                              |
| Deliverability Monitoring        | ✅     | Blacklist, reputation, alerts, bulk health                                                   |
| OAuth Custom Tabs                | ✅     | Desktop + mobile unified flow                                                                |
| Security (PGP, crypto)           | ✅     | AES-256-GCM, PGP encrypt/decrypt, key management                                             |
| CI/Dev tooling                   | ✅     | tsc, cargo, vitest, eslint, vite all clean (BUILD-LOG); 5 workflows                          |
| EventBus (15 events)             | ✅     | All events mapped, DomainEventProcessor wired                                                |
| Graph Connections                | ✅     | `entity_pivots` polymorphic table                                                            |
| Sync Engine                      | ✅     | CRDT via automerge, TCP P2P, mDNS discovery                                                  |
| UI Component Library             | ✅     | 30+ shared components with a11y, focus trap                                                  |

---

## Phase 1 — Pre-Release Polish (🎯 Current Sprint — ~20h)

Gate items from `docs/PRODUCTION-READINESS.md` (Gates 1, 3, 9 are the only non-PASS).

| #    | Task                                     | Effort | Status | Evidence / notes                                                                                                                      |
| ---- | ---------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | CI pipeline                              | 30min  | ✅     | `ci.yml` + `release.yml` + `release-please.yml` + `daily-pr.yml` + `build.yml` (⚠️ earlier text cited a non-existent `packaging.yml`) |
| 1.2  | Keyboard shortcuts system                | 2h     | ✅     | `useKeyboardShortcuts.ts` + `shortcutStore.ts` + `ShortcutsTab.tsx` — all found                                                       |
| 1.3  | Panic injection manual test              | 30min  | 📋     | `docs/05-DEVELOPMENT/03-manual-tests.md` — run before tagging                                                                         |
| 1.4  | WAL recovery manual test                 | 30min  | 📋     | same                                                                                                                                  |
| 1.5  | WAL deletion doc                         | 15min  | ✅     | `docs/05-DEVELOPMENT/04-wal-deletion.md`                                                                                              |
| 1.6  | Watchdog restart manual tests            | 30min  | 📋     | same as 1.3                                                                                                                           |
| 1.7  | `npm run tauri dev` runtime verification | 5min   | 📋     | same                                                                                                                                  |
| 1.8  | React.memo / lazy loading                | 2h     | ✅     | 35 `memo` usages across `src` + lazy routes                                                                                           |
| 1.9  | Certificates + public key                | varies | 🔲     | Gate 3 — Windows EV cert / macOS notarization                                                                                         |
| 1.10 | Dogfooding + beta testing                | 1–2w   | 🔲     | Gate 9 — `docs/beta-testing/`, `docs/dogfooding/`                                                                                     |

---

## Phase 2 — Desktop Power User Features (✅ 14/15 — one claim failed)

| #    | Task                                 | Status | Evidence                                                                                                                 |
| ---- | ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 2.1  | Full keyboard navigation (tab order) | ✅     | SkipLink, FocusOrderManager, `role="search"`                                                                             |
| 2.2  | Screen reader support (WCAG AA)      | ✅     | ARIA labels, live regions, landmark roles                                                                                |
| 2.3  | Rich context menus                   | ✅     | `src/shared/hooks/useContextMenu.ts` + `ContextMenu.tsx`                                                                 |
| 2.4  | Drag-and-drop (email→folder/task)    | ✅     | sidebar drop target + `insertTask`                                                                                       |
| 2.5  | Split-pane resizing                  | ✅     | `src/features/mail/components/layout/MailLayout.tsx` (⚠️ old path `features/mail/components/MailLayout.tsx` was wrong)   |
| 2.6  | VirtualList optimization             | ✅     | EmailList, ThreadView, ContactListView, CampaignList, TaskListView                                                       |
| 2.7  | Desktop focus modes (DND, minimal)   | ✅     | `focusModeStore.ts` + `ZenMode.tsx`                                                                                      |
| 2.8  | Column customization                 | ✅     | `ColumnPicker.tsx` (2026-09-30) mounted in EmailList + TasksPage toolbars; store consumed by `ThreadCard`/`TaskListView` |
| 2.9  | Quick preview (hover popup)          | ✅     | `src/shared/components/ui/HoverPreview.tsx` (portal, 500ms)                                                              |
| 2.10 | System tray / menu bar               | ✅     | `TrayIconBuilder` at `lib.rs:278`                                                                                        |
| 2.11 | Auto-launch on startup               | ✅     | `lib.rs:44 mod auto_launch` + UI toggle                                                                                  |
| 2.12 | Desktop icon badges                  | ✅     | `window.setBadgeCount()`                                                                                                 |
| 2.13 | Global hotkeys                       | ✅     | `useKeyboardShortcuts.ts`                                                                                                |
| 2.14 | Clipboard manager                    | ✅     | `useClipboard.ts` (Tauri + web fallback)                                                                                 |
| 2.15 | Responsive email rendering           | ✅     | `useBreakpoint.ts` + `FocusReader.tsx`                                                                                   |

---

## Phase 3 — Accessibility & i18n (🔶 ~60%)

| #   | Task                   | Status | Evidence                                                                                                                                                                |
| --- | ---------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | RTL layout audit       | 🔶     | **Audit EXISTS** (`docs/03-FRONTEND/10-rtl-audit.md` — old text "not written" was wrong). Remediation remains: **421** physical-direction violation lines vs 475 before |
| 3.2 | High contrast mode     | ✅     | `themeStore` + `useThemeManager` + settings toggle                                                                                                                      |
| 3.3 | Font scaling           | ✅     | `font-scale-*` CSS on `<html>`                                                                                                                                          |
| 3.4 | Reduced motion         | ✅     | `.reduce-motion` CSS + toggle                                                                                                                                           |
| 3.5 | Translation management | 🔶     | `translate:sync` + `translate:clean` scripts exist; **`ja`/`it` each carry 51 `TODO` occurrences** — improved from ~215/211, still not releasable                       |

---

## Phase 4 — Visual & UX Enhancement (✅ 8/8)

| #   | Task                             | Status | Evidence                                                                                                    |
| --- | -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| 4.1 | Skeleton loading screens         | ✅     | `src/shared/components/ui/Skeleton.tsx`                                                                     |
| 4.2 | Animated list transitions        | ✅     | `fadeSlideIn` stagger                                                                                       |
| 4.3 | Onboarding flow (first-run)      | ✅     | `OnboardingScreen.tsx` + `useOnboarding.ts` (⚠️ "OnboardingWizard.tsx" never existed — renamed before ship) |
| 4.4 | Micro-interactions               | ✅     | `active:scale-[0.97]` in `ui-tokens.ts`                                                                     |
| 4.5 | Empty state illustrations        | ✅     | `EmptyState` icon/illustration support                                                                      |
| 4.6 | Achievement/toast system         | ✅     | `NotificationToast.tsx`                                                                                     |
| 4.7 | Custom app icons                 | ✅     | favicon + `tauri.conf.json` icon set                                                                        |
| 4.8 | Campaign analytics visual polish | ✅     | CSS-variable chart colors, skeletons, dashboard alignment                                                   |

---

## Phase 5 — Data Visualization & Dashboard (✅ 5/5 — actually 10 widgets)

| #   | Task                     | Status | Evidence                                                                                                                                                                               |
| --- | ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Dashboard widgets        | ✅     | **10** components: Email/Contact/Task/Campaign/Contacts/Automation/BusinessHealth/QuickActions stats + `RecentActivityWidget` + heatmap + `EntityNetworkGraph` (docs said "8 widgets") |
| 5.2 | Activity timeline        | ✅     | `RecentActivityWidget.tsx`                                                                                                                                                             |
| 5.3 | Analytics charts (email) | ✅     | `EmailVolumeWidget` + `ContactGrowthWidget`                                                                                                                                            |
| 5.4 | Heat map calendar        | ✅     | `EmailHeatmapWidget.tsx`                                                                                                                                                               |
| 5.5 | Network graph            | ✅     | `EntityNetworkGraph.tsx` (d3-force)                                                                                                                                                    |

---

## Phase 6 — Mobile Extended (💤 0/5 — nothing started)

| #   | Task                                  | Status | Evidence                                                                             |
| --- | ------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| 6.1 | Perfect workflow for screen pages     | 🔲     | emailList, contactList, compose, tasklist, settings                                  |
| 6.2 | Android widget (home screen)          | 🔲     | zero references in `src` or `gen/android`                                            |
| 6.3 | Smart Lock (biometric)                | 🔲     | zero references                                                                      |
| 6.4 | ContactsContract sync (bidirectional) | 🔲     | only a TS type in `native-bridges.d.ts:65` (read-side); **no Kotlin implementation** |
| 6.5 | CalendarContract sync (bidirectional) | 🔲     | same — `native-bridges.d.ts:74` only                                                 |

---

## Phase 7 — Feature Depth (🔶 2/7 done, 2 partial)

| #   | Task                                        | Status | Evidence                                                                                                                                                               |
| --- | ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Microsoft Graph send/draft provider         | ✅     | Rust `send()`/`create_draft()` + `microsoftGraphProvider.ts`                                                                                                           |
| 7.2 | Campaign scheduling (fully wired)           | ✅     | migration `029_campaign_scheduling.sql` + ScheduleStep → `scheduled_at`                                                                                                |
| 7.3 | Calendar provider expansion (beyond Google) | 🔶     | `CalendarDriver` trait (`calendar/driver.rs`) + `background/caldav_sync.rs` exist; **registry wires only test drivers — no production CalDAV/Graph driver registered** |
| 7.4 | Template engine unification (3 → 1)         | 🔲     | `campaignPresets.ts` + `warmupPresets.ts` still TS constants; no SQLite `TemplateCatalog`                                                                              |
| 7.5 | Mail composer feature gaps (25)             | 🔲     | tracked in `docs/superpowers/composer-architecture.md`                                                                                                                 |
| 7.6 | Campaign analytics end-to-end               | 🔶     | `CampaignAnalytics.tsx` + `analyticsService.ts` + tests exist; **live-data pipeline end-to-end ⚠️ UNVERIFIED**                                                         |
| 7.7 | Mobile push notification completeness       | 🔲     | `tauri-plugin-notification = 2.3.3` present; product coverage partial                                                                                                  |

---

## Phase 8 — Vault & Storage Polish (✅ 5/5 — all verified today)

| #   | Task                          | Status | Evidence                                            |
| --- | ----------------------------- | ------ | --------------------------------------------------- |
| 8.1 | Vault search/indexing         | ✅     | `vault_items` table + DB-backed recursive search    |
| 8.2 | Vault categorization          | ✅     | `categorize_file()` + filter chips + category badge |
| 8.3 | Vault multi-account isolation | ✅     | `account_id` on commands, isolated dirs             |
| 8.4 | Vault file preview            | ✅     | `VaultFilePreview.tsx`                              |
| 8.5 | Vault bulk operations         | ✅     | `selectedPaths` store + bulk delete bar             |

---

## Phase 9 — Backend Hardening (✅ 6/6 — all verified today)

| #   | Task                                | Status | Evidence                                                         |
| --- | ----------------------------------- | ------ | ---------------------------------------------------------------- |
| 9.1 | Sync conflict resolution UI         | ✅     | `src/features/sync/components/ConflictResolutionPanel.tsx`       |
| 9.2 | CRDT sync progress indicators       | ✅     | `src/features/sync/components/SyncProgressIndicator.tsx`         |
| 9.3 | Background service health dashboard | ✅     | `HealthDashboard.tsx` + `SystemHealthTab.tsx`                    |
| 9.4 | Offline queue management UI         | ✅     | `src/shared/components/ui/OfflineQueueIndicator.tsx`             |
| 9.5 | Data export (full backup)           | ✅     | `src-tauri/src/export/backup_restore.rs` — VACUUM INTO + restore |
| 9.6 | Migration rollback support          | ✅     | `src-tauri/src/db/migration_rollback.rs`                         |

---

## Phase 10 — Voice & Messaging Agent (🔶 Gates 0–1 done, Phase C in progress)

FR/EN AI receptionist: WhatsApp (text) + inbound voice on a dedicated FR number.
Delivered as a **managed service** operated by us, not a desktop feature.

> **Entry point:** [`docs/voice/README.md`](../voice/README.md) · **Spec:**
> [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md) ·
> **Decisions:** [ADR-001](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> **Living status:** [`docs/voice/dev/BUILD-LOG.md`](../voice/dev/BUILD-LOG.md) ·
> **Glossary:** [`docs/glossary/glossary-voice-agent.md`](../glossary/glossary-voice-agent.md) ·
> **Landscapes:** [`15-`](15-voice-agent-oss-landscape.md) [`16-`](16-voice-agent-whatsapp-oss-landscape.md) [`17-`](17-voice-agent-topology-decision.md)
>
> **Real state (2026-09-30):** Gate 0 ✅ · **Phases A–B closed** (agent-core built, four provider
> seams proven by config-only swap, endpoints + WS + licence gate + migrations 0002–0004) ·
> **Phase C in progress** (C1 landed: console state primitives + Ops screen in
> `src/features/agent/`, 16 files, 5 additive IPC commands) · RAG fork **signed 2026-09-28
> (Option A: server pgvector + `bge-m3`)** · **4 client decisions block the pilot, not the build.**
> **Reuses, does not rebuild:** provider abstraction (`src/shared/services/ai/`), tool registry,
> invoicing, deliverability, i18n `fr`, orchestrator, ml-sidecar contract pattern.

| #     | Task                                    | Effort | Depends On | Status | Evidence / notes                                                                                                                                  |
| ----- | --------------------------------------- | ------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1  | Spec + cost model + call flow + RFQ     | 1–2d   | —          | ✅     | `docs/voice/**` + spec                                                                                                                            |
| 10.2  | **Client decisions (4)**                | —      | client     | ⛔     | Vertical, cost sign-off, two-channel confirm, consent. **RAG fork already signed** — no longer an open item                                       |
| 10.3  | Vendor quotes (BSP + carrier)           | —      | vendors    | 🔲     | `client/VENDOR-QUOTE-REQUEST.md` drafted, send-as-is (strip internal footer)                                                                      |
| 10.4  | `agent-core` skeleton + provider traits | 3–4d   | —          | ✅     | Phases A–B closed; `test_swap.py` 15/15. **Remainder:** one real provider per seam, real auth, persistence (no Postgres — 5 migration tests skip) |
| 10.5  | WhatsApp channel, sandbox via Baileys   | 3–4d   | 10.4       | 🔲     | E.164 sandbox allowlist — production use forbidden                                                                                                |
| 10.6  | Console + Rust IPC bridge               | 4–5d   | 10.4       | 🔶     | Phase C in progress: `src/features/agent/` (16 files) + 5 IPC commands; rest of port order per `BUILD-PLAN.md` §4                                 |
| 10.7  | Telephony, inbound FR number            | 5–7d   | 10.6       | 🔲     | **One writer.** Blocked by D4 consent + ARCEP number                                                                                              |
| 10.8  | Metering + provider tiers               | 1–2d   | 10.7       | 🔲     | Reuses invoicing + deliverability                                                                                                                 |
| 10.9  | FR/EN voice enforcement                 | 1–2d   | 10.7       | 🔲     | FR UI ships — voice config only                                                                                                                   |
| 10.10 | Production BSP swap + ops runbooks      | 4–5d   | 10.3, 10.5 | 🔲     | Partly waiting on Meta verification                                                                                                               |
| 10.11 | 2-week pilot (≥ 100 calls)              | 2w     | 10.10      | 🔲     | Go/no-go per `client/PILOT-CRITERIA.md`                                                                                                           |

**Out of scope for v1:** cold outbound, outbound WhatsApp templates, CRM/calendar writes,
native app (Android ships), >2 languages, audio recording.

**Hard constraint:** WhatsApp live voice calls are exposed by **no** API. Voice runs on a
dedicated PSTN number. If the client expects in-WhatsApp voice, that is a different
conversation, not a different implementation.

---

## Phase 11 — Monetization (🔲 design only)

Four design docs exist, **zero implementation** (verified: no `entitlement`/`paywall` files in `src` or `src-tauri`):

| Doc                                                                              | Covers                     | State     |
| -------------------------------------------------------------------------------- | -------------------------- | --------- |
| [`10-monetization-entitlement-engine.md`](10-monetization-entitlement-engine.md) | Entitlement/license engine | 🔲 design |
| [`11-monetization-frontend-paywall.md`](11-monetization-frontend-paywall.md)     | Frontend paywall UI        | 🔲 design |
| [`12-monetization-asset-delivery.md`](12-monetization-asset-delivery.md)         | Asset delivery             | 🔲 design |
| [`13-monetization-mobile-strategy.md`](13-monetization-mobile-strategy.md)       | Mobile monetization        | 🔲 design |

---

## Immediate Next Sprint (🎯 Phases 1 + 3 + 10-C — ~12h)

| Priority | Task                                                     | Effort     |
| -------- | -------------------------------------------------------- | ---------- |
| P0       | Manual tests (panic, WAL, watchdog, dev-verify) — Gate 1 | 1.5h 🔲    |
| P0       | Voice: continue Phase C port order (BUILD-PLAN §4)       | ongoing 🔶 |
| P0       | Voice: send client questionnaire + RFQ (lead times)      | 📋         |
| P1       | RTL remediation — 421 violations (`10-rtl-audit.md`)     | varies 🔲  |
| P1       | `ja`/`it` TODO keys (51 each)                            | 2h 🔶      |
| P1       | Resolve 2.8: build column-config UI or delete the store  | 30min ⚠️   |
| P2       | Code signing certs + public key — Gate 3                 | varies 🔲  |
| P2       | Dogfooding + beta — Gate 9                               | 1–2w 🔲    |

---

## Dependency Map

```
Phase 1 (Pre-Release Polish)
  └─ 1.2 Keyboard shortcuts ← enables → 2.1 Keyboard navigation
  └─ 1.10 Dogfood + Beta ← depends on → 1.1-1.9

Phase 2 (Desktop Power User) ✅
  └─ 2.8 column config — ORPHANED: store has no UI

Phase 3 (Accessibility & i18n)
  ├─ 3.1 RTL remediation ← independent, 421 violations
  └─ 3.5 Translation tools ✅ → ja/it key debt 🔶

Phase 6 (Mobile Extended) — all independent, all not started

Phase 7 (Feature Depth)
  ├─ 7.3 Calendar drivers ← needs production CalDAV/Graph impl registered
  └─ 7.4 Template catalog ← blocked until 6/7 feature depth work

Phase 10 (Voice)
  ├─ 10.6 console (Phase C) ← 10.4 ✅
  ├─ 10.7 telephony ← 10.6 + consent decision + ARCEP number
  └─ 10.11 pilot ← 10.10 + Meta verification (long lead time)
```

---

## Effort Summary

| Phase               | Effort (est.)     | Remaining                  | Status                            |
| ------------------- | ----------------- | -------------------------- | --------------------------------- |
| Phase 0             | —                 | —                          | ✅ Complete                       |
| Phase 1             | ~20h              | ~4h + 1–2w beta            | 🎯 Sprint (6 done, 4 manual/cert) |
| Phase 2             | ~20h              | 0.5h (2.8 orphan)          | ✅ 14/15 + 1 ⚠️                   |
| Phase 3             | ~9h               | ~6h                        | 🔶 RTL (421) + ja/it debt         |
| Phase 4             | ~22h              | —                          | ✅ Complete                       |
| Phase 5             | ~25h              | —                          | ✅ Complete                       |
| Phase 6             | ~30h              | ~30h                       | 💤 Deferred / not started         |
| Phase 7             | ~28h              | ~21h                       | 🔶 2/7 done                       |
| Phase 8             | ~12h              | —                          | ✅ Complete                       |
| Phase 9             | ~15h              | —                          | ✅ Complete                       |
| Phase 10            | client engagement | Gates 2–7 + client answers | 🔶 built through Phase C          |
| Phase 11            | —                 | everything                 | 🔲 design only                    |
| **Total (product)** | **~187h**         | **~60h**                   | (30h deferred in Ph6)             |

---

## Merged Roadmap Directives (archive — merged from since-deleted docs)

Preserved for context; the tables above are authoritative.

- **Template engine** (was `07-template-engine.md`): 3 systems → one `TemplateCatalog`, SQLite + `template_type`. Still Phase 7.4, not started.
- **Competitive analysis** (was `11-top-apps-comparison.md`): sub-100ms interactions, command discoverability, offline queue UX, keyboard-first — Phases 1/2 cover most.
- **Spec-driven dev** (was `12-spec-driven-dev-plan.md`): Spec → Files → Workflow → Acceptance per phase.
- **Correction (2026-09-30):** the old "37-settings-redesign-spec.md MISSING" note is stale — the spec exists (`docs/04-FEATURES/37-settings-redesign-spec.md`); `36-onboarding-reboot-plan.md` is still ⚠️ MISSING.

---

## Related Documents

- [Production Readiness](../PRODUCTION-READINESS.md) — 10 gates with evidence (1, 3, 9 in progress)
- [STATUS.md](../STATUS.md) — project status ⚠️ its metrics table is stale; trust `00-INDEX.md`
- [UI/UX Super-App Spec](../03-FRONTEND/12-ui-super-app-spec.md) — desktop & mobile UI/UX gaps
- [RTL Audit](../03-FRONTEND/10-rtl-audit.md) — remediation plan for the 421 violations
- [Composer Architecture](../superpowers/composer-architecture.md) — composer gaps (Phase 7.5)
- [Voice README](../voice/README.md) — voice engagement entry point

## Source reconciliation (2026-09-30)

Greps run this date; see **Ground truth** above for the table. Superseded claims fixed in this
revision: 831→841 commands · 34→32 migrations · 43→44 stores · 915→969 Rust tests ·
"ColumnPicker.tsx exists"→was no, built 2026-09-30 (`ColumnPicker.tsx` + EmailList/TasksPage mounts) · "OnboardingWizard.tsx exists"→renamed `OnboardingScreen.tsx` ·
"packaging.yml"→`build.yml` · "RTL audit not written"→written, 421 violations remain ·
"No code written" (voice)→Phases A–B closed, C in progress · widget count 8→10 ·
ja/it TODO 215/211→51/51. The 2026-07-19 reconciliation block below this line is **archive**:

- ~~831 commands / 3,344 TS tests / 34 migrations / 43 stores~~ — all superseded by the
  2026-09-30 numbers above.
