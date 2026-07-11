# SMEMaster Pre-Release Checklist

This is the last gate before tagging `v1.0.0`. Every box must be ticked and
the corresponding link / output pasted into the release ticket. **Do not cut a
tag from a branch where any box is unchecked.**

The checklist is intentionally short. If you find yourself wanting to add
"verify that …" to this list, that probably belongs in a more specific gate
document (e.g. PROD-GATE-6 for security).

---

## 1. Gates

- [ ] All Gate 0–8 marked **PASS** in the corresponding `PROD-GATE-*.md`
      files. Confirm with the gate owner for each one — a stale "PASS" from
      last week is not a PASS for this release.
- [ ] The release ticket links the latest commit SHA where each gate was
      signed off.

## 2. Security

- [ ] **Dependency audit** shows zero exploitable **HIGH** or **MEDIUM**
      vulnerabilities. Run `npm audit` and `cargo audit`. Suppressions must
      be listed in `SECURITY-AUDIT.md` with justification and expiry.
- [ ] Code signing certificates are **valid** and not within 14 days of
      expiry.
- [ ] Auto-updater public key in `tauri.conf.json` matches the private key
      in CI secrets.

## 3. Tests

- [ ] All **3205 tests** pass locally on the release branch.
- [ ] All 3205 tests pass in CI on the same SHA.
- [ ] No test was skipped or marked `.todo()` in the last 7 days.

## 4. CI

- [ ] CI build is **green** on Linux, macOS, and Windows runners for the
      release SHA.
- [ ] The packaging workflow produced a valid installer artifact for each
      target platform.
- [ ] The release-please workflow ran successfully for the last 3 commits
      (this proves the changelog generator is healthy).

## 5. Cross-platform onboarding smoke test

- [ ] Onboarding tested end-to-end on a clean **Windows 11** VM.
- [ ] Onboarding tested end-to-end on a clean **macOS 14** VM.
- [ ] Onboarding tested end-to-end on a clean **Ubuntu 24.04** VM.
- [ ] Onboarding tested end-to-end on a clean **Fedora 40** VM.
- [ ] Onboarding tested end-to-end on a clean **Arch Linux** VM.

## 6. Code signing

- [ ] **macOS:** Apple Developer ID Application certificate is in the CI keychain, notarization credentials are in `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` secrets.
- [ ] **Windows:** EV or standard code signing certificate is in `WINDOWS_CERT_FILE` / `WINDOWS_CERT_PASSWORD` secrets. The signing timestamp server is reachable.
- [ ] **Linux:** GPG signing key is in CI; the public key is published on a keyserver; `.deb`, `.AppImage`, and `.rpm` are signed.

## 7. Release notes

- [ ] Release notes are drafted in `docs/user-guide/release-notes.md` with:
  - [ ] Headline features
  - [ ] Bug fixes (linked to GitHub issues)
  - [ ] Known issues (with workarounds)
  - [ ] Upgrade instructions (when breaking)
  - [ ] Credits and acknowledgements

## 8. Legal and trust

- [ ] Privacy policy URL is **live** and resolves with HTTP 200.
- [ ] Privacy policy is linked from the in-app About screen and from the
      project README.
- [ ] Terms of service (if any) are linked.
- [ ] License file in the repo matches the published license.

## 9. Versioning

- [ ] `package.json` `version` is bumped.
- [ ] `src-tauri/Cargo.toml` `version` is bumped.
- [ ] `src-tauri/tauri.conf.json` `version` is bumped.
- [ ] All three match exactly. (See `scripts/bump-version.sh` /
      `scripts/release.ps1`.)
- [ ] The version is consistent with the migration plan in
      `docs/06-ROADMAP/release-strategy.md`.

## 10. Final approvals

- [ ] Engineering lead approval recorded in the release ticket.
- [ ] Product lead approval recorded in the release ticket.
- [ ] Security lead approval recorded in the release ticket (only required
      for the v1.0.0 release, or for any release that ships a security fix).

---

## Sign-off

When every box is ticked, run `scripts/release.ps1 <version>` (or
`scripts/bump-version.sh <version>` followed by the GitHub Actions release
workflow on a manual trigger). The release script verifies the tree is
clean, tests pass, and pushes the tag.

The release lead signs here:

- **Release lead:** ____________________
- **Date:** ____________________
- **Tag:** ____________________
- **Commit SHA:** ____________________
