import { useState } from 'react';
import { Play, Lock, Sparkles, Shield, Palette, MapPin, Eye, Volume2, Zap, Calculator } from 'lucide-react';
import { useConfigStore, useUiStore, useReachable, useOpsStore, useVertical, useCostSimStore, runCostSim } from '../store';
import { COST_ROWS, DAILY_MINUTES, VERTICAL_TEMPLATES, VOICE_PERSONAS } from '../data';
import {
  Panel, PanelHead, Pill, Button, DegradedBanner, Note, Labeled, Select, Radio, Checkbox,
  DataTable, AiBanner, type Column, SectionTitle,
} from '../components/ui';
import type { CostRow, ConsentOption, PricingShape } from '../types';

const CONSENT_OPTIONS: { id: ConsentOption; name: string; copy: string; gdprLoad: string; badge: 'ok' | 'tr' | 'flag'; who: string }[] = [
  {
    id: 'A', name: 'Option A · Announce-first, no recording',
    copy: '« Bonjour, vous êtes en ligne avec l\'assistant vocal de [Entreprise]. Cet appel n\'est pas enregistré. Comment puis-je vous aider ? »',
    gdprLoad: 'Minimal GDPR load. No audio retention. No retention limits to enforce. No erasure workflow.',
    badge: 'ok', who: '§3.3 — recommended for v1',
  },
  {
    id: 'B', name: 'Option B · Announce + opt-out',
    copy: '« … Cet appel est enregistré pour la qualité du service. Dites « arrêter l\'enregistrement » pour désactiver. »',
    gdprLoad: 'Medium load. Audio retention policy (max N days), erasure workflow, per-call retention-limit enforcement needed.',
    badge: 'tr', who: '⚙️ v2 — consent option B',
  },
  {
    id: 'C', name: 'Option C · Announce + opt-in',
    copy: '« … Voulez-vous accepter l\'enregistrement de cet appel pour la qualité du service ? Répondez « oui » pour continuer. »',
    gdprLoad: 'Highest load. Explicit opt-in per call. Break out of main STT stream for a consent-gate turn. Full audit trail of accept/reject.',
    badge: 'flag', who: '⚙️ Enterprise / regulated industries',
  },
];

export function ConfigPage() {
  const c = useConfigStore();
  const v = useVertical();
  const notify = useUiStore((s) => s.notify);
  const [testing, setTesting] = useState(false);
  const [testVoiceId, setTestVoiceId] = useState<string | null>(null);
  const [section, setSection] = useState<'vertical' | 'consent' | 'persona' | 'voice' | 'availability' | 'tier' | 'innovations'>('vertical');

  const tabs: { id: typeof section; label: string; icon: React.ReactNode }[] = [
    { id: 'vertical', label: 'Vertical', icon: <MapPin size={13} /> },
    { id: 'consent', label: 'Consent', icon: <Shield size={13} /> },
    { id: 'persona', label: 'Voice personas', icon: <Palette size={13} /> },
    { id: 'voice', label: 'Language + voice', icon: <Volume2 size={13} /> },
    { id: 'availability', label: 'Availability', icon: <Zap size={13} /> },
    { id: 'tier', label: 'Tier', icon: <Sparkles size={13} /> },
    { id: 'innovations', label: 'Guardrails & innovations', icon: <Eye size={13} /> },
  ];

  return (
    <Panel>
      <PanelHead
        title="Config"
        sub="changes are per-tenant · every save writes a new scope version"
        right={
          <span style={{ display: 'flex', gap: 4 }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setSection(t.id)} className="focus-ring"
                style={{
                  font: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 10px',
                  borderRadius: 'var(--radius)', border: 0,
                  background: section === t.id ? 'var(--accent-subtle)' : 'transparent',
                  color: section === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: section === t.id ? 600 : 400,
                  display: 'inline-flex', gap: 6, alignItems: 'center',
                }}>
                {t.icon}{t.label}
              </button>
            ))}
            <Pill tone="off" style={{ marginLeft: 8 }}>no prompt editor — by decision</Pill>
          </span>
        }
      />

      {/* ────── VERTICAL IN A BOX — §5 #1 ─────────────────────────────── */}
      {section === 'vertical' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <AiBanner
            title="§5 innovation #1 — Vertical-in-a-box templates"
            body="Pick a vertical, get the call flows, the knowledge structure, the booking rules, the escalation ladder and the killer outcome. Onboarding becomes config, not build. The scored matrix from §2 sorts by fit — garage is recommended."
            actions={<button className="focus-ring" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ai)', fontWeight: 600, fontSize: 12 }}>Open scoring matrix →</button>}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, margin: '8px 0 12px' }}>
            {VERTICAL_TEMPLATES.map((t) => {
              const active = c.verticalId === t.id;
              return (
                <button key={t.id} onClick={() => c.set('verticalId', t.id)}
                  className="focus-ring"
                  style={{
                    textAlign: 'start', font: 'inherit', cursor: 'pointer', padding: 14,
                    borderRadius: 'var(--radius-lg)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-primary)'}`,
                    background: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{active ? '● ' : '○ '}{t.name}</strong>
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
                    {t.callTypes.slice(0, 4).map((ct) => <span key={ct} style={{ padding: '2px 7px', background: 'var(--bg-tertiary)', borderRadius: 999 }}>{ct}</span>)}
                  </div>
                </button>
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
      )}

      {/* ────── CONSENT MODEL — §3.3 ─────────────────────────────────── */}
      {section === 'consent' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>§3.3 Consent model + disclosure</h2>
          <Note>
            <strong>Recommendation: Option A.</strong> Minimal GDPR exposure (no audio retention, no retention limits, no erasure workflow). Builds trust with callers who hate bots. Simple to explain to the client and to CNIL. §4 decision #4 is a <em>recommendation with escape hatch</em> — not a question. Transcripts (text) are still stored for analytics.
          </Note>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
            {CONSENT_OPTIONS.map((o) => {
              const on = c.consent === o.id;
              return (
                <label key={o.id} style={{
                  display: 'block', cursor: 'pointer', padding: 14,
                  borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border-primary)'}`,
                  background: on ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Radio name="consentopt" checked={on}
                      label={<strong style={{ color: 'var(--text-primary)' }}>{o.name}</strong>}
                      onChange={() => c.set('consent', o.id)} />
                    <Pill tone={o.badge}>{o.who}</Pill>
                    {o.id === 'A' && <Pill tone="ok">✓ v1 default</Pill>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--accent-hover)', fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', margin: '6px 0' }}>
                    {o.copy}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    📋 {o.gdprLoad}
                  </div>
                </label>
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
            <Button primary onClick={() => { setTesting(true); setTimeout(() => { setTesting(false); notify(`Consent Option ${c.consent} preview played — exact copy above · no audio stored`); }, 900); }}>
              <Play size={13} /> {testing ? 'Playing…' : `Test Option ${c.consent} greeting (6s)`}
            </Button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              plays the real voice · catches a broken voice id before save · §5 #7 auto-creates a consent receipt per call
            </span>
          </div>
        </div>
      )}

      {/* ────── VOICE PERSONA LIBRARY — §5 #15 ───────────────────────── */}
      {section === 'persona' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>§5 #15 · Voice persona library</h2>
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
                    <div key={p.id} style={{
                      padding: 12, borderRadius: 'var(--radius-lg)',
                      border: `1px solid ${active ? 'var(--ai)' : 'var(--border-primary)'}`,
                      background: active ? 'var(--ai-subtle)' : 'var(--bg-primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Radio name={`v${L}`} checked={active} label={<strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>}
                          onChange={() => c.set(L === 'FR' ? 'voiceFr' : 'voiceEn', p.id)} />
                        <Pill tone="off">{p.brand}</Pill>
                        {active && <Pill tone="ai">● active</Pill>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 6 }}>
                        🎭 {p.character}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontStyle: 'italic', marginBottom: 8 }}>
                        « {p.sample} »
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Button size="sm" onClick={() => {
                          setTestVoiceId(p.id);
                          setTimeout(() => { setTestVoiceId(null); notify(`Persona « ${p.name} » played · ${p.sample.length} chars · cache would be warmed on save`); }, 700);
                        }}>
                          <Play size={12} />{testVoiceId === p.id ? ' Playing…' : ' Play'}
                        </Button>
                        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                          speed {p.speed.toFixed(2)} · pitch {p.pitch}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ────── VOICE / LANGUAGE + DISCLOSURE ───────────────────────── */}
      {section === 'voice' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>Language pair & TTS</h2>
          <Labeled label="Voice locale (not UI locale)">
            <Pill tone="ok">FR ✓</Pill><Pill tone="ok">EN ✓</Pill>
            <Pill tone="off" title="Voice is FR/EN only. The UI ships 5 locales; that is separate.">AR — permanently off · JA/IT — UI only</Pill>
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
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>📥 1 024 cached phrases · cache invalidated on change (~90s)</span>
          </Labeled>
          <Labeled label="TTS voice (EN)">
            <Select ariaLabel="English TTS voice" value={c.voiceEn} onChange={(v) => c.set('voiceEn', v)}
              options={VOICE_PERSONAS.filter((p) => p.lang === 'EN').map((p) => ({ v: p.id, l: `${p.name} · ${p.brand}` }))} />
          </Labeled>
        </div>
      )}

      {/* ────── AVAILABILITY — §3.1 + §5 #12 callback promise ───────── */}
      {section === 'availability' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>Availability</h2>
          <Labeled label="Business hours">
            <input value={c.hours} onChange={(e) => c.set('hours', e.target.value)} aria-label="Business hours"
              style={{ font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', padding: '6px 10px', width: 200 }} />
            <Select ariaLabel="Time zone" value={c.tz} onChange={(v) => c.set('tz', v)} options={[{ v: 'Europe/Paris', l: 'Europe/Paris' }]} />
          </Labeled>
          <Labeled label="Transfer target (P4 Julie)" hint="required whenever the agent answers in-hours">
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{c.transferTarget}</span>
            <Pill tone="ok">required</Pill>
          </Labeled>
          <div style={{ padding: '12px 0' }}>
            <SectionTitle style={{ marginBottom: 8 }}>§5 #17 + #12 · After-hours behaviour</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {(
                [
                  { v: 'take_message', l: '💬 Take a message', d: 'Classic. Prompted caller for message + number. Sent to Patron WhatsApp within 5 min.' },
                  { v: 'callback_promise', l: '⏰ Promise a callback (§5 #12)', d: '« Quelqu\'un vous rappelle sous X heures ». Logs a ticket. More valuable than transfer to a closed line.' },
                  { v: 'transfer', l: '📞 Transfer', d: 'To the on-call number. Good for BTP emergencies; produces P1 alerts if the target rings out.' },
                  { v: 'announce_only', l: '🔊 Announce only', d: 'Hours + closed line. No message captured. Last-resort; hates this = angry callers.' },
                ] as { v: typeof c.afterHours; l: string; d: string }[]
              ).map(({ v, l, d }) => {
                const on = c.afterHours === v;
                return (
                  <label key={v} style={{ display: 'block', padding: 12, borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-primary)'}`,
                    background: on ? 'var(--accent-subtle)' : 'var(--bg-primary)' }}>
                    <Radio name="ah" checked={on} label={<strong style={{ fontSize: 13 }}>{l}</strong>}
                      onChange={() => c.set('afterHours', v)} />
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, paddingInlineStart: 26 }}>{d}</p>
                  </label>
                );
              })}
            </div>
            {c.afterHours === 'callback_promise' && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--warning-light)', border: '1px solid rgba(217,119,6,.25)' }}>
                <Labeled label="Callback within (hours)">
                  <input type="number" min={0.5} max={48} step={0.5} value={c.callbackHours}
                    onChange={(e) => c.set('callbackHours', Math.max(0.5, Math.min(48, parseFloat(e.target.value || '2'))))}
                    style={{ font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', background: 'var(--bg-primary)', padding: '6px 10px', width: 100 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Logged as a ticket · P4 Julie sees it on arrival · Patron gets WhatsApp note</span>
                </Labeled>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────── TIER ────────────────────────────────────────────────── */}
      {section === 'tier' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>Tier (decides where keys live)</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <TierCard title="Budget · self-hosted" price="—" state="unavailable — latency unmeasured, Gate 4" disabled />
            <TierCard title="Standard · cloud" price="€0.19/min" state="signed model" active={c.tier === 'standard'}
              onClick={() => c.set('tier', 'standard')} />
            <TierCard title="Premium · ElevenLabs" price="€0.28/min" state="best quality, higher cost" active={c.tier === 'premium'}
              onClick={() => c.set('tier', 'premium')} />
          </div>
          <DegradedBanner tone="warning" title="Budget tier unavailable"
            body="The self-hosted tier is disabled because its end-of-turn latency has not been measured yet. It is shown with the reason rather than hidden — a missing option becomes a support ticket." />
        </div>
      )}

      {/* ────── INNOVATIONS + GUARDRAIL TOGGLES ─────────────────────── */}
      {section === 'innovations' && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>§5 Innovations · behavioural toggles</h2>
          <Note>
            Each toggle maps directly to the 20-item ranked innovation list in the brainstorm. Turning one off here removes it from the call flow. Every toggle is per-tenant, not global.
          </Note>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>
            {(
              [
                { id: 'shadowMode' as const, k: '§5 #2', t: '👻 Shadow mode', d: 'Agent listens for 1 week without speaking. P1/Marc reviews transcripts, then goes live. Cheapest trust-builder in the plan.' },
                { id: 'emotionEscalation' as const, k: '§5 #11', t: '😠 Emotion-aware escalation', d: 'If caller sounds distressed or angry → escalate faster. 2 angry turns = skip the ladder. Reduces the worst calls.' },
                { id: 'spamFilter' as const, k: '§5 #16', t: '🛡 Spam / robocall filtering', d: 'French SMEs get flooded. Detect + reject by prefix pattern & spam score. Saves P1/Marc ~10min/day.' },
                { id: 'bilingualCodeSwitching' as const, k: '§5 #9', t: '🌐 Bilingual code-switching', d: 'European French uses occasional English loanwords. EN callers throw in « rendez-vous ». Cross-lingual retrieval + pinning.' },
                { id: 'accentAdaptive' as const, k: '§5 #10', t: '🗣 Accent-adaptive STT', d: 'Per-accent WER tracking: Parisian, Marseille, Alsatian, Breton, North African. Not just aggregate WER.' },
                // #3 WhatsApp summary & #7 consent receipt are ALWAYS on = not toggles
                // #1 local node, #8 pilot scorecard, #13 graceful degradation = infrastructure = not toggles
                // #18 multilingual overflow, #19 persona A/B, #20 provenance replay = ops toggles elsewhere
              ] as { id: keyof typeof c; k: string; t: string; d: string; }[]
            ).map(({ id, k, t, d }) => (
              <div key={id} style={{
                padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
              }}>
                <Checkbox checked={!!c[id] as boolean}
                  onChange={() => c.set(id, !Boolean(c[id]) as never)}
                  label={<><strong>{t}</strong> <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k}</span></>} />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, paddingInlineStart: 26 }}>{d}</p>
              </div>
            ))}
          </div>
          {c.shadowMode && (
            <DegradedBanner tone="warning" title="Shadow mode is ON"
              body="The agent is listening but producing NO audio output. Transcripts are captured for P1/Marc to review. Inbound callers hear the carrier voicemail. Go to the Scenarios surface to inspect call transcripts before flipping this back."
              action={<Button size="sm" onClick={() => notify('Shadow-mode call list opened → 2 calls captured today (c_09, c_10)')}>Review captured transcripts</Button>} />
          )}
        </div>
      )}

      <div style={{ padding: 16, background: 'var(--bg-tertiary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Lock size={14} color="var(--text-tertiary)" style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong>Behaviour is read-only here.</strong> Prompts, the tool set and the assistant's
          "never" list are <em>not</em> editable in the console — see <code>dev/AGENT-PROMPTS.md</code>.
          If you want different wording, that is a change request, not a setting.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)', position: 'sticky', bottom: 0 }}>
        {c.dirty && <span style={{ alignSelf: 'center', marginInlineEnd: 'auto', fontSize: 12, color: 'var(--warning)' }}>Unsaved changes — leaving now discards them (Esc)</span>}
        <Button onClick={() => { c.discard(); notify('Changes discarded'); }}>Discard</Button>
        <Button primary disabled={!c.dirty} onClick={() => { c.save(); notify('Saved · tier change applies to the next call, never a live one'); }}>
          Save changes
        </Button>
      </div>
    </Panel>
  );
}

const H2: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600 };

function TierCard({ title, price, state, active, disabled, onClick }: {
  title: string; price: string; state: string; active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="focus-ring"
      style={{
        textAlign: 'start', minWidth: 220, flex: '1 1 220px', cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-primary)'}`,
        background: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)', padding: 12, opacity: disabled ? 0.6 : 1, font: 'inherit',
      }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{active ? '● ' : '○ '}{title}</div>
      <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0', color: 'var(--text-primary)' }}>{price}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{state}</div>
    </button>
  );
}

/* ── Cost ─────────────────────────────────────────────────────────────────── */

export function CostPage() {
  const [group, setGroup] = useState<'call_type' | 'day'>('call_type');
  const ci = useCostSimStore((s) => s.input);
  const setCI = useCostSimStore((s) => s.set);
  const res = runCostSim(ci);
  const totalMin = COST_ROWS.reduce((a, r) => a + (r.minutes ?? 0), 0);
  const totalActual = COST_ROWS.reduce((a, r) => a + r.actualEur, 0);
  const totalModel = COST_ROWS.reduce((a, r) => a + r.modelEur, 0);
  const perMin = totalActual / totalMin;
  const modelPerMin = totalModel / totalMin;
  const delta = ((perMin - modelPerMin) / modelPerMin) * 100;
  const max = Math.max(...DAILY_MINUTES);
  const totalPct = ci.containedPct + ci.transferredPct + ci.voicemailPct + ci.whatsappTextPct;

  const autoBalance = (key: 'containedPct' | 'transferredPct' | 'voicemailPct' | 'whatsappTextPct', v: number) => {
    const others = ['containedPct', 'transferredPct', 'voicemailPct', 'whatsappTextPct'].filter((x) => x !== key) as ('containedPct' | 'transferredPct' | 'voicemailPct' | 'whatsappTextPct')[];
    setCI(key, v);
    const sumOther = others.reduce((a, k) => a + ci[k], 0);
    const want = 100 - v;
    const factor = sumOther === 0 ? 1 / others.length : want / sumOther;
    others.forEach((k) => setCI(k, Math.max(0, Math.min(100, Math.round(ci[k] * factor)))));
  };

  const columns: Column<CostRow>[] = [
    { key: 'l', header: 'Call type', render: (r) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span> },
    { key: 'c', header: 'Calls', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.calls}</span> },
    { key: 'm', header: 'Minutes', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.minutes ?? '—'}</span> },
    { key: 'a', header: 'Actual', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>€{r.actualEur.toFixed(2)}</span> },
    {
      key: 'v', header: 'vs model', align: 'end', render: (r) => {
        const d = r.modelEur === 0 ? 0 : ((r.actualEur - r.modelEur) / r.modelEur) * 100;
        return r.overModel
          ? <Pill tone="flag">⚑ +{d.toFixed(0)}%</Pill>
          : <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{d > 0 ? '+' : ''}{d.toFixed(0)}%</span>;
      },
    },
  ];

  return (
    <>
      {/* §5 #5 LIVE COST SIMULATOR */}
      <Panel>
        <PanelHead
          title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Calculator size={15} /> §5 #5 · Live cost simulator</span>}
          sub="the signed-model engine from client/COST-MODEL.md — this is what the sales screen shows"
          right={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {totalPct === 100 ? <Pill tone="ok">mix {totalPct}%</Pill> : <Pill tone="p1">mix sums to {totalPct}% — auto-balancing</Pill>}
            <Pill tone="ai">§4 Decision #3 live</Pill>
          </span>}
        />
        <AiBanner
          title="44% of prospects walk when the pricing page is vague"
          body="The simulator unblocks §4 blocking decision #3 (pricing model) by showing the three shapes side-by-side with the exact driver breakdown. 22 working days/month, carrier+TTS+STT+LLM+WhatsApp+infra = 100%."
        />
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Volume sliders */}
            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Volume</SectionTitle>
              <SliderRow label="Calls / day" min={5} max={150} step={5} value={ci.callsPerDay} onChange={(v) => setCI('callsPerDay', v)} unit="" />
              <SliderRow label="Avg duration" min={0.5} max={8} step={0.1} value={ci.avgDurationMin} onChange={(v) => setCI('avgDurationMin', v)} unit="min" />
            </div>
            {/* Pricing shape & tier */}
            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Pricing shape & tier</SectionTitle>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {([
                  { v: 'per_minute', l: 'Per-minute', desc: `€${ci.tier === 'standard' ? '0.19' : '0.28'}/min` },
                  { v: 'per_call', l: 'Per-call', desc: '€0.65 flat' },
                  { v: 'monthly_cap', l: 'Monthly cap', desc: '€750 + €0.14 over' },
                ] as { v: PricingShape; l: string; desc: string }[]).map(({ v, l, desc }) => (
                  <button key={v} onClick={() => setCI('shape', v)} className="focus-ring"
                    style={{
                      flex: '1 1 140px', font: 'inherit', cursor: 'pointer', padding: '10px 12px',
                      border: `1px solid ${ci.shape === v ? 'var(--accent)' : 'var(--border-primary)'}`,
                      background: ci.shape === v ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                      borderRadius: 'var(--radius)', color: 'var(--text-primary)', textAlign: 'start',
                    }}>
                    <div style={{ fontSize: 12.5, fontWeight: ci.shape === v ? 600 : 400 }}>{l}</div>
                    <div style={{ fontSize: 11, color: ci.shape === v ? 'var(--accent)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCI('tier', 'standard')} className="focus-ring"
                  style={{
                    flex: 1, font: 'inherit', cursor: 'pointer', padding: '8px 12px',
                    border: `1px solid ${ci.tier === 'standard' ? 'var(--success)' : 'var(--border-primary)'}`,
                    background: ci.tier === 'standard' ? 'var(--success-light)' : 'var(--bg-primary)',
                    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: ci.tier === 'standard' ? 600 : 400 }}>Standard</div>
                  <div style={{ fontSize: 11, color: ci.tier === 'standard' ? 'var(--success)' : 'var(--text-tertiary)' }}>€0.19/min · Deepgram + Gemini</div>
                </button>
                <button onClick={() => setCI('tier', 'premium')} className="focus-ring"
                  style={{
                    flex: 1, font: 'inherit', cursor: 'pointer', padding: '8px 12px',
                    border: `1px solid ${ci.tier === 'premium' ? 'var(--ai)' : 'var(--border-primary)'}`,
                    background: ci.tier === 'premium' ? 'var(--ai-subtle)' : 'var(--bg-primary)',
                    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: ci.tier === 'premium' ? 600 : 400 }}>Premium</div>
                  <div style={{ fontSize: 11, color: ci.tier === 'premium' ? 'var(--ai)' : 'var(--text-tertiary)' }}>€0.28/min · ElevenLabs best quality</div>
                </button>
              </div>
            </div>
            {/* Outcome mix */}
            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Outcome mix (must sum to 100%)</SectionTitle>
              <MixRow label="📦 Contained" pct={ci.containedPct} tone="ok" onChange={(v) => autoBalance('containedPct', v)} />
              <MixRow label="📞 Transferred" pct={ci.transferredPct} tone="tr" onChange={(v) => autoBalance('transferredPct', v)} />
              <MixRow label="🎙 Voicemail → WApp" pct={ci.voicemailPct} tone="vm" onChange={(v) => autoBalance('voicemailPct', v)} />
              <MixRow label="💬 WhatsApp text" pct={ci.whatsappTextPct} tone="ai" onChange={(v) => autoBalance('whatsappTextPct', v)} />
            </div>
          </div>

          {/* Results column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 12 }}>Monthly estimate (22 working days)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <ResultCard tone="ok" label="MIN" value={`€${res.monthlyMin.toLocaleString('fr-FR')}`} sub={`${(res.monthlyMin / (ci.callsPerDay * 22)).toFixed(2)}/call`} />
                <ResultCard tone="ai" label="MID" value={`€${res.monthlyMid.toLocaleString('fr-FR')}`} sub={`€${res.perMinMid}/min · €${res.perCallMid}/call`} highlight />
                <ResultCard tone="flag" label="MAX" value={`€${res.monthlyMax.toLocaleString('fr-FR')}`} sub={`${(res.monthlyMax / (ci.callsPerDay * 22)).toFixed(2)}/call`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Mini label="Total calls / month" value={`${(ci.callsPerDay * 22).toLocaleString('fr-FR')}`} />
                <Mini label="Total minutes / month" value={`${Math.round(ci.callsPerDay * 22 * ci.avgDurationMin).toLocaleString('fr-FR')}`} />
                <Mini label="Per-call cost" value={`€${res.perCallMid}`} />
                <Mini label="Per-minute cost" value={`€${res.perMinMid}`} />
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Cost driver breakdown</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {res.driverBreakdown.map((d) => (
                  <div key={d.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      <span>{d.label}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{d.eurPct}% · ~€{Math.round(res.monthlyMid * d.eurPct / 100)}</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        width: `${d.eurPct}%`, height: '100%',
                        background: d.label.startsWith('TTS') ? 'var(--ai)' :
                          d.label.startsWith('STT') ? 'var(--accent)' :
                          d.label.startsWith('LLM') ? 'var(--success)' :
                          d.label.startsWith('Carrier') ? 'var(--warning)' :
                          d.label.startsWith('WhatsApp') ? '#25D366' : 'var(--text-tertiary)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-secondary)' }}>
                Driver shares are stable across volume; the shape change moves the total €, not the %.
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Historical cost table — same as before, below the simulator */}
      <Panel>
        <PanelHead title="Historical cost" right={<Pill tone="flag">all figures UNVERIFIED</Pill>} />
        <Note>
          <strong>Vendor rates are not yet confirmed.</strong> These are the signed-model figures from
          <code> client/COST-MODEL.md</code>, whose §6 checklist is still open. Do not quote this screen to anyone.
        </Note>
        <div style={{ padding: 16, display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><div style={H2}>Volume</div><div style={BIG}>{totalMin.toFixed(0)} min · 128 calls</div></div>
          <div><div style={H2}>Signed model</div><div style={BIG}>€{modelPerMin.toFixed(2)}/min</div></div>
          <div>
            <div style={H2}>Actual</div>
            <div style={{ ...BIG, color: 'var(--warning)' }}>€{perMin.toFixed(2)}/min</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>⚠ {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% · within the ±20% band</div>
          </div>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          <div role="img" aria-label="Sparkline: daily minutes over 24 days" style={{ fontSize: 30, letterSpacing: 2, color: 'var(--accent)' }}>
            {DAILY_MINUTES.map((m) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor((m / max) * 8))]).join('')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>minutes per day, 24 days · group the table by day for exact figures</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-primary)' }}>
          <strong style={{ fontSize: 13 }}>By {group.replace('_', ' ')}</strong>
          <Button size="sm" onClick={() => setGroup(group === 'call_type' ? 'day' : 'call_type')} primary={group === 'call_type'}>call type</Button>
          <Button size="sm" onClick={() => setGroup(group === 'day' ? 'call_type' : 'day')} primary={group === 'day'}>day</Button>
          <span style={{ flex: 1 }} />
          <Pill tone="flag">⚑ 4 over model</Pill>
        </div>
        <DataTable rows={COST_ROWS} columns={columns} rowKey={(r) => r.key} />
        <div style={{ padding: 16 }}>
          <Note>
            ⓘ <strong>Why WhatsApp text is €0.00.</strong> Those are user-initiated service
            conversations inside the 24-hour window, which Meta does not charge for. It is a policy
            consequence, not missing data — inbound-only v1 means Meta cost ≈ 0.
          </Note>
          <AiBanner
            title="4 of the over-model calls are after-hours"
            body="At the current tier that is expected: off-hours minutes are billed at the lower rate, so a higher per-minute figure there is not a regression. Re-check at 3,000 min/month, where the tier changes."
          />
        </div>
      </Panel>
    </>
  );
}

/* ── helpers for CostPage simulator */

function SliderRow({ label, min, max, step, value, onChange, unit }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; unit: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
          {Number.isInteger(step) ? value : value.toFixed(1)}{unit && ` ${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
        <span>{Number.isInteger(step) ? min : min.toFixed(1)}{unit && ` ${unit}`}</span>
        <span>{Number.isInteger(step) ? max : max.toFixed(1)}{unit && ` ${unit}`}</span>
      </div>
    </div>
  );
}

function MixRow({ label, pct, tone, onChange }: {
  label: string; pct: number; tone: 'ok' | 'tr' | 'vm' | 'ai'; onChange: (v: number) => void;
}) {
  const pctColor = tone === 'ok' ? 'var(--success)' : tone === 'tr' ? 'var(--warning)' : tone === 'vm' ? 'var(--accent)' : 'var(--ai)';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
          <Pill tone={tone} style={{ fontSize: 10.5 }}>{label.split(' ')[0]}</Pill>
          <span style={{ color: 'var(--text-secondary)' }}>{label.split(' ').slice(1).join(' ')}</span>
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: pctColor }}>{pct}%</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={pct}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ width: '100%', accentColor: pctColor }} />
    </div>
  );
}

function ResultCard({ label, value, sub, tone, highlight }: { label: string; value: string; sub: string; tone: 'ok' | 'ai' | 'flag'; highlight?: boolean }) {
  const bg = tone === 'ok' ? 'var(--success-light)' : tone === 'ai' ? 'var(--ai-subtle)' : 'var(--warning-light)';
  const bd = tone === 'ok' ? 'rgba(5,150,105,.3)' : tone === 'ai' ? 'rgba(147,51,234,.3)' : 'rgba(217,119,6,.3)';
  const clr = tone === 'ok' ? 'var(--success)' : tone === 'ai' ? 'var(--ai)' : 'var(--warning)';
  return (
    <div style={{
      padding: 12, borderRadius: 'var(--radius-lg)',
      background: highlight ? bg : 'var(--bg-primary)',
      border: `1px solid ${highlight ? bd : 'var(--border-primary)'}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: clr, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 'var(--radius)',
      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const BIG: React.CSSProperties = { fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

/* ── Topology ─────────────────────────────────────────────────────────────── */

export function TopologyPage() {
  const reachable = useReachable();
  const setReachable = useOpsStore((s) => s.setReachable);

  return (
    <>
      <Panel>
        <PanelHead title="Topology & capabilities"
          sub="where each job runs, and what this device can do"
          right={<Pill tone={reachable ? 'ok' : 'p1'}>{reachable ? 'agent-core reachable' : 'agent-core OFFLINE'}</Pill>} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, alignItems: 'stretch' }}>
          <Node title="This desktop" tag="Tauri v2 · React 19 · SMEMaster" rows={[
            { ok: true, t: 'Console — digest, call log, live, config, cost' },
            { ok: true, t: 'Local RAG — candle + LanceDB, offline (384-d)' },
            { ok: true, t: 'Provider keys — self-hosted tier only', key: true },
            { ok: false, t: 'ml-sidecar — local tier, disabled (RTF unmeasured)' },
            { ok: false, t: 'Answering calls if powered off' },
          ]} />
          <div style={{ alignSelf: 'center', color: 'var(--text-tertiary)', fontSize: 20, flex: '0 0 auto', padding: '0 4px' }} aria-hidden>⇄</div>
          <Node title="agent-core (EU VPS)" tag="Python · FastAPI · wss://…" rows={[
            { ok: true, t: 'Carrier media stream — inbound FR DID' },
            { ok: true, t: 'Turn loop — LLM · TTS · STT (cloud tier)' },
            { ok: true, t: 'WhatsApp — official BSP (prod) / Baileys (dev)' },
            { ok: true, t: 'Metering · ops snapshot · alerts' },
            { ok: true, t: 'Answers calls when the office is shut' },
            { ok: true, warn: true, t: 'Compromise exposes transcripts, not vendor accounts' },
          ]} />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
          <h2 style={H2}>Tier — decides where the keys live</h2>
          <DataTable
            rows={[
              { id: 'a', tier: 'Standard (cloud)', runs: 'agent-core, cloud vendors', keys: 'the VPS', state: '● active' },
              { id: 'b', tier: 'Self-hosted (local)', runs: 'this desktop, offline', keys: 'this desktop', state: '⛠ disabled — RTF unmeasured' },
              { id: 'c', tier: 'Premium', runs: 'agent-core, ElevenLabs', keys: 'the VPS', state: '○ available' },
            ]}
            rowKey={(r) => r.id}
            columns={[
              { key: 't', header: 'Tier', render: (r: { tier: string }) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.tier}</span> },
              { key: 'r', header: 'Speech runs', render: (r: { runs: string }) => r.runs },
              { key: 'k', header: 'Keys live on', render: (r: { keys: string }) => <strong>{r.keys}</strong> },
              { key: 's', header: 'State', render: (r: { state: string }) => r.state.includes('active') ? <Pill tone="ok">{r.state}</Pill> : <Pill tone="flag">{r.state}</Pill> },
            ]}
          />
          <Note>
            ⚠️ <strong>Only one tier is local at a time.</strong> Whichever provider the agent calls
            must have a key on the machine running it. Selecting a cloud tier moves the keys to the
            VPS; selecting self-hosted keeps them here. The console never implies both are local.
            <div style={{ marginTop: 8 }}>
              <Button size="sm" onClick={() => setReachable(!reachable)}>
                Simulate agent-core {reachable ? 'offline' : 'reachable'}
              </Button>
            </div>
          </Note>
        </div>

        <AiBanner
          title="Capability gaps this device cannot close"
          body="Inferred from a capability probe, not a config file: no local speech models installed, no GPU execution provider, and no microphone capture permission. It can run the console; it cannot run the local tier today."
        />
      </Panel>

      {!reachable && (
        <DegradedBanner
          title="We cannot reach the agent — last seen 14:51"
          body="The desktop and its local features keep working: the console renders, the local RAG searches, settings are still editable locally. What is not working is anything that needs the agent — including answering calls. If the agent is down, inbound calls go to the carrier's failover, not to voicemail."
          action={<span style={{ display: 'flex', gap: 8 }}><Button primary size="sm" onClick={() => setReachable(true)}>Retry connection</Button><Pill tone="p1">P1 — calls are unanswered</Pill></span>}
        />
      )}
    </>
  );
}

function Node({ title, tag, rows }: {
  title: string; tag: string;
  rows: { ok: boolean; warn?: boolean; t: string; key?: boolean }[];
}) {
  return (
    <div style={{
      flex: '1 1 320px', minWidth: 'min(100%,320px)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', padding: 12,
    }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{title}</h3>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tag}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={r.t.slice(0, 24) + i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: r.warn ? 'var(--warning)' : 'var(--text-secondary)' }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999, flex: 'none',
              background: r.key ? 'var(--ai)' : r.warn ? 'var(--warning)' : r.ok ? 'var(--success)' : 'var(--text-tertiary)',
            }} />
            <span>{r.t}{r.key && <strong> · keys here</strong>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
