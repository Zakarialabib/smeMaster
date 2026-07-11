# SMEMaster — Master Plan v1.0

> **Last updated:** 2026-07-08
> **Status:** Living document — **single canonical roadmap** for all remaining work.
> **Supersedes:** All other roadmap docs. Feature specs live in `docs/04-FEATURES/`; frontend plans in `docs/03-FRONTEND/`.

---

## Legend

| Icon | Meaning        |
| ---- | -------------- |
| ✅   | Complete       |
| 🔶   | In Progress    |
| 🔲   | Not Started    |
| 🎯   | Current Sprint |
| 📋   | Planned        |
| 💤   | Deferred       |

---

## Phase 0 — Foundation (✅ Complete)

Everything in the app compiles, tests pass, and core features are wired end-to-end.

| Area                      | Status | Evidence                                              |
| ------------------------- | ------ | ----------------------------------------------------- |
| 652 Rust IPC commands     | ✅     | All 14 domain modules, 62 files                       |
| 2,470 TS + 735 Rust tests | ✅     | Zero failures across both suites                      |
| DB layer (56 migrations)  | ✅     | 367 `pub fn` across 11 domains, all wired to commands |
| Store split (21 Zustand)  | ✅     | UI, layout, sync, theme, per-feature stores           |
| Mobile UX Overhaul (5/5)  | ✅     | Shell, gestures, adaptive, focus, polish              |
| Subsystem Orchestration   | ✅     | Lifecycle, state machine, tool registry, gating       |
| Deliverability Monitoring | ✅     | Blacklist, reputation, alerts, bulk health            |
| OAuth Custom Tabs         | ✅     | Desktop + mobile unified flow                         |
| Security (PGP, crypto)    | ✅     | AES-256-GCM, PGP encrypt/decrypt, key management      |
| CI/Dev tooling            | ✅     | tsc, cargo, vitest, eslint, vite all clean            |
| EventBus (15 events)      | ✅     | All events mapped, DomainEventProcessor wired         |
| Graph Connections         | ✅     | entity_pivots polymorphic table                       |
| Sync Engine               | ✅     | CRDT via automerge, TCP P2P, mDNS discovery           |
| UI Component Library      | ✅     | 30+ shared components with a11y, focus trap           |

---

## Phase 1 — Pre-Release Polish (🎯 Current Sprint — ~20h)

Gate items from PRODUCTION-READINESS.md that are in progress or remaining.

| #    | Task                                       | Effort | Depends On | Status | Notes                                                                              |
| ---- | ------------------------------------------ | ------ | ---------- | ------ | ---------------------------------------------------------------------------------- |
| 1.1  | **CI pipeline (cargo check + pnpm test)**  | 30min  | —          | ✅     | `ci.yml` + `release.yml` + `release-please.yml` + `packaging.yml` already exist    |
| 1.2  | Keyboard shortcuts system                  | 2h     | —          | ✅     | `useKeyboardShortcuts.ts` (25 shortcuts) + `shortcutStore.ts` + `ShortcutsTab.tsx` |
| 1.3  | Panic injection manual test                | 30min  | —          | 🔲     | Verify dialog appears on panic                                                     |
| 1.4  | WAL recovery manual test                   | 30min  | —          | 🔲     | Kill during write → verify replay                                                  |
| 1.5  | WAL deletion doc                           | 15min  | —          | ✅     | `docs/05-DEVELOPMENT/04-wal-deletion.md`                                           |
| 1.6  | Watchdog restart manual tests              | 30min  | —          | 🔲     | Panic in sync_engine → verify restart                                              |
| 1.7  | `npm run tauri dev` runtime verification   | 5min   | —          | 🔲     | Manual check                                                                       |
| 1.8  | React.memo / lazy loading (P9 items)       | 2h     | —          | ✅     | `memo` on Skeleton/Badge/EmptyState/ContactAvatar; routes already use `lazy`       |
| 1.9  | Certificates + public key for distribution | varies | —          | 🔲     | Code signing setup                                                                 |
| 1.10 | Dogfooding + beta testing                  | 1-2w   | 1.1-1.9    | 🔲     | 7-day dogfood, then beta                                                           |

---

## Phase 2 — Desktop Power User Features (📋 Planned — ~20h)

From UI/UX roadmap P1 + P6 gaps.

| #    | Task                                     | Effort | Depends On | Status | Notes                                                                                        |
| ---- | ---------------------------------------- | ------ | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| 2.1  | **Full keyboard navigation (tab order)** | 3h     | 1.2        | 🔲     | Tab order, focus indicators, skip-links                                                      |
| 2.2  | **Screen reader support (WCAG AA)**      | 4h     | —          | 🔲     | ARIA labels, live regions, roles                                                             |
| 2.3  | Rich context menus (right-click)         | 2h     | —          | ✅     | `useContextMenu.ts` + `ContextMenu.tsx` (334 lines)                                          |
| 2.4  | Drag-and-drop (email→folder/task)        | 4h     | —          | ✅     | Email→folder/label already worked; email→task now wired (sidebar drop target + `insertTask`) |
| 2.5  | Split-pane resizing                      | 2h     | —          | ✅     | `MailLayout.tsx` draggable divider (240‑800 px)                                              |
| 2.6  | VirtualList optimization                 | 3h     | —          | ✅     | Applied to EmailList, ThreadView, ContactListView, CampaignList, TaskListView                |
| 2.7  | Desktop focus modes (DND, minimal)       | 2h     | —          | ✅     | `focusModeStore.ts` + `ZenMode.tsx`                                                          |
| 2.8  | Column customization (show/hide/reorder) | 4h     | —          | ✅     | `columnConfigStore.ts` + `ColumnPicker.tsx` — email, contacts, tasks                         |
| 2.9  | Quick preview (hover popup)              | 3h     | —          | ✅     | `HoverPreview.tsx` (portal, 500ms delay) — wired in ThreadCard                               |
| 2.10 | System tray / menu bar                   | 3h     | —          | ✅     | `TrayIconBuilder` in `lib.rs` — 8 menu items                                                 |
| 2.11 | Auto-launch on startup                   | 1h     | —          | ✅     | `auto_launch.rs` + `commands/system.rs` + UI toggle                                          |
| 2.12 | Desktop app icon badges (unread)         | 1h     | —          | ✅     | `badgeManager.ts` + `window.setBadgeCount()`                                                 |
| 2.13 | Global hotkeys                           | 2h     | —          | ✅     | `useKeyboardShortcuts.ts` (498 lines)                                                        |
| 2.14 | Clipboard manager                        | 3h     | —          | ✅     | `useClipboard.ts` (Tauri + Web fallback)                                                     |
| 2.15 | Responsive email rendering               | 3h     | —          | ✅     | `useBreakpoint.ts` + `FocusReader.tsx`                                                       |

---

## Phase 3 — Accessibility & i18n (📋 Planned — ~19h)

| #   | Task                         | Effort | Depends On | Status | Notes                                                                                             |
| --- | ---------------------------- | ------ | ---------- | ------ | ------------------------------------------------------------------------------------------------- |
| 3.1 | **RTL layout audit**         | 2h     | —          | ✅     | `docs/03-FRONTEND/12-rtl-audit-report.md` — 4-phase plan, 26h estimate                            |
| 3.2 | High contrast mode           | 2h     | —          | ✅     | `themeStore` + `useThemeManager` + `GeneralTab` toggle                                            |
| 3.3 | Font scaling (system size)   | 2h     | —          | ✅     | `themeStore` + `font-scale-*` CSS classes on `<html>`                                             |
| 3.4 | Reduced motion support       | 1h     | —          | ✅     | `themeStore` + `.reduce-motion` CSS class + settings toggle                                       |
| 3.5 | Translation management tools | 2h     | —          | ✅     | `translate:sync` + `translate:clean` scripts work. `ja`/`it` locales added. `it` 100% translated. |

---

## Phase 4 — Visual & UX Enhancement (📋 Planned — ~22h)

| #   | Task                               | Effort | Depends On | Status | Notes                                                                                     |
| --- | ---------------------------------- | ------ | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| 4.1 | **Skeleton loading screens**       | 3h     | —          | ✅     | `Skeleton.tsx` — ThreadCardSkeleton, EmailListSkeleton, etc.                              |
| 4.2 | **Animated list transitions**      | 3h     | —          | ✅     | `fadeSlideIn` stagger on Contact/ Task/ Vault lists; EmailList already uses CSSTransition |
| 4.3 | Onboarding flow (first-run)        | 4h     | —          | ✅     | `OnboardingWizard.tsx` — 4-step modal with animations, keyboard nav, backend wiring       |
| 4.4 | Micro-interactions (press effects) | 4h     | —          | ✅     | `active:scale-[0.97]` on `BTN_BASE` in `ui-tokens.ts`                                     |
| 4.5 | Empty state illustrations          | 3h     | —          | ✅     | `EmptyState.tsx` — icon/illustration support                                              |
| 4.6 | Achievement/toast system           | 2h     | —          | ✅     | `NotificationToast.tsx` — toast notifications                                             |
| 4.7 | Custom app icons (variants)        | 1h     | —          | ✅     | Favicon in index.html, all icon sizes in tauri.conf.json, generate-icons script           |
| 4.8 | Campaign analytics visual polish   | 2h     | —          | ✅     | CSS-variable chart colors, merged effects, skeleton load, empty state, dashboard-aligned  |

---

## Phase 5 — Data Visualization & Dashboard (📋 Planned — ~25h)

| #   | Task                          | Effort | Depends On | Status | Notes                                                                                       |
| --- | ----------------------------- | ------ | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| 5.1 | **Dashboard widgets**         | 6h     | —          | ✅     | 8 widgets (4 standalone, 2 chart, 1 new heatmap, 1 network graph); customizable; persisted  |
| 5.2 | Activity timeline             | 4h     | —          | ✅     | `RecentActivityWidget` — vertical timeline, event icons, relative time, scores              |
| 5.3 | Analytics charts (email)      | 6h     | —          | ✅     | `EmailVolumeWidget` + `ContactGrowthWidget` — Bar/Line/Area toggles, CSS vars, dash-aligned |
| 5.4 | Heat map calendar             | 3h     | —          | ✅     | GitHub-style 52wk×7day grid with colored cells, tooltips, month/day labels                  |
| 5.5 | Network graph (entity pivots) | 6h     | —          | ✅     | d3-force SVG force-directed graph with entity-type colors, tooltips, node/edge count        |

---

## Phase 6 — Mobile Extended (💤 Deferred — ~30h)

| #   | Task                                       | Effort | Depends On | Status | Notes                                                                   |
| --- | ------------------------------------------ | ------ | ---------- | ------ | ----------------------------------------------------------------------- |
| 6.1 | Make the perfect workflow for screen pages | 4h     | —          | 🔲     | emailList, contactList, compose an email/compagne , tasklist , settings |
| 6.2 | Android widget (Home Screen)               | 4h     | —          | 🔲     | Unread count, quick compose                                             |
| 6.3 | Smart Lock                                 | 6h     | —          | 🔲     | Biometric                                                               |
| 6.4 | ContactsContract sync                      | 4h     | —          | 🔲     | Bidirectional sync with Android contacts                                |
| 6.5 | CalendarContract sync                      | 4h     | —          | 🔲     | Bidirectional sync with Android calendar events                         |

---

## Phase 7 — Feature Depth (💤 Deferred — varies)

Items identified from codebase audit where features exist but have gaps.

| #   | Task                                        | Effort | Depends On | Status | Notes                                                  |
| --- | ------------------------------------------- | ------ | ---------- | ------ | ------------------------------------------------------ |
| 7.1 | **Microsoft Graph send/draft provider**     | 6h     | —          | 🔲     | Currently throws unsupported error for send/draft      |
| 7.2 | Campaign scheduling (fully wired)           | 4h     | —          | 🔲     | Scheduling not yet end-to-end                          |
| 7.3 | Calendar provider expansion (beyond Google) | 4h     | —          | 🔲     | Additional CalDAV providers                            |
| 7.4 | Template engine unification (3 systems → 1) | 8h     | —          | 🔲     | Email + Campaign + Warmup → single catalog             |
| 7.5 | Mail composer feature gaps (25 gaps)        | varies | —          | 🔲     | See `docs/superpowers/composer-architecture.md`        |
| 7.6 | Campaign analytics end-to-end               | 3h     | —          | 🔲     | Reports/analytics from live data                       |
| 7.7 | Mobile push notification completeness       | 3h     | —          | 🔲     | Full notification product coverage (currently partial) |

---

## Phase 8 — Vault & Storage Polish (📋 Planned — ~12h)

| #   | Task                                   | Effort | Depends On | Status | Notes                                                                                 |
| --- | -------------------------------------- | ------ | ---------- | ------ | ------------------------------------------------------------------------------------- |
| 8.1 | **Vault search/indexing improvements** | 3h     | —          | ✅     | `vault_items` DB table (migration 019), DB-backed recursive search, upsert on list    |
| 8.2 | Vault categorization enhancement       | 2h     | —          | ✅     | `categorize_file()` auto-categorization by extension, filter chips UI, category badge |
| 8.3 | Vault multi-account file isolation     | 2h     | —          | ✅     | `account_id` on all commands, isolated dirs (`/vault/{account_id}/`), store wiring    |
| 8.4 | Vault file preview (images, PDFs)      | 3h     | —          | ✅     | `VaultFilePreview.tsx` — wired in VaultPage                                           |
| 8.5 | Vault bulk operations (multi-select)   | 2h     | —          | ✅     | `selectedPaths` store + checkbox UI + bulk delete bar                                 |

---

## Phase 9 — Backend Hardening (📋 Planned — ~15h)

| #   | Task                                  | Effort | Depends On | Status | Notes                                                                      |
| --- | ------------------------------------- | ------ | ---------- | ------ | -------------------------------------------------------------------------- |
| 9.1 | **Sync conflict resolution UI**       | 3h     | —          | ✅     | `ConflictResolutionPanel.tsx` — side-by-side diff, Keep Local/Remote/Merge |
| 9.2 | CRDT sync progress indicators         | 2h     | —          | ✅     | `SyncProgressIndicator.tsx` — animated pills in shell footer               |
| 9.3 | Background service health dashboard   | 3h     | —          | ✅     | `HealthDashboard.tsx` + `SystemHealthTab.tsx` — registered in Settings     |
| 9.4 | Offline queue management UI           | 2h     | —          | ✅     | `OfflineQueueIndicator.tsx` — queue status widget                          |
| 9.5 | Data export improvement (full backup) | 3h     | —          | ✅     | `backup_restore.rs` — VACUUM INTO backup, restore, list; 3 new Tauri cmds  |
| 9.6 | Database migration rollback support   | 2h     | —          | ✅     | `migration_rollback.rs` — tracking table, rollback_n, 2 new Tauri cmds     |

---

## Immediate Next Sprint (🎯 Phase 1 + 3 — ~8h)

| Priority | Task                                | Effort    |
| -------- | ----------------------------------- | --------- |
| P0       | CI pipeline setup                   | ✅ done   |
| P0       | Keyboard shortcuts system           | ✅ done   |
| P0       | Manual tests (panic, WAL, watchdog) | 1.5h 🔲   |
| P0       | WAL deletion doc                    | ✅ done   |
| P1       | Translation tools (fix ja/it)       | ✅ done   |
| P2       | RTL layout audit (report findings)  | ✅ done   |
| P3       | Certificates + public key           | varies 🔲 |

---

## Sprint After (Release)

| Priority | Task                            | Effort |
| -------- | ------------------------------- | ------ |
| P0       | Dogfooding + beta testing       | 1-2w   |
| P1       | Screen reader support (WCAG AA) | 4h     |
| P1       | Keyboard nav (tab order)        | 3h     |

---

## Dependency Map

```
Phase 1 (Pre-Release Polish)
  └─ 1.2 Keyboard shortcuts ← enables → 2.1 Keyboard navigation
  └─ 1.10 Dogfood + Beta ← depends on → 1.1-1.9

Phase 2 (Desktop Power User)
  ├─ 2.1 Keyboard nav ← depends on → 1.2 Keyboard shortcuts
  ├─ 2.2 Screen reader ← independent
  └─ 2.3-2.15 ← mostly independent

Phase 3 (Accessibility & i18n)
  ├─ 3.6 Additional locales ← depends on → 3.5 Translation tools
  └─ Mostly independent of Phase 2

Phase 4 (Visual Enhancement)
  └─ Mostly independent

Phase 5 (Data Viz)
  └─ Independent but benefits from Phase 2 polish

Phase 6 (Mobile Extended)
  └─ Independent; can be parallel

Phase 7 (Feature Depth)
  └─ Independent timeboxed items

Phase 8 (Vault Polish)
  └─ Independent

Phase 9 (Backend Hardening)
  └─ Mostly independent
```

---

## Effort Summary

| Phase     | Effort (est.) | Remaining | Status                          |
| --------- | ------------- | --------- | ------------------------------- |
| Phase 0   | —             | —         | ✅ Complete                     |
| Phase 1   | ~20h          | ~3h       | 🎯 Sprint (6 of 9 items ✅)     |
| Phase 2   | ~20h          | —         | ✅ Complete (15 of 15 items ✅) |
| Phase 3   | ~9h           | ~2h       | 📋 Planned (4 of 5 items ✅)    |
| Phase 4   | ~22h          | —         | ✅ Complete (8 of 8 items ✅)   |
| Phase 5   | ~25h          | —         | ✅ Complete (5 of 5 items ✅)   |
| Phase 6   | ~30h          | ~30h      | 💤 Deferred                     |
| Phase 7   | ~28h          | ~28h      | 💤 Deferred                     |
| Phase 8   | ~12h          | —         | ✅ Complete (5 of 5 items ✅)   |
| Phase 9   | ~15h          | —         | ✅ Complete (6 of 6 items ✅)   |
| **Total** | **~187h**     | **~63h**  | (58h deferred in Ph6+Ph7)       |

---

## Merged Roadmap Directives (from consolidated docs)

The following formerly separate roadmap docs have been merged here. Their key directives are preserved below.

### Template Engine — Unified Template Catalog (from `07-template-engine.md`)

**Core insight:** Three template systems (email presets, campaign presets, warmup presets) should converge into one unified `TemplateCatalog`.

- **Current state:** 5 email presets in SQLite, 10 campaign presets as TS constants, 24 warmup presets in SQLite
- **Target:** All templates stored in SQLite with `template_type` discriminator, unified editor UI, shared variable system
- **Priority:** Phase 7.4 (deferred) — blocked until Phase 6/7 feature depth work

### Competitive Analysis Highlights (from `11-top-apps-comparison.md`)

SMEMaster is competitive on architecture (local-first SQLite, Rust-owned data, typed IPC). Key remaining gaps:

- **Sub-100ms interactions** — virtual list already done; event-bus dispatch needs profiling
- **Unified command surface** — 652 commands exist, but Superhuman-level discoverability is missing
- **Offline semantics** — CRDT works; queue visibility needs UX polish
- **Keyboard-first workflows** — Phase 2 covers this (tab order, screen reader)

### Spec-Driven Dev Plan (from `12-spec-driven-dev-plan.md`)

All remaining work follows the pattern: **Spec → Files → Workflow → Acceptance**. Each phase in this document has acceptance criteria. Feature specs that were extracted as separate documents now live in:

- `docs/04-FEATURES/36-onboarding-reboot-plan.md` — Onboarding wizard spec
- `docs/04-FEATURES/37-settings-redesign-spec.md` — Settings redesign spec

---

## Related Documents

- [Production Readiness](../PRODUCTION-READINESS.md) — 9 gates with detailed evidence
- [UI/UX Super-App Spec](../03-FRONTEND/12-ui-super-app-spec.md) — Desktop & Mobile UI/UX gaps
- [Frontend RTL Audit](../03-FRONTEND/10-rtl-audit.md) — RTL readiness findings
- [Composer Architecture](../superpowers/composer-architecture.md) — 25+ composer gaps
- [STATUS.md](../STATUS.md) — Current project status
