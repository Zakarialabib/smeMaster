-- 0001_tenants.sql
-- Phase A2: ONE table only. The rest arrive in Phase B, one per gate that needs
-- them (BACKEND.md section 15), so a reviewer can see which gate introduced what.
--
-- This is the agent's database, NOT the desktop app's SQLite. They are separate
-- stores on separate machines and must never share a migration sequence.

CREATE TABLE IF NOT EXISTS tenants (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name             text NOT NULL,

    -- Availability. The console's Config page writes these; nothing else does.
    tz               text NOT NULL DEFAULT 'Europe/Paris',
    business_hours   jsonb NOT NULL DEFAULT '{"mon-fri": ["09:00", "18:00"]}'::jsonb,

    -- E.164. A tenant that answers in-hours MUST have one: an in-hours agent with
    -- no transfer target fails the "no silent failure" principle (CALL-FLOW.md 4).
    -- Nullable so a tenant can exist in a not-yet-provisioned state, but the
    -- `answering` flag below is what the invariant is actually written against.
    transfer_target  text,

    -- Explicit rather than inferred. A tenant is only "answering" once a number
    -- is provisioned and the client has signed off, and the schema can then
    -- refuse the state that drops callers.
    answering        boolean NOT NULL DEFAULT false,

    tier             text NOT NULL DEFAULT 'standard'
                     CHECK (tier IN ('budget', 'standard', 'premium', 'selfhosted')),

    after_hours_mode text NOT NULL DEFAULT 'take_message'
                     CHECK (after_hours_mode IN ('take_message', 'transfer', 'announce_only')),

    -- Voice is FR/EN only. There is no column for a third language, deliberately:
    -- a nullable locale list is how "we'll add Darija next sprint" becomes silent
    -- scope creep (UX.md section 12).
    voice_fr         text,
    voice_en         text,

    -- The disclosure line is spoken on 100% of calls (PILOT-CRITERIA.md). It is a
    -- tenant setting because the wording is client-facing legal copy, not an
    -- implementation detail. NULL falls back to the built-in FR/EN default in
    -- contracts.py; it must never fall back to "no disclosure".
    disclosure_fr    text,
    disclosure_en    text,

    created_at       timestamptz NOT NULL DEFAULT now(),

    -- THE invariant: an answering tenant has somewhere to transfer a caller.
    -- This is a real constraint, not a placeholder - a bad API write cannot leave
    -- a tenant that answers calls and drops the transfer silently.
    CONSTRAINT answering_requires_transfer_target
        CHECK (NOT answering OR transfer_target IS NOT NULL)
);

-- The console is multi-tenant from day one even with one client, because the
-- tenant scoping is what ADR-001 D4a depends on.
CREATE INDEX IF NOT EXISTS tenants_tier_idx ON tenants (tier);

-- Seeding note: insert tenants with `answering = false` first, set
-- `transfer_target`, then flip `answering = true`. Two statements, in that order.
-- A single INSERT with answering=true and no target is rejected - which is the
-- point.
