-- 0003_metering.sql
-- Phase B4: provider usage, so the cost model stops being an estimate.
--
-- COST-MODEL.md's whole difficulty is that the pilot is priced FLAT-FEE with an
-- included-minute bucket, because at pilot volume fixed costs dominate and
-- per-minute pricing cannot work yet. The included bucket is only defensible if
-- we can say what a minute actually COST us. This table is that answer.

CREATE TABLE IF NOT EXISTS usage_events (
    id              bigserial PRIMARY KEY,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id         text REFERENCES calls(id) ON DELETE SET NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now(),

    seam            text NOT NULL
                    CHECK (seam IN ('llm', 'tts', 'stt', 'embedding', 'telephony')),
    provider        text NOT NULL,        -- which one ANSWERED, not the primary
    fallback_active boolean NOT NULL DEFAULT false,

    -- Units as the provider bills them. NULL where a seam is not metered in
    -- that unit (embeddings are per-vector, telephony per-minute, tts per char).
    input_tokens    integer,
    output_tokens   integer,
    characters      integer,
    audio_seconds   numeric(10, 3),
    calls           integer,

    -- The decimal matters. Money in binary floating point is money that is
    -- subtly wrong on every invoice.
    cost_usd        numeric(12, 6) NOT NULL DEFAULT 0,
    cost_eur        numeric(12, 6) NOT NULL DEFAULT 0,

    -- UNVERIFIED pricing is recorded as a VERSION, not baked in. Prices change
    -- weekly; a cost row that does not say which price list produced it is not
    -- auditable and cannot be defended to a client.
    price_list_version text NOT NULL
);

-- Per-tenant, per-day, per-seam rollups are what the Cost page reads.
CREATE INDEX IF NOT EXISTS usage_tenant_day_idx
    ON usage_events (tenant_id, occurred_at DESC, seam);

-- Fallback analysis: "how often does X fail over, and what does that cost?"
-- Partial, because a non-fallback event is the overwhelming majority and this
-- query is rare.
CREATE INDEX IF NOT EXISTS usage_fallback_idx
    ON usage_events (tenant_id, seam, occurred_at DESC)
    WHERE fallback_active;

-- A rate-card snapshot, so historical cost is reproducible. Storing the price
-- used, not the price current at read time.
CREATE TABLE IF NOT EXISTS price_list_versions (
    version         text PRIMARY KEY,
    effective_from  date NOT NULL,
    -- The literal rate card, verbatim, with its source and its date. This is
    -- what makes COST-MODEL.md checkable instead of aspirational.
    rates           jsonb NOT NULL,
    -- Set while any figure in `rates` is still unverified. The console must
    -- refuse to present a provisional rate card as a client-facing price.
    is_verified     boolean NOT NULL DEFAULT false,
    source          text NOT NULL,
    verified_on     date
);

-- Cross-check: usage may not be recorded against a price list that does not
-- exist. A cost row with an unresolvable price_list_version is unauditable.
--
-- ON DELETE RESTRICT is deliberate, and the test enforces it. Deleting a
-- price_list_version that usage rows already reference would silently orphan
-- historical costs — and a cost you cannot re-derive from a rate card is not a
-- cost, it is a guess with a number. Retire a rate card; do not delete it.
ALTER TABLE usage_events
    DROP CONSTRAINT IF EXISTS usage_price_list_fk;
ALTER TABLE usage_events
    ADD CONSTRAINT usage_price_list_fk
    FOREIGN KEY (price_list_version) REFERENCES price_list_versions(version)
    ON DELETE RESTRICT;
