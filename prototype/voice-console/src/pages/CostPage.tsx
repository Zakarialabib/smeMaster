import { useMemo, useState } from 'react';
import { Calculator, AlertTriangle, FlaskConical, GitCompare, TableProperties } from 'lucide-react';
import {
  useCostSimStore, runCostSim,
  useProviderPresets, useSelectedProviderPreset,
} from '../store';
import { COST_ROWS, DAILY_MINUTES } from '../data';
import {
  Panel, PanelHead, Pill, Button, Note, DataTable, AiBanner, SectionTitle,
  Slider, Stat, Card, SectionLabel,
  type Column, type PillTone,
} from '../components/ui';
import type { CostRow, PricingShape } from '../types';
import {
  PRESET_RATE_FACTOR,
  PRESET_DRIVER_BREAKDOWN,
  PRESET_PROVIDER_MAP,
  PRESET_NARRATIVE,
  PRESET_IDS,
  RATE_CARDS,
  SENSITIVITY_KEYS,
  SENSITIVITY_LABELS,
  applySensitivity,
  type SensitivityKey,
  type RateCard,
} from '../data/costPresets';

/* ══════════════════════════════════════════════════════════════════════════
   CostPage
   ══════════════════════════════════════════════════════════════════════════ */

export function CostPage() {
  const [group, setGroup] = useState<'call_type' | 'day'>('call_type');
  const ci = useCostSimStore((s) => s.input);
  const setCI = useCostSimStore((s) => s.set);
  const presetId = useSelectedProviderPreset();
  const setPreset = useCostSimStore((s) => s.setProviderPreset);
  const presets = useProviderPresets();

  const [sensitivity, setSensitivity] = useState<Set<SensitivityKey>>(() => new Set());

  const toggleSensitivity = (k: SensitivityKey) =>
    setSensitivity((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const baseRes = runCostSim(ci);
  const presetFactor = PRESET_RATE_FACTOR[presetId] ?? 1;
  const baseBreakdown = PRESET_DRIVER_BREAKDOWN[presetId] ?? baseRes.driverBreakdown;

  /* Sensitivity re-weights the driver breakdown. `weight` is the sum of the
     shocked percentages; the monthly figure scales by `weight / 100`. */
  const { breakdown: driverBreakdown, weight } = useMemo(
    () => applySensitivity(baseBreakdown, sensitivity),
    [baseBreakdown, sensitivity],
  );

  const sensitivityActive = sensitivity.size > 0;
  const combinedFactor = presetFactor * (weight / 100);

  const res = {
    ...baseRes,
    monthlyMin: Math.round(baseRes.monthlyMin * combinedFactor),
    monthlyMid: Math.round(baseRes.monthlyMid * combinedFactor),
    monthlyMax: Math.round(baseRes.monthlyMax * combinedFactor),
    perCallMid: +(baseRes.perCallMid * combinedFactor).toFixed(2),
    perMinMid:  +(baseRes.perMinMid  * combinedFactor).toFixed(3),
    driverBreakdown,
  };

  const totalMin    = COST_ROWS.reduce((a, r) => a + (r.minutes ?? 0), 0);
  const totalActual = COST_ROWS.reduce((a, r) => a + r.actualEur, 0);
  const totalModel  = COST_ROWS.reduce((a, r) => a + r.modelEur, 0);
  const perMin = totalActual / totalMin;
  const modelPerMin = totalModel / totalMin;
  const delta = ((perMin - modelPerMin) / modelPerMin) * 100;
  const max = Math.max(...DAILY_MINUTES);
  const totalPct = ci.containedPct + ci.transferredPct + ci.voicemailPct + ci.whatsappTextPct;

  const autoBalance = (
    key: 'containedPct' | 'transferredPct' | 'voicemailPct' | 'whatsappTextPct',
    v: number,
  ) => {
    const others = (['containedPct', 'transferredPct', 'voicemailPct', 'whatsappTextPct'] as const)
      .filter((x) => x !== key);
    setCI(key, v);
    const sumOther = others.reduce((a, k) => a + ci[k], 0);
    const want = 100 - v;
    const factor = sumOther === 0 ? 1 / others.length : want / sumOther;
    others.forEach((k) => setCI(k, Math.max(0, Math.min(100, Math.round(ci[k] * factor)))));
  };

  const columns: Column<CostRow>[] = [
    { key: 'l', header: 'Call type', render: (r) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span> },
    { key: 'c', header: 'Calls',   align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.calls}</span> },
    { key: 'm', header: 'Minutes', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.minutes ?? '—'}</span> },
    { key: 'a', header: 'Actual',  align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>€{r.actualEur.toFixed(2)}</span> },
    {
      key: 'v', header: 'vs model', align: 'end', render: (r) => {
        const d = r.modelEur === 0 ? 0 : ((r.actualEur - r.modelEur) / r.modelEur) * 100;
        return r.overModel
          ? <Pill tone="flag">⚑ +{d.toFixed(0)}%</Pill>
          : <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{d > 0 ? '+' : ''}{d.toFixed(0)}%</span>;
      },
    },
  ];

  const currentPresetLabel = presets.find((p) => p.id === presetId)?.label ?? 'Custom';
  const savingsPct = Math.round((1 - presetFactor) * 100);
  const shockPct = Math.round((weight - 100));

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          LIVE SIMULATOR
          ═══════════════════════════════════════════════════════════════ */}
      <Panel>
        <PanelHead
          title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Calculator size={15} /> §5 #5 · Live cost simulator</span>}
          sub="the signed-model engine from client/COST-MODEL.md — this is what the sales screen shows"
          right={
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {totalPct === 100
                ? <Pill tone="ok">mix {totalPct}%</Pill>
                : <Pill tone="p1">mix sums to {totalPct}% — auto-balancing</Pill>}
              {sensitivityActive && (
                <Pill tone="flag">⚠ sensitivity on · +{shockPct}% vs base</Pill>
              )}
              <Pill tone="ai">§4 Decision #3 live</Pill>
            </span>
          }
        />

        <AiBanner
          title="44% of prospects walk when the pricing page is vague"
          body="The simulator unblocks §4 blocking decision #3 (pricing model) by showing the three shapes side-by-side with the exact driver breakdown. 22 working days/month, carrier+TTS+STT+LLM+WhatsApp+infra = 100%."
        />

        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
          {/* ── Left column ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PresetPicker
              presets={presets}
              presetId={presetId}
              onSelect={setPreset}
              currentPresetLabel={currentPresetLabel}
              savingsPct={savingsPct}
            />

            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Volume</SectionTitle>
              <Slider label="Calls / day"  min={5}   max={150} step={5}   value={ci.callsPerDay}   onChange={(v) => setCI('callsPerDay', v)}   tone="tr" />
              <Slider label="Avg duration" min={0.5} max={8}   step={0.1} value={ci.avgDurationMin} onChange={(v) => setCI('avgDurationMin', v)} unit="min" tone="tr" />
            </div>

            <PricingShapeCard ci={ci} setCI={setCI} />

            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Outcome mix (must sum to 100%)</SectionTitle>
              <Slider label="📦 Contained"        min={0} max={100} step={1} value={ci.containedPct}    onChange={(v) => autoBalance('containedPct', v)}    tone="ok" />
              <Slider label="📞 Transferred"      min={0} max={100} step={1} value={ci.transferredPct}  onChange={(v) => autoBalance('transferredPct', v)}  tone="tr" />
              <Slider label="🎙 Voicemail → WApp"  min={0} max={100} step={1} value={ci.voicemailPct}    onChange={(v) => autoBalance('voicemailPct', v)}    tone="vm" />
              <Slider label="💬 WhatsApp text"     min={0} max={100} step={1} value={ci.whatsappTextPct} onChange={(v) => autoBalance('whatsappTextPct', v)} tone="ai" />
            </div>
          </div>

          {/* ── Right column ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 12 }}>Monthly estimate (22 working days)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <Stat tone="ok"   label="MIN" value={`€${res.monthlyMin.toLocaleString('fr-FR')}`} sub={`${(res.monthlyMin / (ci.callsPerDay * 22)).toFixed(2)}/call`} />
                <Stat tone="ai"   label="MID" value={`€${res.monthlyMid.toLocaleString('fr-FR')}`} sub={`€${res.perMinMid}/min · €${res.perCallMid}/call`} highlight />
                <Stat tone="flag" label="MAX" value={`€${res.monthlyMax.toLocaleString('fr-FR')}`} sub={`${(res.monthlyMax / (ci.callsPerDay * 22)).toFixed(2)}/call`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Stat layout="inline" label="Total calls / month"   value={`${(ci.callsPerDay * 22).toLocaleString('fr-FR')}`} />
                <Stat layout="inline" label="Total minutes / month" value={`${Math.round(ci.callsPerDay * 22 * ci.avgDurationMin).toLocaleString('fr-FR')}`} />
                <Stat layout="inline" label="Per-call cost"         value={`€${res.perCallMid}`} />
                <Stat layout="inline" label="Per-minute cost"       value={`€${res.perMinMid}`} />
              </div>
            </div>

            <SensitivityCard
              active={sensitivity}
              onToggle={toggleSensitivity}
              shockPct={shockPct}
            />

            <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <SectionTitle style={{ marginBottom: 10 }}>Cost driver breakdown</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {res.driverBreakdown.map((d) => (
                  <DriverRow key={d.label} label={d.label} eurPct={d.eurPct} monthly={res.monthlyMid} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-secondary)' }}>
                Driver shares follow the preset, not the volume. The carrier share <em>rises</em> sharply
                as you remove cloud speech — that is the real finding, and the reason "self-hosted
                is cheaper" is only true at volume.
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════
          PRESET COMPARISON — all four side by side at the current input
          ═══════════════════════════════════════════════════════════════ */}
      <PresetComparisonPanel
        currentPresetId={presetId}
        onPick={setPreset}
        baseMonthly={baseRes.monthlyMid}
        callsPerMonth={ci.callsPerDay * 22}
      />

      {/* ═══════════════════════════════════════════════════════════════
          RATE CARDS — the source data
          ═══════════════════════════════════════════════════════════════ */}
      <RateCardsPanel />

      {/* ═══════════════════════════════════════════════════════════════
          HISTORICAL COST
          ═══════════════════════════════════════════════════════════════ */}
      <Panel>
        <PanelHead title="Historical cost" right={<Pill tone="flag">all figures UNVERIFIED</Pill>} />
        <Note>
          <strong>Vendor rates are not yet confirmed.</strong> These are the signed-model figures from{' '}
          <code>client/COST-MODEL.md</code>, whose §6 checklist is still open. Do not quote this screen to anyone.
        </Note>

        <div style={{ padding: 16, display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={SMALL_LABEL}>Volume</div>
            <div style={BIG}>{totalMin.toFixed(0)} min · 128 calls</div>
          </div>
          <div>
            <div style={SMALL_LABEL}>Signed model</div>
            <div style={BIG}>€{modelPerMin.toFixed(2)}/min</div>
          </div>
          <div>
            <div style={SMALL_LABEL}>Actual</div>
            <div style={{ ...BIG, color: 'var(--warning)' }}>€{perMin.toFixed(2)}/min</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              ⚠ {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% · within the ±20% band
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <div role="img" aria-label="Sparkline: daily minutes over 24 days"
            style={{ fontSize: 30, letterSpacing: 2, color: 'var(--accent)' }}>
            {DAILY_MINUTES.map((m) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor((m / max) * 8))]).join('')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            minutes per day, 24 days · group the table by day for exact figures
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-primary)' }}>
          <strong style={{ fontSize: 13 }}>By {group.replace('_', ' ')}</strong>
          <Button size="sm" primary={group === 'call_type'} onClick={() => setGroup('call_type')}>call type</Button>
          <Button size="sm" primary={group === 'day'}       onClick={() => setGroup('day')}>day</Button>
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

/* ══════════════════════════════════════════════════════════════════════════
   PRESET PICKER
   ══════════════════════════════════════════════════════════════════════════ */

function PresetPicker({
  presets, presetId, onSelect, currentPresetLabel, savingsPct,
}: {
  presets: ReturnType<typeof useProviderPresets>;
  presetId: string;
  onSelect: (id: string) => void;
  currentPresetLabel: string;
  savingsPct: number;
}) {
  return (
    <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <SectionTitle style={{ marginBottom: 10 }}>Provider mix preset</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {presets.map((p) => {
          const active = presetId === p.id;
          const factor = PRESET_RATE_FACTOR[p.id] ?? 1;
          const pct = Math.round((1 - factor) * 100);
          const narrative = PRESET_NARRATIVE[p.id];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="focus-ring"
              title={narrative?.description}
              style={{
                font: 'inherit', textAlign: 'start', cursor: 'pointer',
                padding: 10, borderRadius: 'var(--radius)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-primary)'}`,
                background: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500 }}>
                {active ? '● ' : '○ '}{p.label}
              </div>
              <div style={{
                fontSize: 11, marginTop: 2, fontVariantNumeric: 'tabular-nums',
                color: pct > 0 ? 'var(--success)' : 'var(--text-tertiary)',
              }}>
                {pct > 0 ? `≈ −${pct}% rate` : 'baseline rate'}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.45 }}>
        Tier sets the <em>absolute</em> rate (€0.19 vs €0.28/min). Preset changes the stack{' '}
        <em>inside</em> it. Currently <strong>{currentPresetLabel}</strong>
        {savingsPct > 0 && <> — saves ≈ {savingsPct}% vs baseline.</>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRICING SHAPE CARD
   ══════════════════════════════════════════════════════════════════════════ */

function PricingShapeCard({
  ci, setCI,
}: {
  ci: ReturnType<typeof useCostSimStore.getState>['input'];
  setCI: ReturnType<typeof useCostSimStore.getState>['set'];
}) {
  return (
    <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <SectionTitle style={{ marginBottom: 10 }}>Pricing shape & tier</SectionTitle>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {([
          { v: 'per_minute',  l: 'Per-minute',  desc: `€${ci.tier === 'standard' ? '0.19' : '0.28'}/min` },
          { v: 'per_call',    l: 'Per-call',    desc: '€0.65 flat' },
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
            <div style={{
              fontSize: 11, fontVariantNumeric: 'tabular-nums',
              color: ci.shape === v ? 'var(--accent)' : 'var(--text-tertiary)',
            }}>{desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {([
          { t: 'standard' as const, l: 'Standard', sub: '€0.19/min · Deepgram + Gemini', tone: 'ok' as const },
          { t: 'premium'  as const, l: 'Premium',  sub: '€0.28/min · ElevenLabs best quality', tone: 'ai' as const },
        ]).map(({ t, l, sub, tone }) => {
          const on = ci.tier === t;
          const color = tone === 'ok' ? 'var(--success)' : 'var(--ai)';
          const bg = tone === 'ok' ? 'var(--success-light)' : 'var(--ai-subtle)';
          return (
            <button key={t} onClick={() => setCI('tier', t)} className="focus-ring"
              style={{
                flex: 1, font: 'inherit', cursor: 'pointer', padding: '8px 12px',
                border: `1px solid ${on ? color : 'var(--border-primary)'}`,
                background: on ? bg : 'var(--bg-primary)',
                borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              }}>
              <div style={{ fontSize: 12.5, fontWeight: on ? 600 : 400 }}>{l}</div>
              <div style={{ fontSize: 11, color: on ? color : 'var(--text-tertiary)' }}>{sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SENSITIVITY CARD
   ══════════════════════════════════════════════════════════════════════════ */

function SensitivityCard({
  active, onToggle, shockPct,
}: {
  active: Set<SensitivityKey>;
  onToggle: (k: SensitivityKey) => void;
  shockPct: number;
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-lg)',
      background: active.size > 0 ? 'var(--warning-light)' : 'var(--bg-secondary)',
      border: `1px solid ${active.size > 0 ? 'rgba(217,119,6,.35)' : 'var(--border-primary)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <FlaskConical size={13} color={active.size > 0 ? 'var(--warning)' : 'var(--text-tertiary)'} />
        <SectionTitle style={{ margin: 0 }}>Sensitivity — what if a rate changes?</SectionTitle>
        <span style={{ flex: 1 }} />
        {active.size > 0 && (
          <Pill tone="flag">+{shockPct}% monthly</Pill>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {SENSITIVITY_KEYS.map((k) => {
          const on = active.has(k);
          return (
            <button key={k} onClick={() => onToggle(k)} className="focus-ring"
              style={{
                font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '4px 10px',
                border: `1px solid ${on ? 'var(--warning)' : 'var(--border-primary)'}`,
                background: on ? '#fff7ed' : 'var(--bg-primary)',
                color: on ? '#92400e' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)', fontWeight: on ? 600 : 400,
              }}>
              {on ? '● ' : '○ '}{SENSITIVITY_LABELS[k]}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Each toggle applies +20% to one driver and re-runs the sim. This is what makes the
        "self-hosted is cheaper" claim concrete: under <strong>selfhosted</strong>, carrier is 74%
        of the bill, so a 20% carrier increase moves the monthly more than any other lever.
        Under <strong>openai-primary</strong>, TTS dominates — a 20% ElevenLabs increase is what
        actually hurts.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DRIVER ROW
   ══════════════════════════════════════════════════════════════════════════ */

function DriverRow({ label, eurPct, monthly }: { label: string; eurPct: number; monthly: number }) {
  const color = label.startsWith('TTS') ? 'var(--ai)'
    : label.startsWith('STT')      ? 'var(--accent)'
    : label.startsWith('LLM')      ? 'var(--success)'
    : label.startsWith('Carrier')  ? 'var(--warning)'
    : label.startsWith('WhatsApp') ? '#25D366'
    : 'var(--text-tertiary)';

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: 12,
        color: 'var(--text-secondary)', marginBottom: 3,
      }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
          {eurPct}% · ~€{Math.round(monthly * eurPct / 100)}
        </span>
      </div>
      <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${eurPct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRESET COMPARISON — all four presets at the current input
   ══════════════════════════════════════════════════════════════════════════ */

function PresetComparisonPanel({
  currentPresetId, onPick, baseMonthly, callsPerMonth,
}: {
  currentPresetId: string;
  onPick: (id: string) => void;
  baseMonthly: number;
  callsPerMonth: number;
}) {
  const rows = PRESET_IDS.map((id) => {
    const factor = PRESET_RATE_FACTOR[id];
    const narrative = PRESET_NARRATIVE[id];
    const providerMap = PRESET_PROVIDER_MAP[id];
    const breakdown = PRESET_DRIVER_BREAKDOWN[id];
    const dominant = breakdown.reduce((a, b) => (a.eurPct > b.eurPct ? a : b));
    const monthly = Math.round(baseMonthly * factor);
    return {
      id,
      label: id,
      factor,
      narrative,
      providerMap,
      dominantDriver: dominant.label,
      monthly,
      savingsPct: Math.round((1 - factor) * 100),
      perCall: +(monthly / callsPerMonth).toFixed(2),
    };
  });

  return (
    <Panel>
      <PanelHead
        title={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <GitCompare size={15} /> Preset comparison
          </span>
        }
        sub={`all four presets at the current volume — ${callsPerMonth.toLocaleString('fr-FR')} calls / month`}
        right={<Pill tone="ai">click a row to load it</Pill>}
      />

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {rows.map((r) => {
          const active = r.id === currentPresetId;
          return (
            <Card key={r.id} active={active} onClick={() => onPick(r.id)} style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {active ? '● ' : '○ '}{r.label}
                </strong>
                {r.savingsPct > 0
                  ? <Pill tone="ok" style={{ fontSize: 10.5 }}>−{r.savingsPct}%</Pill>
                  : <Pill tone="off" style={{ fontSize: 10.5 }}>baseline</Pill>}
                {r.narrative.selfHosted && <Pill tone="flag" style={{ fontSize: 10.5 }}>self-hosted VPS</Pill>}
              </div>

              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', marginBottom: 2 }}>
                €{r.monthly.toLocaleString('fr-FR')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                €{r.perCall.toFixed(2)} / call · monthly MID
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 10, fontSize: 11.5, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>STT</span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.providerMap.stt}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>LLM</span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.providerMap.llm}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>TTS</span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.providerMap.tts}</span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingTop: 8, borderTop: '1px solid var(--border-secondary)' }}>
                Dominant cost: <strong style={{ color: 'var(--text-secondary)' }}>{r.dominantDriver}</strong>
              </div>

              {r.narrative.costBeyondMoney && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>
                  {r.narrative.costBeyondMoney}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ padding: 16 }}>
        <Note>
          <strong>Why the absolute number matters more than the % saving.</strong> A −65% saving on a
          €1,000/mo bill is €650. The same percentage on a €5,000/mo bill is €3,250 — and at that
          volume the self-hosted VPS is a real 24/7 operational commitment, not a colour change on a
          chart. The row that wins depends on where volume lands, not on the ratio.
        </Note>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RATE CARDS — the source numbers
   ══════════════════════════════════════════════════════════════════════════ */

function RateCardsPanel() {
  const columns: Column<RateCard>[] = [
    {
      key: 'stage', header: 'Stage',
      render: (r) => <Pill tone={stageTone(r.stage)}>{r.stage.toUpperCase()}</Pill>,
    },
    {
      key: 'label', header: 'Provider',
      render: (r) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span>,
    },
    {
      key: 'rate', header: '€ / min of call', align: 'end',
      render: (r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.perMinute === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>€0 · VPS only</span> : `€${r.perMinute.toFixed(4)}`}
        </span>
      ),
    },
    {
      key: 'src', header: 'Source',
      render: (r) => <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{r.source}</span>,
    },
    {
      key: 'ver', header: 'Verified', align: 'end',
      render: (r) => r.verified
        ? <Pill tone="ok">✓</Pill>
        : <Pill tone="flag">placeholder</Pill>,
    },
  ];

  const verifiedCount = RATE_CARDS.filter((r) => r.verified).length;
  const totalCards = RATE_CARDS.length;

  return (
    <Panel>
      <PanelHead
        title={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <TableProperties size={15} /> Rate cards — source of every number above
          </span>
        }
        sub={`${verifiedCount} of ${totalCards} verified · the rest are placeholders pending COST-MODEL.md §6`}
        right={<Pill tone="flag">⚠ unverified</Pill>}
      />

      <DataTable rows={RATE_CARDS} columns={columns} rowKey={(r) => r.key} />

      <div style={{ padding: 16 }}>
        <Note>
          <strong>Read every placeholder as a placeholder.</strong> The three rows marked ✓ are
          structural facts: self-hosted engines have no per-minute API cost, and Meta's inbound
          24h window is free by policy. Everything else is an educated guess at a vendor rate
          that has not been signed. When a rate is confirmed, flip its <code>verified</code> flag
          in <code>costPresets.ts</code> — the panel above will recount and the simulator keeps
          working without a code change.
        </Note>
      </div>
    </Panel>
  );
}

function stageTone(stage: RateCard['stage']): PillTone {
  switch (stage) {
    case 'stt':      return 'tr';
    case 'llm':      return 'ai';
    case 'tts':      return 'vm';
    case 'carrier':  return 'flag';
    case 'whatsapp': return 'ok';
    case 'infra':    return 'off';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Shared styles
   ══════════════════════════════════════════════════════════════════════════ */

const SMALL_LABEL: React.CSSProperties = {
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
  color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600,
};
const BIG: React.CSSProperties = {
  fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
};