use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::{self, SerializedError};
use pgp::armor::{self, BlockType};
use pgp::composed::{KeyType, SecretKeyParamsBuilder, SignedPublicKey, SignedSecretKey, Deserializable};
use pgp::crypto::hash::HashAlgorithm;
use pgp::crypto::sym::SymmetricKeyAlgorithm;

use pgp::types::{CompressionAlgorithm, KeyDetails};
use rand::rngs::OsRng;
use smallvec::smallvec;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PgpKeyInfo {
    pub id: String,
    pub fingerprint: String,
    pub user_id: String,
    pub algorithm: String,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub is_revoked: bool,
}

/// Internal representation of a stored key in the keyring.
#[derive(Debug, Clone, Deserialize, Serialize)]
struct StoredKey {
    info: PgpKeyInfo,
    public_key_armored: String,
    private_key_armored: String,
    is_active: bool,
}

/// In-memory keyring store. Keys are indexed by fingerprint.
fn key_store() -> &'static Mutex<HashMap<String, StoredKey>> {
    static STORE: OnceLock<Mutex<HashMap<String, StoredKey>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn generate_key_pair(user_id: &str, _passphrase: &str) -> Result<(String, String), SerializedError> {
    let mut key_params = SecretKeyParamsBuilder::default();
    key_params
        .key_type(KeyType::Rsa(4096))
        .can_certify(true)
        .can_sign(true)
        .primary_user_id(user_id.into())
        .preferred_symmetric_algorithms(smallvec![SymmetricKeyAlgorithm::AES256])
        .preferred_hash_algorithms(smallvec![HashAlgorithm::Sha256])
        .preferred_compression_algorithms(smallvec![CompressionAlgorithm::ZLIB]);

    let secret_key_params = key_params
        .build()
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Key params build failed: {e}")))?;

    let signed_secret_key = secret_key_params
        .generate(OsRng)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Key generation failed: {e}")))?;

    // Export private key (transferable secret key) in armored format
    let private_armored = {
        let mut buf = Vec::new();
        armor::write(&signed_secret_key, BlockType::PrivateKey, &mut buf, None, true)
            .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Armor private key failed: {e}")))?;
        String::from_utf8(buf).map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Armor private key encoding: {e}")))?
    };

    // Export public key in armored format
    let signed_public_key = signed_secret_key.to_public_key();
    let public_armored = {
        let mut buf = Vec::new();
        armor::write(&signed_public_key, BlockType::PublicKey, &mut buf, None, true)
            .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Armor public key failed: {e}")))?;
        String::from_utf8(buf).map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Armor public key encoding: {e}")))?
    };

    Ok((public_armored, private_armored))
}

fn extract_key_info(
    user_ids: &[pgp::types::SignedUser],
    algorithm: String,
    created_at: u64,
    key_id: pgp::types::KeyId,
    fingerprint: pgp::types::Fingerprint,
) -> PgpKeyInfo {
    let user_id = user_ids
        .first()
        .map(|u| String::from_utf8_lossy(u.id.id()).to_string())
        .unwrap_or_default();

    PgpKeyInfo {
        id: format!("{}", key_id),
        fingerprint: hex::encode(fingerprint.as_bytes()),
        user_id,
        algorithm,
        created_at,
        expires_at: None,
        is_revoked: false,
    }
}

pub fn get_key_info(armored_key: &str) -> Result<PgpKeyInfo, SerializedError> {
    // Try public key first, then secret key
    if let Ok((pub_key, _)) = SignedPublicKey::from_string(armored_key) {
        let algorithm = format!("{:?}", pub_key.algorithm());
        let created_at = u64::from(pub_key.created_at().as_secs());

        return Ok(extract_key_info(
            &pub_key.details.users,
            algorithm,
            created_at,
            pub_key.legacy_key_id(),
            pub_key.fingerprint(),
        ));
    }

    if let Ok((sec_key, _)) = SignedSecretKey::from_string(armored_key) {
        let algorithm = format!("{:?}", sec_key.algorithm());
        let created_at = u64::from(sec_key.created_at().as_secs());

        return Ok(extract_key_info(
            &sec_key.details.users,
            algorithm,
            created_at,
            sec_key.legacy_key_id(),
            sec_key.fingerprint(),
        ));
    }

    Err(SerializedError::new(
        error::ERR_PARSE,
        "Failed to parse PGP key: not a valid armored key".to_string(),
    ))
}

/// Rotate a PGP key:
/// 1. Looks up the old key in the keyring by `key_id` (fingerprint).
/// 2. Copies metadata (user_id) from the old key.
/// 3. Generates a new key pair with the same user_id.
/// 4. Stores the new key in the keyring and marks the old key as inactive.
/// 5. Returns the new key's info.
pub fn rotate_key(key_id: &str, new_passphrase: &str) -> Result<PgpKeyInfo, SerializedError> {
    let store = key_store();
    let mut map = store.lock().map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Key store lock error: {}", e)))?;

    // Find the old key entry (search by key_id matching either id or fingerprint)
    let old_key_id = map
        .iter()
        .find(|(_, entry)| entry.info.id == key_id || entry.info.fingerprint == key_id)
        .map(|(k, _)| k.clone())
        .ok_or_else(|| SerializedError::new(error::ERR_NOT_FOUND, format!("Key not found in keyring: {}", key_id)))?;

    let old_entry = map
        .get_mut(&old_key_id)
        .ok_or_else(|| SerializedError::new(error::ERR_NOT_FOUND, format!("Key not found: {}", key_id)))?;

    // Copy user_id from old key
    let user_id = old_entry.info.user_id.clone();

    // Mark old key as inactive (preserved for backward compatibility)
    old_entry.is_active = false;

    // Generate new key pair
    let (public_armored, private_armored) = generate_key_pair(&user_id, new_passphrase)?;

    // Extract metadata from new key
    let new_info = get_key_info(&public_armored)?;

    // Store the new key
    let new_entry = StoredKey {
        info: new_info.clone(),
        public_key_armored: public_armored,
        private_key_armored: private_armored,
        is_active: true,
    };

    // Use fingerprint as the canonical store key
    let store_key = new_info.fingerprint.clone();
    map.insert(store_key, new_entry);

    log::info!(
        "[pgp] Rotated key '{}' → new fingerprint '{}'",
        key_id,
        new_info.fingerprint
    );

    Ok(new_info)
}

/// Return all keys in the keyring that are expiring within `days` days.
#[allow(dead_code)]
pub fn list_expiring_keys(days: u32) -> Vec<PgpKeyInfo> {
    let store = match key_store().lock() {
        Ok(map) => map,
        Err(_) => return Vec::new(),
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let cutoff = now + (days as u64 * 86_400);

    store
        .values()
        .filter(|entry| entry.is_active)
        .filter(|entry| {
            if let Some(exp) = entry.info.expires_at {
                exp > now && exp <= cutoff
            } else {
                false // no expiry set
            }
        })
        .map(|entry| entry.info.clone())
        .collect()
}

/// Get the expiry timestamp for a key (0 = never expires).
#[allow(dead_code)]
pub fn get_key_expiry(key_id: &str) -> Result<u64, SerializedError> {
    let store = key_store();
    let map = store.lock().map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Key store lock error: {}", e)))?;

    let entry = map
        .values()
        .find(|entry| entry.info.id == key_id || entry.info.fingerprint == key_id)
        .ok_or_else(|| SerializedError::new(error::ERR_NOT_FOUND, format!("Key not found: {}", key_id)))?;

    Ok(entry.info.expires_at.unwrap_or(0))
}

// ── Tauri commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn generate_key(user_id: String, passphrase: String) -> Result<(String, String), SerializedError> {
    generate_key_pair(&user_id, &passphrase)
}

#[tauri::command]
pub fn get_key_info_cmd(armored_key: String) -> Result<PgpKeyInfo, SerializedError> {
    get_key_info(&armored_key)
}

#[tauri::command]
pub fn rotate_pgp_key(key_id: String, new_passphrase: String) -> Result<PgpKeyInfo, SerializedError> {
    rotate_key(&key_id, &new_passphrase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_get_info() {
        let (public, _private) = generate_key_pair("test@example.com", "").unwrap();
        let info = get_key_info(&public).unwrap();
        assert!(!info.id.is_empty());
        assert!(!info.fingerprint.is_empty());
        assert!(!info.user_id.is_empty());
        assert!(!info.algorithm.is_empty());
        assert!(info.created_at > 0);
        assert_eq!(info.expires_at, None);
        assert!(!info.is_revoked);
    }

    #[test]
    fn test_rotate_key_and_preserve_old() {
        // First generate and store a key
        let (public, private) = generate_key_pair("alice@example.com", "old-pwd").unwrap();
        let info = get_key_info(&public).unwrap();

        // Manually insert into store (simulating prior keyring entry)
        let store = key_store();
        let mut map = store.lock().unwrap();
        map.insert(
            info.fingerprint.clone(),
            StoredKey {
                info: info.clone(),
                public_key_armored: public,
                private_key_armored: private,
                is_active: true,
            },
        );
        drop(map);

        // Rotate the key
        let new_info = rotate_key(&info.id, "new-pwd").unwrap();
        assert_ne!(new_info.id, info.id);
        assert_eq!(new_info.user_id, info.user_id);

        // Old key should be marked inactive
        let map = store.lock().unwrap();
        let old = map.get(&info.fingerprint).unwrap();
        assert!(!old.is_active);
    }

    #[test]
    fn test_rotate_key_not_found() {
        let result = rotate_key("nonexistent", "pwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_expiring_keys_empty() {
        let keys = list_expiring_keys(30);
        assert!(keys.len() <= 1);
    }

    #[test]
    fn test_get_key_expiry_never_expires() {
        let (public, _private) = generate_key_pair("nobody@example.com", "").unwrap();
        let info = get_key_info(&public).unwrap();

        let store = key_store();
        let mut map = store.lock().unwrap();
        map.insert(
            info.fingerprint.clone(),
            StoredKey {
                info: info.clone(),
                public_key_armored: public,
                private_key_armored: "unused".into(),
                is_active: true,
            },
        );
        drop(map);

        // Never-expires key returns 0
        let expiry = get_key_expiry(&info.id).unwrap();
        assert_eq!(expiry, 0);
    }

    #[test]
    fn test_get_key_expiry_not_found() {
        let result = get_key_expiry("deadbeef");
        assert!(result.is_err());
    }
}
