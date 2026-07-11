// ── Sync Protocol Message Types ─────────────────────────────────────────────
//
// Serializable message types for the CRDT sync protocol between paired devices.
// Messages are serialized via serde and transmitted over TCP streams.

use serde::{Deserialize, Serialize};

/// Top-level message type exchanged between sync engine peers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncMessage {
    /// Initial handshake — sent by the connecting peer.
    Handshake {
        device_id: String,
        public_key: Vec<u8>,
    },
    /// Acknowledgment of a handshake — sent by the accepting peer.
    HandshakeAck {
        device_id: String,
    },
    /// Request to sync a specific document at a given version.
    SyncRequest {
        doc_id: String,
        version: u64,
    },
    /// Response containing compressed automerge changes for a document.
    SyncResponse {
        doc_id: String,
        /// Compressed automerge changes as serialized bytes.
        changes: Vec<u8>,
    },
    /// Acknowledgment that a sync response was received and applied.
    SyncAck {
        doc_id: String,
        version: u64,
    },
    /// Graceful disconnection notification.
    Disconnect,
}