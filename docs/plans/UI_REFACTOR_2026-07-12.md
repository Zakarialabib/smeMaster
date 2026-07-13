# SMEMaster — Unified UX & Email-Migration Roadmap

[!NOTE]
**Superseded (2026-07-13).** The design/UI/UX direction in this document has been
consolidated into `docs/plans/DESIGN_UI_UX_SPEC.md`, which is now the single source of
truth for the design system, page-template contract, and the Chunk 1-9 execution roadmap
(Direction A = Glass surface layer, shipped). The email-migration section (C9) of this
document remains valid and is out of scope for the design plan. Keep this file for
historical reference only.


> **Single source of truth** for UI/UX direction and the email-migration feature.
> This document **supersedes and replaces** four earlier design docs, which were
> merged into it and then deleted:
>
> - `docs/plans/UI_REFACTOR_2026-07-12.md` (the "Flat & Calm" refactor plan)
> - `docs/email-migration-design.md` (workspace-aligned email-migration design)
> - `docs/smeMaster_Premium_UX_Framework.md` (the "Bohemian Liquid Glass" framework)
> - `docs/superpowers/specs/2026-07-12-bohemian-liquid-glass-design.md` (glass spec)
>
> **Last consolidated:** 2026-07-13. Status below is **verified against the live
> code** (`src/`, `src-tauri/`, `src/constants/themes.ts`, `src/router/routeTree.tsx`,
> `src/locales/en/translation.json`, `src-tauri/src/db/migrations/019_sync_migration.sql`).

---

## 0. How to use this document

- It is a **living roadmap**, not a frozen spec. Every PR that touches UX or the
  email-migration flow should update the relevant checkbox/status row here.
- **Status legend:** ✅ Done (verified in code) · 🔶 In progress (partial) · 🔲 Not started · ⚠️ Verify (couldn't fully confirm from code).
- **Constraint reminder:** SMEMaster is a 3-layer app — React UI → TS service layer →
  Tauri/Rust owns SQLite. UI never touches the DB; Rust owns the schema. All IPC goes
  through `db-invoke.ts` / `commands.ts` via `invokeCommand`, never raw `invoke()`.

---

## 1. Design System — Two Coexisting Themes

### 1.1 Canonical decision: **Both as themes**

After reconciling two contradictory "approved" plans dated the same day (2026-07-12),
the consolidated direction is:

| | Default | Selectable |
| --- | --- | --- |
| **Theme A — Flat & Calm** | ✅ active default | — |
| **Theme B — Bohemian Liquid Glass** | — | ✅ user-selectable |

**Why this (and why it's already supported by code):**
- The later `UI_REFACTOR` plan (Flat & Calm) is the one **actually executing**: `PageScaffold`
  is already wired into 7 primary pages (automation, erp, invoicing, tasks, contacts,
  calendar, attachments) and `FilterBar` is in use. Recent commits (contacts/tasks/automation
  validation parity, `CardTabBar` reuse) match it.
- The glass aesthetic is **not deleted** — it survives as a user-selectable theme. The
  building blocks already exist: `src/shared/components/ui/FrostedBackground.tsx` (animated
  orbs) and `src/constants/themes.ts` ships `COLOR_THEMES = ["frost", "amber"]` (default
  `frost`). The `amber` theme **is** the Bohemian accent.
- What is **not** built: the proposed `AmbientGlow.tsx` (warm amber radial gradients) and its
  `ambient-glow` keyframes are absent from `globals.css`. That refinement remains open work
  under Theme B.

### 1.2 Theme A — Flat & Calm (DEFAULT)

| Attribute | Choice |
| --- | --- |
| Surfaces | Solid/near-solid bg (`#f7f8fa` light, `#0f1115` dark); cards = white (`#1a1d23` dark) with a 1px neutral border + subtle 1–2px shadow. No blur, no blobs. |
| Accent | Single brand accent, de-saturated. Propose `#2f6df6` (or keep `#0b57d0`). Neutral grays elsewhere. |
| Type | Keep existing modular scale + Inter; drop decorative sheen. (Theme B optionally layers `Outfit` as a display face.) |
| Motion | Keep `PageTransition` + subtle hover; remove blob/orbital animations. Respect `prefers-reduce-motion` (already wired). |
| Density | Keep 8-pt spacing + compact desktop density tokens. |
| Dark / RTL | Keep dark mode + RTL (`dir='rtl'`, logical properties). |

**Flat token rewrite (chunk C1) is NOT yet done** — `src/styles/globals.css` still contains
`.animated-bg`, `.blob`, `blobMove`, `orbitalDrift`. The page-level scaffold adoption
(chunks C2–C5) is ahead of the token rewrite.

### 1.3 Theme B — Bohemian Liquid Glass (SELECTABLE)

| Attribute | Choice |
| --- | --- |
| Tone | Warm industrial with organic softness; frosted glass over layered ambient light. |
| Color | Dominant deep slate + warm amber accent `#d97706` (hover `#B45309`, active `#92400E`, tint `#FEF3C7`). Warm neutrals: light bg `#e8e6e3` (not pure white), dark bg `#121212` (not pure black). |
| Background | `FrostedBackground` orbs (exists). Optional `AmbientGlow` (proposed, not built) — 3–4 `aria-hidden`, `pointer-events:none` radial-gradient layers, slow drift, auto-hidden on mobile ≤768px and `prefers-reduced-motion`. |
| Surfaces | `GlassPanel` variants (`card`, `sidebar`, `widget`, `modal`, `tooltip`, `liquid`) with `backdrop-blur`. |
| Type | Optionally `Outfit` (display) + `Inter` (body); `Tajawal` kept for Arabic. |
| Motion | Spring physics with organic overshoot (entrance only). |

### 1.4 Shared non-negotiables (apply to BOTH themes)

1. **No spinners** — ever. Replace with skeletons (already present: `Skeleton.tsx`) or
   nothing (synchronous local reads).
2. **Every interactive element** has default → hover → active → focus → disabled states.
3. **Motion with purpose** — entrance animations on first load only, not every re-render.
4. **Keyboard-first** — desktop app; `Cmd+K`, `E`/`R`/`S`, `N`, `Cmd+Shift+F`, `Cmd+B`.
5. **Accessibility (WCAG 2.1 AA)** — ARIA, live regions, full keyboard nav.
6. **RTL** — always logical properties (`ms-*`/`me-*`, `text-start/end`, `inset-inline-*`),
   never physical `left`/`right`.
7. **Offline-first** — local SQLite is source of truth; queue operations, optimistic UI.
8. **No data lock-in** — trust requirement for desktop software.
9. **Lucide icons only** — 18px inline, 20px nav, 24px empty states.

---

## 2. Status Dashboard (verified 2026-07-13)

| # | Area | Claim | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Email · Special-use detection | RFC 6154 + name-heuristic folder mapping | ✅ | `src-tauri/src/imap/folder.rs` |
| 2 | Email · `labels.imap_folder_path` | column exists | ✅ | `schema.sql` |
| 3 | Email · `folder_sync_state` checkpoint | uidvalidity/last_uid/modseq | ✅ | schema + `db/tables/core/folder_sync_state.rs` |
| 4 | Email · `syncStore` progress | store exists | ✅ | `src/shared/stores/syncStore.ts` |
| 5 | Email · Resumable-sync columns on `folder_sync_state` | `sync_phase`, `last_error`, `retry_count`, `is_paused` | ✅ | migration `019_sync_migration.sql` + `folder_sync_state.rs` helpers |
| 6 | Email · `sync_jobs` table + commands | 1 table + 5 commands | ✅ | `019_sync_migration.sql` + `db/tables/core/sync_jobs.rs` |
| 7 | Email · `sync_conflicts` table + commands | 1 table + 3 commands | ✅ | `019_sync_migration.sql` + `db/tables/core/sync_conflicts.rs` |
| 8 | Email · Folder-mapping UI (US-1..US-6) | drag/select map + live preview | 🔲 | not present |
| 9 | Email · Deselect-to-skip wiring | Spam/Promotions skipped in backfill | 🔲 | not wired |
| 10 | Email · MS Graph OAuth frontend | custom-tab flow for Outlook 365 | 🔲 | backend ready, frontend pending |
| 11 | Email · IMAP engine unit tests (P1) | cover `sync.rs`/`flags.rs`/`folder.rs` | 🔲 | zero tests today |
| 12 | Email · Conflict audit-log UI | surface `sync_conflicts` to user | 🔲 | table only, no UI |
| 13 | UX · `PageScaffold` | shared page scaffold component | ✅ + wired to 7 pages | `src/shared/components/layout/PageScaffold.tsx` |
| 14 | UX · `FilterBar` | shared filter primitive | ✅ + used | `src/shared/components/ui/FilterBar.tsx` |
| 15 | UX · globals.css flat rewrite (C1) | remove blobs/glass keyframes | 🔲 | blobs still present |
| 16 | UX · Per-page scaffold adoption | Contacts/Tasks/Calendar/Automation/Invoicing/ERP/Attachments | ✅ | all use `PageScaffold` |
| 17 | UX · Route cleanup (DROP/MERGE) | delete `/business` `/campaigns` `/workflows` `/crm` | 🔲 | still present as redirects in `routeTree.tsx` (lines 287, 335–386) |
| 18 | UX · Settings re-section | regroup tabs + copy + i18n | 🔲 | not started |
| 19 | i18n · en source namespaces | automation/erp/pos/crm/invoicing/assistant/contacts/attachments/tasks | ✅ | present in `src/locales/en/translation.json` |
| 20 | i18n · ar/fr/it fills | translate new/missing keys | 🔶 | ongoing (`it` completed per STATUS; fr/ar partial) |
| 21 | Theme · `COLOR_THEMES` (frost/amber) | selectable themes | ✅ | `src/constants/themes.ts`; default `frost` |
| 22 | Theme B · `AmbientGlow` (amber radial) | proposed component + keyframes | 🔲 | not built |
| 23 | Onboarding · Wizard | 4-step flow + sessionStorage restore | ✅ | `src/features/onboarding/` |
| 24 | Onboarding · Demo data seeding | seed after completion | 🔶 | `db_seed_full_demo` exists; normal-finalize path gap noted |
| 25 | Onboarding · Theme/density/role prefs | pick vibe during wizard | 🔲 | not built |
| 26 | Shell · PremiumSidebar / BottomTabBar | icon rail + mobile tabs | ✅ | `src/shared/components/layout/shell/` |
| 27 | Shell · Expand-on-hover / auto-hide header / active label | niceties | 🔶 | active label added (P2); others open |
| 28 | Perf · Skeletons | SkeletonPage/Table/Card | ✅ | `src/shared/components/ui/Skeleton.tsx` |
| 29 | Perf · Optimistic UI | archive/star/snooze | ✅ | email `stashThread`/`unstashThread` |
| 30 | Perf · IntersectionObserver prefetch | long-list prefetch | 🔶 | `InfiniteScrollSentinel` exists; broad rollout open |
| 31 | Keyboard · Shortcuts + cheatsheet | Cmd+K, E/R/S, N, search, Cmd+B | ✅ | `useKeyboardShortcuts.ts`, `ShortcutsHelp.tsx` |
| 32 | Keyboard · Tooltips / remapping / Zen / hints | power-user extras | 🔶 | Zen mode exists (FocusReader/ZenMode); tooltips/remapping/hints open |
| 33 | Dashboard · Hero KPI | one big number + trend | 🔲 | not built |
| 34 | Dashboard · Quick actions / widget empty states / 5-sec rule | polish | 🔲 | not built |
| 35 | Mobile · BottomTabBar + adaptive shell | phone nav | ✅ | `MobileShell.tsx`, `BottomTabBar.tsx` |
| 36 | Mobile · Breakpoint audit (375/768/1024) | verify accessibility | 🔶 | not fully audited |

---

## 3. Email Migration Roadmap

> Source: `email-migration-design.md`. The hard part — **resumable fetch** — is already
> solved at the schema level (items #1–7 above). What remains is **product glue** (mapping
> UI, deselect wiring, MS Graph frontend) and **test coverage**.

### 3.1 Where the code lives

| Concern | Location |
| --- | --- |
| IMAP engine (fetch, sync, folders, flags) | `src-tauri/src/imap/` + `src/features/mail/services/imap/tauriCommands.ts` |
| OAuth (Gmail + MS Graph, PKCE) | `src-tauri/src/oauth.rs`, `oauth/monitor.rs`, `src/shared/services/oauth/customTabAuth.ts` |
| Local account discovery (no password read) | `src-tauri/src/commands/account_import.rs` |
| Persistence / schema | `src/shared/services/db/schema.sql`, `src-tauri/src/db/` |
| Resumable sync state | `folder_sync_state` (+ `019` columns), `sync_jobs`, `sync_conflicts` |

### 3.2 Architecture (two-phase + ghost mailbox + conflict resolution)

- **Phase 1 — Historical backfill (cold):** `imap_fetch_new_uids` → `imap_fetch_messages`
  (BATCH 50) → checkpoint `folder_sync_state` per batch.
- **Phase 2 — Live cutover (hot):** `imap_delta_check` / `imap_sync_folder` diff from
  `last_uid` + `modseq`; repeat on idle/interval until caught up.
- **Ghost Mailbox:** imported mailbox is fully readable offline the moment it's in SQLite.
- **Conflict rules:** keyed by `(account_id, id)`; source wins on active import;
  `imap_set_flags` owns flag state; local read/starred is UI-authoritative; folder renames
  re-detected by special-use without retro-moving items.

### 3.3 Backend — DONE (verified, items #1–7)

Schema + commands already in place via migration `019_sync_migration.sql` and the three
core table modules. Nothing backend-blocking remains for a basic resumable import.

### 3.4 Resumable sync data model — IMPLEMENTED

- **`folder_sync_state`** gained additive columns (`sync_phase`, `last_error`, `retry_count`,
  `is_paused`) — no destructive migration.
- **`sync_jobs`** (one row per migration run): `phase`, `status`, `total_folders`,
  `done_folders`, `estimated_messages`, `synced_messages`, timestamps.
- **`sync_conflicts`** (audit log): `conflict_type`, `source_value`, `local_value`,
  `resolved`.
- **Resume flow:** on app start / "Resume" → select running/paused `sync_jobs` → per folder
  by `sync_phase` → `imap_fetch_messages FROM last_uid+1` (backfill) or `imap_delta_check`
  (delta) → on error `retry_count++`, pause at threshold → when all folders `done`, mark job done.

### 3.5 Frontend — TODO (items #8–12)

1. **Folder-mapping screen + live preview** (US-1..US-6) inside Account Setup / Settings → Accounts.
2. **Deselect-to-skip wiring** — feed deselected folders (Spam/Promotions/All Mail) into backfill.
3. **MS Graph OAuth frontend** — complete the `customTabAuth.ts` MS Graph branch.
4. **IMAP engine unit tests (P1)** — cover `sync.rs`, `flags.rs`, `folder.rs`.
5. **Conflict audit-log UI** — surface `sync_conflicts` so "my starred items moved" is explainable.

### 3.6 Folder-mapping user stories

- **US-1 Auto-map by special-use** — Sent/Trash/Drafts/Archive land in right labels.
- **US-2 Full source tree** — every folder as a row with count + size.
- **US-3 Deselect noise** — uncheck Spam/Promotions/All Mail; drives `total_folders` vs `done_folders`.
- **US-4 Manual map / rename** — drag source folder onto a label or rename target; writes `labels.imap_folder_path` + `name`.
- **US-5 Preview before download** — live label-tree preview (pure read, no fetch).
- **US-6 Resume visibility** — per-folder green/amber status + overall % bound to `sync_jobs` + `folder_sync_state.sync_phase`.

**Screen flow:** Connect → [Discovery] `imap_list_folders`+`imap_get_folder_status` →
[Map] optional drag/rename + deselect + live preview → [Confirm] create labels + insert
`sync_jobs` (phase=backfill) → [Progress] per-folder timeline (header-first, archive browsable
immediately) → [Cutover] `imap_delta_check` + `send_as_aliases` default.

### 3.7 Build order

1. Folder-mapping UI + live preview (US-1..US-6). 2. Deselect-to-skip wiring. 3. MS Graph frontend.
4. IMAP engine unit tests. 5. Conflict audit-log UI.

---

## 4. Primary Pages Roadmap (Flat & Calm scaffold)

### 4.1 Route cleanup (item #17 — NOT done)

`routeTree.tsx` still defines redirect routes. Decision: keep redirects but **delete dead
page components** where they exist:

| Route | Current | Action |
| --- | --- | --- |
| `/business` | redirect → `/dashboard` | keep redirect; no feature dir |
| `/campaigns` | redirect → `/automation` | keep redirect; `CampaignPage` stays a tab |
| `/workflows` | redirect → `/automation` | **delete** `WorkflowsPage.tsx` (dead `@deprecated`) |
| `/crm` | alias → `/people` | keep alias; `/people` is the CRM page |

Net primary routes after cleanup: automation, invoicing, erp, vault, ai-assistant, people,
pos, plus contacts, attachments, tasks, calendar, dashboard, mail(+threads), settings, help.

### 4.2 PageScaffold + FilterBar adoption (items #13–16 — done)

`PageScaffold` (title row + optional filter bar + content + empty-state slot) and `FilterBar`
are the single source of UI truth. Adopted by: Contacts, Tasks, Calendar, Automation,
Invoicing, ERP, Attachments. Exempt (keep own layout): mail/thread/label, dashboard,
ai-assistant, pos, vault, help.

### 4.3 Per-page status

| Page | Verdict | Status | Notes |
| --- | --- | --- | --- |
| Mail | Exempt | ✅ | uses shared `EmptyState`; i18n ok |
| Dashboard | Exempt | 🔶 | hero KPI + quick actions still open (#33–34) |
| AI-assistant | Exempt | 🔶 | needs `assistant` i18n namespace |
| POS | Exempt | 🔶 | needs `pos` i18n namespace |
| Vault | Exempt | 🔶 | finish `vault` i18n + empty-state CTA |
| Contacts | RESHAPE | ✅ | scaffold + validation parity; ~30 strings → `contacts.*` |
| Attachments | RESHAPE | ✅ | relocated to `features/attachments/`; i18n ok; empty CTA |
| Tasks | KEEP+ | ✅ | scaffold; ~40-string i18n migration |
| Calendar | RESHAPE chrome | ✅ | title row + `FilterBar` + shared `EmptyState`; grid stays |
| Automation | KEEP | ✅ | scaffold + `FilterBar` + `AdaptiveTable`; `automation` i18n |
| Invoicing | KEEP | ✅ | `Documents` list → `AdaptiveTable` + `FilterBar`; `invoicing` i18n; share list with CRM `InvoicesTab` |
| ERP | RESHAPE | ✅ | thin shells; consider folding Stock/Items into Invoicing; `erp` i18n |
| People/CRM | KEEP | ✅ | unified tabbed page; `crm`/`people` i18n |

---

## 5. Settings Re-section Roadmap (item #18 — NOT done)

- Regroup tabs in `SettingsTabRegistry.ts` into clearer sections: Account, Composing,
  Delivery, Templates, AI, Automations, Hardware, Privacy/Security, About.
- Fix `getTabLabel()` hard-coded labels (about, pairing, backup, calendar, developer, queue,
  account-cleaning) → wrap in `t()`.
- Regroup `business-profile` tab (Morocco DGI tax IDs ICE/IF/RC/CNSS) sensibly — it's under
  "Workspace" but is tax config.
- Align Hardware + Mobile settings pages to `SettingGroup`/`SettingsHelpers`.
- Add smooth tab transitions, auto-save (debounce 500ms), settings search.
- Finish `settings` i18n for any new labels.

---

## 6. i18n Roadmap (items #19–20)

- **en source namespaces** present: automation, erp, pos, crm, invoicing, assistant,
  contacts, attachments, tasks (calendar/campaign/mail/vault partial/ok).
- **Action:** run `npm run translate:sync`; fill `ar`/`fr`/`it` for new/missing keys.
- **Verify** no hard-coded English strings remain in refactored components (RTL + `t()` everywhere).
- Keep `it` maintenance current (completed per STATUS); prioritize `fr`, then `ar`.

---

## 7. Cross-cutting UX (theme-agnostic — from Premium UX Framework)

### 7.1 Onboarding (items #23–25)
✅ Wizard shows on first launch; 4-step flow; progress in `sessionStorage`; Quick Start;
animations. 🔶 Seed demo data on normal completion (not just "Skip to Demos"). 🔲 Theme/density
picker ("Pick your vibe") + role-based default tool selection during wizard.

### 7.2 Shell / Navigation (items #26–27)
✅ `PremiumSidebar` + `BottomTabBar` + adaptive `MobileShell` + `AppLayout` 3-pane + command palette.
🔶 Expand-on-hover for icon rail; auto-hide header on scroll in mail/people/tasks; active route
label above `BottomTabBar` (added). Add `title`/tooltip to collapsed nav items.

### 7.3 Perceived performance (items #28–30)
✅ `Skeleton` family; settings lazy-load uses `SkeletonPage`; email/tasks/dashboard skeletons;
optimistic email actions via `stashThread`/`unstashThread`. 🔶 `IntersectionObserver` prefetch
rollout (`InfiniteScrollSentinel` exists). Audit every `lazy()` route has a `SkeletonPage` fallback.

### 7.4 Keyboard & power user (items #31–32)
✅ `Cmd+K`, `E`/`R`/`S`, `N` (mail/tasks), `Cmd+Shift+F`, `Cmd+B`; visual cheatsheet.
🔶 500ms hover shortcut tooltips; custom shortcut remapping page; prioritize `Cmd+K` by usage;
progressive "Press N to compose" hints. (Zen mode already exists via FocusReader/ZenMode.)

### 7.5 Dashboard (items #33–34)
🔲 Hero KPI (one big number + sparkline + semantic color); QuickActionsWidget
(compose / contact / campaign / meeting); empty states with CTAs on every widget; 5-second
health-check rule (hero + 3 widgets above the fold).

### 7.6 Mobile (items #35–36)
✅ `BottomTabBar` (5 tabs) + adaptive `MobileShell`; active route label added. 🔶 Breakpoint
audit at 375/768/1024; verify all navigation reachable via tabs when sidebar hidden.

---

## 8. Execution Roadmap (chunks / commits)

Each chunk = one layer or page group; semantic message; push after green
`npm run typecheck` + `npm run lint --max-warnings=0`.

| Chunk | Scope | Status |
| --- | --- | --- |
| **C1** | Design tokens + `globals.css` flat rewrite (remove blobs/glass keyframes; keep spacing/type/RTL/dark) | 🔲 |
| **C2** | PageScaffold + FilterBar + validation primitives (RHF + Zod) | ✅ done, keep extending |
| **C3** | Primary pages batch 1 (contacts, tasks, attachments) | ✅ done |
| **C4** | Primary pages batch 2 (calendar, automation) | ✅ done |
| **C5** | Primary pages batch 3 (invoicing, erp, people/crm, ai-assistant, pos, vault, help) | 🔶 partial |
| **C6** | Settings re-section + copy + search + auto-save | 🔲 |
| **C7** | i18n fill (ar/fr/it) + `translate:sync` | 🔶 ongoing |
| **C8** | Mobile breakpoint verification pass | 🔶 partial |
| **C9** | Email migration — folder-mapping UI + deselect wiring + MS Graph frontend + IMAP tests + conflict UI | 🔲 |
| **C10** | Theme B polish — `AmbientGlow` component + `Outfit` display font + amber ambient-glow keyframes (opt-in) | 🔲 |

---

## 9. Guardrails

- Do **not** run `docs:build` (docs are separate; out of scope here).
- Preserve file line-ending conventions already used in the repo.
- Keep `prefers-reduced-motion` + RTL working in **both** themes.
- No behavior changes in presentation-only chunks (C1–C2) — pure tokens/empty-states/validation UX.
- Every chunk must pass `npm run typecheck` and `npm run lint --max-warnings=0`.
- Rust still owns the schema: any new email-migration column/table goes through a migration in
  `src-tauri/src/db/migrations/` + a `db/tables/` module, never direct SQL in TS.
- Route deletions must keep working redirects for bookmarked URLs.
