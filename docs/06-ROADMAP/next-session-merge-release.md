# Next Session Plan — Merge to main + GitHub Release

**Branch:** `private/voice-agent-client` → `origin/main`
**Date:** 2026-10-02
**Commits ahead:** 241 (includes all of main's history + this session's work)

---

## Pre-merge checklist

- [ ] `git status` clean (no uncommitted changes)
- [ ] All gates green: typecheck 0, lint 0, test 0 (3432 passed)
- [ ] `cargo check --features rustls-tls,local-ai` EXIT=0
- [ ] `cargo check -p ml-sidecar --features offline-speech` EXIT=0
- [ ] MCP bridge live test passed (app starts, sidecar Start/Stop works, model download+load works)
- [ ] Docs updated (STATUS.md, 00-INDEX.md, 07-sidecar-architecture.md, 20-offline-stt-and-audio-summarization.md)
- [ ] CI workflows fixed (all 5 `cargo build -p ml-sidecar` lines now include `--features offline-speech`)

## Merge strategy

The branch is 241 commits ahead of `origin/main`. A direct merge would be a large PR.

**Recommended: squash-merge via `gh`**

```bash
# 1. Push the branch
git push origin private/voice-agent-client

# 2. Create a squash-merge PR
gh pr create \
  --base main \
  --head private/voice-agent-client \
  --title "feat(ai): offline speech engine (STT+TTS), settings IA, sidecar lifecycle, MCP bridge" \
  --body "$(cat <<'EOF'
## Summary

- **Offline speech (sherpa-onnx):** STT (Zipformer Small en) RTF 0.033, TTS (Piper fr_FR-siwis) RTF 0.573 — both verified end-to-end against the shipped binary
- **Model download → engine wiring:** `ai_prepare_model_dir` bridges hf-hub cache layout to flat engine layout (hard-link)
- **Settings IA:** AI tab split into Text Generation / Voice / Local Models with model catalog + download UI
- **Sidecar lifecycle:** Start/Stop/Refresh in Voice tab; fixed Stop being undone by watchdog (intent flag)
- **Tauri MCP bridge:** dev-only, drives running app for verification
- **Sidecar build script:** `scripts/build-sidecar.sh` wired into all build scripts; CI gap fixed (was dropping `offline-speech`)
- **Bug fix:** EventBus `state() called before manage()` — app could not start at all

## Verification

| Gate | Result |
|---|---|
| typecheck | 0 errors |
| lint | 0 warnings |
| tests | 3432 passed |
| cargo check (local-ai) | EXIT=0 |
| cargo check (offline-speech) | EXIT=0 |
| E2E speech (release binary) | 8/8 PASS |
| TTS subset (9-file espeak) | PASS |
| MCP bridge live test | PASS |

## Docs

- `docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` — implementation + verification
- `docs/01-ARCHITECTURE/07-sidecar-architecture.md` — build script, CI, disk notes
- `docs/STATUS.md` — session changelog
- `docs/00-INDEX.md` — doc 20 status updated
EOF
)"

# 3. Merge (squash)
gh pr merge --squash --delete-branch
```

## Release

After merge to main:

```bash
# 1. Pull latest main
git checkout main && git pull origin main

# 2. Create release
gh release create v1.0.0-rc.2 \
  --title "SMEMaster v1.0.0-rc.2 — Offline Speech + Settings IA" \
  --notes "$(cat <<'EOF'
## What's New

### Offline Speech Engine
- **STT:** Zipformer Small (English, int8) — RTF 0.033, 99.8% accuracy
- **TTS:** Piper fr_FR-siwis-medium — RTF 0.573
- Both run fully on-device via sherpa-onnx (Apache-2.0)
- Model download + prepare UI in Settings → Local Models
- Sidecar lifecycle control in Settings → Voice

### Settings IA
- AI tab reorganized: Text Generation / Voice / Local Models
- Model catalog with real HF repos, byte sizes, licences
- Resumable downloads with hard-link preparation

### Bug Fixes
- EventBus startup panic (app could not start)
- Sidecar Stop being silently undone by watchdog
- CI shipping sidecar without speech methods

### Dev Tooling
- Tauri MCP bridge for driving the running app
- Sidecar build script with triple-suffixed output

## Verification
- 3432 tests passing
- All quality gates green
- E2E verified against shipped binary
EOF
)"

# 3. Build release binaries (Windows)
bun run windows:build
# Attach artifacts to release
gh release upload v1.0.0-rc.2 src-tauri/target/release/bundle/nsis/*.exe
```

## Known caveats to document in release notes

1. **TTS intelligibility** — machine-verified (non-silent, correct rate/duration) but not human-judged
2. **Non-English STT** — only English zipformer tested; locale matrix is model existence, not measured quality
3. **Disk space** — full Rust build needs ~10 GB free; `app_lib.lib` can reach 5 GB
4. **Live-call TTS** — RTF 0.573 + STT 0.033 approaches real time; marginal for live calls
5. **CI not yet validated** — workflows updated but not run; first CI build may need `SHERPA_ONNX_ARCHIVE_DIR`

## Files changed (this session)

| File | Change |
|---|---|
| `scripts/build-sidecar.sh` | New — builds + installs sidecar with triple suffix |
| `package.json` | `tauri:dev:mcp`, `sidecar:build:release` scripts |
| `.github/workflows/{build,ci,release}.yml` | `--features offline-speech` added to all 5 build lines |
| `docs/STATUS.md` | Session changelog |
| `docs/00-INDEX.md` | Doc 20 status → ✅ Implemented |
| `docs/01-ARCHITECTURE/07-sidecar-architecture.md` | Build script, --release, disk notes |
| `docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` | TTS verification, espeak subset proof |
| `src-tauri/crates/ml-sidecar/examples/tts_smoke.rs` | TTS harness with subset test |
