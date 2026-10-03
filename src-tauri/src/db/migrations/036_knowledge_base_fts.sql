-- Knowledge Base full-text search (BM25) index.
-- Mirrors the LanceDB vector index so hybrid search can run both
-- BM25 (SQLite FTS5) and vector similarity (LanceDB) in parallel,
-- then merge results with Reciprocal Rank Fusion (RRF).

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
  id UNINDEXED,
  text,
  tokenize='trigram'
);
