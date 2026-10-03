-- 0004_knowledge.sql
-- Phase B4: the knowledge base the agent retrieves from.
--
-- The RAG-FORK decision (bge-m3 vs arctic-embed-l-v2.0) is still pending, and
-- this schema is written so that EITHER can be chosen without a migration. That
-- is the whole point of putting `dim` and `space` in the table rather than in
-- application code.

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Where the knowledge came from, and who said so. An answer the agent gives
    -- must be traceable to a document a human approved, or it is a guess with a
    -- citation-shaped wrapper.
    kind            text NOT NULL
                    CHECK (kind IN ('document', 'faq', 'policy', 'manual', 'url')),
    title           text NOT NULL,
    source_uri      text,
    -- Who approved it. A KB entry with no approver is unreviewed content that
    -- the agent will still speak to a caller as though it were settled.
    approved_by     text,
    approved_at     timestamptz,

    -- Language of the SOURCE. The agent speaks fr/en; the knowledge may be in
    -- either, and retrieval has to know which embedding space a chunk lives in.
    language        text NOT NULL DEFAULT 'fr'
                    CHECK (language IN ('fr', 'en')),

    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    ordinal         integer NOT NULL,
    content         text NOT NULL,

    -- ── The vector space, made explicit ──────────────────────────────────
    --
    -- `dim` and `space` exist so that a 384-d desktop vector can never be
    -- silently compared against a 1024-d server vector. RAG-FORK.md is emphatic
    -- that these are DIFFERENT spaces and merging them produces plausible
    -- nonsense. Carrying dim in the row makes the mistake a constraint instead
    -- of a hope.
    dim             integer NOT NULL,
    space           text NOT NULL,        -- e.g. 'bge-m3', 'arctic-l-v2.0', 'desktop-bge-small-en'
    model_id        text NOT NULL,
    embedding       vector,               -- pgvector; dim varies per model

    -- Chunking strategy is recorded per chunk, because retrieval quality at KB
    -- scale is mostly chunking, not the embedder.
    chunker         text NOT NULL,

    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Retrieval is always (tenant, is_active) then nearest-neighbour. This index
-- serves the filter; the vector index is created per model in RAG-FORK, once the
-- model is chosen, because pgvector's HNSW needs the dimension at DDL time.
CREATE INDEX IF NOT EXISTS knowledge_chunks_tenant_idx
    ON knowledge_chunks (tenant_id);

-- The space-mixing guard is the `dim`/`space` columns above, and a test in
-- tests/test_migrations.py that asserts a single retrieval set cannot contain
-- two dims. A UNIQUE constraint cannot express it (chunks legitimately differ
-- per model across rebuilds), so asserting it in a test is the honest form --
-- a CHECK here would forbid the legitimate multi-model case.

-- TODO(RAG-FORK, pending): once bge-m3 vs arctic-l-v2.0 is decided, add
--   CREATE INDEX ... ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
-- with the chosen dimension. It cannot be written now: pgvector's HNSW requires
-- the dimension at DDL time, and writing it before the decision would hard-code
-- the answer into the schema.
