# Frosted Glass Design System — SMEMaster

> **Source of truth** for tokens, components, layouts, and visual patterns.
> **Stack:** React 19 · Tailwind CSS v4 · TypeScript · Zustand · Tauri
> **Theme:** Frosted Glass — translucent surfaces, border-based depth, fluid animated orbs, 24dp corner radius
> **Tokens defined in:** `src/styles/globals.css` · `src/shared/styles/ui-tokens.ts`

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Layout Architecture](#2-layout-architecture)
3. [Navigation System](#3-navigation-system)
4. [Page Templates & States](#4-page-templates--states)
5. [Component Inventory](#5-component-inventory)
6. [UI Element States](#6-ui-element-states)
7. [Action Workflows](#7-action-workflows)
8. [Mobile Adaptations](#8-mobile-adaptations)
9. [Desktop Adaptations](#9-desktop-adaptations)
10. [Accessibility](#10-accessibility)
11. [Performance Guidelines](#11-performance-guidelines)

---

## 1. Design Tokens

All CSS tokens are defined in `src/styles/globals.css` via Tailwind's `@theme` block and consumed through Tailwind utility classes or CSS custom properties.

### 1.1 Frosted Glass Color Palette

**Light Mode (default)**

| Token                      | Value                       | Usage                                |
| -------------------------- | --------------------------- | ------------------------------------ |
| `--color-accent`           | `#0B57D0`                   | Primary accent (Frosted Blue)        |
| `--color-accent-hover`     | `#0842A0`                   | Accent hover state                   |
| `--color-accent-active`    | `#062E70`                   | Accent active/pressed state          |
| `--color-accent-light`     | `#D3E3FD`                   | Accent tint (backgrounds, pills)     |
| `--color-accent-subtle`    | `rgba(11, 87, 208, 0.08)`   | Accent subtle background             |
| `--color-danger`           | `#E11D48`                   | Errors, destructive actions          |
| `--color-warning`          | `#D97706`                   | Warnings, caution                    |
| `--color-success`          | `#059669`                   | Success, positive actions            |
| `--color-info`             | `#0284C7`                   | Informational highlights             |
| `--color-text-primary`     | `#1C1B1F`                   | Primary text (near-black)            |
| `--color-text-secondary`   | `#49454F`                   | Secondary text                       |
| `--color-text-tertiary`    | `#7A7680`                   | Subtle / disabled text               |
| `--color-bg-primary`       | `rgba(255, 255, 255, 0.70)` | Primary surface (translucent white)  |
| `--color-bg-secondary`     | `rgba(255, 255, 255, 0.55)` | Card / panel surface                 |
| `--color-bg-tertiary`      | `rgba(255, 255, 255, 0.40)` | Input backgrounds                    |
| `--color-bg-hover`         | `rgba(255, 255, 255, 0.35)` | Hover state for interactive areas    |
| `--color-bg-selected`      | `rgba(11, 87, 208, 0.12)`   | Selected/highlighted state           |
| `--color-bg-elevated`      | `rgba(255, 255, 255, 0.82)` | Elevated surfaces (modals, popovers) |
| `--color-border-primary`   | `rgba(255, 255, 255, 0.30)` | Container borders (frost)            |
| `--color-border-secondary` | `rgba(255, 255, 255, 0.18)` | Internal dividers                    |

**Dark Mode** (`.dark` on `<html>`) —

| Token                    | Dark Value                  |
| ------------------------ | --------------------------- |
| `--color-accent`         | `#8AB4F8` (lighter blue)    |
| `--color-bg-primary`     | `rgba(15, 23, 42, 0.72)`    |
| `--color-text-primary`   | `#E6E1E5`                   |
| `--color-text-secondary` | `#C4C0C8`                   |
| `--color-border-primary` | `rgba(255, 255, 255, 0.10)` |

### 1.2 Frosted Glass Surface Tokens

| Token                         | Value (light)               | Usage                          |
| ----------------------------- | --------------------------- | ------------------------------ |
| `--color-frost-bg`            | `rgba(255, 255, 255, 0.25)` | Glass background (standard)    |
| `--color-frost-bg-strong`     | `rgba(255, 255, 255, 0.45)` | Glass background (elevated)    |
| `--color-frost-border`        | `rgba(255, 255, 255, 0.35)` | Glass border stroke            |
| `--color-frost-border-strong` | `rgba(255, 255, 255, 0.55)` | Glass border stroke (elevated) |
| `--color-frost-highlight`     | `rgba(255, 255, 255, 0.50)` | Inner edge highlight           |

### 1.3 Glass-Morphism Tokens

```css
--glass-blur: 24px; /* Standard backdrop blur */
--glass-blur-heavy: 32px; /* Stronger blur for modals */
--glass-blur-light: 12px; /* Subtle blur for inputs */
--frost-border: 1px solid rgba(255, 255, 255, 0.35); /* Border-based depth */
--frost-border-strong: 1.5px solid rgba(255, 255, 255, 0.55);
--frost-highlight: inset 0 1px 0 0 rgba(255, 255, 255, 0.55);
--frost-highlight-strong: inset 0 1.5px 0 0 rgba(255, 255, 255, 0.7);
--frost-radius: 24px; /* Standard container radius */
--frost-radius-sm: 16px; /* Compact container radius */
--frost-radius-lg: 32px; /* Large container radius */
--backdrop-blur-overlay: 20px; /* Modal backdrop blur */
```

**Key principle:** All drop-shadow elevations are replaced by white-translucent borders (`--frost-border`). Depth is communicated through border weight + inner edge highlights — no `box-shadow` on cards or panels.

### 1.4 Spacing System (8-Point Grid)

| Token        | Rem     | Pixels | Usage                     |
| ------------ | ------- | ------ | ------------------------- |
| `--space-1`  | 0.25rem | 4px    | Icon gaps, tightest       |
| `--space-2`  | 0.5rem  | 8px    | Button padding, icon-text |
| `--space-3`  | 0.75rem | 12px   | Tight card padding        |
| `--space-4`  | 1rem    | 16px   | Default card padding      |
| `--space-5`  | 1.25rem | 20px   | Relaxed padding           |
| `--space-6`  | 1.5rem  | 24px   | Section gaps              |
| `--space-8`  | 2rem    | 32px   | Large section gaps        |
| `--space-10` | 2.5rem  | 40px   | Page section margins      |
| `--space-12` | 3rem    | 48px   | Container padding         |
| `--space-16` | 4rem    | 64px   | Page margins              |

### 1.5 Typography

| Token              | Value            | Usage                         |
| ------------------ | ---------------- | ----------------------------- |
| `--font-sans`      | Inter, system-ui | Primary typeface              |
| `--font-mono`      | JetBrains Mono   | Monospace (code, identifiers) |
| `--font-size-xs`   | 0.6875rem (11px) | Badges, meta, timestamps      |
| `--font-size-sm`   | 0.8125rem (13px) | Body text, UI labels          |
| `--font-size-base` | 0.9375rem (15px) | Default body (desktop-dense)  |
| `--font-size-lg`   | 1.0625rem (17px) | Section headers               |
| `--font-size-xl`   | 1.25rem (20px)   | Sub-headings                  |
| `--font-size-2xl`  | 1.5rem (24px)    | H2                            |
| `--font-size-3xl`  | 1.875rem (30px)  | H1                            |

### 1.6 Icon System

| Token       | Pixels | Usage                       |
| ----------- | ------ | --------------------------- |
| `--icon-xs` | 12px   | Inline badges, indicators   |
| `--icon-sm` | 16px   | Menu items, buttons         |
| `--icon-md` | 20px   | Default icon size           |
| `--icon-lg` | 24px   | Section headers, nav icons  |
| `--icon-xl` | 32px   | Empty states, feature icons |

---

## 2. Layout Architecture

### 2.1 Mobile Layout Grid

```
┌──────────────────────────────────────────────┐
│  WindowTitleBar (44px) — translucent frost   │
├──────────────────────────────────────────────┤
│  Content Area (flex-1, overflow: auto)       │
│  ┌──────────────────────────────────────────┐│
│  │  [Page Header] — frosted, sticky top     ││
│  │  [Content Body] — scrollable             ││
│  │  ┌──────────┬──────────┐                 ││
│  │  │ Card (1/2)│ Card(1/2)│ - 2-col grid  ││
│  │  ├──────────┴──────────┤                 ││
│  │  │ Full-width section  │                 ││
│  │  └─────────────────────┘                 ││
│  └──────────────────────────────────────────┘│
├──────────────────────────────────────────────┤
│  BottomTabBar (60px) — frosted, always visible│
└──────────────────────────────────────────────┘

- Max content width: 100vw with safe-area padding
- Grid columns: 2 at < 768px, 4 at ≥ 768px (tablet)
- Cards: 24dp rounded corners, frosted border
- Page padding: 16px (px-4) horizontal, 24px (pt-6) top
- Touch targets: minimum 44×44px (Apple HIG)
```

### 2.2 Desktop Layout Grid

```
┌──────────────────────────────────────────────────────────────┐
│  WindowTitleBar (48px) — frosted, breadcrumb + window ctrls │
├──────────┬───────────────────────────────────────────────────┤
│ IconRail │  Main Content Area                                │
│  (64px)  │  ┌───────────────────────────────────────────┐   │
│  frosted │  │  TopBar / Search — frosted, sticky         │   │
│          │  ├───────────────────────────────────────────┤   │
│  Groups: │  │  Split Pane (Desktop Mail):                │   │
│  Business│  │  ┌──────────────┬──────────────────────┐  │   │
│  Mail    │  │  │ Email List   │ Reading Pane         │  │   │
│  People  │  │  │ (min 240px)  │ (flex-1)             │  │   │
│  Calendar│  │  │ frosted-     │ frosted-             │  │   │
│  Tasks   │  │  │ surface      │ surface              │  │   │
│  ...     │  │  └──────────────┴──────────────────────┘  │   │
│          │  └───────────────────────────────────────────┘   │
├──────────┴───────────────────────────────────────────────────┤
│  Status Bar (28px) — sync progress, offline indicator        │
└──────────────────────────────────────────────────────────────┘

- Icon rail: fixed 64px, vertical nav groups
- Mail split: resizable via drag handle (240–800px)
- Non-mail pages: icon rail only (no sidebar)
- Max content width: 1280px (--space max in SinglePageLayout)
- Sidebar expansion: 344px for full mail panel
- Density: compact (32px), normal (40px), relaxed (48px)
```

### 2.3 Tablet Landscape Layout

```
┌──────────────────────────────────────────────────────────────┐
│  WindowTitleBar (48px)                                       │
├──────────┬───────────────────────────────────────────────────┤
│ Sidebar  │  Content                                          │
│ (icon    │  (same as desktop but single-pane)                │
│  rail +  │                                                   │
│  compact │                                                   │
│  labels) │                                                   │
│          │                                                   │
│ 200px    │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

---

## 3. Navigation System

### 3.1 Desktop Sidebar (PremiumSidebar)

```
┌─────────────────────┐
│  PremiumSidebar     │
│  ┌─── Icon Rail ──┐ │
│  │ [📊] Business  │ │
│  │ [✉️] Mail      │ │  ← active: accent border-left
│  │ [👥] People    │ │
│  │ [📅] Calendar  │ │
│  │ [✅] Tasks     │ │
│  │ [⚡] Automation│ │
│  │ [🔐] Vault     │ │
│  │ [📈] Campaigns │ │
│  │────────────────│ │
│  │ [⚙️] Settings  │ │  ← bottom group
│  │ [❓] Help      │ │
│  └────────────────┘ │
│  Mail Panel         │  ← 344px when expanded
│  ┌────────────────┐ │
│  │ Search labels  │ │
│  │ Inbox      (42)│ │
│  │ Starred        │ │
│  │ Snoozed   (3)  │ │
│  │ Sent           │ │
│  │ Drafts    (2)  │ │
│  │────────────────│ │
│  │ Smart Folders  │ │
│  │ ─────────────  │ │
│  │ Labels         │ │
│  │ Work           │ │
│  │ Receipts       │ │
│  └────────────────┘ │
└─────────────────────┘
```

**Frosted Glass treatment:**

- Icon rail: `frost-surface` with `border-inline-end: var(--frost-border)`
- Active nav item: left border `2px solid var(--color-accent)` + `var(--color-bg-selected)`
- Hover: `color-mix(in srgb, var(--color-bg-hover), 60%)`
- Mail panel: `var(--color-sidebar-bg)` with backdrop blur
- Scrollbar: thin, hidden by default

### 3.2 Mobile Bottom Tab Bar (BottomTabBar)

```
┌────────────────────────────────────────────┐
│                                            │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │ 📊   │  │ ✉️   │  │ 👥   │  │ ⚙️  │  │
│  │Dashboard│  Mail  │  │ CRM  │  │Settings│  │
│  │  ████  │  │      │  │      │  │      │  │
│  └──────┘  └──────┘  └──────┘  └──────┘  │
│           [➕] — Add account FAB           │
└────────────────────────────────────────────┘
```

**Frosted Glass treatment:**

- Background: `bg-white/25 backdrop-blur-[24px]`
- Border top: `border-t border-white/35`
- Active tab: accent color + top indicator bar (spring bounce animation)
- FAB: `bg-accent` with `shadow-lg shadow-accent/30`
- Hinge offset support for foldable devices

### 3.3 Nav Groups & Route Mapping

| Nav ID     | Route Prefix                   | Icon Rail  | Bottom Tab (mobile) |
| ---------- | ------------------------------ | ---------- | ------------------- |
| business   | `/dashboard`                   | ✓          | Dashboard           |
| mail       | `/mail`                        | ✓          | Mail                |
| people     | `/crm`, `/people`, `/contacts` | ✓          | CRM                 |
| calendar   | `/calendar`                    | ✓          | —                   |
| tasks      | `/tasks`                       | ✓          | —                   |
| automation | `/automation`                  | ✓          | —                   |
| vault      | `/vault`                       | ✓          | —                   |
| campaigns  | `/campaigns`                   | ✓          | —                   |
| settings   | `/settings`                    | ✓ (bottom) | Settings            |
| help       | `/help`                        | ✓ (bottom) | —                   |

---

## 4. Page Templates & States

### 4.0 Page Template Contract (canonical — all primary pages MUST comply)

Every primary list/content page renders through `PageScaffold`
(`src/shared/components/layout/PageScaffold.tsx`). The contract below is the single
source of truth for page anatomy; deviations require review.

Anatomy:
  - **Header**: `title` (already translated by caller) + optional numeric `count` chip
    (`<span class="rounded-full bg-bg-tertiary ...">`) + optional one-line `subtitle`.
    Primary `actions` (buttons/menus) render right-aligned.
  - **Toolbar** (optional): search input + `FilterBar` + view toggles, full-width, sticky
    below the header.
  - **Content**: a single scroll region; constrain width via `maxWidth` (full | xl | 2xl |
    prose).
  - **Empty**: when `isEmpty`, render the shared `EmptyState` (icon + title + body + CTA) —
    never bare "no data" text.
  - **Focus**: on mount, focus the search input when a toolbar is present (a11y).
  - **States**: loading → `Skeleton` family; error → `ErrorState` with retry.

Compliance (verified 2026-07-13): Contacts, Attachments, Tasks, Calendar, Automation,
Invoicing, ERP already use `PageScaffold` with title/toolbar/empty-state. Pages still
exempt (must be brought to parity): Dashboard, Campaigns, Mail, POS, Vault, Settings
sub-pages, Workflows, Accounts, Sync, Deliverability, Assistant. See
`docs/plans/DESIGN_UI_UX_SPEC.md` (Chunk 3).


### 4.1 Mobile Dashboard

```
┌──────────────────────────────────────┐
│ Header: SME Master | [Dashboard]     │ ← frosted badge
│ "Your business command center"       │
├──────────────────────────────────────┤
│ ┌───────────┐  ┌───────────┐         │
│ │ ✉️ Mail  │  │ 👥 CRM    │         │ ← 2-col grid
│ │ Inbox,.. │  │ Contact.. │         │   frost-surface
│ ├───────────┤  ├───────────┤         │   24dp radius
│ │ ✅ Tasks │  │ 📊 Camp..│         │   spring enter
│ ├───────────┤  ├───────────┤         │   staggered
│ │ 📅 Cal.  │  │ ⚙️ Sett..│         │
│ └───────────┘  └───────────┘         │
└──────────────────────────────────────┘

States:
- Loading: 6 skeleton cards with shimmer
- Empty: "Welcome!" CTA to add first account
- Error: "Connection lost" banner, retry button
- Edge: >6 features scroll vertically
```

### 4.2 Mobile Settings

```
┌──────────────────────────────────────┐
│ [←]  Settings           [📖]         │ ← frosted header
├──────────────────────────────────────┤
│  SectionGroup (rounded-xl, frosted)  │
│  ┌────────────────────────────────┐  │
│  │ 🎨 Appearance        ›        │  │
│  ├────────────────────────────────┤  │
│  │ 👤 Account & Sync    ›        │  │
│  ├────────────────────────────────┤  │
│  │ 🔔 Notifications     ›        │  │
│  └────────────────────────────────┘  │
│                                      │
│  SectionGroup (separate)             │
│  ┌────────────────────────────────┐  │
│  │ 🛡️ Security            ›      │  │
│  └────────────────────────────────┘  │
│                                      │
│  [➕] — Add account FAB (fixed)      │
└──────────────────────────────────────┘

States:
- Loading: skeleton rows with shimmer
- Toggle loading: spinner on control
- Error: inline error message below row
- Empty: "No accounts" state
```

### 4.3 Desktop Mail (EmailList + ReadingPane)

```
┌──────────────────────────────────────────────────────────────┐
│  MailTopBar — frosted                                        │
│  [🔍 Search...] [🔄]  Inbox (42)  [All|Unread|Read]        │
├──────────────────────────────┬───────────────────────────────┤
│  CategoryTabs                │  ReadingPane                  │
│  [Primary] [Social] [Promos] │  ┌─────────────────────────┐  │
├──────────────────────────────┤  │ ThreadView              │  │
│  EmailList (virtualized)     │  │ ┌─────────────────────┐ │  │
│  ┌────────────────────────┐  │  │ │ Subject + Actions   │ │  │
│  │ 📧 John: Meeting update│  │  │ ├─────────────────────┤ │  │
│  │ 📧 Sarah: Invoice #123 │  │  │ │ Message #1          │ │  │
│  │ ⭐ Mike: Fwd: Proposal │  │  │ │   [Attachments]     │ │  │
│  │ 📧 Anna: Hello         │  │  │ ├─────────────────────┤ │  │
│  └────────────────────────┘  │  │ │ Message #2          │ │  │
│  [Load more...]              │  │ │   [Inline reply]    │ │  │
│                              │  │ └─────────────────────┘ │  │
│                              │  └─────────────────────────┘  │
├──────────────────────────────┴───────────────────────────────┤
│  Status: Synced ✓  |  Offline Queue: 3 pending               │
└──────────────────────────────────────────────────────────────┘

States:
- Loading: EmailListSkeleton (8 thread skeletons)
- Empty (threads): InboxClearIllustration + "Inbox Zero!"
- Empty (search): NoSearchResultsIllustration + suggestions
- Error: ErrorState with retry + error details
- Offline: OfflineBanner top + OfflineIndicator in sidebar
- Multi-select: MultiSelectBottomBar with bulk actions
- Edge: 10,000+ threads (virtualized), bundle collapsing
- Edge: Network reconnect auto-refresh
```

### 4.4 Contacts Page (Desktop)

```
┌──────────────────────────────────────────────────────────────┐
│  [🔍 Search contacts...]  [Filter] [Upload] [Merge] [+ New] │
│  [Contacts] [Tags] [Groups] [Segments] [Imports] — frosted  │
├──────────────────────────────────────────────────────────────┤
│  FilterChipBar: [All] [VIP] [Work] [Custom...]              │
├──────────────────────────────────────────────────────────────┤
│  [List View | Grid View]  [Density] [Sort: Name ▼]          │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┬──────────┬──────────┬────────────┬─────────┐│
│  │ Name ▲     │ Email    │ Phone    │ Company    │ Tags    ││
│  ├────────────┼──────────┼──────────┼────────────┼─────────┤│
│  │ John Doe   │ j@e.com  │ 555-0100 │ Acme Inc  │ VIP,Wk  ││
│  │ Jane Smith │ j@s.com  │ 555-0102 │ Beta Corp  │ Client  ││
│  │ ...        │          │          │            │         ││
│  └────────────┴──────────┴──────────┴────────────┴─────────┘│
│  [< Prev] Page 1 of 12 [Next >]                             │
├──────────────────────────────────────────────────────────────┤
│  Bulk actions bar (when selected)                            │
└──────────────────────────────────────────────────────────────┘

States:
- Loading: SkeletonTable (6 rows with shimmer)
- Empty: GenericEmptyIllustration + "Add your first contact"
- Empty (search): "No contacts match your search"
- Error: ErrorState with retry
- Bulk: MultiSelectBottomBar (merge, tag, delete, export)
- Edge: 50,000+ contacts paginated
- Edge: CSV import wizard overlay
- Edge: Merge conflict dialog
```

### 4.5 Tasks Page

```
┌──────────────────────────────────────────────────────────────┐
│  [🔍 Search...] [Filter] [+ New Task]                       │
│  [List] [Kanban] [Calendar] [Agenda] — view toggle         │
├──────────────────────────────────────────────────────────────┤
│  SmartFilterBar: [All] [Today] [This Week] [Overdue]       │
│  Priority: [Any] [Urgent] [High] [Medium] [Low]            │
├──────────────────────────────────────────────────────────────┤
│  TaskItem (swipeable on mobile)                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ○ Review Q3 proposal    📅 Today   🔴 Urgent   [>]    │ │
│  │ ● Send invoice          📅 Tomorrow 🟡 High     [>]    │ │
│  │ ○ Prep meeting agenda   📅 Jul 12   🟢 Medium   [>]    │ │
│  │ ✓ Completed task        📅 Jul 08   ⚪ Done     [>]    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  [Load more...]  |  PaginationControls                      │
├──────────────────────────────────────────────────────────────┤
│  Quick Add: [What needs to be done?] [+ Add]               │
└──────────────────────────────────────────────────────────────┘

States:
- Loading: SkeletonPage with task row skeletons
- Empty: EmptyStateTask illustration + "No tasks yet"
- Filtered empty: "No tasks match" + clear filter CTA
- Error: inline error with retry per operation
- Kanban: 3 columns (To Do, In Progress, Done) with drag-and-drop
- Agenda: grouped by date with timeline
- Calendar: month/week view with task dots
- Edge: recurring tasks auto-complete + regenerate
- Edge: overdue tasks highlighted in red
- Edge: 500+ tasks paginated
```

### 4.6 Calendar Page

```
┌──────────────────────────────────────────────────────────────┐
│  [< July 2026 >]  [Today]  [Month|Week|Day|Agenda]  [🔄]  │
├──────────────────────────────────────────────────────────────┤
│  ┌────┬────┬────┬────┬────┬────┬────┐                       │
│  │ Sun│ Mon│ Tue│ Wed│ Thu│ Fri│ Sat│                       │
│  ├────┼────┼────┼────┼────┼────┼────┤                       │
│  │    │    │  1 │  2 │  3 │  4 │  5 │                       │
│  │    │    │    │ 📊 │    │    │    │                       │
│  ├────┼────┼────┼────┼────┼────┼────┤                       │
│  │  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │                       │
│  │    │    │ ✅ │    │    │ 📅 │    │                       │
│  └────┴────┴────┴────┴────┴────┴────┘                       │
├──────────────────────────────────────────────────────────────┤
│  Integrated: Tasks, Campaigns, Scheduled Emails              │
└──────────────────────────────────────────────────────────────┘

States:
- Loading: calendar grid skeleton + shimmer
- Empty (events): "No events this month"
- Empty (calendars): "Connect a calendar" CTA
- Error: CalendarReauthBanner + "Grant access" button
- Edge: 500+ events in a single day
- Edge: Read-only calendars (shared)
- Edge: Conflicting events highlighted
- Edge: Calendar type (Gregorian default)
- Detail: EventDetailModal (desktop) / EventDetailSheet (mobile)
```

### 4.7 Composer Window

```
┌──────────────────────────────────────────────────────────────┐
│  [✉️ New Message]  [—] [□] [✕]  — frosted top bar         │
├──────────────────────────────────────────────────────────────┤
│  From: [me@company.com ▼]                                   │
│  To: [John, Sarah...]        [Cc/Bcc]                      │
│  Subject: [________________]                                │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ EditorToolbar: B I U H1 H2 Link Quote Code List Image │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │                                                         │ │
│  │  Rich text editor (TipTap)                              │ │
│  │  - Mentions (@John)                                     │ │
│  │  - Link previews                                        │ │
│  │  - Attachments (drag & drop)                            │ │
│  │  - AI Assist panel (sidebar)                            │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  [📎 Attach] [📁 Templates] [⏰ Schedule] [🔒 Encrypt]     │
│  [✕ Discard]                    [💾 Save] [📨 Send]        │
└──────────────────────────────────────────────────────────────┘

States:
- Loading: editor skeleton
- Empty: fresh compose with cursor in To field
- Saving: auto-save indicator ("Draft saved")
- Sending: progress bar + "Sending..."
- Sent: UndoSendToast (7s undo window)
- Error: inline field validation (invalid email, missing subject)
- Edge: Large attachments (>25MB) warning
- Edge: Multiple recipients (bulk)
- Edge: PreSendChecklist (compliance, attachments review)
- Edge: Schedule send dialog
- Edge: AI assist panel (sidebar)
```

---

## 5. Component Inventory

### 5.1 Frosted CSS Utility Classes

| Class                    | Properties                               | Usage                      |
| ------------------------ | ---------------------------------------- | -------------------------- |
| `.frost-surface`         | `backdrop-filter`, `bg-frost-bg`, border | Standard glass surface     |
| `.frost-surface-strong`  | Stronger blur, `bg-frost-bg-strong`      | Elevated surfaces (modals) |
| `.glass-panel`           | Same as `.frost-surface`                 | Generic glass container    |
| `.glass-modal`           | Stronger blur, 32px                      | Modal surfaces             |
| `.glass-backdrop`        | 20px backdrop blur overlay               | Modal backdrops            |
| `.glass-dropdown`        | Frost + elevated shadow                  | Dropdown menus             |
| `.glass-input`           | Frost + focus ring with accent           | Text inputs                |
| `.glass-select`          | Frost + focus ring with accent           | Select elements            |
| `.glass-top-bar`         | Frost + bottom border                    | Toolbar headers            |
| `.glass-workspace`       | Frost with lighter blur                  | Main content area          |
| `.glass-accent-tint`     | Frost + accent tint                      | Active/hover states        |
| `.glass-category-bar`    | Frost + bottom border                    | Category tab bars          |
| `.glass-thread-row`      | Frost + hover left border                | Email thread rows          |
| `.liquid-glass`          | Frost + hover sheen overlay              | Premium card surfaces      |
| `.liquid-glass-elevated` | Frost-elevated + animated sheen          | Hero sections              |

### 5.2 Shared UI Components (barrel: `src/shared/components/ui/index.ts`)

| Component            | Status | Empty                                               | Loading                      | Error                        | Edge Cases                                                     |
| -------------------- | ------ | --------------------------------------------------- | ---------------------------- | ---------------------------- | -------------------------------------------------------------- |
| FrostedBackground    | ✅     | N/A (decorative)                                    | N/A                          | N/A                          | Reduced-motion disables animation                              |
| GlassPanel           | ✅     | Renders children                                    | N/A                          | N/A                          | 6 variants: panel/modal/card/elevated/liquid/liquid-elevated   |
| Button               | ✅     | N/A                                                 | Shows spinner                | N/A                          | 6 variants: primary/secondary/ghost/danger/glass/glass-primary |
| Toggle               | ✅     | N/A                                                 | N/A                          | N/A                          | sm/md sizes, disabled state                                    |
| Modal                | ✅     | N/A                                                 | N/A                          | N/A                          | 6 sizes, 3 z-index levels                                      |
| Badge                | ✅     | N/A                                                 | N/A                          | N/A                          | 5 color variants, 2 sizes                                      |
| EmptyState           | ✅     | Shows icon/illustration + title + description + CTA | N/A                          | N/A                          | 3 sizes, custom illustration                                   |
| Skeleton             | ✅     | N/A                                                 | Shimmer animation            | N/A                          | Page, Table, Card, Thread, Line variants                       |
| Spinner              | ✅     | N/A                                                 | Spinning animation           | N/A                          | 3 sizes                                                        |
| CenteredLoader       | ✅     | N/A                                                 | Spinner + optional text      | N/A                          | 3 sizes                                                        |
| ErrorBoundary        | ✅     | N/A                                                 | N/A                          | Fallback UI + retry          | Named boundaries                                               |
| ErrorState           | ✅     | N/A                                                 | N/A                          | Error icon + message + retry | Optional details                                               |
| SearchBar            | ✅     | "Search..." placeholder                             | N/A                          | N/A                          | Keyboard shortcut Cmd+F                                        |
| ContextMenu          | ✅     | N/A                                                 | N/A                          | N/A                          | Disabled items, separators, danger variant                     |
| SwipeableRow         | ✅     | N/A                                                 | N/A                          | N/A                          | Configurable actions, threshold                                |
| PullToRefresh        | ✅     | N/A                                                 | Pull indicator → spinner     | N/A                          | Threshold 60px, max 120px                                      |
| Toast                | ✅     | N/A                                                 | N/A                          | Error variant                | Info/success/warning/error, undo action                        |
| FloatingActionButton | ✅     | N/A                                                 | N/A                          | N/A                          | Desktop: inline toolbar; Mobile: speed-dial                    |
| MultiSelectBottomBar | ✅     | Hidden when 0 selected                              | N/A                          | N/A                          | Safe-area aware                                                |
| FocusReader          | ✅     | N/A                                                 | N/A                          | N/A                          | Auto-hides toolbar after 3s                                    |
| SlidePanel           | ✅     | N/A                                                 | N/A                          | N/A                          | Desktop: right; Mobile: bottom sheet                           |
| ConfirmDialog        | ✅     | N/A                                                 | Confirm button shows spinner | N/A                          | Danger variant                                                 |
| InputDialog          | ✅     | Pre-filled value                                    | N/A                          | Validation error             | Initial value, placeholder                                     |

---

## 6. UI Element States

### 6.1 Card / Surface States

| State              | Visual                                                | Implementation                   |
| ------------------ | ----------------------------------------------------- | -------------------------------- |
| **Default**        | Translucent white bg, white border, 24dp radius       | `frost-surface`                  |
| **Hover**          | Slightly brighter bg (hover overlay), border lightens | `hover:bg-white/10`              |
| **Active/Pressed** | Scale 0.97, subtle darkening                          | `active:scale-[0.97]`            |
| **Selected**       | Accent-tinted bg, accent left border                  | `glass-accent-tint`              |
| **Disabled**       | Opacity 50%, no pointer events                        | `opacity-50 pointer-events-none` |
| **Loading**        | Shimmer overlay skeleton                              | `Skeleton` component             |
| **Error**          | Red-tinted border, error icon                         | `border-danger/30 bg-danger/5`   |

### 6.2 Input States

| State         | Visual                           | Implementation                    |
| ------------- | -------------------------------- | --------------------------------- |
| **Default**   | Frosted bg, white border         | `glass-input`                     |
| **Hover**     | Slightly brighter bg             | `hover:bg-bg-secondary/60`        |
| **Focus**     | Accent ring (2px), accent border | `focus:ring-accent`               |
| **Disabled**  | Opacity 50%, no pointer          | `disabled:opacity-50`             |
| **Error**     | Red border, red ring             | `border-danger/50 ring-danger/20` |
| **Read-only** | No border change, muted text     | `read-only:text-text-tertiary`    |

### 6.3 Button States

| State             | Primary                | Glass                | Ghost         | Danger                 |
| ----------------- | ---------------------- | -------------------- | ------------- | ---------------------- |
| **Default**       | `bg-accent text-white` | Frosted + border     | Transparent   | `bg-danger text-white` |
| **Hover**         | `bg-accent-hover`      | Brighter bg + border | `bg-bg-hover` | `bg-danger-hover`      |
| **Active**        | Scale 0.97             | Scale 0.97           | Scale 0.97    | Scale 0.97             |
| **Loading**       | Spinner replaces icon  | Spinner              | Spinner       | Spinner                |
| **Disabled**      | Opacity 50%            | Opacity 50%          | Opacity 50%   | Opacity 50%            |
| **Focus-visible** | Accent ring            | Accent ring          | Accent ring   | Danger ring            |

### 6.4 Navigation States

| State            | Icon Rail                       | Bottom Tab              | Mail Label                       |
| ---------------- | ------------------------------- | ----------------------- | -------------------------------- |
| **Default**      | `text-text-tertiary`            | `text-text-tertiary/50` | `text-text-secondary`            |
| **Hover**        | `bg-bg-hover text-text-primary` | `text-text-primary`     | `bg-bg-hover`                    |
| **Active**       | Accent color + left border      | Top indicator + accent  | Left accent border + bg-selected |
| **Disabled**     | Opacity 30%                     | Opacity 30%             | N/A                              |
| **Unread count** | Badge (accent bg)               | N/A                     | Count badge                      |

### 6.5 Empty States (per page)

| Page              | Illustration                | Title             | Description                             | CTA           |
| ----------------- | --------------------------- | ----------------- | --------------------------------------- | ------------- |
| Dashboard         | App logo                    | "Welcome"         | "Set up your first account"             | Add Account   |
| Mail (inbox)      | InboxClearIllustration      | "Inbox Zero!"     | "You're all caught up"                  | —             |
| Mail (search)     | NoSearchResultsIllustration | "No results"      | "Try a different search"                | Clear search  |
| Contacts          | GenericEmptyIllustration    | "No contacts yet" | "Import or add contacts"                | Add Contact   |
| Contacts (filter) | GenericEmptyIllustration    | "No matches"      | "Try a different filter"                | Clear filters |
| Tasks             | Task-specific illustration  | "No tasks yet"    | "Create your first task"                | New Task      |
| Tasks (filter)    | Task-specific illustration  | "No matches"      | "Adjust your filters"                   | Clear filters |
| Calendar          | Calendar illustration       | "No events"       | "Connect a calendar or create an event" | Create Event  |
| Campaigns         | Campaign illustration       | "No campaigns"    | "Start your first campaign"             | New Campaign  |
| Automation        | Rules illustration          | "No rules"        | "Automate your workflow"                | New Rule      |
| Vault             | Vault illustration          | "Vault empty"     | "Store attachments securely"            | Upload        |

---

## 7. Action Workflows

### 7.1 Email Thread Actions

```
User sees thread in EmailList
├── Tap thread → ReadingPane opens (desktop) / ThreadView (mobile)
├── Swipe left (mobile) → Archive / Delete actions
├── Swipe right (mobile) → Mark read/unread
├── Long press (mobile) → Multi-select mode
├── Right-click (desktop) → ContextMenu:
│   ├── Mark read/unread
│   ├── Star / Unstar
│   ├── Move to folder
│   ├── Snooze
│   ├── Mute
│   ├── Print
│   └── Delete
├── Drag (desktop) → Move to folder (droppable)
└── Multi-select toolbar → Archive / Delete / Mark read / Move / Snooze
```

**Frosted Glass feedback:**

- Swipe: reveals frosted action buttons behind the thread card
- Hover: left accent border appears
- Selected: accent tint background

### 7.2 Compose Workflow

```
User triggers compose
├── Cmd+N / Ctrl+N (keyboard)
├── Tap FAB (mobile)
├── Reply / Reply All / Forward (from ReadingPane)
└── Click "New Message" button

Composer opens (modal on desktop, fullscreen on mobile)
├── Fill To: field → autocomplete from contacts (frosated dropdown)
├── Add Cc/Bcc → inline expansion
├── Write subject
├── Write body (TipTap editor)
│   ├── @mention → mentions dropdown (frosted)
│   ├── Paste link → link preview card
│   ├── Attach file → attachment list (frosted cards)
│   ├── AI Assist → side panel (frosted slide)
│   └── Template → template picker (frosted modal)
├── Pre-send checklist
│   ├── Missing attachment warning
│   ├── Compliance check
│   └── Recipient validation
├── Schedule send → DateTimePicker dialog (frosted modal)
└── Send → UndoSendToast (7s countdown bar)
```

### 7.3 Task Workflow

```
User sees task list
├── Create task
│   ├── Quick Add (inline input at bottom)
│   └── Full form (TaskCreateModal — frosted modal)
│       ├── Title (required)
│       ├── Description (optional)
│       ├── Due date (date picker)
│       ├── Priority (urgent/high/medium/low/none)
│       ├── Assignee (contact picker)
│       └── Recurrence (daily/weekly/monthly...)
├── Complete task
│   ├── Tap checkbox → strikethrough animation
│   ├── Recurring → auto-regenerate with new due date
│   └── Undo option (toast)
├── Edit task → TaskDetailPanel (slide panel)
├── Delete → ConfirmDialog (danger variant)
└── Reorder (Kanban) → drag-and-drop with frosted placeholder
```

### 7.4 Contact Workflow

```
User browses contacts
├── Search → filtered list (debounced, 300ms)
├── Filter → FilterChipBar (frosted chips)
├── Create → CreateContactModal (frosted modal)
├── Import → CsvImportWizard (stepped wizard)
│   ├── Upload CSV
│   ├── Map columns
│   ├── Preview + deduplicate
│   └── Import
├── Merge → ContactMergeDialog (frosted modal)
│   ├── Auto-detect duplicates
│   └── Manual merge candidates
├── Export → ExportMenu (frosted dropdown)
│   ├── CSV export
│   └── vCard export
└── Bulk actions → MultiSelectBottomBar
    ├── Add tag
    ├── Add to group
    ├── Delete
    └── Export selected
```

### 7.5 Calendar Event Workflow

```
User views calendar
├── View switch: Month / Week / Day / Agenda
├── Navigate: arrows or date picker
├── Today button → jump to current date
├── Create event
│   ├── Tap empty slot → quick event
│   ├── Tap "+" button → full EventCreateModal (frosted)
│   └── Drag across times → range selection
├── View event → EventDetailModal (desktop) / EventDetailSheet (mobile)
├── Edit → inline or modal
├── Delete → ConfirmDialog
├── Reauth → CalendarReauthBanner when token expires
└── Calendar list → CalendarList sidebar (frosted)
```

---

## 8. Mobile Adaptations

### 8.1 Touch Targets

| Element       | Minimum Size | Implementation                          |
| ------------- | ------------ | --------------------------------------- |
| Buttons       | 44×44px      | `min-h-[44px]` via `html.mobile button` |
| Nav items     | 48×48px      | `.bottom-tab-btn` class                 |
| List rows     | 44px         | Default row height                      |
| Input fields  | 44px         | `min-h-[44px]`                          |
| Close buttons | 44×44px      | `w-9 h-9` (36px minimum)                |

### 8.2 Safe Areas

| Area                  | Inset                         | CSS                 |
| --------------------- | ----------------------------- | ------------------- |
| Top notch             | `env(safe-area-inset-top)`    | `.safe-area-top`    |
| Bottom bar            | `env(safe-area-inset-bottom)` | `.safe-area-bottom` |
| Left (foldable hinge) | `env(safe-area-inset-left)`   | `.safe-area-left`   |
| Right                 | `env(safe-area-inset-right)`  | `.safe-area-right`  |

### 8.3 Gesture Support

| Gesture        | Action                           | Component       |
| -------------- | -------------------------------- | --------------- |
| Swipe left     | Reveal actions (archive, delete) | `SwipeableRow`  |
| Swipe right    | Mark read/unread                 | `SwipeToDelete` |
| Pull down      | Refresh content                  | `PullToRefresh` |
| Long press     | Context menu / multi-select      | `LongPressMenu` |
| Tap            | Select / navigate                | Native          |
| Pinch (future) | Zoom content                     | —               |

### 8.4 Keyboard on Mobile

- Inputs set `font-size: 16px` to prevent iOS zoom (`mobile-forms.css`)
- `mobile-keyboard-aware` class for smooth height transitions
- Composer has `padding-bottom: env(safe-area-inset-bottom)`

### 8.5 Performance Optimizations

- FrostedBackground: `opacity: 0.3` on `< 768px` to reduce GPU load
- Animated blobs disabled on `prefers-reduced-motion`
- `will-change: transform, opacity` on orbs for GPU acceleration
- Virtualized lists for 50+ items
- `content-visibility: auto` on off-screen sections

---

## 9. Desktop Adaptations

### 9.1 Window Controls

- Frameless Tauri window with custom title bar
- Minimize, maximize, close buttons (Windows-style)
- Traffic light buttons (macOS-style) when on macOS
- `WindowTitleBar` with current page breadcrumb

### 9.2 Keyboard Shortcuts

| Shortcut           | Action                        | Scope    |
| ------------------ | ----------------------------- | -------- |
| `Cmd+K` / `Ctrl+K` | Command palette               | Global   |
| `Cmd+F` / `Ctrl+F` | Focus search                  | Mail     |
| `Cmd+N` / `Ctrl+N` | New message                   | Global   |
| `Escape`           | Close modal / clear selection | Global   |
| `V`                | Cycle view mode               | Per-page |
| `[` / `]`          | Expand/collapse reading pane  | Mail     |
| `M`                | Cycle reading pane position   | Mail     |
| `Cmd+/` / `Ctrl+/` | Shortcuts help                | Global   |

### 9.3 Density Options

| Density | Row Height | Card Padding  | Spacing |
| ------- | ---------- | ------------- | ------- |
| Compact | 32px       | `px-3 py-1.5` | `gap-1` |
| Normal  | 40px       | `px-4 py-2`   | `gap-2` |
| Relaxed | 48px       | `px-4 py-3`   | `gap-3` |

### 9.4 Desktop-Specific Components

| Component              | Purpose                   | Frosted Treatment            |
| ---------------------- | ------------------------- | ---------------------------- |
| `PremiumSidebar`       | Full nav with mail labels | Frosted bg, border-right     |
| `NavRail`              | Compact icon navigation   | Frosted, 64px wide           |
| `WindowTitleBar`       | Custom title bar          | Frosted, 48px height         |
| `ReadingPane`          | Thread detail panel       | 3 positions, draggable width |
| `ResizableEmailLayout` | Split pane                | Drag handle between panes    |
| `MainWorkspace`        | Content wrapper           | `glass-workspace` class      |

---

## 10. Accessibility

### 10.1 Frosted Glass Considerations

| Concern                     | Mitigation                                                                   |
| --------------------------- | ---------------------------------------------------------------------------- |
| Text contrast on frosted bg | `--color-text-primary: #1C1B1F` on 70% white bg = ~10:1 contrast             |
| Focus indicators            | 2px accent ring via `:focus-visible`                                         |
| Touch targets               | 44×44px minimum on mobile                                                    |
| Reduced motion              | `prefers-reduced-motion` disables all animations including blobs             |
| Keyboard navigation         | All interactive elements are keyboard-reachable                              |
| Screen readers              | `aria-hidden="true"` on decorative blobs, `role="status"` on dynamic content |
| High contrast mode          | `.high-contrast` class on `<html>` increases border contrast                 |

### 10.2 Color Contrast Ratios

| Token Pair                                       | Ratio  | WCAG            |
| ------------------------------------------------ | ------ | --------------- |
| `--color-text-primary` on `--color-bg-primary`   | ~10:1  | AAA             |
| `--color-text-secondary` on `--color-bg-primary` | ~7:1   | AAA             |
| `--color-text-tertiary` on `--color-bg-primary`  | ~4.5:1 | AA              |
| `--color-accent` on white                        | ~4.8:1 | AA              |
| `--color-accent` on `--color-bg-primary`         | ~4.2:1 | AA (large text) |

---

## 11. Performance Guidelines

| Pattern           | Recommendation                                      |
| ----------------- | --------------------------------------------------- |
| Animated blobs    | Disable on mobile (<768px) — `opacity: 0.3`         |
| Backdrop blur     | Use sparingly — GPU-intensive on large surfaces     |
| Virtual lists     | `VirtualList` for any list > 50 items               |
| Image loading     | Lazy load with blur placeholder                     |
| Debounce          | Filter/search changes debounced at 300ms            |
| Animation         | Prefer `transform` and `opacity` for 60fps          |
| FrostedBackground | Single instance at app root, `pointer-events: none` |
| CSS containment   | `contain: content` on off-screen panels             |
| Memo              | `React.memo` on list items, card components         |

---

## Reference

| Resource              | Path                                             |
| --------------------- | ------------------------------------------------ |
| Design tokens (CSS)   | `src/styles/globals.css`                         |
| UI token constants    | `src/shared/styles/ui-tokens.ts`                 |
| Component barrel      | `src/shared/components/ui/index.ts`              |
| Glass panel component | `src/shared/components/ui/glass-panel.tsx`       |
| FrostedBackground     | `src/shared/components/ui/FrostedBackground.tsx` |
| Layout shell          | `src/shared/components/layout/shell/`            |
| Theme store           | `src/shared/theme/themeStore.ts`                 |
| Color themes          | `src/constants/themes.ts`                        |
| Mobile CSS            | `src/shared/components/layout/shell/mobile.css`  |
| Animations            | `src/shared/styles/mobile-animations.css`        |
| Docs hub              | `docs/00-INDEX.md`                               |
