// ── Sync Transport — TCP-based P2P Communication ────────────────────────
//
// Handles low-level network communication between paired devices.
// Uses mDNS (via mdns-sd) for peer discovery and TCP streams for data.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;

use super::protocol::SyncMessage;

/// Information about a discovered peer device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub device_id: String,
    pub addr: SocketAddr,
    pub device_name: String,
}

/// An active TCP connection to a sync peer.
pub struct SyncConnection {
    stream: Arc<Mutex<TcpStream>>,
    peer_addr: SocketAddr,
}

impl SyncConnection {
    /// Wrap an existing TCP stream into a `SyncConnection`.
    pub fn new(stream: TcpStream) -> Self {
        let peer_addr = stream.peer_addr().unwrap_or_else(|_| "0.0.0.0:0".parse().unwrap());
        Self {
            stream: Arc::new(Mutex::new(stream)),
            peer_addr,
        }
    }

    /// Send a `SyncMessage` over the connection.
    ///
    /// Messages are length-prefixed JSON-encoded.
    pub async fn send(&self, msg: &SyncMessage) -> Result<()> {
        let data = serde_json::to_vec(msg).context("Failed to serialize SyncMessage")?;
        let len = data.len() as u32;
        let mut stream = self.stream.lock().await;
        stream
            .write_all(&len.to_be_bytes())
            .await
            .context("Failed to write message length")?;
        stream
            .write_all(&data)
            .await
            .context("Failed to write message body")?;
        Ok(())
    }

    /// Receive a `SyncMessage` from the connection.
    ///
    /// Blocks until a full message is received.
    pub async fn receive(&self) -> Result<SyncMessage> {
        let mut stream = self.stream.lock().await;
        let mut len_buf = [0u8; 4];
        stream
            .read_exact(&mut len_buf)
            .await
            .context("Failed to read message length")?;
        let len = u32::from_be_bytes(len_buf) as usize;

        let mut data = vec![0u8; len];
        stream
            .read_exact(&mut data)
            .await
            .context("Failed to read message body")?;

        let msg: SyncMessage =
            serde_json::from_slice(&data).context("Failed to deserialize SyncMessage")?;
        Ok(msg)
    }

    /// The remote peer's socket address.
    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }
}

/// TCP-based transport layer with mDNS peer discovery.
pub struct SyncTransport {
    /// Optional TCP listener for incoming connections.
    listener: Arc<Mutex<Option<TcpListener>>>,
    /// mDNS service daemon for peer discovery.
    mdns: Arc<Mutex<Option<mdns_sd::ServiceDaemon>>>,
}

impl SyncTransport {
    /// Create a new `SyncTransport` (no listener bound yet).
    pub fn new() -> Self {
        Self {
            listener: Arc::new(Mutex::new(None)),
            mdns: Arc::new(Mutex::new(None)),
        }
    }

    /// Start listening for incoming TCP connections on the given port.
    ///
    /// Also registers an mDNS service for discoverability.
    pub async fn start_listener(&self, port: u16, service_type: &str, device_name: &str) -> Result<()> {
        let addr: SocketAddr = format!("0.0.0.0:{port}")
            .parse()
            .context("Invalid listen address")?;
        let listener = TcpListener::bind(addr)
            .await
            .context("Failed to bind TCP listener")?;
        log::info!("[sync-transport] Listening on {}", addr);

        // Register mDNS service
        match mdns_sd::ServiceDaemon::new() {
            Ok(mdns) => {
                let txt_props = vec![("path".to_string(), "/".to_string())];
                let service_info = mdns_sd::ServiceInfo::new(
                    service_type,
                    device_name,
                    "local",
                    "",
                    port,
                    txt_props.as_slice(),
                );
                if let Ok(info) = service_info {
                    if let Err(e) = mdns.register(info) {
                        log::warn!("[sync-transport] Failed to register mDNS service: {e}");
                    } else {
                        log::info!("[sync-transport] mDNS service registered: {service_type}");
                    }
                }
                *self.mdns.lock().await = Some(mdns);
            }
            Err(e) => {
                log::warn!("[sync-transport] Failed to start mDNS daemon: {e}");
            }
        }

        *self.listener.lock().await = Some(listener);
        Ok(())
    }

    /// Accept an incoming TCP connection.
    ///
    /// Returns `None` if no listener is bound.
    pub async fn accept(&self) -> Option<SyncConnection> {
        let listener_guard = self.listener.lock().await;
        match listener_guard.as_ref() {
            Some(listener) => match listener.accept().await {
                Ok((stream, addr)) => {
                    log::info!("[sync-transport] Accepted connection from {addr}");
                    Some(SyncConnection::new(stream))
                }
                Err(e) => {
                    log::warn!("[sync-transport] Failed to accept connection: {e}");
                    None
                }
            },
            None => {
                log::warn!("[sync-transport] No listener bound, cannot accept");
                None
            }
        }
    }

    /// Discover peers on the local network using mDNS.
    ///
    /// Returns a list of discovered `PeerInfo` entries.
    pub async fn discover_peers(&self, service_type: &str) -> Result<Vec<PeerInfo>> {
        let mut peers = Vec::new();

        match mdns_sd::ServiceDaemon::new() {
            Ok(mdns) => {
                let receiver = mdns.browse(service_type).context("Failed to browse mDNS service")?;
                // Give mDNS a short time to discover peers
                let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(3);
                while tokio::time::Instant::now() < deadline {
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    while let Ok(event) = receiver.try_recv() {
                        match event {
                            mdns_sd::ServiceEvent::ServiceResolved(info) => {
                                for addr in info.get_addresses().iter() {
                                    let sa = std::net::SocketAddr::new(*addr, info.get_port());
                                    peers.push(PeerInfo {
                                        device_id: info.get_fullname().to_string(),
                                        addr: sa,
                                        device_name: info.get_hostname().to_string(),
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
                // Drop the daemon to stop browsing
                drop(mdns);
            }
            Err(e) => {
                log::warn!("[sync-transport] mDNS discovery error: {e}");
            }
        }

        Ok(peers)
    }

    /// Connect to a peer at the given address.
    pub async fn connect(&self, addr: SocketAddr) -> Result<SyncConnection> {
        let stream = TcpStream::connect(addr)
            .await
            .context(format!("Failed to connect to {addr}"))?;
        log::info!("[sync-transport] Connected to {addr}");
        Ok(SyncConnection::new(stream))
    }
}

impl Default for SyncTransport {
    fn default() -> Self {
        Self::new()
    }
}