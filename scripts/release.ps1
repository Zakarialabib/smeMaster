# -----------------------------------------------------------------------------
# release.ps1
#
# Drive a SMEMaster release end to end on Windows (PowerShell 5+).
#
# Steps:
#   1. Verify the working tree is clean.
#   2. Verify the dependency audit passes (npm audit, cargo audit).
#   3. Verify all tests pass (vitest, cargo test for the rust workspace).
#   4. Bump the version in package.json, src-tauri/Cargo.toml,
#      src-tauri/tauri.conf.json.
#   5. Create an annotated git tag v<version>.
#   6. Push the commit and the tag (triggers the GitHub Actions release
#      workflow on the remote).
#   7. Print a summary of what was done.
#
# Usage:
#   .\scripts\release.ps1 -Version 1.0.0
#   .\scripts\release.ps1 -Version 1.0.0 -SkipTests       # not recommended
#   .\scripts\release.ps1 -Version 1.0.0 -SkipAudit       # not recommended
#   .\scripts\release.ps1 -Version 1.0.0 -DryRun          # no git push
#
# The script is intentionally noisy. If anything looks wrong, abort.
# -----------------------------------------------------------------------------

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version,

    [switch]$SkipTests,
    [switch]$SkipAudit,
    [switch]$DryRun
)

# Stop on any error. We want the script to fail loudly, not silently skip
# a step. The summary at the end will tell the caller which step failed.
$ErrorActionPreference = 'Stop'

# --- Pretty output helpers ---------------------------------------------------

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "    [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "    [WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "    [FAIL] $Message" -ForegroundColor Red
}

# --- Validate version --------------------------------------------------------

if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$') {
    Write-Err "'$Version' is not a valid semver version."
    Write-Host "Expected: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]"
    Write-Host "Example:  1.0.0  or  1.2.3-beta.1"
    exit 1
}

# --- Resolve repo root -------------------------------------------------------

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = (Resolve-Path (Join-Path $ScriptDir '..')).Path
Set-Location $RepoRoot

Write-Step "SMEMaster release script"
Write-Host "    Repo root: $RepoRoot"
Write-Host "    Version:   $Version"
Write-Host "    Dry run:   $DryRun"

# --- 1. Clean working tree ---------------------------------------------------

Write-Step "Verifying working tree is clean"

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Err "Working tree is dirty. Commit or stash your changes first."
    $gitStatus | ForEach-Object { Write-Host "    $_" }
    exit 1
}
Write-Ok "Working tree is clean."

# --- 2. Dependency audit -----------------------------------------------------

if (-not $SkipAudit) {
    Write-Step "Running dependency audit"

    # npm audit
    if (Test-Path 'package.json') {
        Write-Host "    -> npm audit (production only)"
        try {
            $npmAudit = npm audit --omit=dev --json 2>$null | ConvertFrom-Json
        } catch {
            $npmAudit = $null
        }

        if ($npmAudit -and $npmAudit.metadata) {
            $high   = [int]$npmAudit.metadata.vulnerabilities.high
            $medium = [int]$npmAudit.metadata.vulnerabilities.moderate
            $crit   = [int]$npmAudit.metadata.vulnerabilities.critical
            Write-Host "       critical: $crit, high: $high, moderate: $medium"
            if (($crit + $high + $medium) -gt 0) {
                Write-Err "npm audit found exploitable HIGH/MEDIUM/CRITICAL vulnerabilities."
                Write-Host "       Run 'npm audit' for details, or pass -SkipAudit to override."
                exit 1
            }
            Write-Ok "npm audit clean."
        } else {
            Write-Warn "npm audit returned no parseable JSON. Skipping strict check."
        }
    } else {
        Write-Warn "package.json not found, skipping npm audit."
    }

    # cargo audit
    if (Test-Path 'src-tauri/Cargo.toml') {
        $cargoAudit = Get-Command cargo-audit -ErrorAction SilentlyContinue
        if ($cargoAudit) {
            Write-Host "    -> cargo audit"
            $cargoAuditExit = & cargo audit 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Err "cargo audit reported vulnerabilities."
                Write-Host $cargoAuditExit
                exit 1
            }
            Write-Ok "cargo audit clean."
        } else {
            Write-Warn "'cargo-audit' not installed. Install with 'cargo install cargo-audit --locked'."
        }
    } else {
        Write-Warn "src-tauri/Cargo.toml not found, skipping cargo audit."
    }
} else {
    Write-Warn "Skipping dependency audit (per -SkipAudit)."
}

# --- 3. Tests ----------------------------------------------------------------

if (-not $SkipTests) {
    Write-Step "Running tests"

    # vitest
    if (Test-Path 'package.json') {
        Write-Host "    -> vitest (run)"
        & npm run test --silent
        if ($LASTEXITCODE -ne 0) {
            Write-Err "vitest failed."
            exit 1
        }
        Write-Ok "vitest passed."
    } else {
        Write-Warn "package.json not found, skipping vitest."
    }

    # cargo test
    if (Test-Path 'src-tauri/Cargo.toml') {
        Write-Host "    -> cargo test (workspace)"
        Set-Location 'src-tauri'
        try {
            & cargo test --workspace --all-features 2>&1 | Tee-Object -Variable cargoTestOut | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Write-Err "cargo test failed."
                exit 1
            }
        } finally {
            Set-Location $RepoRoot
        }
        Write-Ok "cargo test passed."
    } else {
        Write-Warn "src-tauri/Cargo.toml not found, skipping cargo test."
    }
} else {
    Write-Warn "Skipping tests (per -SkipTests)."
}

# --- 4. Bump version ---------------------------------------------------------

Write-Step "Bumping version to $Version"

$packageJsonPath = Join-Path $RepoRoot 'package.json'
$cargoTomlPath   = Join-Path $RepoRoot 'src-tauri/Cargo.toml'
$tauriConfPath   = Join-Path $RepoRoot 'src-tauri/tauri.conf.json'

if (-not (Test-Path $packageJsonPath)) { Write-Err "$packageJsonPath not found."; exit 1 }
if (-not (Test-Path $cargoTomlPath))   { Write-Err "$cargoTomlPath not found."; exit 1 }
if (-not (Test-Path $tauriConfPath))   { Write-Err "$tauriConfPath not found."; exit 1 }

# package.json — edit via Node to preserve formatting.
Write-Host "    -> package.json"
$oldPkgVersion = (Get-Content $packageJsonPath -Raw | ConvertFrom-Json).version
$nodeScript = @"
const fs = require('fs');
const path = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = process.argv[2];
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"@
& node -e $nodeScript $packageJsonPath $Version
Write-Ok "package.json: $oldPkgVersion -> $Version"

# Cargo.toml — replace the first 'version = "..."' line.
Write-Host "    -> src-tauri/Cargo.toml"
$cargoContent = Get-Content $cargoTomlPath -Raw
if ($cargoContent -match '(?m)^version\s*=\s*"([^"]+)"') {
    $oldCargoVersion = $Matches[1]
    $cargoContent = $cargoContent -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`""
    Set-Content -Path $cargoTomlPath -Value $cargoContent -NoNewline
    Write-Ok "Cargo.toml: $oldCargoVersion -> $Version"
} else {
    Write-Err "Could not find 'version = ...' line in $cargoTomlPath."
    exit 1
}

# tauri.conf.json — edit via Node to preserve formatting.
Write-Host "    -> src-tauri/tauri.conf.json"
$oldTauriVersion = (Get-Content $tauriConfPath -Raw | ConvertFrom-Json).version
$nodeScript = @"
const fs = require('fs');
const path = process.argv[1];
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.version = process.argv[2];
fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
"@
& node -e $nodeScript $tauriConfPath $Version
Write-Ok "tauri.conf.json: $oldTauriVersion -> $Version"

# Verify all three agree.
$verifyPkg    = (Get-Content $packageJsonPath -Raw | ConvertFrom-Json).version
$verifyCargo  = (Select-String -Path $cargoTomlPath -Pattern '^version\s*=\s*"([^"]+)"' -AllMatches).Matches[0].Groups[1].Value
$verifyTauri  = (Get-Content $tauriConfPath -Raw | ConvertFrom-Json).version

if ($verifyPkg -ne $Version -or $verifyCargo -ne $Version -or $verifyTauri -ne $Version) {
    Write-Err "Post-edit verification failed:"
    Write-Host "    package.json:    $verifyPkg"
    Write-Host "    Cargo.toml:      $verifyCargo"
    Write-Host "    tauri.conf.json: $verifyTauri"
    exit 1
}
Write-Ok "All three files now report version $Version."

# --- 5. Commit + tag ---------------------------------------------------------

Write-Step "Creating release commit and tag"

git add $packageJsonPath $cargoTomlPath $tauriConfPath
$commitMessage = "chore(release): bump version to v$Version"
git commit -m $commitMessage | Out-Null
Write-Ok "Created commit: $commitMessage"

$tagName = "v$Version"
$existingTag = git tag --list $tagName
if ($existingTag) {
    Write-Err "Tag '$tagName' already exists locally. Delete it first or use a new version."
    exit 1
}

# Annotated tag so the GitHub Actions workflow can read the release notes
# from the tag message if needed.
$tagMessage = "SMEMaster $Version"
git tag -a $tagName -m $tagMessage | Out-Null
Write-Ok "Created annotated tag: $tagName"

# --- 6. Push -----------------------------------------------------------------

if ($DryRun) {
    Write-Warn "Dry run: not pushing. Run 'git push origin HEAD' and 'git push origin $tagName' manually."
} else {
    Write-Step "Pushing commit and tag to origin"

    $currentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "    -> git push origin $currentBranch"
    git push origin $currentBranch
    if ($LASTEXITCODE -ne 0) { Write-Err "git push of branch failed."; exit 1 }

    Write-Host "    -> git push origin $tagName"
    git push origin $tagName
    if ($LASTEXITCODE -ne 0) { Write-Err "git push of tag failed."; exit 1 }

    Write-Ok "Pushed commit and tag."
}

# --- 7. Summary --------------------------------------------------------------

Write-Step "Release summary"
Write-Host "    Version:   $Version"
Write-Host "    Tag:       $tagName"
Write-Host "    Branch:    $currentBranch"
Write-Host "    Commit:    $(git rev-parse HEAD)"
Write-Host "    Pushed:    $(-not $DryRun)"
Write-Host ""
Write-Host "Next step: the GitHub Actions release workflow should pick up" -ForegroundColor Cyan
Write-Host "the tag push and produce the installer artifacts. Watch the" -ForegroundColor Cyan
Write-Host "'Release' workflow run in the Actions tab." -ForegroundColor Cyan
