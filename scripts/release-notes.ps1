#!/usr/bin/env pwsh
# ── Release Notes Generator ────────────────────────────────────────────────
# Reads git history since the last tag and generates release notes.
# This is a GATE 9 automation script.

[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$OutputPath = "",
    [string]$RepoPath = "$PSScriptRoot\.."
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
    $package = Get-Content "$RepoPath\package.json" -Raw | ConvertFrom-Json
    $Version = $package.version
    Write-Host "Using version from package.json: $Version"
}

if (-not $OutputPath) {
    $OutputPath = "$RepoPath\docs\user-guide\release-notes.md"
}

# Get the previous tag
$tags = git -C $RepoPath tag --sort=-version:refname
$prevTag = $tags | Select-Object -First 1

# Get commits since the previous tag
if ($prevTag) {
    Write-Host "Generating release notes for v$Version (since $prevTag)"
    $commits = git -C $RepoPath log "$prevTag..HEAD" --pretty=format:"%h|%s|%an" 2>$null
} else {
    Write-Host "Generating release notes for v$Version (no previous tag)"
    $commits = git -C $RepoPath log --pretty=format:"%h|%s|%an" 2>$null
}

# Categorize commits
$features = @()
$fixes = @()
$docs = @()
$chores = @()
$other = @()

foreach ($line in $commits) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "\|", 3
    $hash = $parts[0]
    $subject = $parts[1]
    $author = $parts[2]
    
    if ($subject -match "^feat(\(.+\))?!?:" -or $subject -match "^✨") {
        $features += "- $subject ($hash)"
    } elseif ($subject -match "^fix(\(.+\))?!?:" -or $subject -match "^🐛") {
        $fixes += "- $subject ($hash)"
    } elseif ($subject -match "^docs(\(.+\))?!?:" -or $subject -match "^📝") {
        $docs += "- $subject ($hash)"
    } elseif ($subject -match "^chore(\(.+\))?!?:|^style(\(.+\))?!?:|^refactor(\(.+\))?!?:") {
        $chores += "- $subject ($hash)"
    } else {
        $other += "- $subject ($hash)"
    }
}

# Build release notes
$date = Get-Date -Format "yyyy-MM-dd"
$notes = @"
# SMEMaster v$Version

**Release Date**: $date

> Auto-generated release notes from $prevTag to HEAD.

## What's New

"@

if ($features.Count -gt 0) {
    $notes += "### Features`n`n" + ($features -join "`n") + "`n`n"
} else {
    $notes += "### Features`n`n_No new features in this release._`n`n"
}

if ($fixes.Count -gt 0) {
    $notes += "### Bug Fixes`n`n" + ($fixes -join "`n") + "`n`n"
} else {
    $notes += "### Bug Fixes`n`n_No bug fixes in this release._`n`n"
}

if ($chores.Count -gt 0) {
    $notes += "### Maintenance`n`n" + ($chores | Select-Object -First 20) -join "`n"
    if ($chores.Count -gt 20) { $notes += "`n... and $($chores.Count - 20) more." }
    $notes += "`n`n"
}

if ($docs.Count -gt 0) {
    $notes += "### Documentation`n`n" + ($docs -join "`n") + "`n`n"
}

if ($other.Count -gt 0) {
    $notes += "### Other Changes`n`n" + ($other -join "`n") + "`n`n"
}

$notes += @"
## Upgrade Notes

- No special upgrade steps required for this release.
- If upgrading from a pre-v1.0.0 version, please see the [migration guide](https://github.com/smemaster/smemaster/wiki/Migration).

## Feedback

Report issues on [GitHub](https://github.com/smemaster/smemaster/issues).

## Contributors

Thank you to everyone who contributed to this release!
"@

Set-Content -Path $OutputPath -Value $notes -Encoding UTF8
Write-Host "Release notes written to: $OutputPath"
Write-Host "Features: $($features.Count), Fixes: $($fixes.Count), Docs: $($docs.Count), Chores: $($chores.Count), Other: $($other.Count)"
