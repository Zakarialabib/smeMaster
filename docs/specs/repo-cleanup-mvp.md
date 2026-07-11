# Feature: Repository Cleanup for MVP Launch

> **Status:** Revised 2026-07-11 to reflect actual repository state. Original draft
> assumed several artifacts were gitignored; verification shows they are **tracked in
> git**. Branch list and open questions were also outdated.

## Problem

SMEMaster has been forked and significantly improved over time, resulting in accumulated
technical debt in the repository structure: stale branches, outdated documentation
references, development-only files committed to git, and potential sensitive-data exposure.
The goal is to present a clean, professional repository for the upcoming Android and
Windows desktop MVP launch.

## Current State Analysis (verified 2026-07-11)

### Repository Health

- **Remote branches:** 9 (ALL confirmed merged into `main` → safe to delete)
- **Local branches:** `main`, `agents/civic-halibut` (merged), `feature-ai-rag-backend-3537095358816558672` (merged), `pre-rename-wip` (merged)
- **Commits:** Active development history with conventional commits
- **Keystore:** `src-tauri/gen/android/smemaster.keystore` — properly gitignored, **not tracked** ✅
- **Sensitive files:** No tracked `.env`, `.key`, `.pem`, `.p12`, `.pfx`, `.cert`, `.jks`, `.keystore` ✅
- **Development artifacts:** `missing-keys.json` and `verification/` are **TRACKED in git** (the real problem); `.agents/` is already gone

### Files & Directories — Verified Status

| Category | Files/Dirs | Actual Status | Action Needed |
| --- | --- | --- | --- |
| **Tracked dev artifact** | `missing-keys.json` | **TRACKED** (commits `8bfb2c2`, `50d2a3f`), 20 KB, local exists | `git rm --cached` + gitignore + delete local + history review |
| **Tracked dev artifact** | `verification/` | **TRACKED**: `verify_calendar.ts`, `__pycache__/utils.cpython-312.pyc` | `git rm --cached -r` + gitignore + delete local |
| **Dev artifact** | `.agents/` | gitignored, **not present locally** (already cleaned) | None — confirm stays gitignored |
| **New untracked** | `report.md` | Untracked; "Email Migration … Design" doc | Decide: move to `docs/` or remove |
| **New untracked** | `terminal.md` | Untracked; "Terminal Issues Log" dev notes | Decide: remove or move to `docs/` |
| **Previously open** | `openrouterProvider.ts` | **Now TRACKED** at `src/shared/services/ai/providers/openrouterProvider.ts` | No action — resolved |
| **Stale branches** | 9 remote branches | ALL merged into `main` | Delete from remote |
| **Local stale branches** | `agents/civic-halibut`, `feature-ai-rag-backend-*`, `pre-rename-wip` | All merged | Delete locally |
| **Documentation** | `docs/STATUS.md` | Extensive, has historical sections | Trim historical |
| **Documentation** | `docs/PRODUCTION-READINESS.md` | Comprehensive | Keep (reference) |
| **Documentation** | `docs/00-INDEX.md` | Good structure | Update references |
| **Documentation** | `CONTRIBUTING.md` | Line 25 references `master` branch ❌ | Fix → `main` |
| **Build config** | `src-tauri/Cargo.toml`, `tauri.conf.json` | No uncommitted local diffs (clean) ✅ | None |
| **CI/CD** | `.github/workflows/` | `ci.yml`, `packaging.yml`, `release-please.yml`, `release.yml`, `update-homebrew.yml` | Verify Android + Windows coverage |
| **License** | `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` | Good | Keep |

### Verified Secure (no action)

- No `.env`/`.key`/`.pem`/`.p12`/`.pfx`/`.cert`/`.jks`/`.keystore` tracked in git.
- `src-tauri/gen/android/smemaster.keystore` is gitignored and not tracked.
- `.env` is gitignored.
- `git status` shows only `?? report.md` and `?? terminal.md` as untracked.

## Requirements

### Functional Requirements

- [ ] **FR1:** Untrack and gitignore `missing-keys.json` and `verification/`; delete locally
- [ ] **FR2:** Audit and delete all 9 stale remote branches (all merged into `main`)
- [ ] **FR3:** Delete local stale branches (`agents/civic-halibut`, `feature-ai-rag-backend-*`, `pre-rename-wip`)
- [ ] **FR4:** Verify no sensitive files are tracked in git (history + working tree)
- [ ] **FR5:** Review and consolidate documentation; fix `master`→`main` references
- [ ] **FR6:** Decide disposition of `report.md` and `terminal.md`
- [ ] **FR7:** Ensure CI/CD workflows cover Android + Windows builds

### Non-Functional Requirements

- [ ] **NFR1:** Repository clean enough for public consumption
- [ ] **NFR2:** No development-only artifacts in tracked files
- [ ] **NFR3:** Documentation accurate and well-organized
- [ ] **NFR4:** Git history clean (no sensitive data leaks)
- [ ] **NFR5:** Branch structure minimal — only `main` remains

## Architecture

### Cleanup Strategy

```
Phase 1: Tracked Artifact Cleanup
├── Add missing-keys.json, verification/ to .gitignore
├── git rm --cached (untrack) without deleting working files yet
├── Delete local working copies
└── Review missing-keys.json git history for secrets

Phase 2: Branch Cleanup
├── Delete 9 merged remote branches (git push --delete origin <b>)
├── Delete local stale branches
└── Result: only main remains locally & remotely

Phase 3: Untracked File Decision
├── report.md  → move to docs/ OR remove
└── terminal.md → remove OR move to docs/

Phase 4: Documentation Audit
├── Fix CONTRIBUTING.md master → main
├── Trim docs/STATUS.md historical sections
├── Update docs/00-INDEX.md cross-references
└── Update README.md badges/links if stale

Phase 5: Security Audit
├── Confirm no sensitive files tracked
├── Confirm keystore + .env gitignored
└── Grep for hardcoded credentials

Phase 6: CI/CD Verification
├── Verify workflows cover Android + Windows
└── Verify tauri.android.conf.json / tauri.windows.conf.json

Phase 7: Commit & Verify
├── Commit untracking + gitignore + doc fixes
└── git status clean (only intended changes)
```

### Target Branch State

```
main   # sole branch, local + remote
```

## Acceptance Criteria

### Tracked Artifact Cleanup

- [ ] AC1: `missing-keys.json` untracked (`git rm --cached`) and gitignored
- [ ] AC2: `verification/` untracked and gitignored
- [ ] AC3: Both deleted from local filesystem
- [ ] AC4: `missing-keys.json` git history reviewed for secrets (scrub if found)

### Branch Cleanup

- [ ] AC5: All 9 remote branches deleted
- [ ] AC6: Local stale branches deleted
- [ ] AC7: Only `main` remains (local + remote)

### Untracked Files

- [ ] AC8: `report.md` and `terminal.md` disposition decided & applied

### Documentation

- [ ] AC9: `CONTRIBUTING.md` `master`→`main` fixed
- [ ] AC10: `docs/STATUS.md` historical sections trimmed
- [ ] AC11: `docs/00-INDEX.md` cross-references valid
- [ ] AC12: `README.md` accurate

### Security

- [ ] AC13: No sensitive files tracked
- [ ] AC14: Keystore + `.env` gitignored
- [ ] AC15: No hardcoded credentials

### CI/CD

- [ ] AC16: Android + Windows build workflows functional

## Open Questions (resolved / updated)

1. **Q1 (resolved):** Which remote branches to preserve? → **All 9 are merged into `main`; delete all.** Keep only `main`.
2. **Q2:** Trim `docs/STATUS.md` historical sections? → **Yes**, keep last 2–3 completed items.
3. **Q3 (resolved):** `openrouterProvider.ts`? → **Already tracked** at `src/shared/services/ai/providers/openrouterProvider.ts`; no action.
4. **Q4:** Update `CONTRIBUTING.md` branch refs? → **Yes**, `master`→`main` at line 25 (confirmed).
5. **Q5 (new):** What to do with `report.md` / `terminal.md`? → Decide in Phase 3 (recommend: move `report.md` to `docs/`, remove `terminal.md`).
6. **Q6 (new / important):** `missing-keys.json` & `verification/` are **tracked**. Is `missing-keys.json` content sensitive? → Review history; if non-secret, untrack + gitignore; if secret, scrub with `git filter-repo`/BFG.

## Implementation Plan (revised)

### Phase 1: Tracked Artifact Cleanup
1. Add `missing-keys.json` and `verification/` to `.gitignore`
2. `git rm --cached missing-keys.json` and `git rm --cached -r verification/`
3. Delete local `missing-keys.json` and `verification/`
4. Review `missing-keys.json` git history for secrets

### Phase 2: Branch Cleanup
1. `git push --delete origin <9 branches>`
2. `git branch -d agents/civic-halibut feature-ai-rag-backend-* pre-rename-wip`

### Phase 3: Untracked File Decision
1. `report.md` → move to `docs/` (rename) or remove
2. `terminal.md` → remove or move to `docs/`

### Phase 4: Documentation Audit
1. Fix `CONTRIBUTING.md` `master`→`main`
2. Trim `docs/STATUS.md`
3. Update `docs/00-INDEX.md`
4. Update `README.md` if stale

### Phase 5: Security Audit
1. Confirm no sensitive files tracked
2. Confirm keystore + `.env` gitignored
3. Grep for hardcoded credentials

### Phase 6: CI/CD Verification
1. Verify `.github/workflows` Android + Windows coverage
2. Verify `tauri.android.conf.json` / `tauri.windows.conf.json`

### Phase 7: Commit & Verify
1. Commit untracking + gitignore + doc fixes
2. `git status` clean

## Quality Gates

| Gate | Check | Status |
| --- | --- | --- |
| Artifacts Clean | `missing-keys.json`/`verification/` untracked + gitignored | ⏳ Pending |
| Branch Clean | Only `main` remains | ⏳ Pending |
| Untracked Decided | `report.md`/`terminal.md` resolved | ⏳ Pending |
| Docs Accurate | References fixed | ⏳ Pending |
| Security Clean | No sensitive data tracked | ⏳ Pending |
| CI/CD Ready | Android + Windows builds covered | ⏳ Pending |
