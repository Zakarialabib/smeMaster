# Release Automation

This folder contains scripts for automating the SMEMaster release process (Gate 9.3).

## Scripts

| Script | Purpose |
|--------|---------|
| [`validate-release.ps1`](../../scripts/validate-release.ps1) | Pre-release validator — checks all Gates 0-8 are PASS before tagging |
| [`release.ps1`](../../scripts/release.ps1) | Full release script — runs tests, audit, bumps version, creates tag, pushes |
| [`bump-version.sh`](../../scripts/bump-version.sh) | Bash version bumper (Linux/macOS) — updates all 3 version files |
| [`release-notes.ps1`](../../scripts/release-notes.ps1) | Auto-generates release notes from git history |

## Standard Release Flow

```powershell
# 1. Run pre-release validator
.\scripts\validate-release.ps1

# 2. Bump version
.\scripts\bump-version.sh 1.0.0

# 3. Generate release notes
.\scripts\release-notes.ps1 -Version 1.0.0

# 4. Commit and tag
git add .
git commit -m "chore(release): v1.0.0"
git tag -a v1.0.0 -m "SMEMaster v1.0.0"

# 5. Push (triggers GitHub Actions release workflow)
git push origin main --follow-tags
```

Or use the all-in-one script:

```powershell
.\scripts\release.ps1 -Version 1.0.0
```

## CI Integration

The `validate-release.ps1` script can be run as a CI gate before allowing merges to `main`:

```yaml
- name: Validate production readiness
  run: .\scripts\validate-release.ps1 -SkipBuild
```

## Manual Steps Still Required

The following cannot be automated and must be done by a human:

- Acquire code signing certificates (Apple Developer, Windows EV)
- Generate the Tauri auto-updater public key via `tauri signer generate`
- Conduct dogfooding (7 days)
- Recruit and run beta testing (1 week)
- Write the privacy policy URL when domain is set up

See [`checklist.md`](checklist.md) for the full pre-release checklist.
