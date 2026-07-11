#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# bump-version.sh
#
# Bump the SMEMaster version in three places:
#   - package.json                       (npm)
#   - src-tauri/Cargo.toml              (rust)
#   - src-tauri/tauri.conf.json         (tauri)
#
# Usage:
#   ./scripts/bump-version.sh 1.0.0
#
# It validates the version against semver, edits the three files in place,
# and creates a single git commit. It does NOT create the git tag — that is
# the responsibility of the release script.
#
# This script is intended for Linux and macOS. Windows users should run
# scripts/release.ps1 instead.
# -----------------------------------------------------------------------------

set -euo pipefail

# --- 1. Parse and validate arguments -----------------------------------------

if [ $# -ne 1 ]; then
  echo "Usage: $0 <semver-version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

NEW_VERSION="$1"

# Semver: MAJOR.MINOR.PATCH with optional pre-release and build metadata.
SEMVER_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)(-([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?(\+([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?$'

if ! [[ "$NEW_VERSION" =~ $SEMVER_REGEX ]]; then
  echo "Error: '$NEW_VERSION' is not a valid semver version."
  echo "Expected: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]"
  echo "Example:  1.0.0  or  1.2.3-beta.1"
  exit 1
fi

echo "Bumping SMEMaster to v$NEW_VERSION"

# --- 2. Resolve the repo root (script's parent) ------------------------------

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd )"
cd "$REPO_ROOT"

# --- 3. Pre-flight: clean working tree ---------------------------------------

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is dirty. Commit or stash your changes first."
  git status --short
  exit 1
fi

# --- 4. Pre-flight: required tools -------------------------------------------

for tool in git node python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    # python3 is optional, only needed for the JSON edits
    if [ "$tool" = "python3" ]; then
      echo "Warning: 'python3' not found. Falling back to node for JSON edits."
    else
      echo "Error: '$tool' is required but not installed."
      exit 1
    fi
  fi
done

# --- 5. Update package.json ---------------------------------------------------

PACKAGE_JSON="package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
  echo "Error: $PACKAGE_JSON not found at $REPO_ROOT"
  exit 1
fi

OLD_VERSION_NODE="$(node -p "require('./$PACKAGE_JSON').version")"
echo "  package.json:   $OLD_VERSION_NODE -> $NEW_VERSION"

# Use node to safely edit the JSON in place and preserve formatting.
node <<EOF
const fs = require('fs');
const path = '$PACKAGE_JSON';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
EOF

# --- 6. Update src-tauri/Cargo.toml ------------------------------------------

CARGO_TOML="src-tauri/Cargo.toml"
if [ ! -f "$CARGO_TOML" ]; then
  echo "Error: $CARGO_TOML not found at $REPO_ROOT"
  exit 1
fi

# Match the line: version = "X.Y.Z"   (only inside [package], but a simple
# sed replacement on the first occurrence is good enough and what release-please
# itself does on this codebase).
OLD_VERSION_CARGO="$(grep -E '^version\s*=' "$CARGO_TOML" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')"
echo "  Cargo.toml:     $OLD_VERSION_CARGO -> $NEW_VERSION"

# Use a python helper for cross-platform safety; fall back to sed.
if command -v python3 >/dev/null 2>&1; then
  python3 - <<EOF
import re, sys
path = "$CARGO_TOML"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
# Replace only the first version = "..." line (the package version).
new_content, n = re.subn(
    r'^version\s*=\s*"[^"]+"',
    'version = "$NEW_VERSION"',
    content,
    count=1,
    flags=re.MULTILINE,
)
if n != 1:
    sys.stderr.write("Expected exactly 1 'version = ...' line, found %d\n" % n)
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)
EOF
else
  # sed -i with a unique delimiter and a backup.
  sed -i.bak -E '0,/^version[[:space:]]*=[[:space:]]*".*"/s//version = "'"$NEW_VERSION"'"/' "$CARGO_TOML"
  rm -f "$CARGO_TOML.bak"
fi

# --- 7. Update src-tauri/tauri.conf.json -------------------------------------

TAURI_CONF="src-tauri/tauri.conf.json"
if [ ! -f "$TAURI_CONF" ]; then
  echo "Error: $TAURI_CONF not found at $REPO_ROOT"
  exit 1
fi

OLD_VERSION_TAURI="$(node -p "require('./$TAURI_CONF').version")"
echo "  tauri.conf.json: $OLD_VERSION_TAURI -> $NEW_VERSION"

node <<EOF
const fs = require('fs');
const path = '$TAURI_CONF';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
EOF

# --- 8. Verify all three files agree -----------------------------------------

VERIFY_NODE="$(node -p "require('./$PACKAGE_JSON').version")"
VERIFY_CARGO="$(grep -E '^version\s*=' "$CARGO_TOML" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')"
VERIFY_TAURI="$(node -p "require('./$TAURI_CONF').version")"

if [ "$VERIFY_NODE" != "$NEW_VERSION" ] \
   || [ "$VERIFY_CARGO" != "$NEW_VERSION" ] \
   || [ "$VERIFY_TAURI" != "$NEW_VERSION" ]; then
  echo "Error: post-edit verification failed."
  echo "  package.json:     $VERIFY_NODE"
  echo "  Cargo.toml:       $VERIFY_CARGO"
  echo "  tauri.conf.json:  $VERIFY_TAURI"
  exit 1
fi

# --- 9. Commit ---------------------------------------------------------------

git add "$PACKAGE_JSON" "$CARGO_TOML" "$TAURI_CONF"
git commit -m "chore(release): bump version to v$NEW_VERSION"

echo ""
echo "Done. SMEMaster is now at v$NEW_VERSION."
echo "Next step: run scripts/release.sh to tag and push,"
echo "           or trigger the release workflow from the GitHub UI."
