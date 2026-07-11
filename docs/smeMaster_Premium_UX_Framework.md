# smeMaster Premium UX Framework

> From Functional to Delightful — A Working Design Philosophy for the smeMaster React+Tauri Desktop App
>
> **Version:** 2026-07-08 | **Scope:** `src/`, `src-tauri/`, `docs/`, `verification/`

---

## How to Use This Document

This is a **living implementation guide**, not a spec. Each section answers three questions:

| Question  | What It Means                                                |
| --------- | ------------------------------------------------------------ |
| **WHY**   | What problem does this solve? What does the user feel?       |
| **WHEN**  | When in the user journey does this matter? What triggers it? |
| **WHERE** | Which file/codebase/module needs the change?                 |

Every action item maps to a real file path in this project. Use the checkboxes during sprints.

---

## Part 1: The Design Contract — A Bold Aesthetic Direction

Before implementing anything, commit to a **single, non-negotiable aesthetic point of view**. Our app already has strong foundations — let's sharpen them.

### Our Aesthetic Direction: **Bohemian Liquid Glass**

| Attribute       | Choice                                                                                                             | Why                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Tone            | Warm industrial with organic softness                                                                              | Desktop tool needs to feel substantial but not cold                               |
| Metaphor        | Frosted glass over layered ambient light                                                                           | Depth without clutter — content sits on multiple glass panes                      |
| Color strategy  | Dominant deep slate + warm amber accent                                                                            | Neutral 90% of the time, amber/orange for energy (not indigo — that's every SaaS) |
| Typography      | **Outfit** (display headings) + **IBM Plex Sans** (body)                                                           | Outfit has geometric warmth, Plex Sans is highly readable at 13px                 |
| Motion          | Spring physics with organic overshoot                                                                              | Feels tactile, not mechanical                                                     |
| Differentiation | The **Ambient Glow** — subtle animated radial gradients behind glass panels that shift slowly like northern lights | Users remember the warmth, not another flat UI                                    |

### Non-Negotiable Rules

1. **Never pure black or pure white** — `bg: #121212`, text: `#e8e6e3` (warm dark mode)
2. **Every interactive element** needs: default → hover → active → focus → disabled states
3. **No spinners** — ever. Replace every one with a skeleton or Nothing (if content is synchronous)
4. **Motion must have purpose** — entrance animations on first load only, not on every re-render
5. **Amber (#d97706) for primary actions** — not blue, not indigo. It's warmer and more human
6. **Lucide icons only** — 18px for inline, 20px for navigation, 24px for empty states

---

## Part 2: Onboarding — The First 60 Seconds

### WHY

The user just installed a desktop app. They have zero trust and zero patience. The onboarding must:

- Give value in <5 seconds (show data, not settings)
- Never ask for login or configuration before showing value
- Survive crashes and tab closes (desktop app behavior)
- End with the user having done something meaningful

### WHEN

| Trigger                                                       | Action                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| First launch (no `smemaster.onboarding.done` in localStorage) | Show full-screen wizard                                                             |
| Tab crash / browser close mid-wizard                          | Restore step from `sessionStorage`                                                  |
| User clicks "Quick Start"                                     | Apply default preset + dismiss wizard immediately                                   |
| User completes wizard                                         | Write `is_initialized` to `app_config` DB table + emit `onboarding:completed` event |

### WHERE

| File                                                 | Responsibility                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `src/features/onboarding/OnboardingScreen.tsx`       | Full-screen wizard container, step navigation, progress sidebar   |
| `src/features/onboarding/steps/WelcomeStep.tsx`      | Business name input + 4 preset cards with lucide icons            |
| `src/features/onboarding/steps/ToolsStep.tsx`        | 6 feature toggles with staggered animations                       |
| `src/features/onboarding/steps/AccountSetupStep.tsx` | GlassPanel card with 3 provider options + Add Account modal       |
| `src/features/onboarding/steps/CompletionStep.tsx`   | Summary card with tool badges + 4 Pro Tips                        |
| `src/features/onboarding/hooks/useOnboarding.ts`     | `completeOnboarding` + `isSystemInitialized` IPC wrappers         |
| `src/features/onboarding/types.ts`                   | `ONBOARDING_STEPS` config, `OnboardingData`, `DemoPreset` types   |
| `src/App.tsx`                                        | Onboarding gate logic, localStorage + sessionStorage coordination |
| `src-tauri/src/orchestrator/onboarding.rs`           | Rust `complete_onboarding` command — writes to `app_config` table |

### Current State & Gaps

```
✅ Wizard shows on first launch
✅ 4-step flow: Welcome → Features → Account → Complete
✅ Progress persisted to sessionStorage (survives crash)
✅ Quick Start works in browser mode (try/catch)
✅ Animations: fadeIn, slideUp, scalePop on steps
✅ Continue disabled until preset selected
✅ Mobile responsive (sidebar hidden on <768px)

❌ Step labels in sidebar say "Language & Profile" for Welcome — verify accuracy
❌ No demo data loaded after completion (empty inbox is a cold start)
❌ No theme/density preference during onboarding (would create instant ownership)
❌ No role-based default tool selection (Solo vs Team vs Sales)
```

### Action Items

- [ ] Verify `ONBOARDING_STEPS[0].description` in `types.ts` says "Language & Profile" or "Business Profile"
- [ ] Add a "seed demo data" step after completion: `invoke("seed_demo_data", { preset })` — creates 5 emails, 3 contacts, 1 campaign
- [ ] Add theme picker to WelcomeStep: "Pick your vibe" — 3 options (Warm Amber, Cool Slate, Focus Dark)
- [ ] Add density preference: Compact / Balanced / Relaxed → stored in `app_config`
- [ ] Verify sessionStorage restore works: close tab at step 2, reopen wizard at step 2

---

## Part 3: The Shell — Chrome That Disappears

### WHY

A super-app with 6 feature domains (mail, CRM, campaigns, calendar, tasks, automation) creates **navigation anxiety**. The shell must let users switch domains in <1 second while making the current domain feel full-screen. Chrome should be a faint frame, not a control panel.

### WHEN

| Trigger                       | Shell Behavior                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| App loads                     | `PremiumSidebar` shows icon rail + selected section panel        |
| User hovers sidebar icon rail | Expand to show label text (expand-on-hover, not click-to-toggle) |
| User switches domain          | Section panel content transitions (not full page reload)         |
| Mobile (<768px)               | Sidebar hidden, `BottomTabBar` visible                           |
| User presses `Cmd+K`          | Command palette overlays everything, search is immediate         |

### WHERE

| File                                                    | Responsibility                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/shared/components/layout/shell/DesktopShell.tsx`   | Full sidebar layout for desktop                                       |
| `src/shared/components/layout/shell/PremiumSidebar.tsx` | Icon rail + content panel with expand-on-hover                        |
| `src/shared/components/layout/shell/MobileShell.tsx`    | Adaptive layout chooser (Phone vs Tablet vs Desktop)                  |
| `src/shared/components/layout/shell/BottomTabBar.tsx`   | Phone bottom navigation (5 tabs)                                      |
| `src/shared/components/layout/shell/AppLayout.tsx`      | 3-pane orchestration: PremiumSidebar + Content + Detail               |
| `src/shared/components/layout/shell/navConfig.ts`       | `NAV_GROUPS` (NavRail) + `ALL_NAV_ITEMS` (mail sidebar)               |
| `src/shared/stores/layoutStore.ts`                      | Zustand: `toggleSidebar`, `toggleTaskSidebar`, `toggleContactSidebar` |
| `src/features/mail/components/layout/BottomTabBar.tsx`  | Mobile bottom tab implementation                                      |

### Current State & Gaps

```
✅ Desktop shell with PremiumSidebar
✅ Mobile BottomTabBar with 5 tabs
✅ Adaptive shell (MobileShell chooses layout by viewport)
✅ AppLayout 3-pane structure
✅ Zustand store for sidebar state
✅ Command palette (Cmd+K)

❌ Sidebar items have no text labels when collapsed — need title/tooltip
❌ No expand-on-hover for icon rail (currently click-to-toggle)
❌ No auto-hide header on scroll in mail/people/tasks views
❌ BottomTabBar icons only — no active section label
```

### Action Items

- [ ] Add `title` attribute or CSS tooltip to collapsed `PremiumSidebar` nav items
- [ ] Implement expand-on-hover: CSS `group-hover:w-[200px]` transition on the icon rail
- [ ] Add `useAutoHideHeader` hook: header slides up on scroll-down, appears on scroll-up
- [ ] Add active route label above `BottomTabBar` on mobile (e.g., "Inbox" above the tabs)
- [ ] Verify 375px: BottomTabBar should be full-width, no sidebar visible

---

## Part 4: Perceived Performance — Never Let Them Wait

### WHY

SQLite queries complete in <5ms. IPC round-trips are <1ms. The **only** reason users see loading states is our code adding unnecessary waits. Every spinner is a bug. Every skeleton that doesn't match the final layout is a broken promise.

### WHEN

| Pattern       | Where                                | Implementation                                      |
| ------------- | ------------------------------------ | --------------------------------------------------- |
| Skeleton page | Lazy-loaded routes (`routeTree.tsx`) | `<Suspense fallback={<SkeletonPage />}>`            |
| Skeleton list | Mail inbox, task list, contact list  | `<SkeletonTable rows={8} />`                        |
| Optimistic UI | Archive, star, snooze, delete        | Update local state immediately, sync in background  |
| Prefetch      | Next page of results                 | IntersectionObserver on last item → load next batch |

### WHERE

| File                                                | Responsibility                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/shared/components/ui/Skeleton.tsx`             | `SkeletonPage`, `SkeletonCard`, `SkeletonTable`, `SkeletonLine`, `SkeletonBlock` |
| `src/router/routeTree.tsx` (line 172)               | Settings lazy-load with `<SkeletonPage />` fallback (just applied)               |
| `src/features/mail/components/EmailList.tsx`        | Thread list with skeleton                                                        |
| `src/features/tasks/hooks/useTaskWorkflowEngine.ts` | Background polling — now silent in browser mode                                  |
| `src/features/tasks/components/TasksPage.tsx`       | Task list with skeleton                                                          |
| `src/features/dashboard/DashboardPage.tsx`          | Dashboard with skeleton                                                          |
| `src/features/dashboard/EntityNetworkGraph.tsx`     | Graph visualization with skeleton                                                |
| `src/features/dashboard/BusinessDashboard.tsx`      | Business metrics with skeleton                                                   |

### Current State & Gaps

```
✅ SkeletonPage exists with pulse animation
✅ Settings lazy-load now uses SkeletonPage (was "Loading settings...")
✅ EmailList has skeleton
✅ TasksPage has skeleton
✅ Dashboard has skeleton
✅ IPC polling silenced in browser mode

❌ CalendarPage — check if it has skeleton (unverified)
❌ CampaignPage — check if it has skeleton (unverified)
❌ HelpPage / SupportPage — check if lazy-loaded with skeleton
❌ No optimistic UI anywhere — archive/star/snooze all wait for IPC response
❌ No IntersectionObserver prefetching for long lists
```

### Action Items

- [ ] Audit all routes in `routeTree.tsx` — add `<SkeletonPage />` fallback to every `lazy()` import
- [ ] Add optimistic `toggleStar(threadId)` in `EmailList.tsx`: update local state immediately, fire IPC in background
- [ ] Add optimistic archive: move email to trash in local state, fire IPC in background
- [ ] Add `IntersectionObserver` to `EmailList.tsx`: when last visible item enters viewport, prefetch next 20
- [ ] Verify IPC polling in `useTaskWorkflowEngine.ts` is silent in browser (Tauri guard added)

---

## Part 5: Glass & Depth — The Tactile Interface

### WHY

The "Bohemian Liquid Glass" aesthetic is our brand fingerprint. On a desktop app, users spend 8+ hours in the interface. The surface quality matters — frosted glass with ambient glow creates a tactile warmth that flat UI cannot match. Users won't notice it consciously, but they'll feel its absence if we switch to flat cards.

### WHEN

| Surface           | Treatment                      | Implementation                                 |
| ----------------- | ------------------------------ | ---------------------------------------------- |
| Settings sidebar  | `GlassPanel variant="sidebar"` | Frosted with 12px blur, subtle border          |
| Task cards        | `GlassPanel variant="card"`    | White 10% border, hover lift                   |
| Contact cards     | `GlassPanel variant="card"`    | Same as tasks, consistent                      |
| Campaign cards    | `GlassPanel variant="card"`    | Same pattern                                   |
| Dashboard widgets | `GlassPanel variant="widget"`  | Slightly more opaque (better data readability) |
| Modals            | `GlassPanel variant="modal"`   | 20px blur + stronger shadow `0 8px 32px`       |
| Ambient glow      | CSS `::before` pseudo-element  | Radial gradient that shifts slowly             |

### WHERE

| File                                                   | Responsibility                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `src/shared/components/ui/glass-panel.tsx`             | 6 variants: `card`, `sidebar`, `widget`, `modal`, `tooltip`, `liquid` |
| `src/features/onboarding/steps/AccountSetupStep.tsx`   | ✅ Already uses GlassPanel                                            |
| `src/features/settings/components/SettingsSidebar.tsx` | 🔲 Should use `GlassPanel variant="sidebar"`                          |
| `src/features/settings/components/SettingsPage.tsx`    | 🔲 Settings tabs content — GlassPanel cards                           |
| `src/features/tasks/components/TasksPage.tsx`          | 🔲 Task cards — replace with GlassPanel                               |

### Current State & Gaps

```
✅ GlassPanel component with 6 variants exists
✅ Onboarding Account step already uses GlassPanel
✅ Tailwind tokens for glass effects (bg-white/10, backdrop-blur)

❌ Settings sidebar uses plain background — should use GlassPanel
❌ Task cards are plain — should use GlassPanel
❌ Contact cards are plain — should use GlassPanel
❌ Campaign cards are plain — should use GlassPanel
❌ No ambient glow effect (subtle animated radial gradient behind content)
❌ No hover lift (shadow-md + scale-102) on cards
```

### Action Items

- [ ] Replace `SettingsSidebar.tsx` plain div with `<GlassPanel variant="sidebar">`
- [ ] Replace task card `<div>` in `TasksPage.tsx` with `<GlassPanel variant="card">`
- [ ] Add hover lift CSS to all `GlassPanel variant="card"` instances: `hover:shadow-md hover:scale-[1.02]`
- [ ] Add ambient glow to `AppLayout.tsx`: absolute-positioned radial gradient `bg-[radial-gradient(ellipse_at_50%_0%,_#d97706_0%,_transparent_50%)]` with slow opacity pulse animation
- [ ] Verify dark mode: GlassPanel should use `bg-slate-900/60` (not pure black) + `border-white/10`

---

## Part 6: Keyboard & Power User — Speed as a Feature

### WHY

Desktop app users are power users by default. If they wanted a web app, they'd use Gmail. They chose smeMaster for speed, privacy, and control. Every action that requires a mouse click instead of a keystroke is a friction point for our core audience.

### WHEN

| Action               | Shortcut            | Discovery                               |
| -------------------- | ------------------- | --------------------------------------- |
| Open command palette | `Cmd+K`             | ✅ Done — `CommandPalette.tsx`          |
| Archive              | `E`                 | ✅ Done                                 |
| Reply                | `R`                 | ✅ Done                                 |
| Star                 | `S`                 | ✅ Done                                 |
| New task             | `N` (in tasks view) | ✅ Done                                 |
| New email            | `N` (in mail view)  | ✅ Done                                 |
| Search               | `Cmd+Shift+F`       | ✅ Done                                 |
| Toggle sidebar       | `Cmd+B`             | ✅ Done — `layoutStore.toggleSidebar()` |

### WHERE

| File                                                     | Responsibility                           |
| -------------------------------------------------------- | ---------------------------------------- |
| `src/features/mail/components/search/CommandPalette.tsx` | Cmd+K palette with search, navigate, act |
| `src/shared/hooks/useKeyboardShortcuts.ts`               | Global shortcut registration             |
| `src/features/settings/components/ShortcutsHelp.tsx`     | Visual shortcut cheatsheet               |
| `src/App.tsx`                                            | Wires shortcut handlers at root level    |

### Current State & Gaps

```
✅ Cmd+K command palette
✅ E/R/S shortcuts for mail
✅ Visual shortcut cheatsheet in ShortcutsHelp
✅ Global shortcut registration

❌ No 500ms-delay hover tooltips showing shortcuts on interactive elements
❌ No custom shortcut remapping page in settings
❌ Command palette results aren't prioritized by usage frequency
❌ No Zen Mode for composer (full-screen focus mode, Esc to exit)
❌ No progressive shortcut hints ("Press N to compose" shown near compose button)
```

### Action Items

- [ ] Add `useShortcutTooltip` hook: on hover 500ms, show tooltip with shortcut key
- [ ] Create `ShortcutRemapping.tsx` in settings: table of all shortcuts with editable inputs
- [ ] Prioritize `Cmd+K` results: bump most-used actions to top (track usage count in localStorage)
- [ ] Implement Zen Mode in composer: full-screen overlay, everything hidden except editor, `Esc` to exit
- [ ] Add progressive hint: first 3 times user clicks compose button, show "Tip: Press N to compose"

---

## Part 7: Dashboard — Mission Control in 5 Seconds

### WHY

The dashboard is where users start every session. They need to know business health in 5 seconds and drill into a problem in 5 more. Currently, the dashboard shows a widget grid with no **hero metric** — no single number that tells the story at a glance.

### WHEN

| Viewport            | Layout               | Hero Metric           |
| ------------------- | -------------------- | --------------------- |
| Desktop (>1024px)   | 3-column widget grid | Top-center, 2x size   |
| Tablet (768-1024px) | 2-column widget grid | Still top, full-width |
| Mobile (<768px)     | 1-column stack       | Still top, full-width |

### WHERE

| File                                            | Responsibility                                |
| ----------------------------------------------- | --------------------------------------------- |
| `src/features/dashboard/DashboardPage.tsx`      | Dashboard container, hero metric, widget grid |
| `src/features/dashboard/EntityNetworkGraph.tsx` | Graph visualization widget                    |
| `src/features/dashboard/BusinessDashboard.tsx`  | Business metrics widget                       |

### Current State & Gaps

```
✅ Dashboard renders with widget grid
✅ Skeleton loading on all dashboard pages
✅ EntityNetworkGraph and BusinessDashboard exist

❌ No hero metric — no "one big number" at the top
❌ No 5-second health check — user must scan multiple widgets
❌ No empty states with CTAs on widgets
❌ No quick actions widget (compose, create contact, schedule)
```

### Action Items

- [ ] Add hero metric to `DashboardPage.tsx` above the widget grid: one big KPI number with trend sparkline and semantic color (green/amber/red)
- [ ] Add `QuickActionsWidget` with 4 buttons: Compose, Create Contact, New Campaign, Schedule Meeting
- [ ] Add empty states to every widget: skeleton → empty (icon + text + CTA button) → error → data
- [ ] Implement 5-second rule: hero metric + 3 most important widgets visible above the fold

---

## Part 8: Settings — The Forgotten UX

### WHY

Settings pages are where UX goes to die. They're usually an afterthought — endless form fields, inconsistent spacing, no hierarchy. A premium app's settings page must feel as polished as the main interface because **power users spend hours configuring their tools**.

### WHEN

| Action               | Experience                                                       |
| -------------------- | ---------------------------------------------------------------- |
| Navigate to settings | `/<SkeletonPage />` while lazy-loading                           |
| Switch tabs          | Smooth horizontal slide transition (not flash-replace)           |
| Toggle a setting     | Spring animation on switch, immediate visual feedback            |
| Save                 | No save button — auto-save on change (debounced 500ms)           |
| Reset onboarding     | Confirmation dialog → clear `app_config` + localStorage → reload |

### WHERE

| File                                                   | Responsibility                                      |
| ------------------------------------------------------ | --------------------------------------------------- |
| `src/router/routeTree.tsx` (line 166-179)              | Settings lazy-load with `<SkeletonPage />` fallback |
| `src/features/settings/components/SettingsPage.tsx`    | Main settings with tab container                    |
| `src/features/settings/components/SettingsSidebar.tsx` | Settings tab sidebar                                |
| `src/features/settings/pages/MobileSettingsPage.tsx`   | Mobile-optimized settings                           |
| `src/shared/services/settings/settingsService.ts`      | Settings CRUD operations                            |

### Current State & Gaps

```
✅ Settings lazy-loaded with SkeletonPage fallback (just applied)
✅ SettingsSidebar with tab navigation
✅ SettingsPage with tab switching
✅ MobileSettingsPage for phone layout

❌ No smooth tab transitions (current: flash-replace)
❌ No auto-save on toggle (may require explicit save button)
❌ SettingsSidebar not using GlassPanel
❌ No search in settings
```

### Action Items

- [ ] Add horizontal slide transition on tab switch: `animate-slideInRight 200ms` on content change
- [ ] Implement auto-save: debounce 500ms on input change, immediate save on toggle/switch
- [ ] Replace `SettingsSidebar.tsx` plain background with `<GlassPanel variant="sidebar">`
- [ ] Add settings search: filter tab list + highlight matching terms

---

## Part 9: Mobile Adaptation — Desktop-First, Mobile-Aware

### WHY

smeMaster is a desktop app. But users want to check email on their phone, glance at tasks, or read a campaign report. The mobile experience doesn't need parity — it needs **utility**. Let users do the 20% of actions that cover 80% of mobile use cases.

### WHEN

| Breakpoint | Layout                                                        | Behavior                                |
| ---------- | ------------------------------------------------------------- | --------------------------------------- |
| >1024px    | Full desktop: PremiumSidebar + content + optional detail pane | All features                            |
| 768-1024px | Tablet: collapsed sidebar + content                           | Mail, Tasks, Calendar readable          |
| <768px     | Phone: BottomTabBar + single pane                             | Quick actions: read, reply, check tasks |

### WHERE

| File                                                   | Responsibility           |
| ------------------------------------------------------ | ------------------------ |
| `src/shared/components/layout/shell/MobileShell.tsx`   | Adaptive layout chooser  |
| `src/shared/components/layout/shell/BottomTabBar.tsx`  | Phone bottom navigation  |
| `src/shared/components/layout/shell/mobile.css`        | Mobile-specific styles   |
| `src/features/mail/components/layout/BottomTabBar.tsx` | Mail-specific bottom tab |

### Current State & Gaps

```
✅ MobileShell adapts by viewport
✅ BottomTabBar with 5 tabs
✅ Mobile CSS with thumb-friendly spacing

❌ No hamburger menu (intentional — BottomTabBar replaces it)
❌ No active route label above BottomTabBar
❌ Sidebar hidden on mobile — verify all navigation is accessible through tabs
❌ Mobile breakpoint audit needed at 375px, 768px, 1024px
```

### Action Items

- [ ] Add active route label above `BottomTabBar` (e.g., "Inbox" label above the mail tab icon)
- [ ] Audit every page at 375px: take screenshot, verify all content is accessible
- [ ] Audit every page at 768px: sidebar should show icon rail only (no text)
- [ ] Test mobile: navigate mail → tasks → settings → back to mail — verify no broken transitions

---

## Part 10: The Adjacent Possible — What We Build Next

### WHY

A framework is only useful if it tells you what NOT to build. These are the features we're explicitly deferring, with the conditions that would change their priority.

### Deferred Features

| Feature                   | Why Deferred                                     | Trigger for Reconsideration                        |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Native audio feedback     | Complex: needs Rust audio backend + user testing | User feedback requests it explicitly (>5 requests) |
| Drag-reorder for tasks    | Requires react-dnd or similar, adds complexity   | Tasks tab becomes top-3 used feature               |
| Full calendar drag-create | Calendar already works, drag is polish           | Calendar adoption >30% of users                    |
| Plugin system             | Architectural change, needs module federation    | Feature request from power users                   |
| Custom CSS injection      | Security risk in Tauri context                   | Requested by developers specifically               |

### Always-On Principles

| Principle                   | Why Always-On                           |
| --------------------------- | --------------------------------------- |
| Accessibility (WCAG 2.1 AA) | Legal requirement, also helps all users |
| Keyboard shortcuts          | Core to desktop app identity            |
| Offline-first               | Fundamental architecture, not a feature |
| Glass aesthetics            | Brand fingerprint                       |
| No data lock-in             | Trust requirement for desktop software  |

---

## Appendix A: Action Item Tracker — Sorted by Impact

### High Impact (Do These First)

- [x] **P1:** Add hero metric to Dashboard — one big KPI number with trend
- [x] **P1:** Replace plain cards with GlassPanel in Settings sidebar, task cards, campaign cards
- [x] **P1:** Add optimistic UI to archive/star (star/archive already have it; snooze still pending)
- [x] **P1:** Add 500ms-delay shortcut tooltips on all interactive elements (hook created)
- [x] **P1:** Verify all lazy-loaded routes use `<SkeletonPage />` fallback

### Medium Impact (Next Sprint)

- [ ] **P2:** Add auto-hide header on scroll mail/people/tasks views
- [x] **P2:** Add ambient glow effect to mobile shell (PhoneShell)
- [ ] **P2:** Implement expand-on-hover for PremiumSidebar icon rail
- [x] **P2:** Add active route label above BottomTabBar on mobile
- [ ] **P2:** Implement Zen Mode for composer
- [ ] **P2:** Add empty states with CTAs to dashboard widgets

### Low Impact (Nice to Have)

- [ ] **P3:** Add custom shortcut remapping page in settings
- [ ] **P3:** Add settings search
- [ ] **P3:** Prioritize Cmd+K results by usage frequency
- [ ] **P3:** Add progressive shortcut hints ("Tip: Press N to compose")
- [ ] **P3:** Add celebration states (Inbox Zero, Task Complete)

---

## Appendix B: File Inventory — Quick Reference

```
Core Shell
  src/shared/components/layout/shell/
    DesktopShell.tsx          — Full desktop sidebar layout
    PremiumSidebar.tsx        — Icon rail + content panel
    MobileShell.tsx           — Adaptive layout chooser
    AppLayout.tsx             — 3-pane orchestration
    BottomTabBar.tsx          — Phone bottom nav
    navConfig.ts              — NAV_GROUPS + ALL_NAV_ITEMS
    mobile.css                — Mobile styles

Onboarding
  src/features/onboarding/
    OnboardingScreen.tsx      — Full-screen wizard
    steps/WelcomeStep.tsx     — Preset selection
    steps/ToolsStep.tsx       — Feature toggles
    steps/AccountSetupStep.tsx— Email connection
    steps/CompletionStep.tsx  — Summary + tips
    hooks/useOnboarding.ts    — IPC wrappers
    types.ts                  — Types + step config

Settings
  src/features/settings/
    components/SettingsPage.tsx       — Main settings
    components/SettingsSidebar.tsx    — Tab sidebar
    pages/MobileSettingsPage.tsx      — Mobile settings
  src/router/routeTree.tsx            — Lazy-load wrapper

Dashboard
  src/features/dashboard/
    DashboardPage.tsx         — Widget grid
    EntityNetworkGraph.tsx    — Graph viz
    BusinessDashboard.tsx     — Business metrics

Shared UI
  src/shared/components/ui/
    Skeleton.tsx              — SkeletonPage, SkeletonCard, etc.
    glass-panel.tsx           — 6 GlassPanel variants
    ErrorBoundary.tsx         — Error boundary

Routing
  src/router/
    routeTree.tsx             — All routes + Suspense boundaries
    navigate.ts               — Navigation helpers

State
  src/shared/stores/
    layoutStore.ts            — Sidebar, task sidebar, contact sidebar toggles
```

---

_This is a living document. Every PR that touches UX should update the relevant section. Every sprint planning should reference the action item tracker._
