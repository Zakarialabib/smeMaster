-- 0006_turns_alerts.sql
-- Merged C+D batch step 3: the endpoints the console's Calls/Live/Ops tabs read.
--
-- Migrations land WITH their endpoints (DECISIONS-2026-10-03.md §3.3), not in
-- one atomic batch. This one carries the call-log extensions, the turn
-- transcript, and the ops alert store.
--
-- This is the agent's database, NOT the desktop app's SQLite.

-- ── calls: the columns the console's CallListItem needs ──────────────────────
-- 0002 created the core row. These are additive so a 0002-era row stays valid.
-- SQLite supports ALTER TABLE ADD COLUMN; PG does too. Defaults are required
-- for existing rows.

-- A judgement, not a fact — renders in the AI treatment (WIREFRAMES.md).
ALTER TABLE calls ADD COLUMN flagged text;

-- Money as NUMERIC, never float (0003's rule). NULL for WhatsApp service
-- conversations, which cost EUR 0 by policy and must not read as missing data.
ALTER TABLE calls ADD COLUMN cost_eur numeric(12, 6);

-- §5 #2: the agent listened but did not speak. A shadow call is real traffic
-- with no agent audio, and must be separable from a live call.
ALTER TABLE calls ADD COLUMN shadow_mode boolean NOT NULL DEFAULT 0;

-- §5 #16: spam likelihood 0..1. NULL means "not scored", which is different
-- from 0.0 ("scored, not spam").
ALTER TABLE calls ADD COLUMN spam_score numeric(4, 3);

-- §5 #16: the reasons behind the score, as a JSON array.
ALTER TABLE calls ADD COLUMN spam_reasons jsonb;

-- §5 #3: was the WhatsApp summary delivered?
ALTER TABLE calls ADD COLUMN summary_sent boolean NOT NULL DEFAULT 0;

-- §5 #20: which knowledge scope version answered this call. A call answered
-- under an older scope is not reproducible without it.
ALTER TABLE calls ADD COLUMN scope_version integer;

-- Why this call counted as contained (the pilot's headline metric must be
-- decomposable — WIREFRAMES.md U2).
ALTER TABLE calls ADD COLUMN containment_reason text;

-- ── turns: the transcript, with provenance for "why did it say that?" ────────

CREATE TABLE IF NOT EXISTS turns (
    call_id         text NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    idx             integer NOT NULL,
    role            text NOT NULL CHECK (role IN ('caller', 'agent')),

    -- TRANSCRIPT ONLY. There is no audio column, anywhere, and none may be
    -- added without the client's explicit written consent (CALL-FLOW.md §2).
    text            text NOT NULL,
    final           boolean NOT NULL DEFAULT 1,

    -- Per-turn latency marks. Nullable: a turn that failed before STT has none.
    vad_ms          integer,
    stt_ms          integer,
    llm_ms          integer,
    tts_ms          integer,
    turn_gap_ms     integer,

    -- §5 #20: retrieval hits + scope provenance, as JSON. NULL for a turn that
    -- did not retrieve (a greeting, a guardrail refusal).
    provenance      jsonb,

    -- §5 #11: emotion snapshot after this turn.
    emotion_tag     text,

    -- §3.1: guardrail that fired on this turn, if any.
    guardrail_fired text,

    -- §5 #9/#10: language + accent for this specific caller turn.
    language        text,

    at              timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (call_id, idx)
);

-- Replay reads one call's turns in order; this is the only index it needs.
CREATE INDEX IF NOT EXISTS turns_call_idx ON turns (call_id, idx);

-- ── alerts: the ops digest's persistent rows ─────────────────────────────────

CREATE TABLE IF NOT EXISTS alerts (
    id              text PRIMARY KEY,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    severity        text NOT NULL CHECK (severity IN ('P1', 'P2', 'P3')),

    -- The rule that fired, e.g. 'transfer_failed'. Grouped on, never displayed
    -- raw (OPS-ASSISTANT.md §5).
    rule            text NOT NULL,

    -- The decision, not a log line.
    one_liner       text NOT NULL,
    decision        text NOT NULL,

    -- { "count": 6, "firstAt": "…", "lastAt": "…", "blastRadius": "this tenant" }
    evidence        jsonb NOT NULL,

    -- The calls this alert refers to, so the drill-down has something to open.
    -- The prototype's alert carried a count and nothing to drill into.
    call_ids        jsonb NOT NULL DEFAULT '[]'::jsonb,

    acknowledged_at timestamptz,
    acknowledged_by text,

    -- True while the rule's threshold is a placeholder pending pilot data. The
    -- console renders this provenance rather than a guess as a measurement.
    threshold_is_provisional boolean NOT NULL DEFAULT 1,

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_tenant_severity_idx
    ON alerts (tenant_id, severity, created_at DESC);

-- Unacknowledged alerts are what the digest leads with; partial because the
-- acknowledged ones are only read on drill-down.
CREATE INDEX IF NOT EXISTS alerts_open_idx
    ON alerts (tenant_id, created_at DESC)
    WHERE acknowledged_at IS NULL;
