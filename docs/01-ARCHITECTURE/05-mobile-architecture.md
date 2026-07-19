# Mobile Architecture

> **What you need to know:** ~80% code shared with desktop, ~20% native Android glue. Tauri v2 mobile bridge handles the hard parts. The APK already builds (352MB arm64).

---

## The 80/20 Rule

| Shared (~80%)       | Platform-specific (~20%)                      |
| ------------------- | --------------------------------------------- |
| Core business logic | Kotlin plugins (biometrics, haptics)          |
| Zustand stores      | Mobile UI adaptations (bottom nav vs sidebar) |
| SQLite schema       | Hardware access (NFC, camera)                 |
| React components    | Native splash screen                          |
| Rust commands       | Background sync (WorkManager)                 |

**Goal:** Write once for the feature, adapt the UI per platform.

---

## How It's Stacked

```
React 19 + Tailwind (Adaptive Layout)
    │
Zustand Stores (Shared)
    │
Service Layer + Platform Detection
    │
Tauri v2 Mobile Bridge ──────── Kotlin Plugins (Android)
    │
Rust Core (Shared Commands)
    │
SQLite (Same DB, Same Queries)
```

---

## Four Layers of Platform Detection

### Layer 0: Native Bridges (Kotlin `@JavascriptInterface`)

Direct Kotlin→JS channels that bypass Tauri IPC for latency-sensitive calls:

| Bridge               | Method                     | What it does                                |
| -------------------- | -------------------------- | ------------------------------------------- |
| `SplashBridge`       | `onAppReady()`             | Dismisses native splash when React is ready |
| `HapticsBridge`      | `performHaptic(intensity)` | Triggers haptic feedback                    |
| `MainActivityBridge` | `openMediaPicker()`        | Launches system photo picker                |

These exist only after `onWebViewCreate()` on Android — **always wrap in try/catch**.

### Layer 1: Screen Size (`useMobile.ts`)

Detects viewport width. Controls **layout only**:

- `< 768px` → mobile layout (bottom nav, stacked panes)
- `< 1024px` → tablet layout
- `>= 1024px` → desktop layout (sidebar, split pane)

### Layer 2: Runtime Platform (`usePlatform()` → `invoke("get_platform")`)

Controls **behavior** (not layout):

- `platform.mobile` → touch gestures, back button, haptics
- `platform.desktop` → keyboard shortcuts, tray icon, window management

### Layer 3: Conditional Compilation (Rust `#[cfg()]`)

Controls **native API availability** at compile time:

- `#[cfg(mobile)]` → biometric auth, android module, splash events
- `#[cfg(desktop)]` → tray icon, single-instance, window management
- `#[cfg(target_os = "android")]` → platform info, asset cache paths

---

## Platform-Adaptive Components Pattern

```tsx
function ThreadView() {
  const platform = usePlatform();
  const isNarrow = useMobile();

  // Layout adapts to screen size
  if (isNarrow) return <ThreadViewMobile />;

  // Behavior adapts to platform
  const handleBack = platform.mobile ? () => window.history.back() : () => navigateToMailList();

  return <ThreadViewDesktop onBack={handleBack} />;
}
```

**The rule:** Layout decisions use screen size. Behavior decisions use platform. Never the other way around.

---

## Native Feature Wrappers

Wrap native-only features behind platform checks. Desktop gets a no-op:

```ts
// shared/hooks/useBiometricLock.ts
const result = platform.mobile ? await invoke('plugin:biometric|check_biometric') : true; // desktop: always authenticated
```

---

## What Stays in Rust vs Frontend

| Feature        | Location | Why                                      |
| -------------- | -------- | ---------------------------------------- |
| IMAP/SMTP      | Rust     | Native TLS + TCP needed                  |
| SQLite         | Rust     | Via sqlx, Tauri-managed pool             |
| PGP            | Rust     | Sequoia is the only viable OpenPGP crate |
| CSV parsing    | Frontend | CPU-light, PapaParse works anywhere      |
| PDF extraction | Frontend | Removed (decoupled from MVP)             |

---

## Key Files (Mobile)

| File                                                   | Purpose                                   |
| ------------------------------------------------------ | ----------------------------------------- |
| `src/shared/hooks/usePlatform.ts`                      | Runtime platform detection                |
| `src/shared/hooks/useMobile.ts`                        | Screen width detection                    |
| `src/shared/components/layout/shell/MobileShell.tsx` | Adaptive shell (phone/tablet/desktop)     |
| `src/features/accounts/components/mobile/BiometricLockScreen.tsx` | Biometric auth                            |
| `src-tauri/src/platform.rs`                            | `get_platform` command                    |
| `src-tauri/gen/android/.../MainActivity.kt`            | Kotlin entry — splash, bridges, lifecycle |

---

## Current Limitations (Honest)

- iOS build requires a Mac (I use Windows + WSL)
- Mobile UI works but is rough around the edges
- `is_tablet` is hardcoded to `false` in Rust — Kotlin should provide actual screen metrics
- `useBreakpoint.ts` in contacts uses `639px` threshold — inconsistent with rest of app
- Background sync drains battery (FCM-driven sync planned)

## Source reconciliation (2026-07-19)

Two `Key Files (Mobile)` paths were wrong and corrected against source:
- `MobileShell.tsx` lives at `src/shared/components/layout/shell/MobileShell.tsx` (not `src/shared/components/mobile/`).
- `BiometricLockScreen.tsx` lives at `src/features/accounts/components/mobile/BiometricLockScreen.tsx` (not `src/shared/components/mobile/`).
The `useBreakpoint.ts` "639px threshold in contacts" limitation remains accurate: `src/features/contacts/services/` references `useBreakpoint.ts` with a 639px threshold (see `src/shared/hooks/useBreakpoint.ts`).
