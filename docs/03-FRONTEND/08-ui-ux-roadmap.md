# UI/UX Evolution Roadmap — Desktop & Mobile

> **Last updated:** 2026-07-06
> **Status:** Living document — reflects current implementation state across all platforms.

---

## Purpose

This document provides a unified, prioritized plan for UI and UX across both Desktop (Tauri) and Mobile (Android + future iOS). It synthesizes findings from:

- Codebase audits for reuse, breakpoints, gestures, and accessibility
- Desktop feature gaps identified during development

---

## What's Already Built (Foundation)

### Desktop Shell & Navigation

| Component        | Location                                                | Notes                                    |
| ---------------- | ------------------------------------------------------- | ---------------------------------------- |
| `DesktopShell`   | `src/shared/components/layout/shell/DesktopShell.tsx`   | Full sidebar, three-pane layout          |
| `AppLayout`      | `src/shared/components/layout/AppLayout.tsx`            | Responsive container                     |
| `SidebarContainer` | `src/shared/components/layout/shell/SidebarContainer.tsx` | Navigation + a11y, skip-to-content (note: no `Sidebar.tsx` exists; this is the real component) |
| `CommandPalette` | `src/shared/components/layout/shell/CommandPalette.tsx` | Bottom-anchor mobile, top-center desktop |
| `AppLauncher`    | `src/shared/components/layout/shell/AppLauncher.tsx`    | Odoo-inspired app tile grid              |
| `ViewSwitcher`   | `src/shared/components/ui/ViewSwitcher.tsx`             | List/card/board/kanban toggle            |
| `ActionBar`      | `src/features/mail/components/ActionBar.tsx`        | a11y-labeled icon buttons                |
| `Modal`          | `src/shared/components/ui/Modal.tsx`                    | Focus trap, a11y attributes              |
| `ConfirmDialog`  | `src/shared/components/ui/ConfirmDialog.tsx`            | Loading state, a11y labels               |
| `SlidePanel`     | `src/shared/components/ui/SlidePanel.tsx`               | Desktop right panel                      |

### Mobile Shell & Navigation

| Component              | Location                                                      | Notes                               |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `MobileShell`          | `src/shared/components/layout/shell/MobileShell.tsx`          | Runtime shell selection             |
| `PhoneShell` / `TabletLandscapeShell` | _(do not exist as files)_ — shell selection is handled at runtime inside `MobileShell.tsx` + `mobile.css` | Bottom tab bar / two-pane sidebar are runtime variants, not separate components |
| `BottomTabBar`         | `src/features/mail/components/layout/BottomTabBar.tsx`        | 5 tabs + FAB entry                  |
| `FloatingActionButton` | `src/shared/components/ui/FloatingActionButton.tsx`           | Radial menu mobile, toolbar desktop |
| `PageTransition`       | `src/shared/components/layout/shell/PageTransition.tsx`       | Slide left/right spring transitions |
| `MultiSelectBottomBar` | `src/shared/components/ui/MultiSelectBottomBar.tsx`           | Count + bulk actions                |
| `AdaptiveBottomSheet`  | `src/shared/components/ui/AdaptiveBottomSheet.tsx`            | Desktop panel → mobile bottom sheet |

### Gesture & Input System

| Hook                | Location                                | Purpose                                        |
| ------------------- | --------------------------------------- | ---------------------------------------------- |
| `useGestureActions` | `src/shared/hooks/useGestureActions.ts` | Registry: swipe direction → action per context |
| `useSwipeGesture`   | `src/shared/hooks/useSwipeGesture.ts`   | Raw swipe detection                            |
| `useLongPress`      | `src/shared/hooks/useLongPress.ts`      | Long-press for context menus                   |
| `useHaptics`        | `src/shared/hooks/useHaptics.ts`        | Haptic feedback on key actions                 |
| `useBreakpoint`     | `src/shared/hooks/useBreakpoint.ts`     | Unified 768px/1024px breakpoints               |
| `useInputModality`  | `src/shared/hooks/useInputModality.ts`  | Touch vs mouse vs keyboard detection           |
| `useDensity`        | `src/shared/hooks/useDensity.ts`        | UI density (spacious/compact/default)          |
| `useLongPress`      | `src/shared/hooks/useLongPress.ts`      | Long press activation                          |

### Adaptive Components

| Component              | Location                                            | Behavior                          |
| ---------------------- | --------------------------------------------------- | --------------------------------- |
| `AdaptiveTable`        | `src/shared/components/ui/AdaptiveTable.tsx`        | Desktop table → mobile card stack |
| `AdaptiveBottomSheet`  | `src/shared/components/ui/AdaptiveBottomSheet.tsx`  | Panel ↔ Bottom sheet              |
| `DynamicFieldRenderer` | `src/shared/components/ui/DynamicFieldRenderer.tsx` | Adaptive form fields              |
| `ViewSwitcher`         | `src/shared/components/ui/ViewSwitcher.tsx`         | View mode toggle                  |

### Focus / Chrome-less Modes

| Component           | Location                                         | Behavior                                   |
| ------------------- | ------------------------------------------------ | ------------------------------------------ |
| `FocusReader`       | `src/shared/components/ui/FocusReader.tsx`       | Full-screen reading, tap-to-reveal toolbar |
| `ZenMode`           | `src/shared/components/ui/ZenMode.tsx`           | Full-screen composer, floating format bar  |
| `FloatingFormatBar` | `src/shared/components/ui/FloatingFormatBar.tsx` | iOS-style toolbar on text selection        |
| `MobileEditor`      | `src/shared/components/editor/MobileEditor.tsx`  | TipTap mobile writing mode                 |

### Offline & Sync UX

| Component             | Location                                        | Behavior                    |
| --------------------- | ----------------------------------------------- | --------------------------- |
| `OfflineBanner`       | `src/shared/components/ui/OfflineBanner.tsx`    | Sync animation, queue count |
| `MobileSyncStatus`     | `src/features/mobile/MobileSyncStatus.tsx`                          | Last sync time, refresh     |
| `MobilePullToRefresh` | `src/features/mobile/MobilePullToRefresh.tsx`                      | Custom pull-to-refresh      |
| `useNetworkStatus`    | `src/shared/hooks/useNetworkStatus.ts`          | Online/offline monitoring   |

### Mobile Native Features

| Feature                | Status | Implementation                              |
| ---------------------- | ------ | ------------------------------------------- |
| FCM Push Notifications | ✅     | `register_fcm_token` command, WorkManager   |
| Background Sync        | ✅     | Android WorkManager + Rust queue            |
| Biometric Lock         | ✅     | Tauri biometrics plugin                     |
| Share Intent           | ✅     | Receive content from other apps             |
| Offline Queue          | ✅     | `pendingOperations` table + queue processor |
| Device Pairing         | ✅     | QR code Desktop ↔ Mobile                    |
| Deep Links             | ✅     | `smemaster-auth://` callback scheme         |

### Theming & Design System

| Asset                   | Location                                  | Notes                            |
| ----------------------- | ----------------------------------------- | -------------------------------- |
| `ui-tokens.ts`          | `src/shared/styles/ui-tokens.ts`          | Active class token library       |
| `mobile-animations.css` | `src/shared/styles/mobile-animations.css` | Spring curves, page transitions  |
| 3 UI Densities          | `useDensity.ts` + store                   | spacious/compact/default         |
| 8 Color Palettes        | Theme store                               | Light/dark + 6 accent colors     |
| 5 Locales               | i18n system                               | en, fr, ar, ja, it (RTL support) |
| 536 Typed IPC          | `src/shared/services/db/invoke/` (per-domain wrappers) + `src/shared/services/commands.ts` | Full Rust↔TS type safety (canonical count per STATUS.md: 479 `invoke/` + 57 `commands.ts`) |

---

## Competitive Analysis Summary

The 20-app analysis identified ~50 specific UI/UX actions. They have been consolidated into 5 cross-cutting phases and are now **100% implemented**:

| App              | Key Pattern Taken                                                         | Status |
| ---------------- | ------------------------------------------------------------------------- | ------ |
| **Superhuman**   | Swipe gestures (archive/snooze/flag), quick reply sheet, adaptive toolbar | ✅     |
| **Linear**       | Command palette (bottom mobile, top-center desktop), swipe actions        | ✅     |
| **Adaptive knowledge apps** | Bottom sheet (desktop panel → mobile drawer), mobile writing mode | ✅     |
| **Notion**       | Block cards, adaptive layouts                                             | ✅     |
| **Ghost**        | Zen mode (full-screen composer), focus reader                             | ✅     |
| **Mutt**         | Focus reader (chrome-less reading)                                        | ✅     |
| **AppFlowy**     | Bottom navigation (phone) + sidebar (tablet)                              | ✅     |
| **Odoo**         | App launcher grid with badge counts                                       | ✅     |
| **Folk**         | Multi-select with bulk action bar, view switcher                          | ✅     |
| **Twenty**       | Table → card adaptive pattern                                             | ✅     |
| **Thunderbird**  | Unified actions                                                           | ✅     |
| **Cal.com**      | Swipe navigation, page transitions                                        | ✅     |
| **Monday.com**   | Spring physics, transitions                                               | ✅     |
| **Salesforce**   | Dynamic field rendering                                                   | ✅     |
| **HubSpot**      | Timeline animations, offline indicators                                   | ✅     |
| **Superhuman**   | Breakpoint-adaptive layouts                                               | ✅     |
| **Figma**        | Input modality detection                                                  | ✅     |
| **iOS system**   | Floating format bar (text selection)                                      | ✅     |
| **Material You** | Safe area, notch/status bar insets                                        | ✅     |
| **Spotify**      | Long-press context menus                                                  | ✅     |

---

## Remaining Gaps (Post-MVP)

These are items identified as valuable but deferred from the initial UX overhaul. They represent the next frontier.

### P1. Desktop Polish & Power User Features

| #   | Gap                           | Priority | Effort | Notes                                                                                                                         |
| --- | ----------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **Keyboard shortcuts system** | High     | 2h     | Superhuman-style shortcuts (j/k navigate, e archive, etc.). Hook registry for keybindings.                                    |
| 1.2 | **VirtualList optimization**  | Medium   | 3h     | Pagination/virtualization for email lists, contact lists. Already have `@tanstack/react-virtual`. Need to apply to all lists. |
| 1.3 | **Split-pane resizing**       | Medium   | 2h     | Draggable pane dividers in three-pane layout.                                                                                 |
| 1.4 | **Column customization**      | Low      | 4h     | Show/hide/reorder columns in email list, contact list, task list.                                                             |
| 1.5 | **Quick preview (hover)**     | Low      | 3h     | Hover over email shows pop-up preview, like Outlook.                                                                          |
| 1.6 | **Desktop focus modes**       | Low      | 2h     | Do-not-disturb mode, hide sidebar, minimal mode.                                                                              |
| 1.7 | **Drag-and-drop**             | Medium   | 4h     | Drag emails to folders/tasks/calendar. Drag contacts to campaigns.                                                            |
| 1.8 | **Rich context menus**        | Medium   | 2h     | Right-click on emails, contacts, tasks with contextual actions.                                                               |

### P2. Mobile Extended Features

| #   | Gap                       | Priority | Effort | Notes                                               |
| --- | ------------------------- | -------- | ------ | --------------------------------------------------- |
| 2.1 | **iOS build**             | High     | 8h     | `tauri ios init`, signing, App Store readiness.     |
| 2.2 | **Widget/Home Screen**    | Medium   | 4h     | Android widget showing unread count, quick compose. |
| 2.3 | **NFC business card**     | Low      | 2h     | Tap to share contact info via NFC.                  |
| 2.4 | **Camera integration**    | Low      | 2h     | Scan business cards, attach photos.                 |
| 2.5 | **ContactsContract sync** | Low      | 4h     | Bidirectional sync with Android contacts.           |
| 2.6 | **CalendarContract sync** | Low      | 4h     | Bidirectional sync with Android calendar events.    |
| 2.7 | **Smart Lock / Passkey**  | Medium   | 6h     | Biometric + passkey authentication.                 |
| 2.8 | **Push-to-talk**          | Low      | 2h     | Voice input for quick replies.                      |

### P3. Accessibility & Internationalization

| #   | Gap                          | Priority | Effort | Notes                                                         |
| --- | ---------------------------- | -------- | ------ | ------------------------------------------------------------- |
| 3.1 | **Full keyboard navigation** | High     | 3h     | Tab order, focus indicators, skip-links everywhere.           |
| 3.2 | **Screen reader support**    | High     | 4h     | ARIA labels, live regions, roles on all interactive elements. |
| 3.3 | **High contrast mode**       | Medium   | 2h     | Windows high-contrast, increased contrast ratios.             |
| 3.4 | **Font scaling**             | Medium   | 2h     | Respect system font size settings.                            |
| 3.5 | **Reduced motion**           | Medium   | 1h     | `prefers-reduced-motion` support.                             |
| 3.6 | **RTL layout audit**         | Medium   | 2h     | Full RTL support verification for Arabic.                     |
| 3.7 | **Additional locales**       | Low      | 3h     | es, de, pt, zh, hi.                                           |
| 3.8 | **Translation management**   | Medium   | 2h     | i18n extraction tooling, translation file validation.         |

### P4. Visual & Animation Enhancement

| #   | Gap                           | Priority | Effort | Notes                                                                  |
| --- | ----------------------------- | -------- | ------ | ---------------------------------------------------------------------- |
| 4.1 | **Skeleton loading**          | Medium   | 3h     | Animated skeleton screens for all page loads.                          |
| 4.2 | **Animated list transitions** | Medium   | 3h     | AnimateReorder, AnimatePresence for list changes.                      |
| 4.3 | **Micro-interactions**        | Low      | 4h     | Button press effects, success checkmarks, error shakes.                |
| 4.4 | **Empty state illustrations** | Low      | 3h     | Custom illustrations for empty states (inbox zero, no contacts, etc.). |
| 4.5 | **Onboarding flow**           | Medium   | 4h     | First-run walkthrough with animations.                                 |
| 4.6 | **Achievement/toast system**  | Low      | 2h     | Non-intrusive toast notifications for actions.                         |
| 4.7 | **Custom app icons**          | Low      | 1h     | Different icon variants (desktop, mobile, dark/light).                 |

### P5. Data Visualization & Dashboard

| #   | Gap                   | Priority | Effort | Notes                                                      |
| --- | --------------------- | -------- | ------ | ---------------------------------------------------------- |
| 5.1 | **Dashboard widgets** | Medium   | 6h     | Customizable dashboard with charts, KPIs, recent activity. |
| 5.2 | **Activity timeline** | Medium   | 4h     | Contact/company activity timeline (calls, emails, tasks).  |
| 5.3 | **Analytics charts**  | Low      | 6h     | Email volume, response times, campaign performance.        |
| 5.4 | **Heat map calendar** | Low      | 3h     | GitHub-style contribution calendar for email activity.     |
| 5.5 | **Network graph**     | Low      | 6h     | Contact relationship graph (entity pivots visualization).  |

### P6. Cross-Platform & Device

| #   | Gap                            | Priority | Effort | Notes                                                 |
| --- | ------------------------------ | -------- | ------ | ----------------------------------------------------- |
| 6.1 | **Responsive email rendering** | High     | 3h     | Proper email HTML rendering across viewports.         |
| 6.2 | **Desktop app icon badges**    | Medium   | 1h     | Tauri unread badge on app icon (Windows/Mac/Linux).   |
| 6.3 | **System tray / menu bar**     | Medium   | 3h     | Minimize to tray, quick compose from tray.            |
| 6.4 | **Global hotkeys**             | Low      | 2h     | System-wide hotkeys (e.g., Ctrl+Shift+E to compose).  |
| 6.5 | **Clipboard manager**          | Low      | 3h     | Email templates, quick replies as clipboard snippets. |
| 6.6 | **Auto-launch on startup**     | Medium   | 1h     | Tauri auto-launcher plugin.                           |

---

## Prioritization Matrix

```
                HIGH EFFORT
                     │
        P5.3 (Analytics)     P1.7 (Drag-drop)     P2.1 (iOS)
        P5.5 (Network graph)                       P5.1 (Dashboard)
                     │
    LOW              │                          HIGH
  PRIORITY           │────────────────────────── PRIORITY
                     │
        P1.4 (Columns)        P1.6 (Focus modes)    P1.1 (Keyboard)
        P2.3 (NFC)            P4.5 (Onboarding)     P3.1 (Keyboard nav)
        P4.4 (Illustrations)  P4.6 (Toasts)         P3.2 (Screen reader)
                     │
                LOW EFFORT
```

### Immediate Next Sprint (Priority: High + Low Effort)

| #   | Item                           | Effort | Depends On |
| --- | ------------------------------ | ------ | ---------- |
| 1   | **Keyboard shortcuts system**  | 2h     | Nothing    |
| 2   | **Full keyboard navigation**   | 3h     | #1         |
| 3   | **Screen reader support**      | 4h     | Nothing    |
| 4   | **Responsive email rendering** | 3h     | Nothing    |
| 5   | **Rich context menus**         | 2h     | Nothing    |

### Next Sprint After (Priority: High + Medium Effort)

| #   | Item                          | Effort | Depends On |
| --- | ----------------------------- | ------ | ---------- |
| 6   | **Drag-and-drop**             | 4h     | Nothing    |
| 7   | **Skeleton loading**          | 3h     | Nothing    |
| 8   | **RTL layout audit**          | 2h     | Nothing    |
| 9   | **Animated list transitions** | 3h     | Nothing    |
| 10  | **Smart Lock / Passkey**      | 6h     | Nothing    |
| 11  | **System tray / menu bar**    | 3h     | Nothing    |

---

## Implementation Principles

1. **Runtime adaptation, not CSS-only** — Use `usePlatform()` and `useBreakpoint()` for runtime decisions (existing pattern).
2. **Touch-first, keyboard-always** — Mobile gestures are the primary UX; desktop keyboard shortcuts are parallel.
3. **Progressive enhancement** — All new features must work on both platforms. Desktop-only and mobile-only are only when platform API requires it.
4. **YAGNI** — Only build what's needed for identified gaps. No speculative abstraction.
5. **Accessibility is not optional** — All new components meet WCAG 2.1 AA minimum.
6. **Animation via motion library** — Use framer-motion for complex animations, CSS transitions for simple ones.

---

## Current Implementation Status by Phase

| Phase   | Scope                                | Status            | Completed    |
| ------- | ------------------------------------ | ----------------- | ------------ |
| Phase 1 | Responsive Shell & Navigation        | ✅ Done           | 2026-07-05   |
| Phase 2 | Touch & Gesture Layer                | ✅ Done           | 2026-07-05   |
| Phase 3 | Adaptive Component Library           | ✅ Done           | 2026-07-06   |
| Phase 4 | Focus Modes & Chrome-less UX         | ✅ Done           | 2026-07-06   |
| Phase 5 | Animation, Polish & Accessibility    | ✅ Done           | 2026-07-06   |
| Phase 6 | Desktop Polish & Power User Features | ✅ Done (partial) | 2026-07-06   |
| —       | Focus Modes (P1)                     | ✅ Done           | 2026-07-06   |
| —       | Global Shortcuts (P6)                | ✅ Done           | 2026-07-06   |
| —       | Auto-Launch (P6)                     | ✅ Done           | 2026-07-06   |
| —       | Dashboard Charts (P5)                | ✅ Done           | 2026-07-06   |
| —       | Badge Count (P6)                     | ✅ Done           | Pre-existing |
| Phase 7 | Mobile Extended (iOS/Widgets)        | 🔲 Deferred       | —            |
| Phase 8 | Accessibility & i18n Deep Dive       | 🔲 Planned        | —            |

---

## Related Documents

- [Mobile UI Strategy](../03-FRONTEND/06-mobile-ui-strategy.md) — Layout architecture and component reference
- [Design System Guide](../05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) — Tokens, colors, visual patterns
- [Architecture Overview](../01-ARCHITECTURE/05-mobile-architecture.md) — 80/20 code reuse strategy
