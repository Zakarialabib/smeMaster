#!/usr/bin/env bash
# Verify the Agent scope rule — the one rule that must not be wrong.
#
# WHY THIS EXISTS INSTEAD OF `cargo test`
# `cargo test` cannot execute on this host: the test binary dies at OS load with
# 0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND, because the installed UCRT/VC++ runtime
# is older than what rustc links against (see docs/05-DEVELOPMENT/02-testing.md).
# "The tests compile" was therefore the strongest claim available — and compiling
# is not passing.
#
# The scope functions are pure: no DB, no async, no Tauri. So they can be
# exercised by a plain binary, which DOES run here. This script compiles and runs
# that harness and gates on its verdict line.
#
# The harness mirrors the #[cfg(test)] assertions in
# src-tauri/src/db/tables/ai/agents.rs. If you change the rule, change both.
#
# Usage: bash scripts/verify/agent-scope.sh

set -uo pipefail

SRC="scripts/verify/agent-scope-verify.rs"
# NOTE: the output path is deliberately RELATIVE. rustc is a native Windows
# binary and MSYS path conversion is disabled in this environment, so an
# absolute /tmp/... path is passed through literally and the link fails with
# unresolved externals. A relative path avoids the translation entirely.
OUT="scope-verify-bin"

if [ ! -f "$SRC" ]; then
  echo "FAIL: $SRC not found — run from the repo root" >&2
  exit 1
fi

echo "==> compiling $SRC"
if ! rustc --edition 2021 -O "$SRC" -o "$OUT.exe" 2>&1; then
  echo "FAIL: the harness did not compile" >&2
  exit 1
fi

echo "==> running"
OUTPUT="$("./$OUT.exe" 2>&1)"
RC=$?
echo "$OUTPUT"

# Gate on the verdict line, not the exit code: this repo has a documented
# history of runners that false-green (see docs/05-DEVELOPMENT/02-testing.md).
#
# The pattern must NOT be a bare /failed/ — the success line reads
# "14 passed, 0 failed", which would match and report a false failure.
# Anchor on a non-zero count, and require the explicit verdict line.
if [ $RC -eq 0 ] \
   && echo "$OUTPUT" | grep -q "VERDICT: the scope rule behaves as specified" \
   && ! echo "$OUTPUT" | grep -qE '[1-9][0-9]* failed'; then
  echo
  echo "VERIFIED: the Agent scope rule behaves as specified."
  rm -f "$OUT.exe" "$OUT.pdb"
  exit 0
fi

echo
echo "FAILED: see the output above." >&2
exit 1
