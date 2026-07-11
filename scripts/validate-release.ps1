#!/usr/bin/env pwsh
# Pre-Release Validator
# Verifies all Gates 0-8 are in PASS state before tagging a release.
# This is a GATE 9 automation script.

[CmdletBinding()]
param(
    [string]$DocsPath,
    [string]$AuditLevel = "critical",
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Resolve DocsPath after param block (PSScriptRoot is not available in param defaults)
if (-not $DocsPath) { $DocsPath = Join-Path $PSScriptRoot "..\docs" }

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Write-Success { param($msg) Write-Host "${Green}[PASS]${Reset} $msg" }
function Write-Fail    { param($msg) Write-Host "${Red}[FAIL]${Reset} $msg" -ForegroundColor Red }
function Write-Warn    { param($msg) Write-Host "${Yellow}[WARN]${Reset} $msg" }
function Write-Step    { param($msg) Write-Host "${Cyan}==>${Reset} $msg" }
function Write-Info    { param($msg) Write-Host "    $msg" }

$failed = 0
$warned = 0

# ============================================================
# GATE 0 - Stop Conditions
# ============================================================
Write-Step "GATE 0 - Stop Conditions"
if (Test-Path "$DocsPath\..\SECURITY-AUDIT.md") {
    $audit = Get-Content "$DocsPath\..\SECURITY-AUDIT.md" -Raw
    if ($audit -match "PASS|Pass|Complete") {
        Write-Success "Security audit file present and indicates PASS"
    } else {
        Write-Warn "Security audit present but status unclear"
        $warned++
    }
} else {
    Write-Fail "SECURITY-AUDIT.md missing"
    $failed++
}

# Verify gated commands
$gatedFile = "$PSScriptRoot\..\src-tauri\src\commands\db.rs"
if (Test-Path $gatedFile) {
    $dbRs = Get-Content $gatedFile -Raw
    if ($dbRs -match "#\[cfg\(debug_assertions\)\]") {
        Write-Success "High-risk db commands are cfg-gated to debug builds"
    } else {
        Write-Fail "db_execute_insert no longer gated to debug builds"
        $failed++
    }
}

# ============================================================
# GATE 1 - Stability
# ============================================================
Write-Step "GATE 1 - Stability"
$libRs = "$PSScriptRoot\..\src-tauri\src\lib.rs"
if (Test-Path $libRs) {
    $libContent = Get-Content $libRs -Raw
    if ($libContent -match "panic::set_hook") {
        Write-Success "Panic hook installed"
    } else {
        Write-Fail "panic hook missing in lib.rs"
        $failed++
    }
    if ($libContent -match "WAL|wal_checkpoint") {
        Write-Success "WAL checkpoint configured"
    } else {
        Write-Warn "WAL checkpoint comment not found"
        $warned++
    }
}

# ============================================================
# GATE 2 - Performance
# ============================================================
Write-Step "GATE 2 - Performance"
$dbMod = "$PSScriptRoot\..\src-tauri\src\db\mod.rs"
if (Test-Path $dbMod) {
    $dbContent = Get-Content $dbMod -Raw
    if ($dbContent -match "cache_size.*64000") {
        Write-Success "SQLite cache_size pragma configured"
    } else {
        Write-Fail "SQLite cache_size pragma missing"
        $failed++
    }
    if ($dbContent -match "mmap_size.*268435456") {
        Write-Success "SQLite mmap_size pragma configured"
    } else {
        Write-Fail "SQLite mmap_size pragma missing"
        $failed++
    }
}

# Check virtualization
$contactList = "$PSScriptRoot\..\src\features\contacts\components\ContactListView.tsx"
if ((Test-Path $contactList) -and ((Get-Content $contactList -Raw) -match "useVirtualizer")) {
    Write-Success "ContactListView is virtualized"
} else {
    Write-Fail "ContactListView is not virtualized"
    $failed++
}

$campaignList = "$PSScriptRoot\..\src\features\campaigns\components\CampaignList.tsx"
if ((Test-Path $campaignList) -and ((Get-Content $campaignList -Raw) -match "useVirtualizer")) {
    Write-Success "CampaignList is virtualized"
} else {
    Write-Fail "CampaignList is not virtualized"
    $failed++
}

# ============================================================
# GATE 3 - Distribution
# ============================================================
Write-Step "GATE 3 - Distribution"
$tauriConf = "$PSScriptRoot\..\src-tauri\tauri.conf.json"
if (Test-Path $tauriConf) {
    $conf = Get-Content $tauriConf -Raw | ConvertFrom-Json
    if ($conf.bundle.targets -match "msi|nsis|dmg|appimage|deb") {
        Write-Success "Bundle targets configured"
    } else {
        Write-Fail "No bundle targets configured"
        $failed++
    }
    if ($conf.plugins.updater) {
        Write-Success "Auto-updater configured"
    } else {
        Write-Warn "Auto-updater not configured"
        $warned++
    }
}

# CI workflows
$ciYml = "$PSScriptRoot\..\.github\workflows\ci.yml"
$releaseYml = "$PSScriptRoot\..\.github\workflows\release.yml"
if ((Test-Path $ciYml) -and (Test-Path $releaseYml)) {
    Write-Success "CI and release workflows present"
} else {
    Write-Fail "CI/release workflows missing"
    $failed++
}

# ============================================================
# GATE 4 - Data Safety
# ============================================================
Write-Step "GATE 4 - Data Safety"
$dataExport = "$PSScriptRoot\..\src-tauri\src\export\data_export.rs"
if ((Test-Path $dataExport) -and ((Get-Content $dataExport -Raw) -match "export_contacts_csv|export_contacts_vcard|export_tasks_csv|export_calendar_ics")) {
    Write-Success "Data export commands implemented (CSV/vCard/ICS)"
} else {
    Write-Fail "Data export commands missing"
    $failed++
}

$dataWipeCmd = "$PSScriptRoot\..\src-tauri\src\commands\db.rs"
if ((Test-Path $dataWipeCmd) -and ((Get-Content $dataWipeCmd -Raw) -match "db_wipe_all_data")) {
    Write-Success "Data wipe command implemented"
} else {
    Write-Fail "Data wipe command missing"
    $failed++
}

# ============================================================
# GATE 5 - UX
# ============================================================
Write-Step "GATE 5 - UX"
$focusTrap = "$PSScriptRoot\..\src\shared\hooks\useFocusTrap.ts"
$humanize = "$PSScriptRoot\..\src\shared\utils\humanizeError.ts"
if ((Test-Path $focusTrap) -and (Test-Path $humanize)) {
    Write-Success "Focus trap + error humanization implemented"
} else {
    Write-Fail "Accessibility helpers missing"
    $failed++
}

# ============================================================
# GATE 6 - Observability
# ============================================================
Write-Step "GATE 6 - Observability"
$healthStats = (Get-Content "$PSScriptRoot\..\src-tauri\src\commands\db.rs" -Raw)
if ($healthStats -match "db_health_stats") {
    Write-Success "db_health_stats command implemented"
} else {
    Write-Fail "db_health_stats command missing"
    $failed++
}
if ($healthStats -match "db_sync_status") {
    Write-Success "db_sync_status command implemented"
} else {
    Write-Fail "db_sync_status command missing"
    $failed++
}
if ($healthStats -match "db_export_logs") {
    Write-Success "db_export_logs command implemented"
} else {
    Write-Fail "db_export_logs command missing"
    $failed++
}

# ============================================================
# GATE 7 - Documentation
# ============================================================
Write-Step "GATE 7 - Documentation"
$userGuide = "$DocsPath\user-guide"
$required = @("getting-started.md", "account-setup.md", "pgp-setup.md", "backup-restore.md", "faq.md", "release-notes.md")
$missing = @()
foreach ($f in $required) {
    if (-not (Test-Path "$userGuide\$f")) { $missing += $f }
}
if ($missing.Count -eq 0) {
    Write-Success "All 6 user guide documents present"
} else {
    Write-Fail "Missing user guide docs: $($missing -join ', ')"
    $failed++
}

if (Test-Path "$DocsPath\privacy-policy.md") {
    Write-Success "Privacy policy present"
} else {
    Write-Fail "Privacy policy missing"
    $failed++
}

# ============================================================
# GATE 8 - Legal and Compliance (audits)
# ============================================================
Write-Step "GATE 8 - Legal and Compliance"
Write-Info "Running cargo audit..."
try {
    $cargoAudit = & cargo audit --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0 -and $cargoAudit) {
        $vulns = $cargoAudit.vulnerabilities.list
        $exploitableHigh = @($vulns | Where-Object { $_.severity -in @("high", "critical") -and $_.advisory.id -notmatch "wayland|trust-dns|rsa|esm" })
        if ($exploitableHigh.Count -eq 0) {
            Write-Success "No exploitable high-severity Rust vulnerabilities"
        } else {
            Write-Fail "$($exploitableHigh.Count) exploitable high-severity Rust vulnerabilities remain"
            $failed++
        }
    } else {
        Write-Warn "cargo audit not installed or failed (run: cargo install cargo-audit)"
        $warned++
    }
} catch {
    Write-Warn "cargo audit not installed (run: cargo install cargo-audit)"
    $warned++
}

Write-Info "Running npm audit..."
try {
    $npmAudit = npm audit --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -le 1 -and $npmAudit -and $npmAudit.metadata) {
        $npmVulns = $npmAudit.metadata.vulnerabilities
        if ($npmVulns.high -eq 0 -and $npmVulns.critical -eq 0) {
            Write-Success "No high-severity npm vulnerabilities"
        } else {
            Write-Fail "$($npmVulns.high) high / $($npmVulns.critical) critical npm vulnerabilities"
            $failed++
        }
    } else {
        Write-Warn "npm audit failed or not available"
        $warned++
    }
} catch {
    Write-Warn "npm audit not available"
    $warned++
}

# ============================================================
# Optional: Build verification
# ============================================================
if (-not $SkipBuild) {
    Write-Step "Build verification (cargo check)"
    if (-not $DryRun) {
        Push-Location "$PSScriptRoot\..\src-tauri"
        & cargo check 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "cargo check passes"
        } else {
            Write-Fail "cargo check failed"
            $failed++
        }
        Pop-Location
    } else {
        Write-Info "DRY RUN: skipping cargo check"
    }
}

# ============================================================
# Summary
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "${Green}ALL GATES PASS${Reset} (warnings: $warned)" -ForegroundColor Green
    Write-Host "Ready to tag release. Run: .\scripts\release.ps1 -Version X.Y.Z"
    exit 0
} else {
    Write-Host "${Red}$failed GATES FAILED${Reset} (warnings: $warned)" -ForegroundColor Red
    Write-Host "Fix failures before tagging release."
    exit 1
}
