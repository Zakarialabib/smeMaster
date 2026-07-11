use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Builder, Wry};

/// Register all command handlers with the Tauri builder.
///
/// NOTE: This module's #[tauri::command] functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// Each module's `register()` is now a no-op pass-through because
/// Tauri v2 keeps only the LAST `invoke_handler(...)` call — calling
/// it here would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingToken {
    pub token: String,
    pub device_name: String,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedDevice {
    pub id: String,
    pub device_name: String,
    pub device_type: String,
    pub token_hash: String,
    pub paired_at: u64,
    pub last_seen_at: u64,
    pub is_active: bool,
}

pub fn generate_pairing_token(device_name: &str) -> PairingToken {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let raw = format!("{}:{}:{}", device_name, now, fast_random_string(16));
    let token = base64_encode(&raw);

    PairingToken {
        token,
        device_name: device_name.to_string(),
        created_at: now,
        expires_at: now + 300,
    }
}

pub fn verify_and_pair(token: &str, device_type: &str) -> Result<PairedDevice, String> {
    let decoded = base64_decode(token).ok_or("Invalid token format")?;
    let parts: Vec<&str> = decoded.split(':').collect();
    if parts.len() < 3 {
        return Err("Invalid token structure".into());
    }

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let created_at: u64 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);

    if now > created_at + 300 {
        return Err("Token expired".into());
    }

    Ok(PairedDevice {
        id: format!("dev_{}", fast_random_string(8)),
        device_name: parts[0].to_string(),
        device_type: device_type.to_string(),
        token_hash: simple_hash(token),
        paired_at: now,
        last_seen_at: now,
        is_active: true,
    })
}

pub fn qr_payload(token: &PairingToken) -> String {
    serde_json::json!({
        "v": 1,
        "t": token.token,
        "d": token.device_name,
    }).to_string()
}

fn fast_random_string(len: usize) -> String {
    let seed = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz0123456789".chars().collect();
    let mut rng = seed;
    (0..len).map(|_| {
        rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        chars[(rng as usize) % chars.len()]
    }).collect()
}

fn base64_encode(data: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data.as_bytes())
}

fn base64_decode(data: &str) -> Option<String> {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(data.as_bytes())
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
}

fn simple_hash(data: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[tauri::command]
pub fn generate_qr_token(device_name: String) -> PairingToken {
    generate_pairing_token(&device_name)
}

#[tauri::command]
pub fn verify_device_token(token: String, device_type: String) -> Result<PairedDevice, String> {
    verify_and_pair(&token, &device_type)
}

#[tauri::command]
pub fn get_qr_payload(token: PairingToken) -> String {
    qr_payload(&token)
}
