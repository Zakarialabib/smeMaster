#!/usr/bin/env node
/**
 * Event contract guard (smeMaster).
 *
 * Keeps docs/code aligned by detecting drift in the typed `AppEvent` bus:
 *
 *   1. Dead enum arms — `AppEvent` variants declared (with `#[serde(rename)]`)
 *      that are NEVER emitted anywhere in `src-tauri/src`. These are phantom
 *      contract entries and fail CI.
 *   2. Frontend registry drift — `EventNames` values in
 *      `src/shared/services/events/eventBus.ts` that have no backing Rust
 *      `AppEvent` variant (likely stale or native-bridge markers) — warned.
 *   3. Produced-but-unregistered — Rust emits an event absent from the
 *      frontend `EventNames` registry. The frontend decodes `core-event` by
 *      `kind` dynamically, so this is acceptable but worth surfacing — warned.
 *
 * Usage: node scripts/check-event-contract.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUST_SRC = join(root, 'src-tauri', 'src');
const EVENTS_MOD = join(RUST_SRC, 'events', 'mod.rs');
const FRONTEND_BUS = join(root, 'src', 'shared', 'services', 'events', 'eventBus.ts');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.rs')) out.push(p);
  }
  return out;
}

// Parse the AppEvent enum: map Rust ident -> wire name (serde rename).
function parseAppEventVariants() {
  const src = readFileSync(EVENTS_MOD, 'utf8');
  const start = src.indexOf('pub enum AppEvent');
  const brace = src.indexOf('{', start);
  // Find matching closing brace.
  let depth = 0;
  let end = brace;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(brace + 1, end);

  const variants = new Map(); // ident -> wire
  const re = /#\[serde\(rename\s*=\s*"([^"]+)"\)\][\s\S]*?(?:pub\s+)?([A-Z][A-Za-z0-9_]*)\s*(?:\{[^}]*\}|\([^)]*\))?\s*[,\n]/g;
  let m;
  while ((m = re.exec(body))) {
    variants.set(m[2], m[1]);
  }
  return variants;
}

// All Rust idents referenced as AppEvent::Ident anywhere in src-tauri/src.
function extractProducers(variants) {
  const produced = new Set();
  const re = /AppEvent::([A-Z][A-Za-z0-9_]*)/g;
  for (const file of walk(RUST_SRC)) {
    const src = readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src))) {
      if (variants.has(m[1])) produced.add(variants.get(m[1]));
    }
  }
  return produced;
}

function extractFrontendEventNames() {
  const src = readFileSync(FRONTEND_BUS, 'utf8');
  const names = new Set();
  const re = /:\s*"([a-z0-9:_-]+)",/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

const variants = parseAppEventVariants();
const produced = extractProducers(variants);
const frontend = extractFrontendEventNames();

const phantom = [...variants.values()].filter((w) => !produced.has(w));
const frontendOrphans = [...frontend].filter((w) => !variants.has(w) && !w.startsWith('native'));
const producedUnregistered = [...produced].filter((w) => !frontend.has(w));

let ok = true;
if (phantom.length) {
  ok = false;
  console.error('✗ Phantom AppEvent variants (declared, never emitted by Rust):');
  phantom.forEach((w) => console.error(`    - ${w}`));
} else {
  console.log('✓ Every AppEvent variant has a Rust producer.');
}

if (frontendOrphans.length) {
  console.warn('⚠ Frontend EventNames with no Rust AppEvent variant (stale/native?):');
  frontendOrphans.forEach((w) => console.warn(`    - ${w}`));
}

if (producedUnregistered.length) {
  console.warn('⚠ Rust-produced events absent from frontend EventNames (dynamic kind decode OK):');
  producedUnregistered.forEach((w) => console.warn(`    - ${w}`));
}

console.log(
  `\nScanned ${variants.size} AppEvent variants, ${produced.size} producers, ${frontend.size} frontend names.`
);
process.exit(ok ? 0 : 1);
