// ── CRDT Sync Engine ──────────────────────────────────────────────────────
//
// Phase 2 of the Data Layer Evolution: A CRDT-based sync engine that
// replaces the JSON-file sync layer with automerge-backed documents
// stored in SQLite, with TCP-based P2P transport and mDNS discovery.
//
// Architecture:
//   SyncEngineService (Service trait) → SyncEngine (core logic)
//     → SyncStorage (SQLite persistence)
//     → SyncTransport (TCP + mDNS)
//     → SyncDocument (automerge CRDT)

pub mod document;
pub mod migration;
pub mod peer;
pub mod protocol;
pub mod storage;
pub mod transport;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::RwLock;

use crate::orchestrator::service::{HealthStatus, Service};

use self::document::SyncDocument;
use self::storage::SyncStorage;
use self::transport::SyncTransport;

/// Core sync engine logic, wrapped by `SyncEngineService`.
pub struct SyncEngine {
    storage: SyncStorage,
    transport: SyncTransport,
    /// In-memory cache of loaded documents (doc_id → SyncDocument).
    documents: RwLock<HashMap<String, SyncDocument>>,
    /// Flag indicating whether the background sync loop is active.
    running: AtomicBool,
}

impl SyncEngine {
    /// Create a new `SyncEngine` with the given storage and transport.
    pub fn new(storage: SyncStorage, transport: SyncTransport) -> Self {
        Self {
            storage,
            transport,
            documents: RwLock::new(HashMap::new()),
            running: AtomicBool::new(false),
        }
    }

    /// Load all documents from SQLite into memory.
    pub async fn load_all(&self) -> Result<()> {
        let doc_ids = self.storage.list_documents().await?;
        let mut docs = self.documents.write().await;
        for doc_id in &doc_ids {
            if let Ok(Some(doc)) = self.storage.load_document(doc_id).await {
                docs.insert(doc_id.clone(), doc);
            }
        }
        log::info!("[sync-engine] Loaded {} documents from storage", docs.len());
        Ok(())
    }

    /// Save all in-memory documents back to SQLite.
    pub async fn save_all(&self) -> Result<()> {
        let mut docs = self.documents.write().await;
        let count = docs.len();
        for doc in docs.values_mut() {
            self.storage.save_document(doc).await?;
        }
        log::info!("[sync-engine] Saved {count} documents to storage");
        Ok(())
    }

    /// Get or create a document by ID.
    pub async fn get_or_create_document(&self, doc_id: &str) -> Result<SyncDocument> {
        let mut docs = self.documents.write().await;
        if docs.contains_key(doc_id) {
            // Return a clone by saving and reloading
            let doc = docs.get_mut(doc_id).expect("doc must exist");
            let bytes = doc.save();
            return SyncDocument::load(doc_id, &bytes);
        }

        // Check storage
        if let Some(doc) = self.storage.load_document(doc_id).await? {
            docs.insert(doc_id.to_string(), doc);
            let doc = docs.get_mut(doc_id).expect("doc must exist");
            let bytes = doc.save();
            return SyncDocument::load(doc_id, &bytes);
        }

        // Create new
        let doc = SyncDocument::new(doc_id);
        docs.insert(doc_id.to_string(), doc);
        let doc = docs.get_mut(doc_id).expect("doc must exist");
        let bytes = doc.save();
        SyncDocument::load(doc_id, &bytes)
    }

    /// Set a value on a document, saving to storage.
    pub async fn set_value(&self, doc_id: &str, key: &str, value: &str) -> Result<()> {
        let mut docs = self.documents.write().await;
        if !docs.contains_key(doc_id) {
            let existing = self.storage.load_document(doc_id).await
                .ok().flatten()
                .unwrap_or_else(|| SyncDocument::new(doc_id));
            docs.insert(doc_id.to_string(), existing);
        }
        let doc = docs.get_mut(doc_id).expect("Document should exist after insert");
        doc.set(key, value);
        self.storage.save_document(doc).await?;
        Ok(())
    }

    /// Get a value from a document (returns a scalar JSON-friendly representation).
    pub async fn get_value_string(&self, doc_id: &str, key: &str) -> Option<String> {
        let docs = self.documents.read().await;
        let doc = docs.get(doc_id)?;
        let val = doc.get(key)?;
        Some(format!("{:?}", val))
    }

    /// Merge a remote document (received from a peer) into the local one.
    pub async fn merge_document(&self, remote: &mut SyncDocument) -> Result<u64> {
        let doc_id = remote.doc_id().to_string();
        let mut docs = self.documents.write().await;
        if !docs.contains_key(&doc_id) {
            let existing = self.storage.load_document(&doc_id).await
                .ok().flatten()
                .unwrap_or_else(|| SyncDocument::new(&doc_id));
            docs.insert(doc_id.clone(), existing);
        }
        let local = docs.get_mut(&doc_id).expect("Document should exist after insert");
        let count = local.merge(remote)?;
        if count > 0 {
            self.storage.save_document(local).await?;
        }
        Ok(count)
    }

    /// Access the storage layer.
    pub fn storage(&self) -> &SyncStorage {
        &self.storage
    }

    /// Access the transport layer.
    pub fn transport(&self) -> &SyncTransport {
        &self.transport
    }

    /// Whether the engine is running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

/// Tauri-managed service wrapping the `SyncEngine`.
///
/// Registered as an AlwaysOn service in the orchestrator.
pub struct SyncEngineService {
    engine: Arc<SyncEngine>,
    app_handle: AppHandle,
    pool: SqlitePool,
    running: Arc<AtomicBool>,
}

impl SyncEngineService {
    pub fn new(app_handle: AppHandle, pool: SqlitePool) -> Self {
        let storage = SyncStorage::new(pool.clone());
        let transport = SyncTransport::new();
        let engine = Arc::new(SyncEngine::new(storage, transport));
        Self {
            engine,
            app_handle,
            pool,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Access the underlying `SyncEngine`.
    pub fn engine(&self) -> &Arc<SyncEngine> {
        &self.engine
    }

    /// Access the database connection pool (used for reconnection / diagnostics).
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Run the one-time migration from JSON sync log.
    pub async fn run_migration(app: &AppHandle, pool: &SqlitePool) {
        match migration::migrate_from_json_log(app, pool).await {
            Ok(()) => log::info!("[sync-engine] Migration completed successfully"),
            Err(e) => log::warn!("[sync-engine] Migration failed (non-fatal): {e}"),
        }
    }
}

#[async_trait]
impl Service for SyncEngineService {
    fn name(&self) -> &'static str {
        "sync_engine"
    }

    fn priority(&self) -> u32 {
        45 // After data_cache (20), before sync (50)
    }

    fn is_critical(&self) -> bool {
        false // Engine is non-critical — app works without it, just no P2P sync
    }

    async fn init(&self) -> Result<()> {
        log::info!("[sync-engine] Initializing CRDT sync engine");
        self.engine.load_all().await?;
        log::info!("[sync-engine] Documents loaded from storage");
        Ok(())
    }

    async fn start(&self) -> Result<()> {
        self.running.store(true, Ordering::SeqCst);
        log::info!("[sync-engine] Sync engine started");

        // Start the background sync loop in a spawned task
        let engine = self.engine.clone();
        let handle = self.app_handle.clone();
        let running = self.running.clone();

        tauri::async_runtime::spawn(async move {
            log::info!("[sync-engine] Background sync loop started");
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            while running.load(Ordering::SeqCst) {
                interval.tick().await;

                // Periodic save of all documents
                if let Err(e) = engine.save_all().await {
                    log::warn!("[sync-engine] Background save failed: {e}");
                }

                // Emit heartbeat event
                if let Some(bus) = handle.try_state::<crate::events::EventBus>() {
                    bus.emit(crate::events::AppEvent::Heartbeat {
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    });
                }
            }
            log::info!("[sync-engine] Background sync loop stopped");
        });

        Ok(())
    }

    async fn stop(&self) -> Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[sync-engine] Saving all documents before shutdown...");
        self.engine.save_all().await?;
        log::info!("[sync-engine] Sync engine stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        if self.running.load(Ordering::SeqCst) {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded("Sync engine is not running".into())
        }
    }
}