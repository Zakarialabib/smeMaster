use std::sync::{Arc, Mutex as StdMutex};
use tauri::State;
use sysinfo::{System, Disks, Networks};
use tokio::sync::Mutex;

/// Hardware ID generation and binding system
/// Generates a stable hardware fingerprint based on system components
pub struct HardwareId {
    /// Cached hardware ID to avoid regenerating on every call.
    ///
    /// This is a `std::sync::Mutex` because it is only ever locked
    /// inside the synchronous [`HardwareId::generate_id`] and
    /// [`HardwareId::clear_cache`] methods — the lock is never held
    /// across an `.await` point, so the guard does not need to be
    /// `Send`. The *outer* managed-state wrapper in [`super::init`]
    /// is a `tokio::sync::Mutex`, which is what guarantees that the
    /// Tauri-command futures themselves are `Send`.
    cached_id: StdMutex<Option<String>>,
}

impl HardwareId {
    /// Create a new HardwareId instance
    pub fn new() -> Self {
        Self {
            cached_id: StdMutex::new(None),
        }
    }

    /// Generate a hardware ID based on system components
    /// This creates a stable fingerprint that should remain consistent
    /// across reboots but change significantly if hardware changes
    pub fn generate_id(&self) -> Result<String, String> {
        // Check if we already have a cached ID
        if let Some(cached) = self.cached_id.lock().unwrap().as_ref() {
            return Ok(cached.clone());
        }

        let mut system = System::new_all();
        system.refresh_all();

        // Collect various hardware identifiers
        let mut identifiers = Vec::new();

        // CPU information
        for cpu in system.cpus() {
            identifiers.push(format!("cpu:{}:{}", cpu.brand(), cpu.frequency()));
        }

        // Memory information
        identifiers.push(format!("memory:{}", system.total_memory()));

        // Motherboard/BIOS information is intentionally skipped in sysinfo 0.32
        // because the API was removed/renamed. The CPU + memory + disk + network
        // identifiers below still produce a stable fingerprint.

        // Disk information
        let disks = Disks::new_with_refreshed_list();
        for disk in &disks {
            if let Some(name) = disk.name().to_str() {
                identifiers.push(format!("disk_name:{name}"));
            }
            let fs = disk.file_system();
            if let Some(fs_str) = fs.to_str() {
                identifiers.push(format!("disk_fs:{fs_str}"));
            }
            if let Some(mount_point) = disk.mount_point().to_str() {
                identifiers.push(format!("disk_mount:{mount_point}"));
            }
        }

        // Network interface information (MAC addresses)
        let networks = Networks::new_with_refreshed_list();
        for (interface_name, data) in &networks {
            let mac = data.mac_address();
            identifiers.push(format!("net_mac:{interface_name}:{mac}"));
        }

        // Sort identifiers for consistent ordering
        identifiers.sort();
        identifiers.dedup();

        // Create a hash of all identifiers
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        for id in identifiers {
            hasher.update(id.as_bytes());
        }
        let result = hasher.finalize();
        let hardware_id = hex::encode(result);

        // Cache the hardware ID
        *self.cached_id.lock().unwrap() = Some(hardware_id.clone());

        Ok(hardware_id)
    }

    /// Clear the cached hardware ID (useful for testing)
    #[cfg(any(debug_assertions, test))]
    pub fn clear_cache(&self) {
        *self.cached_id.lock().unwrap() = None;
    }
}

/// Tauri command to get the hardware ID
#[tauri::command]
pub async fn get_hardware_id(state: State<'_, Arc<Mutex<HardwareId>>>) -> Result<String, String> {
    let hw_id = state.lock().await;
    hw_id.generate_id()
}

/// Tauri command to clear hardware ID cache (development only)
#[cfg(any(debug_assertions, test))]
#[tauri::command]
pub async fn clear_hardware_id_cache(state: State<'_, Arc<Mutex<HardwareId>>>) -> Result<(), String> {
    let hw_id = state.lock().await;
    hw_id.clear_cache();
    Ok(())
}