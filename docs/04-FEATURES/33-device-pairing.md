# Device Pairing

> Device-linking and pairing flows between desktop and mobile surfaces.

## Scope

Device pairing covers the user-facing flow for connecting supported devices, especially desktop and mobile surfaces that need to establish trust or shared context.

## Current Ownership

Representative code areas:

- `src/features/settings/pages/DevicePairingPage.tsx`
- `src/features/settings/components/PairingSettings.tsx`
- `src/features/settings/pages/MobileSettingsPage.tsx`
- `src-tauri/src/device/pairing.rs`
- related device sync/types modules in `src-tauri/src/device/`

## What It Does

The pairing system provides a structured way to connect devices and bootstrap trusted communication or sync-related workflows.

Current docs should describe it as a device-linking flow owned by settings and native/backend pairing modules, not as an isolated standalone feature directory with outdated component paths.

## Boundaries

Keep these responsibilities separate:

- mobile bridge and native capability docs belong to `35-mobile-native-features.md`
- account/provider setup belongs to `Core/04-accounts.md`

## Key Files

| Area                   | Files                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pairing pages/UI       | `src/features/settings/pages/DevicePairingPage.tsx`, `src/features/settings/components/PairingSettings.tsx` |
| Mobile entrypoint      | `src/features/settings/pages/MobileSettingsPage.tsx`                                                        |
| Backend pairing        | `src-tauri/src/device/pairing.rs`, `src-tauri/src/device/`                                                           |
| Backend discovery/sync | `src-tauri/src/commands/discovery.rs`, `src-tauri/src/commands/sync.rs`                                     |

## Update Rules

Update this page when:

- pairing transport or UX changes materially
- settings ownership changes
- device-linking becomes a broader cross-platform subsystem
