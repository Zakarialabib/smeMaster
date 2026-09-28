import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as T from './commands';

/**
 * Contract-parity tests.
 *
 * These are the tests that justify the split: Python is the source of truth, and
 * a drifted TypeScript type is a console that reads `undefined` off a real
 * payload in production. So we assert the *shape* of both sides against each
 * other rather than trusting either to stay still.
 *
 * Python source: services/agent-core/agent_core/contracts.py
 */

const PY_CONTRACTS = join(process.cwd(), '..', 'services', 'agent-core', 'agent_core', 'contracts.py');
const py = readFileSync(PY_CONTRACTS, 'utf8');

/** Pull the pydantic model bodies out of the Python source. */
function pyModel(name: string): string {
  const start = py.indexOf(`class ${name}(`);
  if (start === -1) throw new Error(`no pydantic model named ${name} — did it get renamed?`);
  const end = py.indexOf('\nclass ', start + 1);
  return py.slice(start, end === -1 ? py.length : end);
}

/** snake_case field name -> the camelCase the client actually sees. */
function toCamel(s: string): string {
  const [head, ...rest] = s.split('_');
  return head + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/** Snake-case fields declared in a pydantic model body, ignoring comments. */
function pyFields(name: string): string[] {
  const body = pyModel(name)
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'));
  const out: string[] = [];
  for (const line of body) {
    const m = line.match(/^\s{4}([a-z][a-z0-9_]*)\s*:/);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Interfaces are erased at runtime, so field parity cannot be asserted by
 * reflection. Assert it by DECLARATION instead: these tests read the source text
 * and compare it against the Python declarations. Slow by the standards of a unit
 * test, exact by the standards of a contract.
 */
function tsInterfaceBody(name: string): string {
  const src = readFileSync(join(process.cwd(), 'src', 'features', 'agent', 'types', 'commands.ts'), 'utf8');
  const m = src.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`no TS interface named ${name}`);
  return m[1];
}

function tsFields(name: string): string[] {
  return [...tsInterfaceBody(name).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]);
}

describe('interface field parity', () => {
  it.each([
    ['Health', ['ok', 'version', 'startedAt', 'db', 'providers']],
    ['StageMarks', ['vadMs', 'sttMs', 'llmMs', 'ttsMs', 'turnGapMs']],
    ['OpsAlert', ['id', 'severity', 'rule', 'oneLiner', 'decision', 'evidence', 'acknowledgedAt', 'acknowledgedBy', 'thresholdIsProvisional']],
    ['AlertEvidence', ['count', 'firstAt', 'lastAt', 'blastRadius']],
    ['ProviderHealth', ['provider', 'role', 'errorRate', 'latencyP95Ms', 'fallbackActive', 'state']],
    ['OpsSnapshot', ['generatedAt', 'since', 'p1', 'p2Grouped', 'p3Count', 'callCount', 'containedPct', 'reachable', 'lastSeenAt']],
    ['SearchResponse', ['chunks', 'embedder', 'dims']],
    ['SearchHit', ['docId', 'ordinal', 'text', 'score']],
    ['ErrorBody', ['code', 'message', 'retryable', 'provider', 'at']],
    ['IngestAccepted', ['jobId', 'state', 'chunks', 'error']],
  ])('%s has the declared fields', (name, expected) => {
    expect(tsFields(name).sort()).toEqual([...expected].sort());
  });

  it('every TS interface field also exists on the Python side', () => {
    const pairs: [string, string][] = [
      ['Health', 'Health'],
      ['StageMarks', 'StageMarks'],
      ['OpsAlert', 'OpsAlert'],
      ['AlertEvidence', 'AlertEvidence'],
      ['ProviderHealth', 'ProviderHealth'],
      ['OpsSnapshot', 'OpsSnapshot'],
      ['SearchResponse', 'SearchResponse'],
      ['SearchHit', 'SearchHit'],
      ['ErrorBody', 'ErrorBody'],
      ['IngestAccepted', 'IngestAccepted'],
    ];
    for (const [tsName, pyName] of pairs) {
      const pyCamel = pyFields(pyName).map(toCamel);
      for (const f of tsFields(tsName)) {
        expect(pyCamel, `${tsName}.${f} missing from ${pyName}`).toContain(f);
      }
    }
  });
});

describe('invariants encoded as types', () => {
  it('no tenant field anywhere in the contract', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'features', 'agent', 'types', 'commands.ts'), 'utf8');
    // Strip comments so prose about tenantId is not a false positive.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const offenders = [...code.matchAll(/^\s*(?:export\s+)?(?:interface\s+)?([A-Za-z]*[Tt]enant[A-Za-z]*)\??:/gm)].map((m) => m[1]);
    expect(offenders).toEqual([]);
    // And the Python side agrees.
    expect(/^\s*tenant_id\s*:/m.test(py)).toBe(false);
  });

  it('no audio field anywhere in the contract', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'features', 'agent', 'types', 'commands.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const banned of ['audioUrl', 'recordingId', 'audio_url', 'recording_path', 'blob']) {
      expect(code).not.toContain(banned);
    }
  });

  it('ClientFrame has exactly one variant: ping', () => {
    // A frame that acts on a call would be a barge-in control wearing a disguise.
    const body = tsInterfaceBody('ClientFrame');
    expect([...body.matchAll(/^\s{2}type:\s*'([^']+)'/gm)].map((m) => m[1])).toEqual(['ping']);
  });

  it('OpsSnapshot.reachable is required, not optional', () => {
    const body = tsInterfaceBody('OpsSnapshot');
    expect(body).toMatch(/^\s{2}reachable: boolean;/m);
    expect(body).not.toMatch(/^\s{2}reachable\?:/m);
  });

  it('voice locale is FR/EN only', () => {
    // The repo ships 5 UI locales; that is a separate fact from what the agent speaks.
    const src = readFileSync(join(process.cwd(), 'src', 'features', 'agent', 'types', 'commands.ts'), 'utf8');
    const m = src.match(/export type VoiceLocale =([^;]+);/);
    expect(m?.[1].replace(/\s/g, '')).toBe("'fr'|'en'");
  });
});
