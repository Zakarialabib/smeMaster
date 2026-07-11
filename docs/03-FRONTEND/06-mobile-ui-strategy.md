# Mobile UI Strategy

> Current mobile and adaptive layout strategy across desktop, tablet, and phone-sized surfaces.

## Scope

This page documents the live adaptive-shell model, not an implementation victory lap.

It covers:

- how the app chooses mobile, tablet, and desktop layouts
- which shell components matter today
- where mobile-specific UI and settings live
- how touch and adaptive behavior fit into the broader frontend

## Current Ownership

Primary layout ownership lives in:

- `src/shared/components/layout/shell/MobileShell.tsx`
- related shell components in the same directory
- breakpoint helpers in `src/shared/hooks/useBreakpoint.ts`
- platform/screen helpers in `src/shared/hooks/usePlatform.ts`

Mobile-specific settings and utility surfaces also live in:

- `src/features/settings/pages/MobileSettingsPage.tsx`
- `src/features/mobile/`

## Layout Model

The app uses an adaptive shell approach rather than a separate mobile app codebase.

At a high level:

- small screens collapse into mobile-oriented navigation and touch-first surfaces
- tablet-width screens use intermediate layouts
- wide screens use desktop shell patterns

The key runtime decision point is the shell layer, not a separate product fork.

## Breakpoints

The shared breakpoint helper currently exposes:

- `mobile`
- `tablet`
- `desktop`

The default thresholds are driven by `useBreakpoint.ts`, with more detailed platform/screen metadata available through platform-aware hooks where needed.

## Important Shell Pieces

Current important pieces include:

- `MobileShell`
- `DesktopShell`
- `AppLayout`
- `BottomTabBar`
- `WindowTitleBar`
- adaptive banners and mobile-aware utility components such as `OfflineBanner`

This doc should not reference old shell component paths that no longer exist.

## Mobile-Specific Behavior

The mobile strategy includes:

- adaptive navigation
- touch-friendly UI affordances
- mobile-aware settings and sync controls
- integration with native bridges and platform-aware features

Native bridge specifics belong in `../04-FEATURES/35-mobile-native-features.md`.

## Boundaries

Keep these responsibilities separate:

- visual design tokens belong to `../05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`
- native bridge and Android-specific feature details belong to feature/backend docs
- route ownership belongs to the router and navigation docs

## Related Docs

- `../03-FRONTEND/08-ui-ux-roadmap.md`
- `../04-FEATURES/35-mobile-native-features.md`
- `../05-DEVELOPMENT/07-mobile-development.md`
