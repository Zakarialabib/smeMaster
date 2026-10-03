#!/usr/bin/env node
/**
 * assert-summary.mjs — summary-line gate for test-runner output.
 *
 * Owner: qa-guardian. Companion to scripts/run-tests-gated.ps1 (the local
 * PowerShell gate) and .github/workflows/ground-truth.yml (the CI job).
 *
 * WHY: on the Windows dev host vitest (and pytest) can exit 0 while tests are
 * failing — a "false green". Process exit codes are therefore NOT trusted.
 * The verdict is taken from the runner's own SUMMARY LINE instead.
 *
 * Rules (applied to ANSI-stripped output):
 *   1. Recognised summary lines
 *        vitest : `Test Files ...` and `Tests ...`
 *        pytest : `=== N passed ===` / `=== N failed, N passed ===` / `=== N errors ... ===`
 *   2. FAIL if any summary line reports `N failed` or `N error(s)` with N > 0.
 *   3. FAIL if no summary line exists at all (runner crashed / never ran).
 *   4. FAIL if no summary line contains `passed` (no evidence tests ran).
 *   5. Otherwise PASS.
 *
 * Usage:
 *   node scripts/assert-summary.mjs <log-file>
 *   node scripts/assert-summary.mjs -            # read stdin
 *   <command> | node scripts/assert-summary.mjs -
 *
 * Exit codes: 0 = PASS, 1 = FAIL. All diagnostics go to stdout (in order) so CI
 * logs stay readable; the exit code is the only pass/fail signal.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('usage: node scripts/assert-summary.mjs <log-file> | - (stdin)');
  process.exit(1);
}

const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');

function readInput(source) {
  if (source === '-') {
    try {
      return fs.readFileSync(0, 'utf8'); // stdin
    } catch {
      return '';
    }
  }
  if (!fs.existsSync(source)) {
    console.log(`assert-summary: log file not found: ${source}`);
    process.exit(1);
  }
  return fs.readFileSync(source, 'utf8');
}

const raw = readInput(args[0]);
const lines = raw.split(/\r?\n/).map(stripAnsi);

const SUMMARY_PATTERNS = [
  /^\s*Test Files\b/, // vitest file-level summary
  /^\s*Tests\b/, // vitest test-level summary
  /^={3,}.*\b(passed|failed|error)\b.*={3,}\s*$/, // pytest / unittest summary
];

const summaryLines = lines.filter((line) => SUMMARY_PATTERNS.some((re) => re.test(line)));

console.log('assert-summary: summary-line gate (exit codes are NOT trusted)');
console.log(`assert-summary: ${summaryLines.length} summary line(s) found`);

if (summaryLines.length === 0) {
  console.log('assert-summary: FAIL — no summary line found in the output');
  console.log('assert-summary: the runner crashed, produced no tests, or wrote no summary.');
  process.exit(1);
}

let failedTotal = 0;
let hasPassedEvidence = false;

for (const line of summaryLines) {
  const trimmed = line.trim();
  console.log(`  summary> ${trimmed}`);
  for (const m of trimmed.matchAll(/(\d+)\s+(failed|errors?)\b/g)) {
    failedTotal += Number(m[1]);
  }
  if (/\d+\s+passed\b/.test(trimmed)) hasPassedEvidence = true;
}

if (failedTotal > 0) {
  console.log(`assert-summary: FAIL — summary reports ${failedTotal} failed/error test(s)`);
  process.exit(1);
}
if (!hasPassedEvidence) {
  console.log('assert-summary: FAIL — no summary line contains "passed" (no evidence tests ran)');
  process.exit(1);
}

console.log('assert-summary: PASS — summary shows no failures');
process.exit(0);
