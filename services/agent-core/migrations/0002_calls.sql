-- 0002_calls.sql
-- Phase B4: the call log. One table per gate, continuing the 0001 convention.
--
-- This is the agent's database, NOT the desktop app's SQLite.

CREATE TABLE IF NOT EXISTS calls (
    id              text PRIMARY KEY,              -- ULID, from agent-core
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    channel         text NOT NULL
                    CHECK (channel IN ('voice', 'whatsapp')),
    state           text NOT NULL
                    CHECK (state IN (
                        'ringing', 'greeting', 'listening', 'thinking', 'speaking',
                        'transferring', 'after_hours', 'voicemail', 'closed'
                    )),

    started_at      timestamptz NOT NULL DEFAULT now(),
    answered_at     timestamptz,
    closed_at       timestamptz,

    -- E.164, already normalised at the edge. '+33', '0033' and '0' forms are
    -- collapsed BEFORE the allowlist check, or the allowlist is bypassable by
    -- formatting alone (BACKEND.md 9).
    caller_e164     text NOT NULL,

    -- MASKED BY DEFAULT. The console shows a masked number; the full number is
    -- one deliberate extra step. A call log full of unmasked numbers is a
    -- GDPR problem with a UI attached.
    caller_masked   text NOT NULL,

    -- 'test_call' rows are synthetic. They are retained (they are how the client
    -- demonstrates the product) but they MUST be separable from real traffic,
    -- because a count that mixes them is a count nobody can bill from.
    purpose         text NOT NULL DEFAULT 'live'
                    CHECK (purpose IN ('live', 'test_call')),

    outcome         text,
    -- No CHECK on outcome: the set grows as the ops vocabulary grows, and a
    -- CHECK here would need a migration per new word. An unrecognised outcome
    -- renders as "unknown" in the console rather than crashing the query.

    -- INFERENCE, not fact. Summaries and containment verdicts are computed and
    -- are rendered in the AI treatment. A transcript is a FACT and is not.
    summary         text,
    contained       boolean,

    -- PROVIDER NAMES, never credentials. Which provider actually answered is
    -- what makes a fallback visible and a bill explainable; the key that
    -- authenticated to it is not this database's business.
    llm_provider    text,
    tts_provider    text,
    stt_provider    text,
    fallback_active boolean NOT NULL DEFAULT false,

    -- PER-TURN LATENCY. The four stage marks are what turn "it felt slow" into
    -- a number, and STT-vs-LLM is only diagnosable with them separated.
    -- Nullable: a call that failed before turning has no marks.
    vad_ms          integer,
    stt_ms          integer,
    llm_ms          integer,
    tts_ms          integer,
    turn_gap_ms     integer,

    -- NO AUDIO. There is no audio column, no audio_url, no blob reference, and
    -- none may be added without the client's explicit written consent. Retention
    -- of TEXT is a separate, open question (RAG-FORK / PILOT-CRITERIA); this
    -- schema deliberately does not pre-decide it either way.
    transcript_gone_at timestamptz
);

-- The call log is read newest-first, always scoped to one tenant. This index is
-- the only one the console's CallList actually needs.
CREATE INDEX IF NOT EXISTS calls_tenant_started_idx
    ON calls (tenant_id, started_at DESC);

-- Ops digests count calls in a window by channel.
CREATE INDEX IF NOT EXISTS calls_tenant_channel_idx
    ON calls (tenant_id, channel, started_at DESC);

-- "Show me the P1's calls" — the alert drill-down. Partial, because only
-- closed calls with an outcome are ever drilled into.
CREATE INDEX IF NOT EXISTS calls_with_outcome_idx
    ON calls (tenant_id, closed_at DESC)
    WHERE outcome IS NOT NULL;
