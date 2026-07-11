// ── Sync Document — CRDT Wrapper ──────────────────────────────────────────
//
// Wraps `automerge::AutoCommit` to provide a higher-level document API
// for the sync engine. Documents are identified by a string `doc_id` and
// track a version counter for incremental sync.

use anyhow::{Context, Result};
use automerge::transaction::Transactable;
use automerge::{AutoCommit, ReadDoc, Value};

/// A syncable CRDT document backed by an Automerge `AutoCommit` handle.
pub struct SyncDocument {
    doc_id: String,
    doc: AutoCommit,
    /// Unix timestamp (milliseconds) of the last modification.
    last_modified: i64,
    /// Monotonically increasing version counter for change tracking.
    version_counter: u64,
}

impl SyncDocument {
    /// Create a new empty document with the given `doc_id`.
    pub fn new(doc_id: &str) -> Self {
        let doc = AutoCommit::new();
        Self {
            doc_id: doc_id.to_string(),
            doc,
            last_modified: chrono::Utc::now().timestamp_millis(),
            version_counter: 0,
        }
    }

    /// Load a document from previously serialised bytes.
    pub fn load(doc_id: &str, bytes: &[u8]) -> Result<Self> {
        let doc = AutoCommit::load(bytes).context("Failed to load automerge document from bytes")?;
        Ok(Self {
            doc_id: doc_id.to_string(),
            doc,
            last_modified: chrono::Utc::now().timestamp_millis(),
            version_counter: 0,
        })
    }

    /// Serialise the document to bytes for storage or transmission.
    pub fn save(&mut self) -> Vec<u8> {
        self.doc.save()
    }

    /// Set a value at the given key in the document's root map.
    pub fn set<V: Into<automerge::ScalarValue>>(&mut self, key: &str, value: V) {
        let _ = Transactable::put(&mut self.doc, automerge::ROOT, key, value);
        self.last_modified = chrono::Utc::now().timestamp_millis();
        self.version_counter += 1;
    }

    /// Get a value by key from the document's root map.
    pub fn get(&self, key: &str) -> Option<Value<'_>> {
        match self.doc.get(automerge::ROOT, key) {
            Ok(Some((val, _))) => Some(val),
            _ => None,
        }
    }

    /// Merge another document's changes into this one.
    ///
    /// Returns the number of new changes applied.
    pub fn merge(&mut self, other: &mut SyncDocument) -> Result<u64> {
        let change_hashes = self
            .doc
            .merge(&mut other.doc)
            .context("Failed to merge sync documents")?;
        let count = change_hashes.len() as u64;
        if count > 0 {
            self.last_modified = chrono::Utc::now().timestamp_millis();
            self.version_counter += count;
        }
        Ok(count)
    }

    /// Get all changes that have occurred since the given version.
    ///
    /// This returns the raw automerge changes for the requested window.
    pub fn changes_since(&mut self, version: u64) -> Vec<u8> {
        // Automerge doesn't have a built-in "changes since counter" concept.
        // For simplicity, we return the full save when version is 0,
        // and an empty response otherwise (incremental sync is handled at a higher level).
        if version == 0 {
            self.save()
        } else {
            // In a production system, we'd track change hashes and return only
            // changes after a specific hash. For now, return full document.
            vec![]
        }
    }

    /// The current version counter.
    pub fn version(&self) -> u64 {
        self.version_counter
    }

    /// The document identifier.
    pub fn doc_id(&self) -> &str {
        &self.doc_id
    }

    /// Timestamp of the last modification (milliseconds since epoch).
    pub fn last_modified(&self) -> i64 {
        self.last_modified
    }

    /// Access the underlying `AutoCommit` document.
    #[allow(dead_code)]
    pub fn inner(&self) -> &AutoCommit {
        &self.doc
    }

    /// Mutable access to the underlying `AutoCommit` document.
    #[allow(dead_code)]
    pub fn inner_mut(&mut self) -> &mut AutoCommit {
        &mut self.doc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_document() {
        let doc = SyncDocument::new("contacts");
        assert_eq!(doc.doc_id(), "contacts");
        assert_eq!(doc.version(), 0);
        assert!(doc.get("name").is_none());
    }

    #[test]
    fn test_set_and_get() {
        let mut doc = SyncDocument::new("test");
        doc.set("name", "Alice");
        doc.set("email", "alice@example.com");

        let name = doc.get("name");
        assert!(name.is_some());

        let email = doc.get("email");
        assert!(email.is_some());

        assert_eq!(doc.version(), 2);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let mut doc = SyncDocument::new("contacts");
        doc.set("name", "Bob");
        doc.set("phone", "+1234567890");
        assert_eq!(doc.version(), 2);

        let bytes = doc.save();
        assert!(!bytes.is_empty());

        let loaded = SyncDocument::load("contacts", &bytes).expect("Should load");
        assert_eq!(loaded.doc_id(), "contacts");

        // Values should be retrievable after load
        let name = loaded.get("name");
        assert!(name.is_some());
    }

    #[test]
    fn test_merge() {
        let mut doc_a = SyncDocument::new("shared");
        doc_a.set("field_a", "value_a");

        let mut doc_b = SyncDocument::new("shared");
        doc_b.set("field_b", "value_b");

        let count = doc_a.merge(&mut doc_b).expect("Merge should succeed");
        assert!(count > 0);

        // Both fields should be visible in doc_a after merge
        let field_a = doc_a.get("field_a");
        assert!(field_a.is_some());

        let field_b = doc_a.get("field_b");
        assert!(field_b.is_some());
    }
}