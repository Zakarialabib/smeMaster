use tauri::AppHandle;
use tauri::Manager;

pub fn spawn_domain_event_processor(app: &AppHandle) {
    let rx = app.state::<crate::events::EventBus>().subscribe();
    let pool = app.state::<sqlx::SqlitePool>().inner().clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut rx = rx;

        loop {
            match rx.recv().await {
                Ok(crate::events::AppEvent::EmailReceived { account_id, message_id, from_address, date }) => {
                    log::info!("[domain-event-processor] Updating last contacted for {}", from_address);
                    if let Err(e) = crate::db::tables::crm::contacts::update_last_contacted_by_email(&pool, &from_address, date).await {
                        log::warn!("[domain-event-processor] Failed to update contact date: {}", e);
                    }
                    // Invalidate and pre-warm the thread cache for the updated thread
                    if let Some(cache_service) = app_handle.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
                        cache_service.get_threads_cache().invalidate(&account_id, &message_id);
                        // Pre-warm: fetch the updated thread summary into cache
                        let _ = cache_service.get_threads_cache().get(&account_id, &message_id).await;
                        log::info!("[domain-event-processor] Thread cache invalidated and pre-warmed for {}/{}", account_id, message_id);
                    }
                }
                Ok(crate::events::AppEvent::ContactUpdated { contact_id }) => {
                    log::info!("[domain-event-processor] Contact updated: {}", contact_id);
                    if let Some(cache_service) = app_handle.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
                        cache_service.get_contacts_cache().invalidate(&contact_id);
                        cache_service.get_accounts_cache().invalidate(&contact_id);
                        // Contact labels may also have changed — invalidate label cache
                        cache_service.get_labels_cache().invalidate(&contact_id, "");
                        log::info!("[domain-event-processor] Contact, account, and label cache invalidated for {}", contact_id);
                    }
                }
                Ok(crate::events::AppEvent::TaskCompleted { task_id }) => {
                    log::info!("[domain-event-processor] Task completed: {}", task_id);
                    // Future: trigger automation rules, send notifications, etc.
                }
                Ok(crate::events::AppEvent::DeviceSyncComplete { device_id, docs_synced }) => {
                    log::info!("[domain-event-processor] Device sync complete: {} ({} docs)", device_id, docs_synced);
                    // Emit cache invalidation for synced domains
                    if let Some(bus) = app_handle.try_state::<crate::events::EventBus>() {
                        bus.emit(crate::events::AppEvent::CacheInvalidate {
                            domain: "contacts".to_string(),
                        });
                        bus.emit(crate::events::AppEvent::CacheInvalidate {
                            domain: "threads".to_string(),
                        });
                    }
                }
                Ok(crate::events::AppEvent::SyncDocumentConflict { doc_id, resolution }) => {
                    log::info!("[domain-event-processor] Sync conflict resolved for {}: {}", doc_id, resolution);
                }
                Ok(crate::events::AppEvent::CacheInvalidate { domain }) => {
                    log::debug!("[domain-event-processor] Cache invalidate requested for domain: {}", domain);
                    if let Some(cache_service) = app_handle.try_state::<std::sync::Arc<crate::data_cache::DataCacheService>>() {
                        match domain.as_str() {
                            "contacts" => cache_service.cache().invalidate(crate::data_cache::cache::CacheDomain::Contacts),
                            "accounts" => cache_service.cache().invalidate(crate::data_cache::cache::CacheDomain::Accounts),
                            "labels" => cache_service.cache().invalidate(crate::data_cache::cache::CacheDomain::Labels),
                            "threads" => cache_service.cache().invalidate(crate::data_cache::cache::CacheDomain::Threads),
                            _ => {
                                // Unknown domain, invalidate all
                                cache_service.cache().invalidate_all();
                            }
                        }
                        log::info!("[domain-event-processor] Cache invalidated for domain: {}", domain);
                    }
                }
                Ok(_) => {
                    // Ignore other events
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    log::warn!("[domain-event-processor] Lagged, dropped {} events", n);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    log::info!("[domain-event-processor] Channel closed, shutting down");
                    break;
                }
            }
        }
    });
}