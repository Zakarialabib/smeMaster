//! Periodic heartbeat emission on the global [`EventBus`].
//!
//! [`spawn_heartbeat`] runs a background task that emits a [`Heartbeat`]
//! event every `interval_secs` seconds so connected subscribers (frontend,
//! domain-event processor, etc.) can tell the backend is alive.

use crate::events::{AppEvent, EventBus};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

/// Global kill switch for the heartbeat loop.
static HEARTBEAT_STOP: AtomicBool = AtomicBool::new(false);

/// Signal the heartbeat loop to stop.
pub fn signal_stop() {
    HEARTBEAT_STOP.store(true, Ordering::SeqCst);
}

/// Reset the stop signal (for tests or restart).
pub fn reset_stop() {
    HEARTBEAT_STOP.store(false, Ordering::SeqCst);
}

/// Spawn a background task that emits a [`AppEvent::Heartbeat`] on the
/// given [`EventBus`] every `interval_secs` seconds.
///
/// Returns an `Arc<Notify>` that can be awaited for shutdown coordination
/// (the notify is triggered once the loop exits).
pub fn spawn_heartbeat(
    event_bus: EventBus,
    interval_secs: u64,
) -> Arc<Notify> {
    let done = Arc::new(Notify::new());
    let done_clone = done.clone();

    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            if HEARTBEAT_STOP.load(Ordering::SeqCst) {
                log::info!("[heartbeat] Stop signal received — exiting");
                break;
            }

            interval.tick().await;

            if HEARTBEAT_STOP.load(Ordering::SeqCst) {
                log::info!("[heartbeat] Stop signal received — exiting");
                break;
            }

            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            event_bus.emit(AppEvent::Heartbeat { timestamp: ts });
            log::trace!("[heartbeat] emitted @ {ts}");
        }

        done_clone.notify_waiters();
    });

    done
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::Duration;

    #[tokio::test]
    async fn test_heartbeat_emits_events() {
        reset_stop();

        let (bus, mut rx) = EventBus::new(100);
        let _done = spawn_heartbeat(bus.clone(), 1);

        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                match rx.recv().await {
                    Ok(AppEvent::Heartbeat { .. }) => break,
                    Ok(_) => continue,
                    Err(_) => panic!("channel error"),
                }
            }
        })
        .await
        .expect("Should receive a heartbeat within 3s");

        signal_stop();
    }
}
