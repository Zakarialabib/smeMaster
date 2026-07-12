# Mobile Build Pipeline

> **Status:** Preparation guide | **Requires:** Android SDK, Xcode (macOS only)

**What you need to know:** This is the playbook for building SMEMaster on Android and iOS. It works — I've verified the Android build on my machine. But mobile builds have a lot of moving parts (NDK, Java, Rust cross-compilation, deep links, FCM). This doc captures every step and every pitfall I've hit so far.

## Prerequisites

### Android

- Android Studio (latest)
- Android SDK 34+
- Java 17+ (JDK)
- Gradle (bundled with Tauri)

### iOS (macOS only)

- Xcode 16+
- iOS SDK 18+
- CocoaPods (for native dependencies)

## Setup steps

### 1. Initialize Android platform

```bash
cd src-tauri
cargo tauri android init
```

This creates `src-tauri/gen/android/` with the Gradle project.

### 2. Initialize iOS platform

```bash
# macOS only
cargo tauri ios init
```

This creates `src-tauri/gen/ios/` with the Xcode project.

### 3. Configure deep links

Mobile deep links are already configured in `tauri.conf.json`. Schemes: `smemaster://` + `smemaster-auth://`.

### 4. Build for Android

```bash
cargo tauri android build --target aarch64
# APK at: src-tauri/gen/android/app/build/outputs/apk/
```

### 5. Build for iOS

```bash
# macOS only
cargo tauri ios build
# IPA at: src-tauri/gen/ios/build/
```

## My actual build setup (as of 2026-05-16)

### ✅ What's already installed

- **Java JDK 17**: `C:\Program Files\AdoptOpenJDK\jdk-17.0.0.20-hotspot`
- **Rust Android targets**: `aarch64-linux-android`, `armv7-linux-androideabi`, `x86_64-linux-android`, `i686-linux-android`
- **Tauri CLI**: `cargo-tauri v2.11.1`

### ✅ SDK components

- **cmdline-tools**: latest, in `%ANDROID_HOME%\cmdline-tools\latest\`
- **platform-tools**: r37.0.0
- **platforms;android-34**: API 34 rev 3
- **build-tools;34.0.0**: Build Tools 34.0.0
- **NDK**: android-ndk-r27d (`%ANDROID_HOME%\ndk\27.3.13750724`)

### ✅ Android project init

```bash
npm run tauri android init
```

→ `src-tauri\gen\android\` generated successfully.

### ✅ Build status

Both desktop and Android NDK cross-compilation pass clean.

| Target                                | Command                 | Status                               |
| ------------------------------------- | ----------------------- | ------------------------------------ |
| Desktop (x86_64-pc-windows-msvc)      | `cargo check`           | ✅ 0 errors, 6 pre-existing warnings |
| Android ARM64 (aarch64-linux-android) | `. .\build-android.ps1` | ✅                                   |
| Linux (x86_64-unknown-linux-gnu)      | `cargo check`           | ✅ (cross-compile not tested)        |

**Current limitation:** Running `npm run android` (`cargo tauri android dev`) needs an Android Emulator or physical device:

```
Error No available Android Emulator detected
```

I just haven't created the AVD yet.

### NDK cross-compilation fix

The `aws-lc-sys` and `ring` crates need the NDK C compiler for Android targets. I wrote a helper script:

```powershell
# From src-tauri/
.\build-android.ps1                     # cargo check for aarch64-linux-android
.\build-android.ps1 -Target armv7-linux-androideabi  # 32-bit ARM
.\build-android.ps1 -Command build      # Full build
```

The script sets `CC_aarch64-linux-android` and `AR_aarch64-linux-android` env vars pointing to the NDK toolchain. Requires:

- `ANDROID_HOME` environment variable set
- NDK r27d installed at `%ANDROID_HOME%\ndk\27.3.13750724\`

### Google Services (FCM)

`google-services.json` is configured with the real Firebase project (`smemaster-fc43d`). FCM push notifications need an Android device or emulator with Google Play Services.

## Creating an Android emulator (AVD)

I still need to do this. Here's what I'll run:

1. Install an emulator image:
   ```powershell
   & "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "system-images;android-34;google_apis;x86_64"
   ```
2. Create the AVD:
   ```powershell
   & "$env:ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" create avd -n "SMEMaster_Emulator" -k "system-images;android-34;google_apis;x86_64"
   ```
3. Start the emulator:
   ```powershell
   & "$env:ANDROID_HOME\emulator\emulator.exe" -avd "SMEMaster_Emulator"
   ```
4. Run the app:
   ```powershell
   npm run android
   ```

**Alternative:** Android Studio bundles its own SDK manager and NDK downloader. Install it, open SDK Manager, install:

1. Android SDK Platform 34
2. Android SDK Build-Tools 34
3. Android NDK
   Then run `cargo tauri android init --ci --skip-targets-install`.

## Linux Build

Linux builds use `tauri.linux.conf.json` and support three formats:

```bash
# Build for Linux
cd src-tauri
cargo tauri build --target x86_64-unknown-linux-gnu

# Outputs:
#   target/release/bundle/deb/   — .deb (Debian/Ubuntu)
#   target/release/bundle/appimage/ — .AppImage (universal)
#   target/release/bundle/rpm/   — .rpm (Fedora/RHEL)
```

**Prerequisites:**

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev
```

## macOS Build

macOS builds require a Mac with Xcode. No platform-specific config is needed — the base `tauri.conf.json` applies.

```bash
cargo tauri build --target aarch64-apple-darwin
```

## Windows build issues I've hit

### "This app can't run on your PC" (Windows SmartScreen)

This shows up when trying to run an unsigned `.exe` or `.msi`. Here's what causes it and how to deal with it:

| Cause                            | Fix                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Unsigned executable**          | Tauri dev builds aren't signed. There's `"signCommand": null` in `tauri.conf.json` for now. For release, get a code signing cert. |
| **SmartScreen block**            | Click "More info" → "Run anyway". Or add an exclusion in Windows Security → App & browser control.                                |
| **Missing VC++ redistributable** | Install "Microsoft Visual C++ 2015-2022 Redistributable". The Tauri webview needs it.                                             |
| **WebView2 not installed**       | Pre-installed on Windows 10/11. If not, grab it from Microsoft's site.                                                            |
| **Architecture mismatch**        | On ARM Windows (Surface Pro X), use x64 emulation or build for ARM64.                                                             |

### Build commands

```powershell
# Standard Windows installer
npm run windows:build

# Portable MSI (no admin required)
npm run windows:portable
```

## Known issues & their status

| Issue                                | Status        | Workaround                                                                                                |
| ------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| `native-tls` not available on mobile | ✅ Resolved   | Using `rustls` with `default-features`                                                                    |
| NDK clang/ar not in PATH             | ✅ Resolved   | Use `.\build-android.ps1`                                                                                 |
| Window management APIs on mobile     | ✅ Guarded    | `#[cfg(desktop)]` on tray, shortcuts, window management                                                   |
| Tray icon on mobile                  | ✅ Guarded    | `#[cfg(desktop)]` — no-op                                                                                 |
| Global shortcuts                     | ✅ Removed    | Plugin removed, frontend is a no-op                                                                       |
| `google-services.json`               | ✅ Configured | Real Firebase project `smemaster-fc43d`                                                                   |
| Notification channels                | ✅ Configured | 4 channels: email_new, email_sync, downloads, reminders                                                   |
| Deep link schemes                    | ✅ Configured | `smemaster://` + `smemaster-auth://` in manifest                                                          |
| Java JDK                             | Required      | AdoptOpenJDK 17 at `C:\Program Files\AdoptOpenJDK\jdk-17.0.0.20-hotspot`                                  |
| Android SDK                          | Required      | At `%ANDROID_HOME%`                                                                                       |
| Rust Android targets                 | Required      | `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android` |
| NDK download corrupted               | ⚠️ Risk       | Re-download on stable network or use Android Studio                                                       |
| sdkmanager.bat "Tag mismatch"        | ⚠️ Risk       | Java SSL issue. Use `curl.exe -L` with HTTP URLs                                                          |
| Windows SmartScreen block            | ⚠️ Dev build  | Unsigned dev build. Click "More info" → "Run anyway"                                                      |
| Missing VC++ redistributable         | Required      | Install from Microsoft's site                                                                             |
