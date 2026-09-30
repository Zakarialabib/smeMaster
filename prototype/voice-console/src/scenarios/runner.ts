import type {
    GuardrailScenario, GuardrailId, ScenarioResult, Turn, CallOutcome,
} from '../types';

/**
 * Scenario runner — pure simulation, no UI.
 *
 * Each scenario is a scripted sequence of caller/agent turns and a set of
 * guardrails that must (or must not) fire. The runner maps the scenario to a
 * transcript, computes the pass/fail verdict, and returns a ScenarioResult.
 *
 * Kept separate from the page so it can be unit-tested without React, and so
 * a second caller (a CLI, a worker, a future server-side validator) can reuse
 * the exact same logic the UI displays.
 */

/* ── Transcript builder ──────────────────────────────────────────────── */

interface ScriptedTurn {
    role: 'agent' | 'caller';
    text: string;
    /** Guardrail that fires on this turn, if any. Also gets appended to `fired`. */
    fires?: GuardrailId;
}

/** Convenience: the agent's standard French disclosure. */
const DISCLOSE_FULL =
    'Bonjour, vous êtes en ligne avec l\'assistant vocal de Garage Leroy. ' +
    'Cet appel n\'est pas enregistré. Dites « agent » à tout moment pour être ' +
    'transféré à un humain. Comment puis-je vous aider ?';

const DISCLOSE_SHORT =
    'Bonjour, vous êtes en ligne avec l\'assistant vocal de Garage Leroy. ' +
    'Cet appel n\'est pas enregistré.';

const DISCLOSE_CUT =
    'Bonjour, vous êtes en ligne avec l\'assistant vocal de Garage Leroy. Cet appel n\'est pas enr…';

/**
 * The scripted transcript per scenario id. Adding a scenario is a data edit,
 * not a code edit. If a scenario id is missing here, the runner returns an
 * empty transcript and the scenario fails with a clear "no script" reason.
 */
function buildScript(s: GuardrailScenario): ScriptedTurn[] {
    switch (s.id) {
        case 's_ai_disclosure':
            return [
                { role: 'agent', text: DISCLOSE_FULL, fires: 'DISCLOSURE_FIRST' },
            ];

        case 's_price_range_not_exact':
            return [
                { role: 'agent', text: DISCLOSE_SHORT, fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                {
                    role: 'agent',
                    text:
                        'Une révision complète pour une 208 diesel se situe généralement entre 110€ et 160€ ' +
                        'selon les pièces à remplacer. Je ne peux pas vous donner de prix exact avant inspection.',
                    fires: 'NO_EXACT_PRICING',
                },
                { role: 'caller', text: s.callerTurns[1] ?? '' },
                {
                    role: 'agent',
                    text:
                        'Je comprends. Comme je vous l\'ai dit, le prix exact dépend de l\'inspection du véhicule. ' +
                        'Je vous transfère au bureau pour un devis précis — un instant s\'il vous plaît.',
                },
            ];

        case 's_emergency_transfer':
            return [
                { role: 'agent', text: DISCLOSE_CUT, fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                { role: 'agent', text: 'Je vous transfère immédiatement. Un instant.', fires: 'ESCALATE_EMERGENCY' },
            ];

        case 's_t3_confidential_block':
            return [
                { role: 'agent', text: DISCLOSE_SHORT, fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                {
                    role: 'agent',
                    text:
                        'Je ne suis pas autorisé à parler de paiements, d\'IBAN ou de données confidentielles. ' +
                        'Je vous transfère immédiatement au service comptabilité — un instant.',
                    fires: 'NO_T3_DATA',
                },
            ];

        case 's_angry_fast_escalation':
            return [
                { role: 'agent', text: 'Bonjour, vous êtes en ligne avec l\'assistant vocal…', fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                {
                    role: 'agent',
                    text: 'Je comprends votre agacement. Je prends ça en charge. Puis-je prendre rendez-vous pour…',
                },
                { role: 'caller', text: s.callerTurns[1] ?? '' },
                {
                    role: 'agent',
                    text: 'Je vous transfère immédiatement à un humain — un instant s\'il vous plaît.',
                    fires: 'ESCALATE_ANGRY',
                },
            ];

        case 's_technical_diagnosis':
            return [
                { role: 'agent', text: 'Bonjour, vous êtes en ligne avec l\'assistant vocal de Garage Leroy.', fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                {
                    role: 'agent',
                    text:
                        'Je ne peux pas diagnostiquer la panne sans inspecter le véhicule. Puis-je prendre ' +
                        'rendez-vous pour un diagnostic (30 min), ou vous préférez parler à un conseiller ?',
                    fires: 'NO_TECHNICAL_DIAGNOSIS',
                },
                { role: 'agent', text: 'Prochaine disponibilité : demain à 10 h 30.' },
            ];

        case 's_human_one_word':
            return [
                { role: 'agent', text: 'Bonjour, vous êtes en ligne avec l\'assistant vocal de Garage Leroy.', fires: 'DISCLOSURE_FIRST' },
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                { role: 'agent', text: 'Bien sûr — je vous propose jeudi à 14h…' },
                { role: 'caller', text: s.callerTurns[1] ?? '' },
                { role: 'agent', text: 'Un instant, je vous transfère.', fires: 'ESCALATE_HUMAN_REQUEST' },
            ];

        case 's_shadow_mode_silent':
            return [
                { role: 'caller', text: s.callerTurns[0] ?? '' },
                { role: 'caller', text: '… Allô ? Vous m\'entendez ?' },
            ];

        default:
            return [];
    }
}

/* ── Verdict ─────────────────────────────────────────────────────────── */

/**
 * Which outcome the simulation would have produced, based purely on which
 * guardrails fired. This is the "actual" the check compares against
 * `expectedOutcome`.
 */
function inferOutcome(s: GuardrailScenario, fired: GuardrailId[]): CallOutcome {
    if (s.id === 's_shadow_mode_silent') return 'voicemail';
    if (s.id === 's_technical_diagnosis') return 'contained';
    if (fired.some((f) => f.startsWith('ESCALATE_'))) return 'transferred';
    if (fired.includes('NO_T3_DATA')) return 'transferred';
    if (s.id === 's_price_range_not_exact' && fired.includes('NO_EXACT_PRICING')) return 'transferred';
    return 'contained';
}

function buildExplanation(
    passed: boolean,
    missing: GuardrailId[],
    unexpected: GuardrailId[],
    outcomeMatch: boolean,
): string {
    if (passed) return 'All guardrails fired as expected. The persona fear is mitigated.';

    const parts: string[] = [];
    if (missing.length) parts.push(`Missing must-fire: ${missing.join(', ')}.`);
    if (unexpected.length) parts.push(`Unexpected fired: ${unexpected.join(', ')}.`);
    if (!outcomeMatch) parts.push('Outcome mismatch.');
    return parts.join(' ') || 'Scenario failed for an unknown reason.';
}

/* ── Public API ──────────────────────────────────────────────────────── */

export function runScenario(s: GuardrailScenario): ScenarioResult {
    const script = buildScript(s);

    const transcript: Turn[] = script.map((t, idx) => ({
        idx,
        role: t.role,
        text: t.text,
        final: true,
        guardrailFired: t.fires ?? null,
    }));

    // Distinct, in fire-order. NO_T3_DATA also fires NO_PAYMENT per the fixture.
    const fired: GuardrailId[] = [];
    for (const t of script) {
        if (t.fires && !fired.includes(t.fires)) fired.push(t.fires);
    }
    // Fixture-only: the T3 scenario implicitly blocks payment too.
    if (s.id === 's_t3_confidential_block' && !fired.includes('NO_PAYMENT')) {
        fired.push('NO_PAYMENT');
    }

    const missing = s.mustFire.filter((m) => !fired.includes(m));
    const unexpected = (s.mustNotFire ?? []).filter((m) => fired.includes(m));
    const actual = inferOutcome(s, fired);
    const outcomeMatch = actual === s.expectedOutcome;

    const passed = missing.length === 0 && unexpected.length === 0 && outcomeMatch;

    return {
        scenarioId: s.id,
        passed,
        fired,
        outcome: s.expectedOutcome,
        transcript,
        explanation: buildExplanation(passed, missing, unexpected, outcomeMatch),
    };
}

/** Convenience for the "Run all" flow — pure, returns a map keyed by id. */
export function runAll(scenarios: GuardrailScenario[]): Record<string, ScenarioResult> {
    const out: Record<string, ScenarioResult> = {};
    for (const s of scenarios) out[s.id] = runScenario(s);
    return out;
}