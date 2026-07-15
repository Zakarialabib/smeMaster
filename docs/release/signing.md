# SMEMaster Code Signing Guide

> ⚠️ **SCOPE — FUTURE / POST-v1.0.0.** Per `../SECURITY-AUDIT.md`, v1.0.0 ships **Windows (MSI/NSIS) + Android (APK) only, unsigned, with no auto-updater** (no external certs/keys). The macOS notarization and Linux GPG procedures below are **reference for a later release**, not v1.0.0 tasks. The `packaging.yml` / `update-homebrew.yml` workflows referenced in older sections do **not** exist yet.

Every binary that ships to a user must be **signed**. An unsigned build is a
trust failure, a SmartScreen warning, and on macOS a hard block. This document
covers the three target platforms, the secrets that must be configured in CI,
and how to verify a signed artifact.

The shared principles:

1. **Sign in CI, never on a developer laptop.** The signing material must
   only ever live in a CI secret.
2. **Use a separate key per platform.** Compromise of one key does not
   invalidate the others.
3. **Timestamp every signature.** A signature without a counter-signature
   from a trusted timestamp server expires when the certificate does.
4. **Verify before you publish.** The release script verifies locally, and
   the post-release job verifies on the published artifact.

---

## 1. macOS — Developer ID + notarization

Apple requires both a Developer ID Application certificate and notarization
for distribution outside the Mac App Store.

### Prerequisites

- An active **Apple Developer Program** membership ($99 / year).
- A **Developer ID Application** certificate generated in Xcode → Settings →
  Accounts → Manage Certificates. Export as `.p12` with a strong password.
- An **app-specific password** for the Apple ID that owns the team, generated
  at <https://appleid.apple.com/account/manage>.
- The Apple **Team ID** (10-character string in App Store Connect → Membership).

### CI secrets

Set the following in the repository / organization secrets:

| Secret | Value |
| --- | --- |
| `APPLE_ID` | The Apple ID email used for notarization. |
| `APPLE_PASSWORD` | The app-specific password for that Apple ID. |
| `APPLE_TEAM_ID` | The 10-character Apple Team ID. |
| `MACOS_CERT_P12` | Base64 of the `.p12` Developer ID Application certificate. |
| `MACOS_CERT_PASSWORD` | Password for the `.p12`. |
| `MACOS_KEYCHAIN_PASSWORD` | A random password used for the temporary keychain during CI. |

### Signing and notarization workflow

The `packaging.yml` workflow already runs `tauri build` on macOS runners and
performs:

```bash
# Import the certificate into a temporary keychain
security create-keychain -p "$MACOS_KEYCHAIN_PASSWORD" build.keychain
security unlock-keychain -p "$MACOS_KEYCHAIN_PASSWORD" build.keychain
security set-keychain-settings -lut 21600 build.keychain
security import "$MACOS_CERT_P12_FILE" \
  -k build.keychain \
  -P "$MACOS_CERT_PASSWORD" \
  -T /usr/bin/codesign
security list-keychain -d user -s build.keychain

# Build (Tauri auto-codesigns if CSC_LINK / CSC_KEY_PASSWORD are set, but we
# also pass the keychain explicitly for notarization)
tauri build --target universal-apple-darwin

# Notarize
xcrun notarytool submit "target/universal-apple-darwin/bundle/dmg/SMEMaster_*.dmg" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Staple the notarization ticket
xcrun stapler staple "target/universal-apple-darwin/bundle/dmg/SMEMaster_*.dmg"
```

### Verify a signed macOS artifact

```bash
# Signature is valid
codesign --verify --deep --strict --verbose=2 SMEMaster.app

# Notarization ticket is stapled
xcrun stapler validate SMEMaster.app

# Full Gatekeeper check
spctl --assess --type execute --verbose SMEMaster.app
```

Expected output: `SMEMaster.app: accepted` and `source=Notarized Developer ID`.

### Common failure modes

- **"The signature is not valid"** — the cert is not in the login keychain
  when the build runs. The CI step that imports the cert must run **before**
  `tauri build`.
- **"Package not notarized"** — the notarization step did not see the
  hardened runtime. Make sure `tauri.conf.json` has
  `"hardenedRuntime": true` and that `entitlements.plist` allows the
  capabilities you use.
- **"altstore" team is wrong** — `APPLE_TEAM_ID` is for the personal team,
  not the organization team. Cross-check in App Store Connect.

---

## 2. Windows — Authenticode

Windows uses Authenticode. The best experience is an **EV certificate** (no
SmartScreen warning on first run); a standard OV certificate is acceptable
but triggers a one-time SmartScreen warning that must be clicked through.

### Prerequisites

- An EV or OV code signing certificate from a trusted CA (DigiCert,
  Sectigo, GlobalSign). EV requires a hardware token (USB key) in some
  cases; we use a cloud-based EV that exports a `.pfx`.
- Export the certificate as `.pfx` / `.p12` with a strong password.

### CI secrets

| Secret | Value |
| --- | --- |
| `WINDOWS_CERT_FILE` | Base64 of the `.pfx` certificate. |
| `WINDOWS_CERT_PASSWORD` | Password for the `.pfx`. |
| `WINDOWS_TIMESTAMP_URL` | `http://timestamp.digicert.com` (or your CA's URL). |

### Signing and notarization workflow

The `packaging.yml` workflow uses `signtool.exe` (part of the Windows
SDK). Tauri can also call `signtool` automatically via
`signCommand` in `tauri.conf.json` — we use the explicit form for clarity:

```powershell
# Decode the cert
[System.IO.File]::WriteAllBytes(
  "$env:TEMP\cert.pfx",
  [System.Convert]::FromBase64String($env:WINDOWS_CERT_FILE)
)

# Sign every executable and installer
Get-ChildItem -Recurse -Include *.exe,*.msi,*.dll |
  ForEach-Object {
    & "C:\Program Files (x86)\Windows Kits\10\bin\<sdk-version>\x64\signtool.exe" sign `
      /fd SHA256 `
      /tr $env:WINDOWS_TIMESTAMP_URL `
      /td SHA256 `
      /f "$env:TEMP\cert.pfx" `
      /p $env:WINDOWS_CERT_PASSWORD `
      $_.FullName
  }
```

### Verify a signed Windows artifact

```powershell
# Confirm signature is valid and signed by a trusted CA
Get-AuthenticodeSignature "C:\Program Files\SMEMaster\SMEMaster.exe" |
  Select-Object Status, SignerCertificate, TimeStamperCertificate

# Should print:
# Status                : Valid
# SignerCertificate     : CN=SMEMaster Inc., ...
# TimeStamperCertificate: CN=DigiCert Trusted Timestamp, ...
```

Or in cmd:

```cmd
signtool verify /pa /v "C:\Program Files\SMEMaster\SMEMaster.exe"
```

Expected: `Successfully verified` and a timestamped signature from your CA.

### Common failure modes

- **"SignTool requires CAPICOM / .NET 2.0"** — the runner has the wrong
  signtool. Use the Windows 10 SDK 20348 or later.
- **SmartScreen warning on first launch** — using an OV cert (expected), or
  the EV cert was just issued and SmartScreen reputation has not built up
  yet.
- **Timestamp server unreachable** — switch to a backup TSA, e.g.
  `http://timestamp.sectigo.com`.

---

## 3. Linux — GPG signing

Linux users are pickier about signatures than other platforms because the
package manager will refuse to install an unsigned `.deb` / `.rpm` on a
hardened system. AppImage is a single file and is signed with GPG detached
signatures.

### Prerequisites

- A **GPG key** with a subkey for signing. The primary key should be kept
  offline; the subkey is what CI imports.
- The public key uploaded to <https://keys.openpgp.org> and the project's
  website (`/keys.asc`).

### CI secrets

| Secret | Value |
| --- | --- |
| `GPG_PRIVATE_KEY` | ASCII-armored private subkey (the **signing subkey only**, not the primary). |
| `GPG_PASSPHRASE` | Passphrase for that subkey, if any. |
| `GPG_KEY_ID` | Long key ID of the signing subkey, e.g. `0xDEADBEEF12345678`. |

### Signing workflow

```bash
# Import the signing subkey
echo "$GPG_PRIVATE_KEY" | gpg --import --batch --yes

# Sign the .deb
dpkg-sig --sign builder "target/deb/SMEMaster_${VERSION}_amd64.deb"

# Sign the .rpm
rpm --addsign "target/rpm/SMEMaster-${VERSION}.x86_64.rpm"
rpm --checksig "target/rpm/SMEMaster-${VERSION}.x86_64.rpm"

# Sign the .AppImage with a detached GPG signature
gpg --armor --detach-sign --local-user "$GPG_KEY_ID" \
  "target/appimage/SMEMaster_${VERSION}_x86_64.AppImage"
mv "target/appimage/SMEMaster_${VERSION}_x86_64.AppImage.asc" \
   "target/appimage/SMEMaster_${VERSION}_x86_64.AppImage.sig"
```

### Verify a signed Linux artifact

```bash
# .deb
dpkg-sig --verify "SMEMaster_1.0.0_amd64.deb"

# .rpm
rpm --checksig -v "SMEMaster-1.0.0.x86_64.rpm"

# .AppImage
gpg --verify "SMEMaster_1.0.0_x86_64.AppImage.sig" \
            "SMEMaster_1.0.0_x86_64.AppImage"
```

Expected: a `Good signature from SMEMaster <security@smemaster.app>` line
with the key fingerprint matching the one published at `/keys.asc`.

### Common failure modes

- **"No public key"** — the tester does not have your key. Make sure
  `/keys.asc` is served and link to it from the install page.
- **"Can't check signature: public key not found"** — `debsigs` is not
  installed in the verifier's environment.
- **AppImage signature is detached but missing** — the release script
  forgot to rename the `.asc` to `.sig`. AppImageLauncher and
  AppImageUpdate specifically look for `.sig`.

---

## 4. Auto-updater public key

The Tauri auto-updater uses an asymmetric key pair. The **public key** is
embedded in the binary at build time (in `tauri.conf.json`) and is used to
verify that updates come from us. The **private key** signs the update
manifest in CI.

### Generate a key pair (once per release channel)

```bash
tauri signer generate --wigner
```

This produces `~/.tauri/smemaster.key` (private) and prints the public key.
Store the private key as `TAURI_SIGNING_PRIVATE_KEY` in CI, and the public
key in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": ["https://releases.smemaster.app/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

### Verify the key matches

Before cutting a tag, run:

```bash
diff <(echo "$TAURI_SIGNING_PRIVATE_KEY" | tauri signer sign --help 2>/dev/null | grep -oP 'Public key: \K.*') \
     <(jq -r '.plugins.updater.pubkey' src-tauri/tauri.conf.json)
```

If the two strings differ, **stop**. The auto-updater will not work for
existing installs.

---

## 5. Summary — what goes where

| Secret | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Signing material | `MACOS_CERT_P12`, `MACOS_CERT_PASSWORD` | `WINDOWS_CERT_FILE`, `WINDOWS_CERT_PASSWORD` | `GPG_PRIVATE_KEY` |
| Identity | `APPLE_ID`, `APPLE_TEAM_ID` | n/a | `GPG_KEY_ID` |
| Notarization | `APPLE_PASSWORD` | n/a | n/a |
| Timestamp | implicit in `notarytool` | `WINDOWS_TIMESTAMP_URL` | n/a |
| Auto-updater | `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY` |
