// ── Peer Manager ──────────────────────────────────────────────────────────
//
// Extends the existing device/pairing.rs pairing system to provide
// peer discovery and management for the CRDT sync engine.

use std::path::Path;
use std::net::SocketAddr;

use serde::{Deserialize, Serialize};

use crate::device::pairing::{load_pairings, PairingEntry};

/// Information about a known or discovered peer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub device_id: String,
    pub addr: Option<SocketAddr>,
    pub device_name: String,
}

impl From<PairingEntry> for PeerInfo {
    fn from(entry: PairingEntry) -> Self {
        PeerInfo {
            device_id: entry.device_id,
            addr: None,
            device_name: entry.device_name,
        }
    }
}

/// Manages known paired peers and discovered local peers.
pub struct PeerManager {
    base_dir: std::path::PathBuf,
}

impl PeerManager {
    /// Create a new `PeerManager` backed by the given data directory.
    pub fn new(base_dir: &Path) -> Self {
        Self {
            base_dir: base_dir.to_path_buf(),
        }
    }

    /// Load all previously paired devices from the pairing store.
    ///
    /// These are devices that have completed the QR-code pairing flow.
    pub fn get_paired_peers(&self) -> Vec<PeerInfo> {
        load_pairings(&self.base_dir)
            .into_iter()
            .map(PeerInfo::from)
            .collect()
    }

    /// Discover peers on the local network using mDNS.
    ///
    /// This wraps the transport layer's discovery and maps results to `PeerInfo`.
    pub async fn discover_peers(&self) -> Vec<PeerInfo> {
        let transport = crate::sync_engine::transport::SyncTransport::new();
        match transport.discover_peers("_smemaster_sync._tcp.local.").await {
            Ok(discovered) => discovered
                .into_iter()
                .map(|p| PeerInfo {
                    device_id: p.device_id,
                    addr: Some(p.addr),
                    device_name: p.device_name,
                })
                .collect(),
            Err(e) => {
                log::warn!("[peer-manager] mDNS discovery failed: {e}");
                vec![]
            }
        }
    }
}