# Mobile Development

> Current guide for running, debugging, and validating the mobile-oriented parts of SMEMaster.

## Scope

This page covers the practical contributor workflow for mobile development.

It covers:

- Android development entrypoints
- debugging tools
- where mobile-specific code lives
- what to verify when changing mobile behavior

## Current Reality

SMEMaster is still one app with adaptive mobile-oriented surfaces, not a separate fully independent mobile product tree.

Important mobile-related areas include:

- `src/features/mobile/`
- `src/features/settings/pages/MobileSettingsPage.tsx`
- `src/shared/components/layout/shell/`
- Android/native code under `src-tauri/gen/android/`
- Rust mobile/backend support under `src-tauri/src/`

## Main Commands

| Command                     | Purpose                        |
| --------------------------- | ------------------------------ |
| `npm run android`           | Start Android development flow |
| `npm run android:build`     | Build Android target           |
| `npm run android:build:apk` | Build APK                      |
| `npm run android:build:aab` | Build AAB                      |

## Debugging Workflow

Useful tools:

- `adb logcat` for native/runtime logs
- Chrome DevTools for WebView debugging
- Android Studio tooling for emulator/device inspection
- standard web debugging tools for adaptive UI issues

## What To Check When Editing Mobile Behavior

When changing mobile-related code, verify:

1. adaptive shell/layout behavior
2. touch interactions and spacing
3. mobile settings flows
4. native bridge assumptions if the change crosses into Android-specific behavior
5. whether the same change affects tablet and desktop layouts

## Boundaries

Keep these responsibilities separate:

- adaptive layout strategy belongs to `../03-FRONTEND/06-mobile-ui-strategy.md`
- native/mobile feature inventory belongs to `../04-FEATURES/35-mobile-native-features.md`
- release/signing specifics belong to production and release docs

## Related Docs

- `../03-FRONTEND/06-mobile-ui-strategy.md`
- `../04-FEATURES/35-mobile-native-features.md`
- `../03-FRONTEND/08-ui-ux-roadmap.md`
