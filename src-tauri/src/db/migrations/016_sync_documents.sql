-- Sync Documents: CRDT-based P2P sync storage
CREATE TABLE IF NOT EXISTS sync_documents (
  doc_id TEXT PRIMARY KEY,
  doc_bytes BLOB NOT NULL,
  last_modified INTEGER NOT NULL,
  last_synced_at INTEGER,
  version_counter INTEGER DEFAULT 0
);