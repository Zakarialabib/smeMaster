# Mobile Native Features

> Overview of the current mobile-native surface across Tauri, Kotlin bridges, and mobile-specific settings/UI.

## Scope

This page documents the native-mobile capabilities that are currently wired or intentionally scoped:

- Android JavaScript bridge interfaces
- mobile-specific settings and background sync preferences
- biometric and device-specific hooks
- media picker, splash, haptics, and pairing entrypoints
- pending native integrations that are not yet product-ready

It does not try to restate general feature behavior already covered elsewhere.

## Native Bridge Layer

SMEMaster uses typed bridge declarations for Android WebView-to-Kotlin integrations.

Source of truth:

- `src/types/native-bridges.d.ts`
- `src/shared/services/nativeBridges.ts`

Current declared bridges:

| Bridge               | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `SplashBridge`       | Lets React signal that the app is ready so the native splash can dismiss. |
| `HapticsBridge`      | Triggers Android haptic feedback with typed intensity values.             |
| `MainActivityBridge` | Opens the native media picker.                                            |
| `DeviceInfoBridge`   | Exposes screen metrics and size classification.                           |
| `EventRelayBridge`   | Relays typed events across layers where needed.                           |

The previous "missing type stubs" note is no longer accurate; the type declarations already exist.

## Current Implemented Mobile Surfaces

### Splash and app readiness

The mobile app uses a coordinated readiness flow between native startup and the React app. The details should stay close to the native implementation, but the important product fact is simple: the splash lifecycle is wired and no longer a missing subsystem.

### Haptics and media picker

Custom bridge-backed integrations exist for:

- haptic feedback
- native media picking

These are exposed through the typed bridge layer rather than undocumented `window as any` calls.

### Background sync preferences

The current user-facing mobile sync surface is centered on `MobileSettingsPage`:

- `src/features/settings/pages/MobileSettingsPage.tsx`

That page manages:

- enable/disable background sync
- sync interval preferences
- cache clearing
- biometric availability state
- device pairing entrypoint
- push-notification preference UI

Background sync preferences are stored through the shared settings service rather than old local-only browser keys.

### Device pairing

Device pairing is not an isolated top-level mobile feature directory. It is surfaced through settings and dedicated pairing pages/routes.

Relevant areas:

- `src/features/settings/pages/DevicePairingPage.tsx`
- `src/features/settings/pages/MobileSettingsPage.tsx`

### Biometrics

Biometric support is wired through mobile-aware hooks and lock flows, with availability checks coming from native commands rather than from ad hoc frontend-only state.

## Status Overview

| Capability                                  | Status                                | Notes                                                                                              |
| ------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Splash readiness bridge                     | Implemented                           | Uses the native bridge path and app readiness wiring.                                              |
| Haptics bridge                              | Implemented                           | Custom bridge-backed support exists.                                                               |
| Native media picker bridge                  | Implemented                           | Exposed through the `MainActivityBridge`.                                                          |
| Device info bridge types                    | Implemented                           | Declared in `src/types/native-bridges.d.ts`.                                                       |
| Background sync settings UI                 | Implemented                           | Managed from `MobileSettingsPage`.                                                                 |
| Device pairing entrypoint                   | Implemented                           | Lives in settings routes/pages.                                                                    |
| Biometrics                                  | Implemented/available where supported | Availability is checked via native command paths.                                                  |
| Notifications                               | Partial                               | UI/state exists, but full mobile notification product coverage is not the same as "fully shipped". |
| Camera/barcode/NFC/geolocation extras       | Planned or partial                    | Keep these as roadmap items until code and UX are both ready.                                      |
| Foreground-service style persistent sync UX | Planned                               | Not current product behavior.                                                                      |

## What Not To Claim

Avoid outdated statements such as:

- missing `native-bridges.d.ts`
- a non-existent `SyncSettings.tsx`
- app-wide hooks that no longer exist
- dated "fixed on YYYY-MM-DD" notes that belong in release notes, not feature docs

## Key Files

| Area                        | Files                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typed bridge declarations   | `src/types/native-bridges.d.ts`                                                                                                                      |
| Safe bridge access helpers  | `src/shared/services/nativeBridges.ts`                                                                                                               |
| Mobile-specific settings UI | `src/features/settings/pages/MobileSettingsPage.tsx`                                                                                                 |
| Mobile feature components   | `src/features/mobile/`                                                                                                                               |
| Native backend/mobile glue  | `src-tauri/src/android/`, `src-tauri/src/commands/system.rs`, `src-tauri/src/commands/system_android.rs`, `src-tauri/src/commands/system_desktop.rs` |

## Update Rules

Update this page when:

- a native bridge is added or removed
- a planned mobile integration becomes product-ready
- mobile settings ownership moves
- pairing, biometrics, or background sync changes user-facing behavior

Keep speculative roadmap language minimal. If something is not wired end-to-end yet, describe it as planned rather than implemented.
