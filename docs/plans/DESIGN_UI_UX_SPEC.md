# smeMaster — Design / UI / UX Specification (Mobile + Desktop)

> **For Hermes:** This is an APPROVAL document, not an execution plan. Build it in chunks
> only after the user signs off Section 0 (direction). Execution chunks are enumerated in
> Section 9 as bite-sized tasks; each chunk becomes its own `feat(design):` / `docs:`
> commit on `dev`.

**Status:** APPROVED - Direction A (Glass) locked 2026-07-13; executing in chunks on `dev`.
**Date:** 2026-07-13
**Scope:** Cross-cutting design system, UI patterns, and UX consistency for BOTH desktop
(Windows/Linux/macOS Tauri) and mobile (Tauri Android). Touch every primary page to parity.

---

## 0. Direction — DECISION REQUIRED (approve or change)

The repo already ships a real design system (Frosted Glass). Two prior proposals exist but
stalled: `docs/plans/UI_REFACTOR_2026-07-12.md` (proposed DROPPING glassmorphism for a flat
system) and `docs/03-FRONTEND/12-ui-super-app-spec.md` (empty stub). This spec does NOT
re-litigate the visual identity from scratch — it locks one direction, codifies the existing
pattern library as the single source of truth, fixes the gaps, and standardizes UX across
all pages + both form factors.

### 0.1 The three options (pick one)
- **A (RECOMMENDED) — "Refined Frosted Glass" (keep + fix what exists):**
  Keep the current Frosted Glass identity but make it *real and consistent*. Today
  `--glass-blur` is `0px`, so surfaces are border/shadow-only, not actually frosted. We turn
  on a measured blur, keep the brand accent `#0b57d0` (light) / `#8ab4f8` (dark), keep the
  liquid sheen as an *optional, reduced-motion-respecting* accent on hero/modal surfaces only,
  and kill the always-on background blobs for a calmer, faster, award-quality feel.
- **B — "Flat Calm" (the prior UI_REFACTOR proposal):** Drop glassmorphism entirely; solid
  `#f7f8fa`/`#0f1115` backgrounds, 1px borders, subtle shadows, no blur, no blobs.
- **C — "Hybrid":** Flat content areas + frosted overlays only (modals/sheets/command palette).
  Calm by default, glass where it earns it.

### 0.2 Non-negotiables regardless of A/B/C
1. **One design language** across desktop + mobile (no two skins).
2. **`PageScaffold` is the single page shell** for every primary list/content page.
3. **`useFormField` + `validators.ts` is the only form/validation path** — inline i18n errors,
   submit disabled until valid. No silent `if (!x.trim()) return`.
4. **Light + Dark** both ship (tokens already exist); respect `prefers-reduced-motion`.
5. **i18n parity** — every visible string goes through `t()`; en/ar/fr/it keys stay in sync.
6. **RTL** is first-class (ar locale, `dir="rtl"` already supported).
7. **Verification gate** (per `smemaster` skill): `npx tsc --noEmit` delta 0 vs baseline in
   touched files; `cargo check` green if Rust changes; CRLF preserved on `.tsx`/`.css`/`.md`.

**APPROVAL - LOCKED:** Direction **A (Glass)** approved by user (2026-07-13), with a
clarification: "choose the best direction that will make us win the award." Implementation
decision: Glass is delivered as a **selectable surface layer** (`[data-surface="glass"]` on
`<html>`), keeping Flat as the calm/accessible default - this reuses 100% of existing code
(`FrostedBackground` orbs, `GlassPanel`, `--glass-blur`) and matches the consolidated
`UI_REFACTOR_2026-07-12.md` intent (Flat default + Glass selectable). Chunk 1 shipped.

---

## 1. Current State (verified, 2026-07-13)

**Strengths (reuse, don't rebuild):**
- Tokenized theme in `src/styles/globals.css` (typography modular scale, 8pt spacing,
  semantic colors, light+dark, `--desktop-*` density tokens, liquid-glass vars).
- Shell architecture already adaptive: `MobileShell` → `PhoneShell` (BottomTabBar) /
  `TabletLandscapeShell` (compact sidebar) / `DesktopShell`. Plus `WindowTitleBar`,
  `NavRail`, `PremiumSidebar`, `AppLayout`, `MainWorkspace`.
- Pattern library exists: `PageScaffold`, `Button`, `EmptyState`, `AdaptiveTable`,
  `AdaptiveBottomSheet`, `FloatingActionButton`, `CardTabBar`, `FilterBar`, `ContextMenu`,
  `ConfirmDialog`, `glass-panel`, `FrostedBackground`, `Badge`, `DateTimePickerDialog`.
- Forms: `useFormField` + `validators.ts` (return i18n keys) + `CreateContactModal` reference.
- Docs: `DESIGN_SYSTEM_GUIDE.md`, `06-mobile-ui-strategy.md`, `08-ui-ux-roadmap.md`.

**Gaps / inconsistencies (the actual work):**
- G1. `--glass-blur` was `0px` everywhere — "glass" was border/shadow-only, not actually
  frosted. (Fixed in Chunk 1: blur enabled under `[data-surface="glass"]`.)
- G2. Background **blobs** (`.animated-bg`) were always-on → cost + visual noise. (Now scoped
  to flat; orbs via `FrostedBackground` are the glass layer.)
- G3. `PageScaffold` adopted on only 8 pages (Contacts, Attachments, Tasks, Calendar,
  Automation, Invoicing, ERP, plus scaffold file). **Not** on: Dashboard, Campaigns, Mail,
  POS, Vault, Settings sub-pages, Workflows, Accounts, Sync, Deliverability, Assistant.
- G4. Modal/form validation inconsistent — many modals still use silent early-return instead
  of `useFormField`. Reference parity = `CreateContactModal`.
- G5. Empty states: only some pages use `EmptyState`; many show bare "no data" or nothing.
- G6. Mobile `BottomTabBar` is mail-centric (Dashboard/Mail/CRM/Settings) — no Tasks, Calendar,
  Invoicing, ERP entry on phone. Cross-form-factor nav parity is missing.
- G7. Component inventory drift: docs list `TextField` but actual primitive is `useFormField`+
  raw inputs; `ui-tokens.ts` is referenced by docs but EOL/ownership unclear.
- G8. Density switch (compact/normal/relaxed) exists as tokens but no UI to toggle on desktop.
- G9. Command palette / keyboard-first nav exists partially; not unified across surfaces.
- G10. No documented "page template contract" (header height, toolbar, content padding,
  scroll region, focus management) — so pages still drift.

### 1.1 Transitional state (verified 2026-07-13 — IMPORTANT)
The repo is NOT a clean starting point; it was mid-refactor toward flat:
- `src/styles/globals.css` lines **1978–1984** contained:
  `/* Flat theme overrides (2026-07 refactor: bohemi/glass -> flat) */`
  `.animated-bg { display: none !important; }` plus `.liquid-glass::before` / `:hover::before`
  / `-elevated::before` sheen, `.liquid-glow`, and `.liquid-sheen-burst::after` all forced off.
- Blobs were ALSO already hidden on `@media (max-width: 768px)` (mobile) and under
  `@media (prefers-reduced-motion: reduce)` (lines 1611–1624).
- `--glass-blur` / `-heavy` / `-light` were all `0px`, so even the non-blob "frosted" surfaces
  had no actual blur.
- `docs/plans/UI_REFACTOR_2026-07-12.md` proposed exactly this flat direction.

**Consequence for direction choice:**
- **A (Refined Frosted Glass):** the flat override block was scoped to `[data-surface="flat"]`
  so the glass identity is preserved and selectable. Done in Chunk 1.
- **B (Flat Calm):** would KEEP the flat override, delete the now-dead blob/liquid keyframes.
- **C (Hybrid):** KEEP the flat override for blobs, turn blur ON for overlay surfaces only.

This is the single real fork. Everything in sections 2–11 is direction-independent.

## 2. Design Principles (the contract)

1. **Content-first.** Chrome recedes; data leads. Generous whitespace on 8pt grid.
2. **One surface language.** Cards/panels/modals share one depth model (per chosen direction).
3. **Predictable pages.** Every primary page = identical header/toolbar/content/empty anatomy.
4. **Touch + mouse parity.** Same component, different density. No separate mobile widgets.
5. **Errors where they happen.** Inline, translatable, on the field.
6. **Calm motion.** Purposeful transitions; everything respects `prefers-reduced-motion`.
7. **Accessible by default.** 44px touch targets (mobile), visible focus, AA contrast, RTL.

---

## 3. Visual Language (Direction A = Glass surface layer)

### 3.1 Surface model (implemented Chunk 1)
- `<html data-surface="flat">` (default, calm): solid/near-solid surfaces, no orbs, no blur
  beyond subtle. Legacy flat overrides scoped here.
- `<html data-surface="glass">` (opt-in, award look): `FrostedBackground` orbs visible
  (`opacity:1`), real `backdrop-filter: blur()` on `.frost-surface` / `.glass-panel` /
  `.liquid-glass`. Toggle in Settings → Appearance → Surface (Flat | Glass).
- Persisted via theme store (`surface: "flat" | "glass"`), restored on boot and from DB.

### 3.2 Color
- Brand accent (light): `#0b57d0`; hover `#0842a0`; active `#062e70`; subtle `rgba(11,87,208,.08)`.
- Brand accent (dark): `#8ab4f8`. (Already tokenized — keep.)
- Semantic: danger `#e11d48`, warning `#d97706`, success `#059669`, info `#0284c7` (light);
  light-tint variants for badges/surfaces. (Already tokenized — keep.)
- 9 accent themes available (`src/constants/themes.ts`): indigo, rose, emerald, amber, sky,
  violet, orange, slate, frost. Surface layer is independent of accent color.

### 3.3 Typography
- Inter (sans) / JetBrains Mono (mono), modular scale 1.25 (already in `@theme`). Keep.
- `font-scale-small/default/large/xlarge` on `<html>` — wired into Appearance settings.

### 3.4 Spacing & Density
- 8pt grid tokens (already present). Desktop density tokens
  (`--desktop-density-{compact,normal,relaxed}`) exposed via Appearance > Density toggle (G8).
- Mobile uses relaxed density (min 44px tap targets, 16px content padding).

### 3.5 Radius
- Frost radius `24px` (panels), `16px` (sm), `32px` (lg). Keep.

---

## 4. Layout & Navigation Architecture

### 4.1 Shells (keep, extend)
- `DesktopShell` — NavRail + PremiumSidebar + MainWorkspace + WindowTitleBar + status bar.
- `TabletLandscapeShell` — compact icon sidebar + content.
- `PhoneShell` — BottomTabBar + FAB + content; `safe-area-*` insets respected.
- Decision point lives in `MobileShell` via `useScreenInfo()` (already wired). Keep.

### 4.2 Navigation parity (fixes G6)
- Desktop NavRail groups already cover: Dashboard, Mail, CRM, Tasks, Calendar, Automation,
  Invoicing, ERP, Campaigns, Settings, etc. (`navConfig.ts` `NAV_GROUPS`).
- **Mobile BottomTabBar** must expose the top-level primary destinations, NOT just mail.
  Proposed 5-tab phone bar (max 5 for thumb reach):
  1. Dashboard (`/dashboard/mobile`)
  2. Mail (`/mail/inbox`)
  3. CRM/Contacts (`/crm`)
  4. **Hub** (center FAB or "More" sheet) → Tasks / Calendar / Invoicing / ERP / Automation /
     Campaigns via `AdaptiveBottomSheet` (fixes G6 without crowding the bar).
  5. Settings (`/settings/general`)
- Tablet keeps the compact sidebar (already correct).

### 4.3 Page Template Contract (fixes G10)
Every `PageScaffold` page MUST:
- Header: `h1` title (already translated by caller) + optional numeric `count` chip +
  optional one-line `subtitle`; primary `actions` right-aligned.
- Toolbar row (optional): search input + `FilterBar` + view toggles, full-width, sticky.
- Content: single scroll region; `maxWidth` full/xl/2xl/prose.
- Empty: when `isEmpty`, render shared `EmptyState` (icon + title + body + CTA), never bare text.
- Focus: on mount, focus the search input when a toolbar is present (a11y).

---

## 5. Component & Pattern Library (single source of truth)

### 5.1 Mandatory reuse list (do NOT reinvent)
`PageScaffold`, `Button`, `EmptyState` (+`illustrations/GenericEmptyIllustration`),
`AdaptiveTable` (desktop) / `AdaptiveBottomSheet`+list (mobile), `FloatingActionButton`,
`CardTabBar`, `FilterBar`, `ContextMenu`+`ContextMenuPortal`, `ConfirmDialog`,
`DateTimePickerDialog`, `Badge`, `glass-panel` (`GlassPanel`), `FrostedBackground`,
`useFormField` + `validators.ts`.

### 5.2 Form & Validation Standard (fixes G4)
- All modal/inline forms use `useFormField({ validator })` + a `validators.ts` key.
- Inline error: `{f.error && <p className="text-danger text-xs">{t(f.error)}</p>}`.
- Submit disabled until `!f.error` (and required fields non-empty); on submit call `f.onBlur()`.
- Reference implementation: `src/features/contacts/components/CreateContactModal.tsx`.
- Add missing validators as needed (e.g. `phone`, `url`, `requiredIf`) — return i18n keys,
  add the keys to en/ar/fr/it.

### 5.3 Lists & Tables
- Desktop: `AdaptiveTable` (sortable, selectable, sticky header, density-aware).
- Mobile: `AdaptiveBottomSheet`/stacked cards; never a horizontally-scrolling desktop table.
- Row actions: `ContextMenu` (right-click / long-press) — unified across surfaces.

### 5.4 Empty / Loading / Error states
- `EmptyState` (educational: what this page is + primary CTA).
- `CenteredLoader` for initial load; `ErrorState` for failures with retry.
- Skeleton shimmer for list loading (new, lightweight).

### 5.5 Motion
- `PageTransition` for route changes (keep).
- Hover/reveal subtle; all gated by `prefers-reduced-motion` (already wired in globals.css).
- No always-on background animation after direction A/B/C applied.

---

## 6. Mobile-First Adaptations

- BottomTabBar parity (section 4.2). Hub sheet for secondary destinations.
- FAB per page context (e.g. Compose on Mail, New Contact on CRM, New Task on Tasks) — not a
  single global email FAB. Make FAB actions page-aware via a small shell context/event.
- Touch targets >= 44px; inputs comfortable; `AdaptiveBottomSheet` for create/edit forms
  (bottom sheet on phone, centered modal on desktop).
- Safe-area insets (`mobile.css` already handles top/bottom/left/right).
- Pull-to-refresh on list pages (new, optional, respects offline state).
- Offline-first: `OfflineBanner` already exists; ensure every list shows cached state clearly.

## 7. Desktop-First Adaptations

- Density toggle (compact/normal/relaxed) wired to `--desktop-density-*` (G8).
- Keyboard-first: unified command palette (`Cmd/Ctrl+K`) for nav + actions (extend existing).
- Multi-pane where useful (e.g. Mail list+reader, CRM list+detail) — `MainWorkspace` already
  supports split; standardize.
- Status bar shows sync/offline/license state (already partially present).

---

## 8. Accessibility & Internationalization

- AA contrast in both themes; visible focus ring; 44px min touch target (mobile).
- Full RTL: `dir="rtl"` on `<html>` for ar; all layout uses logical properties / flex (no
  hard-coded left/right where avoidable).
- i18n: every string via `t()`; `npm run translate:sync` keeps en/ar/fr/it; exclude `ja`.
- Reduced motion respected globally.

---

## 9. Execution Roadmap (chunks to build AFTER approval)

Each chunk is independently shippable on `dev`, verified by the section 0.2 gate. We build in
this order; you can stop/redirect after any chunk.

**Chunk 1 — Direction lock + Glass surface layer.** Add `surface` to theme store, enable blur
under `[data-surface="glass"]`, scope flat overrides, wire Flat/Glass toggle in Settings
(desktop + mobile), add i18n keys. (DONE — commit 812cc99, tsc delta 0.)

**Chunk 2 — Page Template Contract + audit.** Document the contract (section 4.3) in
`DESIGN_SYSTEM_GUIDE.md`; lint the 8 existing `PageScaffold` pages for compliance; fix drift.

**Chunk 3 — Extend PageScaffold to remaining pages** (Dashboard, Campaigns, Mail surfaces,
POS, Vault, Settings sub-pages, Workflows, Accounts, Sync, Deliverability, Assistant) — bring
each to Contacts parity (header/toolbar/empty). Biggest chunk; can be parallelized per page
with disjoint file ownership.

**Chunk 4 — Form/validation parity.** Convert remaining silent-return modals to `useFormField`
+ inline i18n errors, disabled-until-valid submit. Reference: `CreateContactModal`.

**Chunk 5 — Empty/Loading/Error states.** Ensure every list uses `EmptyState` + `ErrorState`
+ skeleton; add `GenericEmptyIllustration` variants per domain.

**Chunk 6 — Mobile nav parity + page-aware FAB** (section 4.2, 6). Extend `BottomTabBar` + Hub
sheet; make FAB contextual.

**Chunk 7 — Desktop density + command palette + multi-pane standardization** (section 7).

**Chunk 8 — Docs + screenshots.** Update `00-INDEX.md`, `DESIGN_SYSTEM_GUIDE.md`,
`06-mobile-ui-strategy.md`, `08-ui-ux-roadmap.md`; retire `UI_REFACTOR_2026-07-12.md` (mark
superseded); add `12-ui-super-app-spec.md` content (currently empty). Capture before/after
screenshots into `docs/00-SCREENSHOTS`.

**Chunk 9 — Verification sweep.** Full `npx tsc --noEmit` baseline delta 0; `cargo check`;
cross-page visual audit desktop + Android emulator; i18n key sync; CRLF check on edited files.

---

## 10. Open Questions (answer on approval or defer)
- Q1. Direction letter: **A** (locked).
- Q2. Dark-only, light-only, or both? (Both — tokens exist.)
- Q3. Mobile Hub sheet contents — fixed list or user-customizable? (Recommend fixed v1.)
- Q4. Pull-to-refresh + skeleton shimmer — in v1 or later? (Recommend later, low risk.)
- Q5. Should we retire the background blobs entirely (A) or keep one calm ambient layer?
  (A: orbs are the glass layer; blobs removed.)

---

## 11. Files Most Likely Touched
- `src/styles/globals.css` (tokens, blur, blobs, motion)
- `src/shared/theme/themeStore.ts` (+ `src/shared/stores/themeStore.ts` re-export)
- `src/shared/hooks/useWindowInit.ts`, `src/shared/hooks/init/useSettingsRestorer.ts`
- `src/shared/services/commands.ts`, `src/shared/services/settings/configPersistence.ts`
- `src/shared/components/layout/PageScaffold.tsx` (+ contract doc)
- `src/shared/components/layout/shell/{MobileShell,DesktopShell,NavRail,PremiumSidebar,WindowTitleBar,AppearanceSection}.tsx`
- `src/features/mail/components/layout/BottomTabBar.tsx` (mobile nav parity)
- `src/shared/components/ui/{FloatingActionButton,EmptyState,AdaptiveTable,AdaptiveBottomSheet,glass-panel}.tsx`
- `src/shared/hooks/useFormField.ts`, `src/shared/utils/validators.ts`
- Feature pages under `src/features/{dashboard,campaigns,mail,pos,vault,settings,workflows,accounts,sync,deliverability,assistant}/**`
- `src/locales/{en,ar,fr,it}/translation.json` (i18n keys)
- `docs/03-FRONTEND/DESIGN_SYSTEM_GUIDE.md`, `06-mobile-ui-strategy.md`, `08-ui-ux-roadmap.md`,
  `12-ui-super-app-spec.md`; `docs/00-INDEX.md`; `docs/plans/UI_REFACTOR_2026-07-12.md`

---

## 12. Reusable Content Merged from UI_REFACTOR_2026-07-12.md

The consolidated roadmap (`docs/plans/UI_REFACTOR_2026-07-12.md`, dated 2026-07-13) was
folded into this spec as the single source of truth. Verified-against-code facts it got
RIGHT (reuse as-is): the 33-row status dashboard, per-page verdicts, Settings re-section
plan, i18n roadmap, keyboard/shortcut map (`Cmd+K`, `E`/`R`/`S`, `N`, `Cmd+Shift+F`, `Cmd+B`),
skeleton system (`Skeleton.tsx`), and the C1–C10 execution plan. Facts it got STALE
(superseded by this spec / live code): it claims `COLOR_THEMES = ["frost","amber"]` — reality
is **9 accent themes** (`src/constants/themes.ts`, default `frost`); it claims PageScaffold on
"7 pages" (actual: 7 feature pages + scaffold file); it proposes RHF+Zod for validation — the
repo actually uses `useFormField` + `validators.ts` (keep that). Its email-migration section
(C9) is OUT of scope for a design/UI/UX plan and left untouched.

### 12.1 Execution Progress (chunks)
| Chunk | Scope | Commit | Status |
| --- | --- | --- | --- |
| 1 | Glass surface layer + Flat/Glass toggle (Direction A) | 812cc99 | done, tsc delta 0 |
| 2 | Page Template Contract doc + audit existing PageScaffold pages | 0da9436 | done |
| 3 | Extend PageScaffold to remaining pages | - | not started |
| 4 | Form/validation parity | - | not started |
| 5 | Empty/Loading/Error states | - | not started |
| 6 | Mobile nav parity + contextual FAB | - | not started |
| 7 | Desktop density toggle + command palette + multi-pane | - | not started |
| 8 | Docs consolidation | - | not started |
| 9 | Verification sweep | - | not started |

### 12.2 Direction-A note (renaming to avoid collision)
- This spec's "Direction A" = Glass surface layer. The consolidated doc's "Theme A" = Flat,
  "Theme B" = Glass. To avoid future confusion, all new code references
  `[data-surface="flat|glass"]`, never "Theme A/B". Flat is the default; Glass is opt-in.
