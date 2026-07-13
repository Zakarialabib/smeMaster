# Release Pipeline

> How dev → main daily PRs, Release Please, and artifact builds work together.

## Quick Reference

```text
                     ┌──────────────────┐
                     │  Developers push  │
                     │  to dev branch    │
                     └────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Daily PR         │  ← .github/workflows/daily-pr.yml
                    │  (dev → main)     │     runs every midnight UTC
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Merge PR         │  ← manual merge or auto-merge
                    │  into main        │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Release Please   │  ← .github/workflows/release-please.yml
                    │  creates release  │     bumps version, updates CHANGELOG
                    │  PR with tag      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Merge release PR │
                    │  → tag triggers   │
                    │  release.yml      │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──────┐ ┌─────▼───────┐ ┌─────▼───────┐
    │ Build Windows  │ │ Build       │ │ Create      │
    │ MSI + NSIS     │ │ Android APK │ │ GitHub      │
    │                │ │             │ │ Release     │
    └─────────┬──────┘ └─────┬───────┘ └─────┬───────┘
              │              │               │
              └──────────────┴───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Release assets   │
                    │  published to     │
                    │  GitHub Releases  │
                    └───────────────────┘
```

## Workflow Files

All live in `.github/workflows/`:

| File                 | Trigger                        | Purpose                                                                                                                                  |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `daily-pr.yml`       | Cron (daily) + manual dispatch | Creates/updates a PR from `dev` → `main` with a log of commits since last sync                                                           |
| `ci.yml`             | Push to `main`, PRs to `main`  | TypeScript check, ESLint, Vitest, `cargo check`, `cargo test`, Vite build                                                                |
| `release-please.yml` | Push to `main`                 | Uses `googleapis/release-please-action` to detect new commits, bumps version, updates CHANGELOG, creates a release PR with a version tag |
| `release.yml`        | Tag push `v*` + workflow_call  | Builds Windows MSI/NSIS and Android APK, uploads artifacts to the GitHub Release                                                         |

## The Daily PR (`daily-pr.yml`)

Runs every day at midnight UTC (and can be triggered manually from the Actions tab).

```yaml
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:
```

It does:

1. Fetches `origin/main` and `origin/dev`
2. Counts commits `dev` is ahead of `main`
3. If ahead > 0, **creates or updates** a PR titled `chore: daily sync dev → main (YYYY-MM-DD)`
4. PR body includes a git log of all new commits: `git log origin/main..origin/dev --oneline --no-merges`
5. If no new commits, the job exits silently (no PR created)

> **Note:** the PR is not auto-merged. A human (or a follow-up rule) must click merge.
> This gives CI time to run on the PR and lets you catch conflicts before they reach `main`.

## Release Please (`release-please.yml`)

Runs on every push to `main`.

Uses [googleapis/release-please-action](https://github.com/googleapis/release-please-action) to:

1. Scan commits on `main` since the last release
2. Determine the next version bump (major/minor/patch) from [Conventional Commits](https://www.conventionalcommits.org/)
3. Create/update a **Release PR** that:
   - Bumps the version in configured files
   - Updates `CHANGELOG.md`
4. When that Release PR is merged, it **creates a Git tag** (e.g. `v1.1.0`)
5. That tag triggers `release.yml` (below)

## Build & Release (`release.yml`)

Triggered by any `v*` tag push (and callable from `release-please.yml`).

Two build jobs run in parallel:

| Job             | Runner           | Output                  |
| --------------- | ---------------- | ----------------------- |
| `build-windows` | `windows-latest` | MSI installer (`*.msi`) |
| `build-android` | `ubuntu-latest`  | APK (`*.apk`)           |

After both finish, a `create-release` job:

1. Downloads both artifacts
2. Uses [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release) to attach them to the GitHub Release
3. Auto-generates release notes from the tag

## How to trigger a release manually

```bash
# From a local checkout of main:
git checkout main
git pull
# Create and push a tag
git tag v1.2.0
git push origin v1.2.0
```

The `release.yml` workflow will pick it up, build everything, and publish.

## How to skip the daily PR (if nothing is ready)

The daily PR script checks `git rev-list --count origin/main..origin/dev`. If the count is 0, it exits without creating a PR. No action needed.

## Conventional Commits reference

Release Please uses the PR title (squash-merge) to determine the next version:

| PR title prefix             | Version bump               |
| --------------------------- | -------------------------- |
| `feat: ...`                 | minor (e.g. 1.0.0 → 1.1.0) |
| `fix: ...`                  | patch (e.g. 1.0.0 → 1.0.1) |
| `feat!: ...` or `fix!: ...` | major (e.g. 1.0.0 → 2.0.0) |
| `chore: ...` or `docs: ...` | no release (skipped)       |

Always use [Conventional Commits](https://www.conventionalcommits.org/) format for PR titles merged to `main`.
