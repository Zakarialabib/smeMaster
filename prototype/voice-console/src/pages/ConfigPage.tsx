import { useState } from 'react';
import {
  Play, Lock, Sparkles, Shield, Palette, MapPin, Eye, Volume2, Zap, Workflow,
} from 'lucide-react';
import {
  useConfigStore, useUiStore, useVertical,
  useCostSimStore,
  useRoutingStore, useProviderPresets, useSelectedProviderPreset,
} from '../store';
import { VERTICAL_TEMPLATES, VOICE_PERSONAS } from '../data';
import {
  Panel, PanelHead, Pill, Button, DegradedBanner, Note, Labeled, Select,
  Radio, Checkbox, AiBanner, SectionTitle,
  Tabs, Card, Input, Divider,
  type TabItem,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import type {
  ConsentOption, AiCapabilitySlot, ProviderMixPreset, TaskRoute,
} from '../types';

/* ══════════════════════════════════════════════════════════════════════════
   Shared data — consent options, capability labels
   ══════════════════════════════════════════════════════════════════════════ */

const CONSENT_OPTIONS: {
  id: ConsentOption;
  name: string;
  copy: string;
  gdprLoad: string;
  badge: 'ok' | 'tr' | 'flag';
  who: string;
}[] = [
  {
    id: 'A',
    name: 'Option A · Announce-first, no recording',
    copy: '« Bonjour, vous êtes en ligne avec l\'assistant vocal de [Entreprise]. Cet appel n\'est pas enregistré. Comment puis-je vous aider ? »',
    gdprLoad: 'Minimal GDPR load. No audio retention. No retention limits to enforce. No erasure workflow.',
    badge: 'ok',
    who: '§3.3 — recommended for v1',
  },
  {
    id: 'B',
    name: 'Option B · Announce + opt-out',
    copy: '« … Cet appel est enregistré pour la qualité du service. Dites « arrêter l\'enregistrement » pour désactiver. »',
    gdprLoad: 'Medium load. Audio retention policy (max N days), erasure workflow, per-call retention-limit enforcement needed.',
    badge: 'tr',
    who: '⚙️ v2 — consent option B',
  },
  {
    id: 'C',
    name: 'Option C · Announce + opt-in',
    copy: '« … Voulez-vous accepter l\'enregistrement de cet appel pour la qualité du service ? Répondez « oui » pour continuer. »',
    gdprLoad: 'Highest load. Explicit opt-in per call. Break out of main STT stream for a consent-gate turn. Full audit trail of accept/reject.',
    badge: 'flag',
    who: '⚙️ Enterprise / regulated industries',
  },
];

const CAPABILITY_LABELS: Record<AiCapabilitySlot, string> = {
  'voice.stt':         'Voice STT',
  'voice.llm':         'Voice LLM',
  'voice.tts':         'Voice TTS',
  'voice.realtime':    'Voice realtime',
  'email.classify':    'Email classify',
  'email.compose':     'Email compose',
  'email.summarize':   'Email summarize',
  'rag.embedQuery':    'RAG embed (query)',
  'rag.embedDocument': 'RAG embed (doc)',
};

/* ══════════════════════════════════════════════════════════════════════════
   Tabs
   ══════════════════════════════════════════════════════════════════════════ */

type ConfigSection =
  | 'vertical' | 'consent' | 'persona' | 'voice'
  | 'availability' | 'tier' | 'routing' | 'innovations';

const CONFIG_TABS: TabItem<ConfigSection>[] = [
  { id: 'vertical',     label: 'Vertical',                 icon: <MapPin size={13} /> },
  { id: 'consent',      label: 'Consent',                  icon: <Shield size={13} /> },
  { id: 'persona',      label: 'Voice personas',           icon: <Palette size={13} /> },
  { id: 'voice',        label: 'Language + voice',         icon: <Volume2 size={13} /> },
  { id: 'availability', label: 'Availability',             icon: <Zap size={13} /> },
  { id: 'tier',         label: 'Tier',                     icon: <Sparkles size={13} /> },
  { id: 'routing',      label: 'AI routing',               icon: <Workflow size={13} /> },
  { id: 'innovations',  label: 'Guardrails & innovations', icon: <Eye size={13} /> },
];

/** What every section component expects for `c`. See note in App.tsx. */
type ConfigStore = ReturnType<typeof useConfigStore.getState>;

/* ══════════════════════════════════════════════════════════════════════════
   Page shell — tabs, section router, footer
   ══════════════════════════════════════════════════════════════════════════ */

export function ConfigPage() {
  const c = useConfigStore();
  const v = useVertical();
  const notify = useUiStore((s) => s.notify);
  const [section, setSection] = useState<ConfigSection>('vertical');
  const [testing, setTesting] = useState(false);
  const [testVoiceId, setTestVoiceId] = useState<string | null>(null);

  return (
    <Panel>
      <PanelHead
        title="Config"
        sub="changes are per-tenant · every save writes a new scope version"
        right={
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tabs<ConfigSection>
              ariaLabel="Config sections"
              value={section}
              onChange={setSection}
              tabs={CONFIG_TABS}
            />
            <Pill tone="off">no prompt editor — by decision</Pill>
          </span>
        }
      />

      {section === 'vertical'     && <VerticalSection c={c} v={v} />}
      {section === 'consent'      && <ConsentSection c={c} notify={notify} testing={testing} setTesting={setTesting} />}
      {section === 'persona'      && <PersonaSection c={c} notify={notify} testVoiceId={testVoiceId} setTestVoiceId={setTestVoiceId} />}
      {section === 'voice'        && <VoiceSection c={c} />}
      {section === 'availability' && <AvailabilitySection c={c} />}
      {section === 'tier'         && <TierSection c={c} />}
      {section === 'routing'      && <RoutingSection notify={notify} />}
      {section === 'innovations'  && <InnovationsSection c={c} notify={notify} />}

      <div style={{ padding: 16, background: 'var(--bg-tertiary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Lock size={14} color="var(--text-tertiary)" style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong>Behaviour is read-only here.</strong> Prompts, the tool set and the assistant's
          "never" list are <em>not</em> editable in the console — see <code>dev/AGENT-PROMPTS.md</code>.
          If you want different wording, that is a change request, not a setting.
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px',
        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)',
        position: 'sticky', bottom: 0,
      }}>
        {c.dirty && (
          <span style={{ alignSelf: 'center', marginInlineEnd: 'auto', fontSize: 12, color: 'var(--warning)' }}>
            Unsaved changes — leaving now discards them (Esc)
          </span>
        )}
        <Button onClick={() => { c.discard(); notify('Changes discarded'); }}>Discard</Button>
        <Button primary disabled={!c.dirty} onClick={() => { c.save(); notify('Saved · tier change applies to the next call, never a live one'); }}>
          Save changes
        </Button>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Vertical
   ══════════════════════════════════════════════════════════════════════════ */

function VerticalSection({ c, v }: { c: ConfigStore; v: ReturnType<typeof useVertical> }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <AiBanner
        title="§5 innovation #1 — Vertical-in-a-box templates"
        body="Pick a vertical, get the call flows, the knowledge structure, the booking rules, the escalation ladder and the killer outcome. Onboarding becomes config, not build. The scored matrix from §2 sorts by fit — garage is recommended."
        actions={
          <button className="focus-ring"
            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ai)', fontWeight: 600, fontSize: 12 }}>
            Open scoring matrix →
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, margin: '8px 0 12px' }}>
        {VERTICAL_TEMPLATES.map((t) => {
          const active = c.verticalId === t.id;
          return (
            <Card key={t.id} active={active} onClick={() => c.set('verticalId', t.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>
                  {active ? '● ' : '○ '}{t.name}
                </strong>
                <Pill tone="ai">score {t.totalScore}</Pill>
                {active && <Pill tone="ok">loaded</Pill>}
                {t.id === 'garage' && !active && <Pill tone="tr">our recommendation</Pill>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ai)', fontWeight: 600, marginBottom: 6 }}>
                🎯 {t.killerOutcome}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                <strong>Anti-metric:</strong> {t.antiMetric}<br />
                <strong>Patron metric:</strong> {t.patronMetric}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {t.callTypes.slice(0, 4).map((ct) => (
                  <span key={ct} style={{ padding: '2px 7px', background: 'var(--bg-tertiary)', borderRadius: 999 }}>{ct}</span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Preset loaded for {v.name} —</strong>
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <div>📞 <strong>Call types:</strong> {v.callTypes.join(', ')}</div>
          <div>📋 <strong>Booking rules:</strong> {v.bookingRules.join(' · ')}</div>
          <div>🎯 <strong>Optimizes for:</strong> {v.patronMetric}</div>
          <div>🚫 <strong>Anti-metric:</strong> {v.antiMetric}</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Consent
   ══════════════════════════════════════════════════════════════════════════ */

function ConsentSection({ c, notify, testing, setTesting }: {
  c: ConfigStore;
  notify: (m: string) => void;
  testing: boolean;
  setTesting: (v: boolean) => void;
}) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>§3.3 Consent model + disclosure</SectionTitle>
      <Note>
        <strong>Recommendation: Option A.</strong> Minimal GDPR exposure (no audio retention, no retention limits, no erasure workflow). Builds trust with callers who hate bots. Simple to explain to the client and to CNIL. §4 decision #4 is a <em>recommendation with escape hatch</em> — not a question. Transcripts (text) are still stored for analytics.
      </Note>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
        {CONSENT_OPTIONS.map((o) => {
          const on = c.consent === o.id;
          return (
            <Card key={o.id} active={on} onClick={() => c.set('consent', o.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <Radio name="consentopt" checked={on}
                  label={<strong style={{ color: 'var(--text-primary)' }}>{o.name}</strong>}
                  onChange={() => c.set('consent', o.id)} />
                <Pill tone={o.badge}>{o.who}</Pill>
                {o.id === 'A' && <Pill tone="ok">✓ v1 default</Pill>}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--accent-hover)',
                fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic',
                padding: '6px 10px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)', margin: '6px 0',
              }}>
                {o.copy}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                📋 {o.gdprLoad}
              </div>
            </Card>
          );
        })}
      </div>

      <Labeled label="Disclosure line (sentence 0)">
        <Checkbox checked={c.disclosureEnabled}
          onChange={() => c.set('disclosureEnabled', !c.disclosureEnabled)}
          label="Spoken on 100% of calls — the one rule, §3 P3 Camille. Non-negotiable." />
        <span style={{ fontSize: 12, color: 'var(--danger)' }}>⚠ Turning this off removes CNIL compliance</span>
      </Labeled>

      <div style={{ padding: '8px 0 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button primary onClick={() => {
          setTesting(true);
          setTimeout(() => {
            setTesting(false);
            notify(`Consent Option ${c.consent} preview played — exact copy above · no audio stored`);
          }, 900);
        }}>
          <Play size={13} /> {testing ? 'Playing…' : `Test Option ${c.consent} greeting (6s)`}
        </Button>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          plays the real voice · catches a broken voice id before save · §5 #7 auto-creates a consent receipt per call
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Voice personas
   ══════════════════════════════════════════════════════════════════════════ */

function PersonaSection({ c, notify, testVoiceId, setTestVoiceId }: {
  c: ConfigStore;
  notify: (m: string) => void;
  testVoiceId: string | null;
  setTestVoiceId: (v: string | null) => void;
}) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>§5 #15 · Voice persona library</SectionTitle>
      <Note>
        Pre-designed voices tuned to the brand character of the vertical. Pick <em>one persona per language</em> (FR + EN). Changing a persona invalidates the greeting cache (1 024 phrases) and takes ~90 s.
      </Note>

      {(['FR', 'EN'] as const).map((L) => (
        <div key={L} style={{ marginBottom: 18 }}>
          <SectionTitle style={{ marginBottom: 8 }}>{L} · Personas</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {VOICE_PERSONAS.filter((p) => p.lang === L).map((p) => {
              const active = (L === 'FR' ? c.voiceFr : c.voiceEn) === p.id;
              return (
                <Card key={p.id} active={active}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Radio name={`v${L}`} checked={active}
                      label={<strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>}
                      onChange={() => c.set(L === 'FR' ? 'voiceFr' : 'voiceEn', p.id)} />
                    <Pill tone="off">{p.brand}</Pill>
                    {active && <Pill tone="ai">● active</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 6 }}>
                    🎭 {p.character}
                  </div>
                  <div style={{
                    fontSize: 11.5, color: 'var(--text-tertiary)',
                    padding: '6px 8px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)', fontStyle: 'italic', marginBottom: 8,
                  }}>
                    « {p.sample} »
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Button size="sm" onClick={() => {
                      setTestVoiceId(p.id);
                      setTimeout(() => {
                        setTestVoiceId(null);
                        notify(`Persona « ${p.name} » played · ${p.sample.length} chars · cache would be warmed on save`);
                      }, 700);
                    }}>
                      <Play size={12} />{testVoiceId === p.id ? ' Playing…' : ' Play'}
                    </Button>
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      speed {p.speed.toFixed(2)} · pitch {p.pitch}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Voice / language
   ══════════════════════════════════════════════════════════════════════════ */

function VoiceSection({ c }: { c: ConfigStore }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>Language pair & TTS</SectionTitle>

      <Labeled label="Voice locale (not UI locale)">
        <Pill tone="ok">FR ✓</Pill><Pill tone="ok">EN ✓</Pill>
        <Pill tone="off" title="Voice is FR/EN only. The UI ships 5 locales; that is separate.">
          AR — permanently off · JA/IT — UI only
        </Pill>
      </Labeled>

      <Labeled label="§5 #9 · Bilingual code-switching">
        <Checkbox checked={c.bilingualCodeSwitching}
          onChange={() => c.set('bilingualCodeSwitching', !c.bilingualCodeSwitching)}
          label="FR callers drop « ouais », « bah », « du coup », « en fait », and occasional English. Switch mid-call when detected." />
        <Pill tone="ok">v1 · on by default</Pill>
      </Labeled>

      <Labeled label="§5 #10 · Accent-adaptive STT">
        <Checkbox checked={c.accentAdaptive}
          onChange={() => c.set('accentAdaptive', !c.accentAdaptive)}
          label="Per-accent WER eval: Parisian, Marseille, Alsatian, Breton, North African. Not just aggregate WER." />
        <Pill tone="flag">awaiting eval data</Pill>
      </Labeled>

      <Labeled label="TTS voice (FR)">
        <Select ariaLabel="French TTS voice" value={c.voiceFr} onChange={(v) => c.set('voiceFr', v)}
          options={VOICE_PERSONAS.filter((p) => p.lang === 'FR').map((p) => ({ v: p.id, l: `${p.name} · ${p.brand}` }))} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          📥 1 024 cached phrases · cache invalidated on change (~90s)
        </span>
      </Labeled>

      <Labeled label="TTS voice (EN)">
        <Select ariaLabel="English TTS voice" value={c.voiceEn} onChange={(v) => c.set('voiceEn', v)}
          options={VOICE_PERSONAS.filter((p) => p.lang === 'EN').map((p) => ({ v: p.id, l: `${p.name} · ${p.brand}` }))} />
      </Labeled>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Availability
   ══════════════════════════════════════════════════════════════════════════ */

function AvailabilitySection({ c }: { c: ConfigStore }) {
  const MODES: { v: typeof c.afterHours; l: string; d: string }[] = [
    { v: 'take_message',     l: '💬 Take a message',              d: 'Classic. Prompted caller for message + number. Sent to Patron WhatsApp within 5 min.' },
    { v: 'callback_promise', l: '⏰ Promise a callback (§5 #12)', d: '« Quelqu\'un vous rappelle sous X heures ». Logs a ticket. More valuable than transfer to a closed line.' },
    { v: 'transfer',         l: '📞 Transfer',                    d: 'To the on-call number. Good for BTP emergencies; produces P1 alerts if the target rings out.' },
    { v: 'announce_only',    l: '🔊 Announce only',               d: 'Hours + closed line. No message captured. Last-resort; hates this = angry callers.' },
  ];
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>Availability</SectionTitle>

      <Labeled label="Business hours">
        <Input value={c.hours} onChange={(v) => c.set('hours', v)} ariaLabel="Business hours" width={200} fullWidth={false} />
        <Select ariaLabel="Time zone" value={c.tz} onChange={(v) => c.set('tz', v)}
          options={[{ v: 'Europe/Paris', l: 'Europe/Paris' }]} />
      </Labeled>

      <Labeled label="Transfer target (P4 Julie)" hint="required whenever the agent answers in-hours">
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{c.transferTarget}</span>
        <Pill tone="ok">required</Pill>
      </Labeled>

      <div style={{ padding: '12px 0' }}>
        <SectionTitle style={{ marginBottom: 8 }}>§5 #17 + #12 · After-hours behaviour</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {MODES.map(({ v, l, d }) => {
            const on = c.afterHours === v;
            return (
              <Card key={v} active={on} onClick={() => c.set('afterHours', v)}>
                <Radio name="ah" checked={on} label={<strong style={{ fontSize: 13 }}>{l}</strong>}
                  onChange={() => c.set('afterHours', v)} />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, paddingInlineStart: 26 }}>
                  {d}
                </p>
              </Card>
            );
          })}
        </div>

        {c.afterHours === 'callback_promise' && (
          <div style={{
            marginTop: 10, padding: 12, borderRadius: 'var(--radius-lg)',
            background: 'var(--warning-light)', border: '1px solid rgba(217,119,6,.25)',
          }}>
            <Labeled label="Callback within (hours)">
              <Input
                type="number"
                value={String(c.callbackHours)}
                onChange={(v) => c.set('callbackHours', Math.max(0.5, Math.min(48, parseFloat(v || '2'))))}
                width={100}
                fullWidth={false}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Logged as a ticket · P4 Julie sees it on arrival · Patron gets WhatsApp note
              </span>
            </Labeled>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Tier
   ══════════════════════════════════════════════════════════════════════════ */

function TierSection({ c }: { c: ConfigStore }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>Tier (decides where keys live)</SectionTitle>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <TierCard title="Budget · self-hosted" price="—" state="unavailable — latency unmeasured, Gate 4" disabled />
        <TierCard title="Standard · cloud" price="€0.19/min" state="signed model" active={c.tier === 'standard'}
          onClick={() => c.set('tier', 'standard')} />
        <TierCard title="Premium · ElevenLabs" price="€0.28/min" state="best quality, higher cost" active={c.tier === 'premium'}
          onClick={() => c.set('tier', 'premium')} />
      </div>

      <DegradedBanner tone="warning" title="Budget tier unavailable"
        body="The self-hosted tier is disabled because its end-of-turn latency has not been measured yet. It is shown with the reason rather than hidden — a missing option becomes a support ticket." />

      <Note>
        The tier sets the <strong>absolute</strong> rate (€0.19 vs €0.28/min). Which providers run <em>inside</em> that
        tier is a separate decision — see the <strong>AI routing</strong> tab. Combined, they give the € you see in the cost simulator.
      </Note>
    </div>
  );
}

function TierCard({ title, price, state, active, disabled, onClick }: {
  title: string; price: string; state: string; active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <Card active={active} disabled={disabled} onClick={onClick} style={{ minWidth: 220, flex: '1 1 220px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {active ? '● ' : '○ '}{title}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0', color: 'var(--text-primary)' }}>{price}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{state}</div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AI routing
   ══════════════════════════════════════════════════════════════════════════ */

function RoutingSection({ notify }: { notify: (m: string) => void }) {
  const routes = useRoutingStore((s) => s.routes);
  const setRoute = useRoutingStore((s) => s.setRoute);
  const presets = useProviderPresets();
  const presetId = useSelectedProviderPreset();
  const setPreset = useCostSimStore((s) => s.setProviderPreset);

  /**
   * Apply a preset by writing overrides through `setRoute`, so the effective
   * routing and the cost simulator both agree. One click, N routes change.
   */
  const applyPreset = (preset: ProviderMixPreset) => {
    const slots = Object.keys(preset.overrides) as AiCapabilitySlot[];
    for (const slot of slots) {
      const ref = preset.overrides[slot];
      if (!ref) continue;
      const existing = routes.find((r) => r.task === slot);
      setRoute(slot, {
        task: slot,
        primary: ref,
        fallback: existing?.fallback ?? [],
        pinned: existing?.pinned,
      });
    }
    setPreset(preset.id);
    notify(`Preset "${preset.label}" applied — ${slots.length} route${slots.length === 1 ? '' : 's'} updated`);
  };

  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <AiBanner
        title="AI routing — which provider handles which slot"
        body="The signed strategy: OpenAI + Gemini primary, Mistral + BytePlus + OpenRouter extended. A preset changes several routes at once; per-slot overrides live in Settings → Providers (the canonical catalog). Rows marked pinned cannot be swapped without re-embedding the corpus."
      />

      <div style={{ marginTop: 12 }}>
        <SectionTitle style={{ marginBottom: 10 }}>Provider mix preset</SectionTitle>
        <ProviderMixPicker presets={presets} currentId={presetId} onApply={applyPreset} />
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
          Each preset swaps the primary provider for several slots at once. The same preset drives the
          cost simulator on the <strong>Cost</strong> page — a preset is one decision, seen two ways.
        </div>
      </div>

      <Divider label="Effective routing" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {routes.map((r) => <RouteRow key={r.task} route={r} />)}
      </div>

      <Note>
        <strong>Prototype behaviour:</strong> applying a preset calls <code>setRoute</code> for each
        override in the fixture, so the effective routing above updates. In the real app this writes
        to the tenant's settings and re-keys the affected providers on the next call — not mid-call.
      </Note>
    </div>
  );
}

/** Rate-delta per preset, shown as a pill on the picker. Not vendor quotes. */
const PRESET_RATE_FACTOR: Record<string, number> = {
  'openai-primary': 1.00,
  'gemini-primary': 0.92,
  'mistral-lean':   0.68,
  'selfhosted':     0.35,
};

function ProviderMixPicker({
  presets, currentId, onApply,
}: {
  presets: ProviderMixPreset[];
  currentId: string;
  onApply: (p: ProviderMixPreset) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
      {presets.map((p) => {
        const active = currentId === p.id;
        const factor = PRESET_RATE_FACTOR[p.id] ?? 1;
        const deltaPct = Math.round((1 - factor) * 100);
        const slots = Object.keys(p.overrides).length;
        return (
          <Card key={p.id} active={active} onClick={() => onApply(p)} style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {active ? '● ' : '○ '}{p.label}
              </strong>
              {active && <Pill tone="ok">loaded</Pill>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {deltaPct > 0
                ? <Pill tone="ok" style={{ fontSize: 10.5 }}>≈ −{deltaPct}% rate</Pill>
                : <Pill tone="off" style={{ fontSize: 10.5 }}>baseline</Pill>}
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {slots === 0 ? 'no overrides' : `${slots} slot${slots === 1 ? '' : 's'} overridden`}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RouteRow({ route }: { route: TaskRoute }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr 2fr', gap: 12, alignItems: 'center',
      padding: '10px 12px', borderRadius: 'var(--radius)',
      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
          {CAPABILITY_LABELS[route.task]}
        </span>
        {route.pinned && <Pill tone="flag" style={{ fontSize: 10 }}>pinned</Pill>}
      </div>
      <div>
        <ProviderBadge provider={route.primary.provider} model={route.primary.model} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {route.fallback.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>no fallback (pinned)</span>
          : route.fallback.map((f) => (
              <ProviderBadge key={`${f.provider}-${f.model}`} provider={f.provider} model={f.model} muted />
            ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Innovations
   ══════════════════════════════════════════════════════════════════════════ */

function InnovationsSection({ c, notify }: { c: ConfigStore; notify: (m: string) => void }) {
  const TOGGLES: { id: keyof typeof c; k: string; t: string; d: string }[] = [
    { id: 'shadowMode',             k: '§5 #2',  t: '👻 Shadow mode',              d: 'Agent listens for 1 week without speaking. P1/Marc reviews transcripts, then goes live. Cheapest trust-builder in the plan.' },
    { id: 'emotionEscalation',      k: '§5 #11', t: '😠 Emotion-aware escalation', d: 'If caller sounds distressed or angry → escalate faster. 2 angry turns = skip the ladder. Reduces the worst calls.' },
    { id: 'spamFilter',             k: '§5 #16', t: '🛡 Spam / robocall filtering', d: 'French SMEs get flooded. Detect + reject by prefix pattern & spam score. Saves P1/Marc ~10min/day.' },
    { id: 'bilingualCodeSwitching', k: '§5 #9',  t: '🌐 Bilingual code-switching',  d: 'European French uses occasional English loanwords. EN callers throw in « rendez-vous ». Cross-lingual retrieval + pinning.' },
    { id: 'accentAdaptive',         k: '§5 #10', t: '🗣 Accent-adaptive STT',       d: 'Per-accent WER tracking: Parisian, Marseille, Alsatian, Breton, North African. Not just aggregate WER.' },
  ];
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle>§5 Innovations · behavioural toggles</SectionTitle>
      <Note>
        Each toggle maps directly to the 20-item ranked innovation list in the brainstorm. Turning one off here removes it from the call flow. Every toggle is per-tenant, not global.
      </Note>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>
        {TOGGLES.map(({ id, k, t, d }) => (
          <Card key={id}>
            <Checkbox checked={!!c[id] as boolean}
              onChange={() => c.set(id, !Boolean(c[id]) as never)}
              label={
                <>
                  <strong>{t}</strong>{' '}
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k}</span>
                </>
              } />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, paddingInlineStart: 26 }}>
              {d}
            </p>
          </Card>
        ))}
      </div>

      {c.shadowMode && (
        <DegradedBanner tone="warning" title="Shadow mode is ON"
          body="The agent is listening but producing NO audio output. Transcripts are captured for P1/Marc to review. Inbound callers hear the carrier voicemail. Go to the Scenarios surface to inspect call transcripts before flipping this back."
          action={
            <Button size="sm" onClick={() => notify('Shadow-mode call list opened → 2 calls captured today (c_09, c_10)')}>
              Review captured transcripts
            </Button>
          } />
      )}
    </div>
  );
}