#!/usr/bin/env node
/**
 * check-ground-truth.mjs — SMEMaster ground-truth metrics checker
 *
 * Owner: qa-guardian (agent role). Re-baseline instructions: scripts/ground-truth.json ("rebaseline").
 *
 * Counts three canonical metrics straight from source (node builtins only, no deps) and
 * cross-checks them against:
 *   1. the expected values in scripts/ground-truth.json
 *   2. the numbers printed in the docs/00-INDEX.md header (catches docs rot)
 *
 * Counting rules (must stay byte-for-byte in sync with scripts/ground-truth.json):
 *
 *   IPC commands   = literal occurrences of '#[tauri::command]' + '#[command]' in
 *                    src-tauri/src (all .rs files, recursive). Parameterised variants such as
 *                    '#[tauri::command(rename_all = "snake_case")]' are NOT counted
 *                    (7 exist as of 2026-09-30) so 777 + 64 = 841 matches the docs header.
 *
 *   Migrations     = count of *.sql files in src-tauri/src/db/migrations/
 *                    (001_core.sql ... 032_deals_pipeline.sql).
 *
 *   Store modules  = non-test .ts/.tsx files (exclude *.test.*, *.spec.*, any __tests__/
 *                    segment) under the three canonical store roots
 *                      - src/shared/stores/**
 *                      - src/stores/**
 *                      - src/features/<feature>/stores/**
 *                    whose source contains the token 'create'.
 *                    Rationale: every Zustand store here is created with
 *                    create<State>()(...) — the plain token 'create(' never appears in
 *                    those roots — and the roots also host 'create*' slice-factory
 *                    modules that belong to the store layer.
 *                    Expected 44 = 39 files calling zustand create< + 5 create* factories.
 *                    Informational (not gated): 42 non-test files repo-wide contain
 *                    literal 'create<' (45 occurrences).
 *
 * Usage:
 *   node scripts/check-ground-truth.mjs [path/to/ground-truth.json]
 *
 * Exit codes: 0 = all rows PASS, 1 = any mismatch (or missing baseline/doc).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const EXPECTED_FILE = process.argv[2] ?? path.join(__dirname, 'ground-truth.json');

/** @param {string} dir @param {(p:string)=>boolean} [filter] @returns {string[]} */
function walk(dir, filter) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (!filter || filter(full)) out.push(full);
  }
  return out;
}

const countOccurrences = (text, token) => text.split(token).length - 1;

// ---------------------------------------------------------------- metrics ---

function countCommands() {
  const files = walk(path.join(REPO_ROOT, 'src-tauri', 'src'), (p) => p.endsWith('.rs'));
  let tauri = 0;
  let plain = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    tauri += countOccurrences(src, '#[tauri::command]');
    plain += countOccurrences(src, '#[command]');
  }
  return { total: tauri + plain, parts: { tauri, plain }, files: files.length };
}

function countMigrations() {
  const dir = path.join(REPO_ROOT, 'src-tauri', 'src', 'db', 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')) : [];
  // Informational only: numbering must be 001..N with no gaps/duplicates.
  const numbers = files
    .map((f) => f.match(/^(\d{3})_/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  const sequential =
    numbers.length === files.length &&
    numbers.every((n, i) => n === i + 1);
  return { total: files.length, sequential, dir: path.relative(REPO_ROOT, dir) };
}

function countStores() {
  const roots = [path.join(REPO_ROOT, 'src', 'shared', 'stores'), path.join(REPO_ROOT, 'src', 'stores')];
  const featuresDir = path.join(REPO_ROOT, 'src', 'features');
  if (fs.existsSync(featuresDir)) {
    for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
      if (entry.isDirectory()) roots.push(path.join(featuresDir, entry.name, 'stores'));
    }
  }

  const isTest = (p) => {
    const n = p.replace(/\\/g, '/');
    return /\.test\./.test(n) || /\.spec\./.test(n) || n.includes('/__tests__/');
  };

  const modules = [];
  for (const root of roots) {
    for (const file of walk(root, (p) => /\.(ts|tsx)$/.test(p))) {
      if (isTest(file)) continue;
      if (fs.readFileSync(file, 'utf8').includes('create')) modules.push(file);
    }
  }

  // Informational sub-counts (documented, not gated).
  const allSrc = walk(path.join(REPO_ROOT, 'src'), (p) => /\.(ts|tsx)$/.test(p));
  const strictNonTest = allSrc.filter((f) => !isTest(f) && fs.readFileSync(f, 'utf8').includes('create<'));
  const strictOcc = strictNonTest.reduce(
    (n, f) => n + countOccurrences(fs.readFileSync(f, 'utf8'), 'create<'),
    0,
  );
  const callsZustandCreate = modules.filter((f) => fs.readFileSync(f, 'utf8').includes('create<')).length;

  return {
    total: modules.length,
    callsZustandCreate,
    factories: modules.length - callsZustandCreate,
    strictNonTest,
    strictOcc,
  };
}

// ------------------------------------------------------------ docs header ---

function readDocsHeaderNumbers() {
  const docPath = path.join(REPO_ROOT, 'docs', '00-INDEX.md');
  if (!fs.existsSync(docPath)) return { error: `missing ${docPath}` };
  const md = fs.readFileSync(docPath, 'utf8');
  // Only the header block (front matter + ground-truth note) is in scope.
  const header = md.split('\n').slice(0, 20).join('\n');
  const grab = (re) => header.match(re)?.[1];
  const breakdown = header.match(
    /`#\[tauri::command\]`\s*\+\s*(\d+)\s+`#\[command\]`/,
  );
  const numbers = {
    commands: grab(/\*\*Commands:\*\*\s*(\d+)/),
    migrations: grab(/\*\*DB:\*\*\s*(\d+)\s+migrations/),
    stores: grab(/\*\*Stores:\*\*\s*(\d+)\s+Zustand/),
    tauriPart: header.match(/(?:\*\*Commands:\*\*\s*\d+\s*\(\s*|\()(\d+)\s+`#\[tauri::command\]`/)?.[1],
    plainPart: breakdown?.[1],
  };
  return { numbers };
}

// ------------------------------------------------------------------ report ---

const rows = [];
const addRow = (metric, expected, actual, status) => rows.push({ metric, expected, actual, status });

function printTable(title, headers, data) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((r) => String(r[i]).length)),
  );
  const line = (cells) =>
    '  ' + cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(`\n${title}`);
  console.log(line(headers));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of data) console.log(line(row));
}

function main() {
  console.log('SMEMaster ground-truth metrics checker');
  console.log(`repo:   ${REPO_ROOT}`);
  console.log(`base:   ${path.relative(REPO_ROOT, EXPECTED_FILE)}`);

  if (!fs.existsSync(EXPECTED_FILE)) {
    console.error(`\nFAIL: baseline file not found: ${EXPECTED_FILE}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(EXPECTED_FILE, 'utf8'));
  console.log(`verified: ${baseline.verifiedOn} by ${baseline.owner}`);

  const commands = countCommands();
  const migrations = countMigrations();
  const stores = countStores();

  // --- metrics vs baseline -------------------------------------------------
  addRow('IPC commands', baseline.commands, commands.total, commands.total === baseline.commands ? 'PASS' : 'FAIL');
  addRow('SQLite migrations', baseline.migrations, migrations.total, migrations.total === baseline.migrations ? 'PASS' : 'FAIL');
  addRow('Zustand store modules', baseline.stores, stores.total, stores.total === baseline.stores ? 'PASS' : 'FAIL');

  printTable(
    'METRICS (expected vs actual)',
    ['metric', 'expected', 'actual', 'status'],
    rows.map((r) => [r.metric, r.expected, r.actual, r.status]),
  );

  console.log(
    `\n  detail: #[tauri::command]=${commands.parts.tauri}  #[command]=${commands.parts.plain}  ` +
      `(rs files: ${commands.files})`,
  );
  console.log(
    `  detail: migrations=${migrations.total} in ${migrations.dir}` +
      `${migrations.sequential ? ' (001..N sequential, no gaps)' : ' ** NUMBERING NOT SEQUENTIAL **'}`,
  );
  console.log(
    `  detail: stores: ${stores.callsZustandCreate} call zustand create< + ${stores.factories} create* factory modules; ` +
      `repo-wide non-test literal 'create<' = ${stores.strictNonTest.length} files / ${stores.strictOcc} occurrences (informational)`,
  );

  // --- docs/00-INDEX.md header cross-check ---------------------------------
  const docRows = [];
  const docs = readDocsHeaderNumbers();
  const docsCheck = (field, docValue, computed) => {
    const status =
      docValue === undefined ? 'MISSING' : Number(docValue) === computed ? 'PASS' : 'FAIL';
    docRows.push([field, docValue ?? '(not found)', computed, status]);
    return status !== 'FAIL';
  };
  let docsOk = false;
  if (docs.error) {
    docRows.push(['(docs/00-INDEX.md)', docs.error, '-', 'FAIL']);
  } else {
    docsOk =
      docsCheck('Commands:', docs.numbers.commands, commands.total) &
      docsCheck('DB: ... migrations', docs.numbers.migrations, migrations.total) &
      docsCheck('Stores: ... Zustand', docs.numbers.stores, stores.total);
    docsOk = Boolean(docsOk);
    // Breakdown (777 + 64) — informational, reported but not a gate row.
    if (docs.numbers.tauriPart !== undefined || docs.numbers.plainPart !== undefined) {
      const ok =
        Number(docs.numbers.tauriPart) === commands.parts.tauri &&
        Number(docs.numbers.plainPart) === commands.parts.plain;
      docRows.push([
        'Commands breakdown (777 + 64)',
        `${docs.numbers.tauriPart} + ${docs.numbers.plainPart}`,
        `${commands.parts.tauri} + ${commands.parts.plain}`,
        ok ? 'PASS' : 'FAIL',
      ]);
      docsOk = docsOk && ok;
    }
  }

  printTable(
    `DOCS CROSS-CHECK (${path.relative(REPO_ROOT, path.join(REPO_ROOT, 'docs', '00-INDEX.md'))} header vs computed)`,
    ['docs field', 'docs value', 'computed', 'status'],
    docRows,
  );

  const allPass = rows.every((r) => r.status === 'PASS') && docsOk && docRows.every((r) => r[3] !== 'FAIL');

  console.log('\n' + '='.repeat(72));
  console.log(`  GROUND TRUTH: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(72));
  if (!allPass) {
    console.error('\nMismatch. Either the source drifted (fix the code) or the baseline');
    console.error('is stale (re-grep, update scripts/ground-truth.json + docs/00-INDEX.md).');
    process.exit(1);
  }
  process.exit(0);
}

main();
