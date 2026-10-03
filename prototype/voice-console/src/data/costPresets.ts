import type { ProviderMixPreset } from '../types';

/**
 * Cost presets — every rate constant the prototype uses to model money.
 *
 * WHAT THIS FILE IS
 * -----------------
 * A single home for the numbers that decide what the Cost simulator shows.
 * The CostPage and the ConfigPage's AI-routing tab both read from here, so
 * adding a preset or changing a rate is one edit, not two.
 *
 * WHAT THIS FILE IS NOT
 * ---------------------
 * The numbers below are PROTOTYPE PLACEHOLDERS, not vendor quotes. They are
 * calibrated so the sim moves in the right direction under each preset; the
 * absolute € values are unfounded until COST-MODEL.md §6 lands. Each entry
 * carries a `source` string so it is impossible to read a number without
 * also reading where it came from.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Rate factors per preset
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Multiplier on the baseline monthly figure. 1.00 = OpenAI-primary; a value
 * of 0.68 means "this preset costs 32% less at the same volume and mix".
 *
 * Sources: derived from RATE_CARDS below. If you change a rate card, update
 * the factor; there is no auto-derivation because the actual weighting of
 * stages in a call (STT seconds vs LLM tokens vs TTS characters) is not
 * measured yet.
 */
export const PRESET_RATE_FACTOR: Record<string, number> = {
    'openai-primary': 1.00,
    'gemini-primary': 0.92,
    'mistral-lean': 0.68,
    'selfhosted': 0.35,
};

/* ══════════════════════════════════════════════════════════════════════════
   Driver breakdown per preset
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The share of monthly spend by cost driver. Each row's `label` starts with
 * a stage keyword (`TTS`, `STT`, `LLM`, `Carrier`, `WhatsApp`, `Infra`) so the
 * sensitivity simulator can pick the right row to shock without a second key.
 *
 * The story the numbers tell: as cloud speech is removed, the carrier share
 * rises sharply — because carrier is per-minute and never scales down. At the
 * self-hosted floor, carrier is 74% of the bill, and that is the finding.
 */
export const PRESET_DRIVER_BREAKDOWN: Record<string, { label: string; eurPct: number }[]> = {
    'openai-primary': [
        { label: 'TTS · ElevenLabs', eurPct: 42 },
        { label: 'STT · Deepgram', eurPct: 21 },
        { label: 'LLM · GPT-6 Sol', eurPct: 9 },
        { label: 'Carrier · Telnyx', eurPct: 20 },
        { label: 'WhatsApp BSP', eurPct: 2 },
        { label: 'Infra (VPS + pgvector)', eurPct: 6 },
    ],
    'gemini-primary': [
        { label: 'TTS · ElevenLabs', eurPct: 43 },
        { label: 'STT · Deepgram', eurPct: 22 },
        { label: 'LLM · Gemini Flash', eurPct: 6 },
        { label: 'Carrier · Telnyx', eurPct: 20 },
        { label: 'WhatsApp BSP', eurPct: 2 },
        { label: 'Infra (VPS + pgvector)', eurPct: 7 },
    ],
    'mistral-lean': [
        { label: 'TTS · Voxtral', eurPct: 22 },
        { label: 'STT · Voxtral', eurPct: 8 },
        { label: 'LLM · Mistral Med', eurPct: 7 },
        { label: 'Carrier · Telnyx', eurPct: 52 },
        { label: 'WhatsApp BSP', eurPct: 4 },
        { label: 'Infra (VPS + pgvector)', eurPct: 7 },
    ],
    'selfhosted': [
        { label: 'TTS · Kokoro (CPU)', eurPct: 8 },
        { label: 'STT · sherpa (CPU)', eurPct: 5 },
        { label: 'LLM · Ollama (CPU)', eurPct: 0 },
        { label: 'Carrier · Telnyx', eurPct: 74 },
        { label: 'WhatsApp BSP', eurPct: 5 },
        { label: 'Infra (VPS + pgvector)', eurPct: 8 },
    ],
};

/* ══════════════════════════════════════════════════════════════════════════
   Provider map per preset
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Which provider handles which stage under each preset. This is a display
 * table — the actual routing lives in `TASK_ROUTES` in `data.ts` and is what
 * `useRoutingStore` returns. Kept in sync manually; if they diverge, the
 * routing tab is right and this is stale.
 */
export const PRESET_PROVIDER_MAP: Record<string, { stt: string; llm: string; tts: string }> = {
    'openai-primary': { stt: 'OpenAI', llm: 'OpenAI', tts: 'ElevenLabs' },
    'gemini-primary': { stt: 'OpenAI', llm: 'Gemini', tts: 'ElevenLabs' },
    'mistral-lean': { stt: 'Mistral', llm: 'Mistral', tts: 'Mistral' },
    'selfhosted': { stt: 'sherpa', llm: 'Ollama', tts: 'Kokoro' },
};

/* ══════════════════════════════════════════════════════════════════════════
   Narrative + decision context per preset
   ══════════════════════════════════════════════════════════════════════════ */

export interface PresetNarrative {
    /** One-line description of the preset's stack. */
    description: string;
    /** When this preset wins. */
    winsWhen: string;
    /** What it costs beyond money — ops, latency, a VPS, a support ticket. */
    costBeyondMoney?: string;
    /** Requires a self-hosted VPS with the specific capability below. */
    selfHosted?: boolean;
}

export const PRESET_NARRATIVE: Record<string, PresetNarrative> = {
    'openai-primary': {
        description: 'Everything cloud. OpenAI for STT + LLM, ElevenLabs for TTS.',
        winsWhen: 'You want the highest quality and lowest operational risk. It is the current signed model.',
        costBeyondMoney: 'Most exposed to ElevenLabs rate changes — 42% of the bill is TTS.',
    },
    'gemini-primary': {
        description: 'OpenAI STT, Gemini LLM, ElevenLabs TTS.',
        winsWhen: 'You want to trim the LLM line without touching STT quality or TTS voice.',
        costBeyondMoney: 'LLM is only 6% of the bill — the swap saves 8% because everything else is fixed.',
    },
    'mistral-lean': {
        description: 'Mistral for STT, LLM, and TTS. One vendor, one key.',
        winsWhen: 'You trust Voxtral STT and French Piper voices. 32% cheaper, still cloud.',
        costBeyondMoney: 'Carrier becomes 52% of the bill. Any carrier rate change hits harder here.',
    },
    'selfhosted': {
        description: 'sherpa-onnx STT, Ollama LLM, Kokoro TTS. All on CPU.',
        winsWhen: 'You own the hardware and can absorb a 24/7 operational commitment.',
        costBeyondMoney: 'Requires a 4-vCPU VPS and someone to keep it running. Carrier is 74% of the bill.',
        selfHosted: true,
    },
};

/* ══════════════════════════════════════════════════════════════════════════
   Rate cards — the per-unit numbers behind the factors
   ══════════════════════════════════════════════════════════════════════════ */

export type CostStage = 'stt' | 'llm' | 'tts' | 'carrier' | 'whatsapp' | 'infra';

export interface RateCard {
    key: string;
    /** Human label, matching the driver breakdown prefix. */
    label: string;
    stage: CostStage;
    /** € per minute of call time for the prototype's blended usage. */
    perMinute: number;
    /** Where the number came from. */
    source: string;
    /** Is this a locked-in commercial rate or an unverified placeholder? */
    verified: boolean;
}

export const RATE_CARDS: RateCard[] = [
    // STT
    { key: 'openai/gpt-live-transcribe', label: 'OpenAI GPT-Live-Transcribe', stage: 'stt', perMinute: 0.0040, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'mistral/voxtral', label: 'Mistral Voxtral', stage: 'stt', perMinute: 0.0011, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'sherpa/zipformer', label: 'sherpa-onnx zipformer', stage: 'stt', perMinute: 0.0000, source: 'Apache-2.0, no per-minute cost — VPS only', verified: true },

    // LLM
    { key: 'openai/gpt-6-sol', label: 'OpenAI GPT-6 Sol', stage: 'llm', perMinute: 0.0184, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'gemini/gemini-3.8-flash', label: 'Gemini 3.8 Flash', stage: 'llm', perMinute: 0.0121, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'mistral/mistral-medium-3-5', label: 'Mistral Medium 3.5', stage: 'llm', perMinute: 0.0146, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'ollama/qwen2.5-14b', label: 'Ollama Qwen2.5-14B', stage: 'llm', perMinute: 0.0000, source: 'self-hosted, no per-token cost — VPS only', verified: true },

    // TTS
    { key: 'elevenlabs/flash', label: 'ElevenLabs Flash', stage: 'tts', perMinute: 0.0210, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'mistral/voxtral-tts', label: 'Mistral Voxtral TTS', stage: 'tts', perMinute: 0.0075, source: 'placeholder — pricing page not cited', verified: false },
    { key: 'kokoro/cpu', label: 'Kokoro-82M (CPU)', stage: 'tts', perMinute: 0.0000, source: 'Apache-2.0, no per-minute cost — VPS only', verified: true },

    // Carrier
    { key: 'telnyx/eu', label: 'Telnyx — EU termination', stage: 'carrier', perMinute: 0.0068, source: 'placeholder — RFQ not returned', verified: false },

    // WhatsApp
    { key: 'bsp/inbound-24h', label: 'BSP — inbound 24h window', stage: 'whatsapp', perMinute: 0.0000, source: 'Meta policy — user-initiated inside 24h is free', verified: true },

    // Infra
    { key: 'vps/4vcpu', label: 'VPS + pgvector (4 vCPU)', stage: 'infra', perMinute: 0.0000, source: 'fixed monthly, not per-minute', verified: false },
];

/* ══════════════════════════════════════════════════════════════════════════
   Sensitivity — how exposed is the preset to a rate change?
   ══════════════════════════════════════════════════════════════════════════ */

export type SensitivityKey = 'carrier' | 'tts' | 'stt' | 'llm';

export const SENSITIVITY_FACTOR = 1.20;

export const SENSITIVITY_LABELS: Record<SensitivityKey, string> = {
    carrier: 'Carrier +20%',
    tts: 'TTS +20%',
    stt: 'STT +20%',
    llm: 'LLM +20%',
};

export const SENSITIVITY_KEYS: SensitivityKey[] = ['carrier', 'tts', 'stt', 'llm'];

/** Which driver-breakdown row a sensitivity key shocks. */
export function pickSensitivityFactor(
    label: string,
    active: Set<SensitivityKey>,
): number {
    if (label.startsWith('Carrier') && active.has('carrier')) return SENSITIVITY_FACTOR;
    if (label.startsWith('TTS') && active.has('tts')) return SENSITIVITY_FACTOR;
    if (label.startsWith('STT') && active.has('stt')) return SENSITIVITY_FACTOR;
    if (label.startsWith('LLM') && active.has('llm')) return SENSITIVITY_FACTOR;
    return 1;
}

/**
 * Apply sensitivity shocks to a driver breakdown. Returns:
 *   - `breakdown` — renormalized to sum to 100%, safe to render
 *   - `weight`    — the sum of the shocked, un-renormalized percentages.
 *                   Multiply the monthly figure by `weight / 100` to get the
 *                   new total. Example: if the sum is 104, the bill is +4%.
 */
export function applySensitivity(
    breakdown: { label: string; eurPct: number }[],
    active: Set<SensitivityKey>,
): { breakdown: { label: string; eurPct: number }[]; weight: number } {
    let totalWeight = 0;
    const shocked = breakdown.map((d) => {
        const factor = pickSensitivityFactor(d.label, active);
        const next = d.eurPct * factor;
        totalWeight += next;
        return { label: d.label, eurPct: next };
    });
    const renormalized = shocked.map((d) => ({
        label: d.label,
        eurPct: Math.round((d.eurPct / totalWeight) * 100),
    }));
    return { breakdown: renormalized, weight: totalWeight };
}

/* ══════════════════════════════════════════════════════════════════════════
   Preset id list — helpers that don't want to import the store
   ══════════════════════════════════════════════════════════════════════════ */

export const PRESET_IDS = Object.keys(PRESET_RATE_FACTOR);

/** Type-guard for reading a factor without falling back to 1 silently. */
export function presetFactor(id: string): number {
    return PRESET_RATE_FACTOR[id] ?? 1;
}

/** Narrow a `ProviderMixPreset` to the enriched preset id space. */
export function isKnownPreset(preset: ProviderMixPreset): boolean {
    return preset.id in PRESET_RATE_FACTOR;
}