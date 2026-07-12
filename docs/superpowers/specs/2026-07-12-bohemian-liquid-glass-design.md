# Bohemian Liquid Glass: UX Polish + Onboarding Fixes

**Date:** 2026-07-12
**Status:** Approved — ready for implementation planning
**Approach:** A (Full commitment) — complete Bohemian Liquid Glass direction

---

## Problem

SMEMaster has a strong "Frosted Glass" design system, but it hasn't committed to the bolder "Bohemian Liquid Glass" direction proposed in `docs/smeMaster_Premium_UX_Framework.md`. Specific gaps:

1. **Color tension** — Framework wants warm amber `#d97706`; codebase default is cool Frosted Blue `#0B57D0`. Two docs disagree.
2. **No Ambient Glow** — the single most distinctive proposed feature (slow-shifting radial gradients, "northern lights") is absent.
3. **Single-family typography** — Inter alone; no display/headings typeface for hierarchy contrast.
4. **Spinners still exist** — contradicts the Framework's "no spinners ever" rule.
5. **Shadow token debt** — `--glass-shadow-elevated` referenced 3 times but never defined; 28 `box-shadow` usages contradict the "border-based depth only" principle.
6. **Plain div cards** — tasks/contacts/campaigns/settings-sidebar still use plain `<div>` instead of `GlassPanel`.
7. **Onboarding state inconsistency** — no Zustand store (violates project convention); normal finalize path leaves empty inbox; dead `useSeedOnFirstRun` hook; stale doc references.
8. **No dashboard hero KPI** — the highest-impact UX elevation per the Framework.

## Solution

### 1. Commit to amber color direction

**Files:** `src/constants/themes.ts`, `src/styles/globals.css`

- Make `amber` the first/default theme in `themes.ts` (move before `frost`)
- Update `--color-accent` default in `globals.css` `@theme` block to `#d97706`
- Update hover (`#B45309`), active (`#92400E`), tint (`#FEF3C7`), subtle (`rgba(217,119,6,0.08)`)
- Warm-slate neutrals: light bg `#e8e6e3` (not pure white), dark bg `#121212` (not pure black)
- Dark mode accent: `#FBBF24` (lighter amber)
- Keep `frost` (blue) as a selectable theme option — users who want the old look can switch back
- Update `FrostedBackground` orb colors to warm tones (amber, rose, violet — not blue/purple/pink)

### 2. Ambient Glow component

**New file:** `src/shared/components/ui/AmbientGlow.tsx`

- 3-4 absolute-positioned radial-gradient divs, each `~600px` diameter
- Colors: accent-tinted (`rgba(217,119,6,0.15)`, `rgba(244,63,94,0.10)`, `rgba(139,92,246,0.08)`)
- Slow position drift via CSS `@keyframes ambient-glow-drift` (8-12s cycle, different offsets per glow)
- `aria-hidden`, `pointer-events: none`
- Auto-hidden on mobile (`<=768px`) and `prefers-reduced-motion`
- Rendered in `AppLayout.tsx` as first child (behind content, above `FrostedBackground`)

**File:** `src/styles/globals.css` — add `@keyframes ambient-glow-drift` + `.ambient-glow` utility classes

### 3. Typography upgrade — Outfit + Inter

**Files:** `src/styles/globals.css`, `index.html` (or font loading approach)

- Load **Outfit** font (Google Fonts `@import` or `@fontsource/outfit` npm package)
- `globals.css` `@theme` block: add `--font-display: 'Outfit', sans-serif`
- Add `.font-display` utility class — applies `font-family: var(--font-display)`
- Apply to: H1, H2, hero metric numbers, sidebar logo text, onboarding step titles
- Keep Inter for body text, inputs, buttons, labels
- RTL: Outfit supports Latin + Cyrillic; for Arabic, keep `Tajawal`

### 4. No spinners — replace all with skeletons

**Audit and replace:**
- `src/shared/components/ui/Spinner.tsx` — deprecate (add `/** @deprecated Use Skeleton instead */` JSDoc)
- `src/shared/components/ui/Button.tsx` loading state — replace spinner with shimmer animation on the button itself (opacity pulse + shimmer sweep)
- `Loader2 animate-spin` usages in `PremiumSidebar.tsx` and elsewhere — replace with `Skeleton` matching the final layout shape
- `CenteredLoader.tsx` — replace spinner with a skeleton block matching the page layout

**New pattern:** `Skeleton` already exists at `src/shared/components/ui/Skeleton.tsx`. Add a `SkeletonText` variant (multiple lines) and `SkeletonCard` variant (card-shaped).

### 5. GlassPanel migration

**Audit and replace plain `<div>` cards:**
- `src/features/tasks/components/TaskItem.tsx`, `TaskKanbanCard.tsx`, `TaskCalendarDay.tsx`
- `src/features/settings/components/SettingsSidebar.tsx` (sidebar items)
- `src/features/mail/components/ThreadCard.tsx` (if not already using GlassPanel)
- Any `rounded-lg border bg-bg-primary` patterns → `<GlassPanel variant="card" className="hover:shadow-md hover:scale-[1.02] transition-all">`

### 6. Shadow token debt fix

**File:** `src/styles/globals.css`

- Define `--glass-shadow-elevated: 0 8px 32px rgba(0,0,0,0.12)` in the `@theme` block (for overlays only)
- Audit all 28 `box-shadow` usages:
  - Card/panel elevations → replace with `--frost-border` / `--frost-border-strong` (border-based depth)
  - Hover lift (`hover-lift`, `interactive-btn`, `settings-card:hover`) → replace with `border-t-accent` or `--frost-border-strong`
  - Keep `box-shadow` for: modals (`.modal-*`), dropdowns (`.mention-popup`, `.context-menu-*`), floating indicators (`.offline-queue-indicator`)
- Fix the 3 undefined `--glass-shadow-elevated` references (lines 1340, 1651, 1696)

### 7. Onboarding fixes

**New file:** `src/features/onboarding/stores/onboardingStore.ts`

```typescript
interface OnboardingState {
  step: number;
  data: OnboardingData;
  isCompleted: boolean;
  isDismissed: boolean;
  // Actions
  setStep: (step: number) => void;
  updateData: (partial: Partial<OnboardingData>) => void;
  complete: () => void;
  dismiss: () => void;
  reset: () => void;
}
```
- Zustand store with `persist` middleware (localStorage for instant hydration)
- Move state from `App.tsx` `useState`/`useLocalStorage` to this store
- `App.tsx` reads `useOnboardingStore(s => s.isCompleted)` + `isDismissed` for the gate
- `OnboardingScreen.tsx` reads/writes `step` and `data` from the store

**Demo seeding on finalize:**
- In `OnboardingScreen.tsx` `handleFinalize()`: after `finalizeOnboarding()`, call `seedDemoPreset(selectedPreset, ...)` if a preset was selected
- This ensures the normal completion path (not just "Skip to Demos") seeds demo data
- The `seedDemoPreset` call is async; show a brief "Setting up your workspace..." loading state before `onComplete()`

**Doc fixes:**
- `docs/PRODUCTION-READINESS.md` line 219: `OnboardingWizard.tsx` → `OnboardingScreen.tsx`
- `docs/smeMaster_Premium_UX_Framework.md`: `OnboardingWizard.tsx` → `OnboardingScreen.tsx`, "6 feature toggles" → "5 feature toggles"

**Dead code removal:**
- Remove `src/shared/hooks/init/useSeedOnFirstRun.ts` (no-op stub)
- Simplify `useAppInit.ts` to remove the call to it

### 8. Dashboard hero KPI

**File:** Dashboard page component (find via `src/features/dashboard/`)

- Add a hero metric section above the widget grid:
  - One large number (e.g. "47 emails today" or "12 tasks completed")
  - Trend sparkline (simple SVG `polyline` or `recharts` `Sparkline`)
  - Semantic color: green for positive trend, red for negative
  - `font-display` class on the number, `text-4xl` size
- Wrapped in `GlassPanel variant="elevated"` with `glow` prop

## Testing

### TypeScript tests
- `onboardingStore.test.ts`: state transitions (setStep, updateData, complete, reset); persist behavior
- `AiTab.test.tsx`: (covered by AI/RAG spec)
- Visual snapshot: `GlassPanel` variants, `AmbientGlow` (hidden on mobile/reduced-motion)

### Manual tests
- Toggle amber theme → verify across all screens (mail, settings, dashboard, onboarding)
- Check RTL: amber + Arabic locale → no broken layouts
- Complete onboarding normally → verify demo data seeded (emails, contacts, campaign visible)
- Load app with reduced-motion → AmbientGlow hidden, no spinners visible
- Dashboard → hero KPI renders with correct trend color

## Files Modified

| Layer | File | Change |
|-------|------|--------|
| Tokens | `src/styles/globals.css` | Amber default, `--font-display`, `--glass-shadow-elevated`, ambient-glow keyframes, box-shadow audit |
| Themes | `src/constants/themes.ts` | Move `amber` to first/default |
| New component | `src/shared/components/ui/AmbientGlow.tsx` | New — radial gradient ambient layer |
| Layout | `src/shared/components/layout/shell/AppLayout.tsx` | Render `AmbientGlow` |
| Background | `src/shared/components/ui/FrostedBackground.tsx` | Update orb colors to warm tones |
| Typography | `index.html` or `src/styles/globals.css` | Load Outfit font |
| Button | `src/shared/components/ui/Button.tsx` | Loading state → shimmer instead of spinner |
| Skeleton | `src/shared/components/ui/Skeleton.tsx` | Add `SkeletonText`, `SkeletonCard` variants |
| Spinner | `src/shared/components/ui/Spinner.tsx` | Deprecate with JSDoc |
| CenteredLoader | `src/shared/components/ui/CenteredLoader.tsx` | Replace spinner with skeleton |
| Sidebar | `src/shared/components/layout/shell/PremiumSidebar.tsx` | Replace `Loader2` with skeleton |
| GlassPanel | `src/shared/components/ui/glass-panel.tsx` | (No change — existing component is used) |
| Tasks | `src/features/tasks/components/TaskItem.tsx` etc. | Migrate to `GlassPanel variant="card"` |
| Settings sidebar | `src/features/settings/components/SettingsSidebar.tsx` | Migrate to `GlassPanel` |
| New store | `src/features/onboarding/stores/onboardingStore.ts` | New — Zustand store for onboarding state |
| Onboarding | `src/features/onboarding/OnboardingScreen.tsx` | Use store; seed on finalize |
| App | `src/App.tsx` | Read from onboardingStore instead of useState |
| Dashboard | Dashboard page component | Add hero KPI section |
| Dead code | `src/shared/hooks/init/useSeedOnFirstRun.ts` | Remove |
| Init | `src/shared/hooks/useAppInit.ts` | Remove useSeedOnFirstRun call |
| Docs | `docs/PRODUCTION-READINESS.md` | Fix OnboardingWizard→OnboardingScreen |
| Docs | `docs/smeMaster_Premium_UX_Framework.md` | Fix filename + toggle count |

## Dependencies

- `@fontsource/outfit` (npm) — for the Outfit display font (or Google Fonts `@import` in `globals.css`)
- No other new dependencies

## Risks

1. **Amber theme contrast** — amber `#d97706` on light bg needs AA contrast check for text. Solution: use amber for accents/borders/active states, not for body text. Body text stays slate.
2. **Outfit font loading** — adds a network request. Solution: `font-display: swap` so Inter renders first, Outfit swaps in.
3. **Skeleton mismatch** — skeletons must match final layout shape or the "broken promise" principle is violated. Solution: each skeleton variant is purpose-built for its page section.
4. **Onboarding store migration** — existing users have `localStorage["smemaster.onboarding.done"]=true`. The Zustand `persist` middleware must read this key for backward compat.
