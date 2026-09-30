<#
.SYNOPSIS
  Summary-gated quality gate for SMEMaster (owner: qa-guardian).

.DESCRIPTION
  Runs the frontend quality gate on the Windows dev host, where vitest is known to
  FALSE-GREEN (exit code 0 while tests fail). The vitest verdict is therefore taken
  from the SUMMARY LINE of its own output - never from $LASTEXITCODE.

  Stages:
    1. vitest   -> gated on the summary line ("Tests ... passed" / "... failed").
                   The process exit code is recorded as INFO only and is IGNORED
                   for pass/fail. Same rule applies to pytest if it is ever added
                   here: gate on `=== N passed ===` / `=== N failed ===`.
    2. tsc      -> `npx tsc --noEmit`            (trusted exit code)
    3. eslint   -> `npx eslint src --max-warnings=0` (trusted exit code)
    4. cargo    -> ONLY when -WithRust is passed, and ONLY `cargo check --workspace`
                   (compile-only). `cargo test` is NEVER run on this host: the
                   binaries link but will not launch (STATUS_ENTRYPOINT_NOT_FOUND
                   0xc0000139). Run the Rust suite in CI instead.

  Prints a final GATE PASS/FAIL block and exits 0 (pass) / 1 (fail).

.PARAMETER WithRust
  Also run `cargo check --workspace` from src-tauri (compile-only, no tests).

.PARAMETER SkipVitest
  Skip stage 1 (useful for a fast typecheck/lint-only pass).

.PARAMETER VitestLog
  Optional explicit path for the captured vitest output.
  Default: <TEMP>\smemaster-gate\vitest.log

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-tests-gated.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-tests-gated.ps1 -WithRust

.NOTES
  Why gate on the summary line? See docs/05-DEVELOPMENT/02-testing.md
  ("Three host-specific traps - gate on output, not exit codes").
#>
[CmdletBinding()]
param(
  [switch]$WithRust,
  [switch]$SkipVitest,
  [string]$VitestLog
)

$ErrorActionPreference = 'Continue'

$repoRoot  = Split-Path -Parent $PSScriptRoot
$logDir    = Join-Path ([System.IO.Path]::GetTempPath()) 'smemaster-gate'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
if (-not $VitestLog) { $VitestLog = Join-Path $logDir 'vitest.log' }

$script:results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param([string]$Stage, [string]$Status, [string]$Detail)
  $script:results.Add([pscustomobject]@{ Stage = $Stage; Status = $Status; Detail = $Detail })
}

# Runs a native command, streams its output, mirrors it to a log file and
# returns { ExitCode, Lines }. Note: $LASTEXITCODE is pre-zeroed so a missing
# executable cannot inherit a stale success code.
function Invoke-Logged {
  param(
    [Parameter(Mandatory)][string]$Exe,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$LogFile,
    [string]$WorkingDirectory
  )
  $collected = New-Object System.Collections.Generic.List[string]
  $pushed = $false
  try {
    if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory; $pushed = $true }
    $global:LASTEXITCODE = 0
    & $Exe @Arguments 2>&1 | ForEach-Object {
      $text = $_.ToString()
      $collected.Add($text)
      Write-Host $text
    }
    $code = $global:LASTEXITCODE
  } catch {
    $collected.Add("FATAL: $($_.Exception.Message)")
    Write-Host "FATAL: $($_.Exception.Message)" -ForegroundColor Red
    $code = 1
  } finally {
    if ($pushed) { Pop-Location }
  }
  $collected | Set-Content -LiteralPath $LogFile -Encoding UTF8
  [pscustomobject]@{ ExitCode = $code; Lines = @($collected); LogFile = $LogFile }
}

# Strips ANSI colour codes so the summary regexes cannot be defeated by colours.
function Remove-Color {
  param([string]$Text)
  $Text -replace "\x1B\[[0-9;]*[A-Za-z]", ''
}

# Verdict for vitest output: PASS only if a `Tests` summary line exists, contains
# `passed`, and neither the `Tests` nor the `Test Files` line reports a failed count.
function Get-SummaryVerdict {
  param([string[]]$Lines)

  $clean = @($Lines | ForEach-Object { (Remove-Color $_) })
  $testLines = @($clean | Where-Object { $_ -match '^\s*Tests\s' })
  $fileLines = @($clean | Where-Object { $_ -match '^\s*Test Files\s' })

  if ($testLines.Count -eq 0) {
    return [pscustomobject]@{ HasSummary = $false; Pass = $false; Failed = 0; Summary = '(no `Tests` summary line found in output)' }
  }

  $summaryLine = ($testLines[$testLines.Count - 1]).Trim()
  $failed = 0
  foreach ($line in @($testLines) + @($fileLines)) {
    foreach ($m in [regex]::Matches($line, '(\d+)\s+failed')) { $failed += [int]$m.Groups[1].Value }
  }
  $hasPassed = ($summaryLine -match '\d+\s+passed') -or ($summaryLine -match '0 passed')
  $pass = ($failed -eq 0) -and $hasPassed

  [pscustomobject]@{
    HasSummary = $true
    Pass       = $pass
    Failed     = $failed
    Summary    = $summaryLine
  }
}

# ------------------------------------------------------------------------------
Write-Host ''
Write-Host '=== SMEMaster summary-gated quality gate (qa-guardian) ===' -ForegroundColor Cyan
Write-Host "repo : $repoRoot"
Write-Host "logs : $logDir"

Push-Location -LiteralPath $repoRoot
try {
  $env:NO_COLOR = '1'   # keep the captured output regex-friendly

  # ---- Stage 1: vitest (summary-gated; exit code IGNORED) --------------------
  if ($SkipVitest) {
    Write-Host ''
    Write-Host '=== [1/4] vitest : SKIPPED (-SkipVitest) ===' -ForegroundColor Yellow
    Add-Result -Stage 'vitest (summary-gated)' -Status 'SKIP' -Detail '-SkipVitest passed'
  } else {
    Write-Host ''
    Write-Host '=== [1/4] vitest (gated on the summary line, exit code ignored) ===' -ForegroundColor Cyan
    $run = Invoke-Logged -Exe 'npx' -Arguments @('vitest', 'run', '--exclude', 'integration') -LogFile $VitestLog
    $verdict = Get-SummaryVerdict -Lines $run.Lines

    # Host hazard: under some shells the npx/.bin shim crashes before vitest
    # prints anything. Retry once through the real ESM entry point, then re-gate.
    if ((-not $verdict.HasSummary) -and $run.ExitCode -ne 0) {
      Write-Host '!! no summary line + non-zero exit -> retrying via node node_modules/vitest/vitest.mjs' -ForegroundColor Yellow
      $run = Invoke-Logged -Exe 'node' -Arguments @('node_modules/vitest/vitest.mjs', 'run', '--exclude', 'integration') -LogFile $VitestLog
      $verdict = Get-SummaryVerdict -Lines $run.Lines
    }

    if ($verdict.Pass) {
      Write-Host "SUMMARY LINE: $($verdict.Summary)" -ForegroundColor Green
      Write-Host "(process exit code was $($run.ExitCode) - IGNORED for the verdict, per summary-gating rule)"
      Add-Result -Stage 'vitest (summary-gated)' -Status 'PASS' -Detail "$($verdict.Summary) [exit=$($run.ExitCode) ignored]"
    } else {
      Write-Host "SUMMARY LINE: $($verdict.Summary)" -ForegroundColor Red
      Write-Host "(process exit code was $($run.ExitCode) - exit code is NOT trusted either way)" -ForegroundColor Red
      Add-Result -Stage 'vitest (summary-gated)' -Status 'FAIL' -Detail "$($verdict.Summary) [exit=$($run.ExitCode)]"
    }
    Write-Host "log  : $VitestLog"
  }

  # ---- Stage 2: tsc (trusted exit code) -------------------------------------
  Write-Host ''
  Write-Host '=== [2/4] npx tsc --noEmit ===' -ForegroundColor Cyan
  $tsc = Invoke-Logged -Exe 'npx' -Arguments @('tsc', '--noEmit') -LogFile (Join-Path $logDir 'tsc.log')
  if ($tsc.ExitCode -eq 0) {
    Add-Result -Stage 'tsc --noEmit' -Status 'PASS' -Detail 'exit 0'
  } else {
    Add-Result -Stage 'tsc --noEmit' -Status 'FAIL' -Detail "exit $($tsc.ExitCode)"
  }

  # ---- Stage 3: eslint (trusted exit code) ----------------------------------
  Write-Host ''
  Write-Host '=== [3/4] npx eslint src --max-warnings=0 ===' -ForegroundColor Cyan
  $lint = Invoke-Logged -Exe 'npx' -Arguments @('eslint', 'src', '--max-warnings=0') -LogFile (Join-Path $logDir 'eslint.log')
  if ($lint.ExitCode -eq 0) {
    Add-Result -Stage 'eslint --max-warnings=0' -Status 'PASS' -Detail 'exit 0'
  } else {
    Add-Result -Stage 'eslint --max-warnings=0' -Status 'FAIL' -Detail "exit $($lint.ExitCode)"
  }

  # ---- Stage 4: cargo check (opt-in, compile-only; NEVER cargo test) ---------
  if ($WithRust) {
    Write-Host ''
    Write-Host '=== [4/4] cargo check --workspace (compile-only; cargo test is never run here) ===' -ForegroundColor Cyan
    $cargo = Invoke-Logged -Exe 'cargo' -Arguments @('check', '--workspace') `
      -LogFile (Join-Path $logDir 'cargo-check.log') -WorkingDirectory (Join-Path $repoRoot 'src-tauri')
    if ($cargo.ExitCode -eq 0) {
      Add-Result -Stage 'cargo check --workspace' -Status 'PASS' -Detail 'exit 0'
    } else {
      Add-Result -Stage 'cargo check --workspace' -Status 'FAIL' -Detail "exit $($cargo.ExitCode)"
    }
  } else {
    Add-Result -Stage 'cargo check --workspace' -Status 'SKIP' -Detail 'pass -WithRust to enable (cargo test is never run)'
  }
} finally {
  Pop-Location
}

# ------------------------------------------------------------------------------
# Final GATE block
# ------------------------------------------------------------------------------
Write-Host ''
Write-Host ('=' * 78)
Write-Host '  GATE SUMMARY'
Write-Host ('-' * 78)
foreach ($r in $script:results) {
  $color = 'Green'
  if ($r.Status -eq 'FAIL') { $color = 'Red' }
  if ($r.Status -eq 'SKIP') { $color = 'Yellow' }
  Write-Host ('  [{0,-4}] {1,-30} {2}' -f $r.Status, $r.Stage, $r.Detail) -ForegroundColor $color
}
Write-Host ('=' * 78)

$failures = @($script:results | Where-Object { $_.Status -eq 'FAIL' })
if ($failures.Count -eq 0) {
  Write-Host '  GATE: PASS' -ForegroundColor Green
  exit 0
} else {
  Write-Host "  GATE: FAIL ($($failures.Count) stage(s))" -ForegroundColor Red
  exit 1
}
