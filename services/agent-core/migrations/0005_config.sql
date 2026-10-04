-- 0005_config.sql
-- Phase C+D batch, step 2: config tables. First migration in the merged batch.
--
-- This is the agent's database, NOT the desktop app's SQLite. Separate stores,
-- separate migration sequences (BACKEND.md §15).
--
-- PG-shaped by design: the Gate 1 Postgres swap is driver + runner, not a
-- redesign. The storage layer (agent_core/storage.py) translates to SQLite
-- for dev. Column types are the part that matters.

CREATE TABLE IF NOT EXISTS agent_config (
    id              integer PRIMARY KEY CHECK (id = 1),  -- singleton row

    -- Provider mix: which provider handles which seam.
    -- { "llm": "google/gemini-3.x-flash", "tts": "elevenlabs",
    --   "stt": "deepgram", "embed": "bge-m3" }
    provider_mix    jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Consent model. 'announce_first' is the only variant that ships in v1.
    consent_variant text NOT NULL DEFAULT 'announce_first'
                    CHECK (consent_variant IN (
                        'announce_first', 'record_with_consent', 'no_recording'
                    )),

    -- Bilingual voice enforcement (FR/EN). Arabic/Darija is permanently off.
    bilingual       boolean NOT NULL DEFAULT 1,

    -- Primary channel selection. The customer chooses from config.
    -- 'baileys' | 'twilio' | 'official' | 'none'
    channel         text NOT NULL DEFAULT 'none'
                    CHECK (channel IN ('baileys', 'twilio', 'official', 'none')),

    -- Per-channel capability flags. `configured` is DERIVED from .env on the
    -- server — the client may enable a channel, but the flag never claims a
    -- channel that has no credentials behind it.
    -- { "baileys": { "enabled": true, "configured": true }, ... }
    channels        jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Cost simulator inputs. Every rate is UNVERIFIED until the RFQ returns.
    -- { "inputs": {}, "unverified": true }
    cost_sim        jsonb NOT NULL DEFAULT '{"inputs":{},"unverified":true}'::jsonb,

    -- Business hours. { "mon-fri": ["09:00","18:00"] }
    hours           jsonb NOT NULL DEFAULT '{"mon-fri":["09:00","18:00"]}'::jsonb,

    -- Timezone for business-hours calculations.
    tz              text NOT NULL DEFAULT 'Europe/Paris',

    -- E.164 transfer target. Required when answering in-hours.
    transfer_target text,

    -- Provider tier.
    tier            text NOT NULL DEFAULT 'standard'
                    CHECK (tier IN ('budget', 'standard', 'premium', 'selfhosted')),

    -- Knowledge scope: what content is allowed to reach the server.
    -- ["services_pricing", "hours", "booking_rules"]
    knowledge_scope jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- After-hours behaviour.
    after_hours_mode text NOT NULL DEFAULT 'take_message'
                     CHECK (after_hours_mode IN (
                         'take_message', 'transfer', 'announce_only'
                     )),

    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row so GET /config always has something to return.
INSERT INTO agent_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
