#!/usr/bin/env bash
# Build the ml-sidecar and install it where Tauri expects to bundle it.
#
# WHY THIS SCRIPT EXISTS
# `tauri.conf.json` declares `externalBin: ["binaries/ml-sidecar"]`, so Tauri
# resolves `src-tauri/binaries/ml-sidecar-<target-triple>{.exe}` at bundle time.
# Nothing produced that file automatically, which meant:
#   - a clean checkout had no sidecar at all, and
#   - the bundled app shipped WITHOUT speech support, because the stock sidecar
#     is built without the `offline-speech` feature and therefore answers
#     "unknown method" to load_stt_model / load_tts_voice / synthesize.
# Both looked like "the feature is broken" rather than "the binary is wrong".
#
# USAGE
#   scripts/build-sidecar.sh --release       # what you ship (RECOMMENDED)
#   scripts/build-sidecar.sh                 # debug — see the PDB note below
#   scripts/build-sidecar.sh --no-speech     # smaller build without sherpa-onnx
#   scripts/build-sidecar.sh --target aarch64-apple-darwin
#
# ⚠️ PREFER --release ON WINDOWS.
# The ml-sidecar links ~234 objects including onnxruntime and lancedb. A DEBUG
# build emits a PDB large enough to fail MSVC with:
#   LINK : fatal error LNK1318: Unexpected PDB error; FILE_SYSTEM (3)
# (or LIMIT (12) on a fuller disk). It is a PDB-size/filesystem limit, not a
# code error — and it only appears once the disk is tight. `--release` emits far
# less debug info and links reliably. The debug profile is kept for parity but
# is not the supported path here.
#
# SHERPA-ONNX NETWORK NOTE
# With `offline-speech` on, `sherpa-onnx-sys`'s build script DOWNLOADS a ~117 MB
# prebuilt archive. On a flaky link that fails with `cannot decrypt peer's
# message`. If you have the archive already, point the build at it to skip the
# download entirely:
#   SHERPA_ONNX_ARCHIVE_DIR=/path/to/dir scripts/build-sidecar.sh --release
# (the directory must contain
#  sherpa-onnx-v<version>-<platform>-<arch>-static-MT-Release-lib.tar.bz2)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$REPO_ROOT/src-tauri"
BINARIES_DIR="$TAURI_DIR/binaries"

PROFILE="debug"
PROFILE_FLAG=""
FEATURES=""
WITH_SPEECH=1
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --release)
      PROFILE="release"
      PROFILE_FLAG="--release"
      shift
      ;;
    --no-speech)
      WITH_SPEECH=0
      shift
      ;;
    --target)
      TARGET="${2:-}"
      if [ -z "$TARGET" ]; then
        echo "error: --target needs a value (e.g. x86_64-pc-windows-msvc)" >&2
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

# ── Resolve the target triple Tauri will look for ──────────────────────────
# Tauri appends the target triple to the externalBin name, so the copied file
# MUST carry it or bundling silently finds nothing.
HOST_TRIPLE="$(rustc -vV 2>/dev/null | sed -n 's/^host: //p')"
if [ -z "$TARGET" ]; then
  TARGET="$HOST_TRIPLE"
fi
if [ -z "$TARGET" ]; then
  echo "error: could not determine the target triple (is rustc on PATH?)" >&2
  exit 1
fi

# Only pass `--target` when it differs from the host. Passing the host triple
# explicitly makes cargo use a SEPARATE build tree (target/<triple>/...), which
# duplicates the whole ~20 GB of artefacts and — on this host — trips MSVC's
# PDB size limit:
#   LINK : fatal error LNK1318: Unexpected PDB error; LIMIT (12)
# Building for the host needs no `--target` at all.
CROSS_TARGET=0
if [ -n "$HOST_TRIPLE" ] && [ "$TARGET" != "$HOST_TRIPLE" ]; then
  CROSS_TARGET=1
fi

case "$TARGET" in
  *windows*) EXT=".exe" ;;
  *)         EXT="" ;;
esac

# ── Features ───────────────────────────────────────────────────────────────
# `offline-speech` is what makes sherpa-onnx STT/TTS reachable. Without it the
# sidecar compiles and runs but answers "unknown method" to every speech call.
FEATURES=""
if [ "$WITH_SPEECH" -eq 1 ]; then
  FEATURES="--features offline-speech"
fi

echo "==> ml-sidecar"
echo "    target   : $TARGET"
echo "    profile  : $PROFILE"
echo "    speech   : $([ "$WITH_SPEECH" -eq 1 ] && echo 'ON (offline-speech)' || echo 'off')"
if [ -n "${SHERPA_ONNX_ARCHIVE_DIR:-}" ]; then
  echo "    archive  : $SHERPA_ONNX_ARCHIVE_DIR"
else
  [ "$WITH_SPEECH" -eq 1 ] && echo "    archive  : (none set — sherpa-onnx-sys will download ~117 MB)"
fi
echo

BUILD_ARGS=(-p ml-sidecar)
[ -n "$PROFILE_FLAG" ] && BUILD_ARGS+=("$PROFILE_FLAG")
[ "$CROSS_TARGET" -eq 1 ] && BUILD_ARGS+=(--target "$TARGET")
# shellcheck disable=SC2206  # word splitting is intended for the feature list
[ -n "$FEATURES" ] && BUILD_ARGS+=($FEATURES)

cd "$TAURI_DIR"
cargo build "${BUILD_ARGS[@]}"

# ── Locate the artefact ────────────────────────────────────────────────────
if [ "$CROSS_TARGET" -eq 1 ]; then
  OUT_DIR="$TAURI_DIR/target/$TARGET/$PROFILE"
else
  OUT_DIR="$TAURI_DIR/target/$PROFILE"
fi
SRC="$OUT_DIR/ml-sidecar$EXT"

if [ ! -f "$SRC" ]; then
  echo "error: build succeeded but no binary at $SRC" >&2
  exit 1
fi

# ── Install with the triple-suffixed name Tauri resolves ───────────────────
mkdir -p "$BINARIES_DIR"
DEST="$BINARIES_DIR/ml-sidecar-$TARGET$EXT"
cp -f "$SRC" "$DEST"
chmod +x "$DEST" 2>/dev/null || true

SIZE="$(du -h "$DEST" | cut -f1)"
echo
echo "==> installed"
echo "    $DEST  ($SIZE)"
echo
if [ "$WITH_SPEECH" -eq 1 ]; then
  echo "    Speech methods available: load_stt_model, transcribe, load_tts_voice, synthesize"
else
  echo "    Built WITHOUT offline-speech — speech calls will answer 'unknown method'."
fi
echo "    Next: bun run tauri:build   (or tauri:dev:mcp for the MCP bridge)"
