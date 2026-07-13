# smeMaster — Design / UI / UX Specification (Mobile + Desktop)

> **For Hermes:** This is an APPROVAL document, not an execution plan. Build it in chunks
> only after the user signs off Section 0 (direction). Execution chunks are enumerated in
> Section 9 as bite-sized tasks; each chunk becomes its own `feat(design):` / `docs:`
> commit on `dev`.

**Status:** DRAFT for approval
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
- **C — "Hybrid":** Flat content areas + frosted overlays (modals/sheets/command palette).
  Calm by default, glass only where it earns its keep.

> My recommendation is **A** because the investment in the current system is real, the brand
> is already coherent, and turning on blur + taming motion is far cheaper than a rebuild — and
> gets us to "award-quality" without throwing away working code. Confirm A/B/C below.

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

**APPROVAL (locked default = A, pending explicit confirm):**
The direction question timed out. Per fallback I lock the **recommended default = A
(Refined Frosted Glass)** — it matches the stated "award-winning glassmorphism" quality bar
and reuses the existing investment. HOWEVER, see §1 "Transitional state" — the repo ALREADY
carries a partial flat-refactor (globals.css lines 1978–1984 disable blobs + liquid effects
globally). So **Chunk 1 (the visual token pass) is HELD** until you explicitly confirm the
letter, because choosing A means reverting an already-applied change while B means finishing
it. Chunks 2–9 are direction-independent and can start once the plan is approved.

Reply with the letter (A/B/C) — or "go with A" / "go with B" / "go with C" — and I'll execute.
If you stay silent, I proceed with A and start Chunks 2–9 (consistency work), leaving Chunk 1
for your sign-off.

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
- G1. `--glass-blur: 0px` everywhere → "glass" is currently fake. Blur not actually applied.
- G2. Background **blobs** (`.animated-bg`, 6 orbiting orbs) run always-on → cost + visual noise.
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

---

### 1.1 Transitional state (verified 2026-07-13 — IMPORTANT)
The repo is NOT a clean starting point; it is mid-refactor toward flat:
- `src/styles/globals.css` lines **1978–1984** contain:
  `/* Flat theme overrides (2026-07 refactor: bohemi/glass -> flat) */`
  `.animated-bg { display: none !important; }` plus `.liquid-glass::before` / `:hover::before`
  / `-elevated::before` sheen, `.liquid-glow`, and `.liquid-sheen-burst::after` all forced off.
- Blobs are ALSO already hidden on `@media (max-width: 768px)` (mobile) and under
  `@media (prefers-reduced-motion: reduce)` (lines 1611–1624).
- `--glass-blur` / `-heavy` / `-light` are all `0px`, so even the non-blob "frosted" surfaces
  have no actual blur.
- `docs/plans/UI_REFACTOR_2026-07-12.md` proposed exactly this flat direction, but its own text
  says "execution starts only after the user approves" — yet the override is already applied,
  implying either prior approval or an over-eager subagent.

**Consequence for direction choice:**
- **A (Refined Frosted Glass):** requires REMOVING the flat override block (lines 1978–1984),
  re-asserting the glass identity, and turning blur ON. Reverts an applied change.
- **B (Flat Calm):** KEEP the flat override, delete the now-dead blob/liquid keyframes + defs,
  set `--glass-blur: 0`, finish the prior refactor, update the (now-stale) DESIGN_SYSTEM_GUIDE.
- **C (Hybrid):** KEEP the flat override for blobs, but turn blur ON for overlay surfaces
  (modals/sheets/command palette) only.

This is the single real fork. Everything in §2–§11 is direction-independent.

## 2. Design Principles (the contract)

1. **Content-first.** Chrome recedes; data leads. Generous whitespace on 8pt grid.
2. **One surface language.** Cards/panels/modals share one depth model (per chosen direction).
3. **Predictable pages.** Every primary page = identical header/toolbar/content/empty anatomy.
4. **Touch + mouse parity.** Same component, different density. No separate mobile widgets.
5. **Errors where they happen.** Inline, translatable, on the field.
6. **Calm motion.** Purposeful transitions; everything respects `prefers-reduced-motion`.
7. **Accessible by default.** 44px touch targets (mobile), visible focus, AA contrast, RTL.

---

## 3. Visual Language (per approved direction)

### 3.1 Color
- Brand accent (light): `#0b57d0`; hover `#0842a0`; active `#062e70`; subtle `rgba(11,87,208,.08)`.
- Brand accent (dark): `#8ab4f8`. (Already tokenized — keep.)
- Semantic: danger `#e11d48`, warning `#d97706`, success `#059669`, info `#0284c7` (light);
  light-tint variants for badges/surfaces. (Already tokenized — keep.)
- Surfaces: tokenized `--color-bg-{primary,secondary,tertiary,hover,selected,elevated}` +
  `--color-frost-*`. (Keep; only the *blur* + *blob* treatment changes per direction.)

### 3.2 Typography
- Inter (sans) / JetBrains Mono (mono), modular scale 1.25 (already in `@theme`). Keep.
- `font-scale-small/default/large/xlarge` on `<html>` — wire into Appearance settings (G8).

### 3.3 Depth & Motion (direction-dependent)
- **A:** enable real blur (`--glass-blur: 12px`, `--glass-blur-heavy: 20px`,
  `--glass-blur-light: 8px`), constrain blobs to a single static/very-slow ambient layer (or
  remove), keep liquid sheen only on `GlassPanel variant="liquid"` modals/hero, gated by
  reduced-motion.
- **B:** `--glass-blur: 0`, remove blobs + liquid keyframes, rely on 1px borders + 1–2px shadow.
- **C:** blur only on overlay surfaces (`Modal`, `AdaptiveBottomSheet`, command palette).

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

- BottomTabBar parity (§4.2). Hub sheet for secondary destinations.
- FAB per page context (e.g. Compose on Mail, New Contact on CRM, New Task on Tasks) — not a
  single global email FAB. Make FAB actions page-aware via a small shell context/event.
- Touch targets ≥ 44px; inputs comfortable; `AdaptiveBottomSheet` for create/edit forms
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

Each chunk is independently shippable on `dev`, verified by the §0.2 gate. We build in this
order; you can stop/redirect after any chunk.

**Chunk 1 — Direction lock + token pass.** Apply chosen A/B/C to globals.css (blur values,
blob treatment, motion gating). Update `DESIGN_SYSTEM_GUIDE.md` to match reality (fix G7).
Verification: `cargo check` n/a; `npx tsc --noEmit` delta 0; visual diff in `tauri:dev`.

**Chunk 2 — Page Template Contract + audit.** Document the contract (§4.3) in
`DESIGN_SYSTEM_GUIDE.md`; lint the 8 existing `PageScaffold` pages for compliance; fix drift.

**Chunk 3 — Extend PageScaffold to remaining pages** (Dashboard, Campaigns, Mail surfaces,
POS, Vault, Settings sub-pages, Workflows, Accounts, Sync, Deliverability, Assistant) — bring
each to Contacts parity (header/toolbar/empty). Biggest chunk; can be parallelized per page
with disjoint file ownership.

**Chunk 4 — Form/validation parity.** Convert remaining silent-return modals to `useFormField`
+ inline i18n errors, disabled-until-valid submit. Reference: `CreateContactModal`.

**Chunk 5 — Empty/Loading/Error states.** Ensure every list uses `EmptyState` + `ErrorState` +
skeleton; add `GenericEmptyIllustration` variants per domain.

**Chunk 6 — Mobile nav parity + page-aware FAB** (§4.2, §6). Extend `BottomTabBar` + Hub sheet;
make FAB contextual.

**Chunk 7 — Desktop density + command palette + multi-pane standardization** (§7).

**Chunk 8 — Docs + screenshots.** Update `00-INDEX.md`, `DESIGN_SYSTEM_GUIDE.md`,
`06-mobile-ui-strategy.md`, `08-ui-ux-roadmap.md`; retire `UI_REFACTOR_2026-07-12.md` (mark
superseded); add `12-ui-super-app-spec.md` content (currently empty). Capture before/after
screenshots into `docs/00-SCREENSHOTS`.

**Chunk 9 — Verification sweep.** Full `npx tsc --noEmit` baseline delta 0; `cargo check`;
cross-page visual audit desktop + Android emulator; i18n key sync; CRLF check on edited files.

---

## 10. Open Questions (answer on approval or defer)
- Q1. Direction letter: **A / B / C**?
- Q2. Dark-only, light-only, or both? (Recommend both — tokens exist.)
- Q3. Mobile Hub sheet contents — fixed list or user-customizable? (Recommend fixed v1.)
- Q4. Pull-to-refresh + skeleton shimmer — in v1 or later? (Recommend later, low risk.)
- Q5. Should we retire the background blobs entirely (A) or keep one calm ambient layer?

---

## 11. Files Most Likely Touched
- `src/styles/globals.css` (tokens, blur, blobs, motion)
- `src/shared/components/layout/PageScaffold.tsx` (+ contract doc)
- `src/shared/components/layout/shell/{MobileShell,DesktopShell,NavRail,PremiumSidebar,WindowTitleBar}.tsx`
- `src/features/mail/components/layout/BottomTabBar.tsx` (mobile nav parity)
- `src/shared/components/ui/{FloatingActionButton,EmptyState,AdaptiveTable,AdaptiveBottomSheet,glass-panel}.tsx`
- `src/shared/hooks/useFormField.ts`, `src/shared/utils/validators.ts`
- Feature pages under `src/features/{dashboard,campaigns,mail,pos,vault,settings,workflows,accounts,sync,deliverability,assistant}/**`
- `docs/03-FRONTEND/DESIGN_SYSTEM_GUIDE.md`, `06-mobile-ui-strategy.md`, `08-ui-ux-roadmap.md`,
  `12-ui-super-app-spec.md`; `docs/00-INDEX.md`; `docs/plans/UI_REFACTOR_2026-07-12.md`
