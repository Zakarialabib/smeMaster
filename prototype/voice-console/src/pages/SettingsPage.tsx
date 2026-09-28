import { useState } from 'react';
import { Cloud, HardDrive, KeyRound, ShieldCheck, Download, Trash2, Check } from 'lucide-react';
import { useUiStore, useConfigStore, useKnowledgeStore } from '../store';
import { Panel, PanelHead, Pill, Button, Note, DataTable, DegradedBanner, AiBanner, type Column } from '../components/ui';

/**
 * Settings — providers per seam, local vs cloud, and where the keys live.
 *
 * The four seams come from BACKEND.md §3. Each row is a real swap: changing the
 * selection is a config value, never a code change (the Gate 1 exit criterion).
 * Where a seam can run LOCALLY vs CLOUD is the row's most important column —
 * it decides which machine holds the API key.
 */

type Seam = 'LLM' | 'TTS' | 'STT' | 'EMBEDDING';
type Where = 'cloud' | 'local';

interface SeamDef {
  seam: Seam;
  runs: 'agent-core (VPS)' | 'this desktop';
  primary: string;
  primaryWhere: Where;
  fallback: string;
  fallbackWhere: Where;
  state: 'active' | 'available' | 'unavailable';
  why: string;
  licence: string;
}

const SEAMS: SeamDef[] = [
  {
    seam: 'LLM', runs: 'agent-core (VPS)', primary: 'google/gemini-3.x-flash', primaryWhere: 'cloud',
    fallback: 'gpt-4o-mini', fallbackWhere: 'cloud', state: 'active',
    why: 'Fast TTFT, strong multilingual, cheapest per turn. Verified 2026-09-28: 458 models, only 4 emit audio — OpenRouter is the brain, never the voice.',
    licence: 'n/a (API)',
  },
  {
    seam: 'TTS', runs: 'agent-core (VPS)', primary: 'ElevenLabs — siwis-medium (FR)', primaryWhere: 'cloud',
    fallback: 'Azure Neural (margin rescue)', fallbackWhere: 'cloud', state: 'active',
    why: 'Dominant cost line and the latency bottleneck. Cached greetings and the disclosure line are the cheapest lever on it.',
    licence: 'n/a (API)',
  },
  {
    seam: 'STT', runs: 'agent-core (VPS)', primary: 'Deepgram Nova (streaming)', primaryWhere: 'cloud',
    fallback: 'ElevenLabs Scribe (batch / voicemail)', fallbackWhere: 'cloud', state: 'active',
    why: 'Native streaming. Scribe has the better WER but is not streaming, so it is batch-only. **Deepgram EU residency unverified** — see PERFORMANCE.md C1.',
    licence: 'n/a (API)',
  },
  {
    seam: 'EMBEDDING', runs: 'agent-core (VPS)', primary: 'bge-m3 (self-hosted)', primaryWhere: 'local',
    fallback: 'arctic-embed-l-v2.0', fallbackWhere: 'local', state: 'active',
    why: 'Self-hosted, so the client KB never leaves the EU. Same XLM-R arch and 1024-d as the fallback — swapping is a config value, but it means re-embedding the corpus.',
    licence: 'MIT',
  },
];

const LOCAL_TIER = [
  { id: 'stt', task: 'Speech to text', engine: 'sherpa-onnx zipformer (FR/EN)', rtf: 'not measured', state: 'blocked' as const, size: '~70 MB' },
  { id: 'tts', task: 'Text to speech', engine: 'sherpa-onnx Piper / Kokoro', rtf: 'not measured', state: 'blocked' as const, size: '~60 MB' },
  { id: 'vad', task: 'Voice activity', engine: 'sherpa-onnx Silero VAD', rtf: 'not measured', state: 'blocked' as const, size: '~2 MB' },
  { id: 'llm', task: 'LLM', engine: 'mistral.rs / Qwen2.5-14B', rtf: 'n/a', state: 'unavailable' as const, size: '~9 GB' },
];

const CAPS = [
  { id: '1', cap: 'Speech to text', value: 'available', via: 'sherpa-onnx 1.11 (Apache-2.0)', state: 'ok' as const },
  { id: '2', cap: 'Text to speech', value: 'available', via: 'sherpa-onnx 1.11 (Apache-2.0)', state: 'ok' as const },
  { id: '3', cap: 'Voice activity detection', value: 'available', via: 'sherpa-onnx Silero VAD', state: 'ok' as const },
  { id: '4', cap: 'Execution providers', value: 'cpu', via: 'no GPU detected on this host', state: 'warn' as const },
  { id: '5', cap: 'Microphone capture', value: 'not granted', via: 'not requested — the console never records audio', state: 'off' as const },
  { id: '6', cap: 'Local embedding models', value: '1 installed', via: 'bge-small-en-v1.5, 384-d, ENGLISH-ONLY', state: 'warn' as const },
];

export function SettingsPage() {
  const tier = useConfigStore((s) => s.tier);
  const notify = useUiStore((s) => s.notify);
  const k = useKnowledgeStore();
  const [tab, setTab] = useState<'providers' | 'local' | 'keys' | 'about'>('providers');

  const seamCols: Column<SeamDef>[] = [
    { key: 's', header: 'Seam', render: (r) => <strong style={{ color: 'var(--text-primary)' }}>{r.seam}</strong> },
    {
      key: 'p', header: 'Provider', render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{r.primary}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>then {r.fallback}</span>
        </div>
      ),
    },
    {
      key: 'w', header: 'Runs where', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {r.primaryWhere === 'local' ? <HardDrive size={13} color="var(--ai)" /> : <Cloud size={13} color="var(--text-tertiary)" />}
          <span style={{ color: 'var(--text-secondary)' }}>{r.runs}</span>
        </span>
      ),
    },
    { key: 'l', header: 'Licence', render: (r) => <Pill tone="off">{r.licence}</Pill> },
    {
      key: 'st', header: 'State', render: (r) => r.state === 'active'
        ? <Pill tone="ok">● active</Pill>
        : r.state === 'available' ? <Pill tone="off">○ available</Pill> : <Pill tone="flag">⛠ unavailable</Pill>,
    },
  ];

  return (
    <>
      <Panel>
        <PanelHead
          title="Settings"
          sub="providers, local hardware, and where the keys live"
          right={
            <span style={{ display: 'flex', gap: 4 }}>
              {(['providers', 'local', 'keys', 'about'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className="focus-ring"
                  style={{
                    font: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 10px',
                    borderRadius: 'var(--radius)', border: 0,
                    background: tab === t ? 'var(--accent-subtle)' : 'transparent',
                    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: tab === t ? 600 : 400,
                  }}>{t === 'providers' ? 'Providers' : t === 'local' ? 'Local hardware' : t === 'keys' ? 'Keys' : 'About'}</button>
              ))}
            </span>
          }
        />

        {tab === 'providers' && (
          <>
            <DataTable rows={SEAMS} columns={seamCols} rowKey={(r) => r.seam} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SEAMS.map((r) => (
                <div key={r.seam} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <strong>{r.seam}:</strong> {r.why}
                </div>
              ))}
            </div>
            <Note>
              <strong>The swap test is the Gate 1 exit criterion:</strong> a second implementation of
              each seam must swap in by a <em>config value alone</em>, with no code change. The
              EMBEDDING row already demonstrates it — same architecture, same 1024-d, different
              model id.
            </Note>
            <div style={{ padding: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => notify('Provider test: STT ok · TTS ok · LLM ok (412 ms TTFT) · EMBED 1024-d ok')}>
                Test all providers
              </Button>
              <Button onClick={() => notify('Chain order: Deepgram → Scribe → local zipformer')}>View fallback chain</Button>
              <span style={{ flex: 1 }} />
              <Pill tone="flag">rates unverified</Pill>
            </div>
          </>
        )}

        {tab === 'local' && (
          <>
            <div style={{ padding: 16 }}>
              <h3 style={H3}>This device's capabilities</h3>
              <DataTable
                rows={CAPS}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'c', header: 'Capability', render: (r: typeof CAPS[number]) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.cap}</span> },
                  { key: 'v', header: 'Value', render: (r: typeof CAPS[number]) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.value}</span> },
                  { key: 'vi', header: 'Via', render: (r: typeof CAPS[number]) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.via}</span> },
                  {
                    key: 's', header: 'State', render: (r: typeof CAPS[number]) => r.state === 'ok'
                      ? <Pill tone="ok">ok</Pill> : r.state === 'warn' ? <Pill tone="flag">check</Pill> : <Pill tone="off">n/a</Pill>,
                  },
                ]}
              />
              <DegradedBanner tone="warning" title="The local embedding model is English-only"
                body="bge-small-en-v1.5 is hard-coded in six places. A French query against it retrieves nothing useful, silently — an English test passes. This is the blocking item in RAG-FORK.md." />
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
              <h3 style={H3}>Local tier — models</h3>
              <DataTable
                rows={LOCAL_TIER}
                rowKey={(r) => r.id}
                columns={[
                  { key: 't', header: 'Task', render: (r: typeof LOCAL_TIER[number]) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.task}</span> },
                  { key: 'e', header: 'Engine', render: (r: typeof LOCAL_TIER[number]) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.engine}</span> },
                  { key: 'z', header: 'Size', align: 'end', render: (r: typeof LOCAL_TIER[number]) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.size}</span> },
                  { key: 'r', header: 'RTF', align: 'end', render: (r: typeof LOCAL_TIER[number]) => <Pill tone="flag">{r.rtf}</Pill> },
                  {
                    key: 's', header: 'State', render: (r: typeof LOCAL_TIER[number]) => r.state === 'blocked'
                      ? <Pill tone="flag">⛠ blocked</Pill> : <Pill tone="off">⛠ unavailable</Pill>,
                  },
                  {
                    key: 'a', header: '', align: 'end', render: (r: typeof LOCAL_TIER[number]) => (
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <Button size="sm" disabled={r.state !== 'blocked'} onClick={() => notify(`Downloading ${r.engine}…`)}>
                          <Download size={12} /> Get
                        </Button>
                        <Button size="sm" disabled><Trash2 size={12} /></Button>
                      </span>
                    ),
                  },
                ]}
              />
              <DegradedBanner
                title={`Local tier is unavailable — RTF not measured (tier is ${tier})`}
                body="The budget tier is gated on measured real-time factor. An engine at RTF 1.4 cannot serve a live call however good its WER, so it stays disabled with the reason shown rather than hidden."
              />
              <AiBanner
                title="This device can close 3 of 4 gaps; one needs hardware"
                body="STT, TTS and VAD are all satisfiable on CPU today. The LLM would need roughly 9 GB of disk and a GPU to stay under RTF 1 — that is an upgrade conversation, not a settings change."
              />
            </div>
          </>
        )}

        {tab === 'keys' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Note>
              <strong>Keys follow the provider.</strong> Whichever machine runs the agent needs the
              key for the provider it calls. You cannot have a cloud tier running on the VPS and a
              self-hosted tier on the desktop at the same time and expect both to be keyless.
            </Note>
            <DataTable
              rows={[
                { id: '1', seam: 'LLM', provider: 'OpenRouter', keyWhere: 'the VPS', holder: 'agent-core secret store', exposed: false },
                { id: '2', seam: 'TTS', provider: 'ElevenLabs', keyWhere: 'the VPS', holder: 'agent-core secret store', exposed: false },
                { id: '3', seam: 'STT', provider: 'Deepgram', keyWhere: 'the VPS', holder: 'agent-core secret store', exposed: false },
                { id: '4', seam: 'EMBEDDING', provider: 'bge-m3 (self-hosted)', keyWhere: 'nowhere', holder: 'no key — the model runs on our host', exposed: false },
                { id: '5', seam: 'LLM/TTS/STT', provider: 'self-hosted tier', keyWhere: 'this desktop', holder: 'Tauri secure store', exposed: false },
                { id: '6', seam: 'telephony', provider: 'Telnyx', keyWhere: 'the VPS', holder: 'agent-core secret store', exposed: false },
              ]}
              rowKey={(r) => r.id}
              columns={[
                { key: 's', header: 'Seam', render: (r: { seam: string }) => <strong style={{ color: 'var(--text-primary)' }}>{r.seam}</strong> },
                { key: 'p', header: 'Provider', render: (r: { provider: string }) => r.provider },
                {
                  key: 'k', header: 'Key lives on', render: (r: { keyWhere: string; exposed: boolean }) => r.keyWhere === 'nowhere'
                    ? <Pill tone="ok"><ShieldCheck size={11} /> nowhere — local model</Pill>
                    : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <KeyRound size={12} color={r.keyWhere === 'this desktop' ? 'var(--ai)' : 'var(--text-tertiary)'} />
                        <strong style={{ color: r.keyWhere === 'this desktop' ? 'var(--ai)' : 'var(--text-secondary)' }}>{r.keyWhere}</strong>
                      </span>,
                },
                { key: 'h', header: 'Held by', render: (r: { holder: string }) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.holder}</span> },
                { key: 'v', header: 'Verify', render: (r: { keyWhere: string }) => <Button size="sm" onClick={() => notify(`Verifying the ${r.keyWhere} key… ok`)}><Check size={12} /> Test</Button> },
              ]}
            />
            <Note>
              <strong>Two different things, deliberately.</strong> "Key lives on" says{' '}
              <em>which machine holds the credential</em> — the VPS needs one because the agent runs
              there. "Not your vendor accounts" is about <em>blast radius</em>: a compromised VPS
              gives an attacker the credential and whatever it can reach, which is per-tenant
              transcripts and configuration. It does <strong>not</strong> hand over a login to
              ElevenLabs or Deepgram, but it <em>does</em> let an attacker spend against those
              accounts until we rotate. Rotation is one button; do it after any suspected
              compromise, and prefer short-lived scoped keys over long-lived ones at procurement.
            </Note>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => notify('Rotate all VPS keys — staged, non-disruptive')}><KeyRound size={13} /> Rotate VPS keys</Button>
              <Button onClick={() => notify('This would drop the local tier to unconfigured')}><Trash2 size={13} /> Revoke local-tier key</Button>
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row k="Prototype" v="high-fidelity React prototype — not product code" />
            <Row k="Stack" v="React 19 · Zustand 5 · Vite 7 · lucide-react" />
            <Row k="Design tokens" v="copied verbatim from src/styles/globals.css (@theme)" />
            <Row k="Token classes" v="src/shared/styles/ui-tokens.ts (FOCUS_RING, BTN_PRIMARY, CARD_BASE)" />
            <Row k="Nav source" v="navConfig.ts — NAV_GROUPS, INSIGHT_WIDGETS" />
            <Row k="Payload shapes" v="docs/voice/design/BACKEND.md §13" />
            <Row k="Stores & WS states" v="docs/voice/design/FRONTEND.md §12" />
            <Row k="Alert matrix" v="docs/voice/dev/OPS-ASSISTANT.md §3" />
            <Row k="Forbidden" v="no audio UI · no barge-in control · no provider SDK in the console · no tenantId from the client · no prompt editor" />
            <Note>
              <strong>Voice is FR/EN only.</strong> The app ships 5 UI locales (en/fr/ar/ja/it) and
              that is a separate fact from what the agent speaks. The `ar` interface never offers
              Arabic voice.
            </Note>
            <AiBanner
              title="Knowledge scope: 4 of 6 sources enabled"
              body={`Currently ${Object.values(k.scope).filter(Boolean).length} scopes on, ${Object.values(k.scope).filter((v) => !v).length} off. Mail and contacts stay off in v1 — that is the privacy guardrail, not an oversight.`}
            />
          </div>
        )}
      </Panel>
    </>
  );
}

const H3: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600 };

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
    </div>
  );
}
