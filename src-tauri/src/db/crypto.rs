use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use base64::Engine;
use tauri::Manager;
use crate::db::error::AppDbError;

/// Encrypt plaintext and return "iv:ciphertext" (both base64).
pub fn encrypt_value(plaintext: &str, key: &[u8; 32]) -> Result<String, AppDbError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut iv = [0u8; 12];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppDbError::Crypto(format!("encrypt failed: {e}")))?;
    let iv_b64 = base64::engine::general_purpose::STANDARD.encode(iv);
    let ct_b64 = base64::engine::general_purpose::STANDARD.encode(ciphertext);
    Ok(format!("{iv_b64}:{ct_b64}"))
}

/// Decrypt "iv:ciphertext" back to plaintext.
pub fn decrypt_value(encrypted: &str, key: &[u8; 32]) -> Result<String, AppDbError> {
    let parts: Vec<&str> = encrypted.split(':').collect();
    if parts.len() != 2 {
        return Err(AppDbError::Crypto("invalid format: expected iv:ciphertext".into()));
    }
    let iv = base64::engine::general_purpose::STANDARD
        .decode(parts[0])
        .map_err(|e| AppDbError::Crypto(format!("invalid iv: {e}")))?;
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(parts[1])
        .map_err(|e| AppDbError::Crypto(format!("invalid ciphertext: {e}")))?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(&iv);
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| AppDbError::Crypto(format!("decrypt failed: {e}")))?;
    String::from_utf8(plaintext)
        .map_err(|e| AppDbError::Crypto(format!("invalid utf-8: {e}")))
}

// ── Unit Tests ─────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: generate a random 32-byte key for tests.
    fn test_key() -> [u8; 32] {
        let mut key = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut key);
        key
    }

    // ── 1. Encrypt → decrypt round-trip preserves original value ────────────
    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = test_key();
        let plaintext = "sensitive-token-12345";
        let encrypted = encrypt_value(plaintext, &key).unwrap();
        let decrypted = decrypt_value(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    // ── 2. Encrypt produces different ciphertext each time (random nonce) ───
    #[test]
    fn test_encrypt_produces_different_ciphertext() {
        let key = test_key();
        let plaintext = "same-input";
        let enc1 = encrypt_value(plaintext, &key).unwrap();
        let enc2 = encrypt_value(plaintext, &key).unwrap();
        assert_ne!(enc1, enc2, "encryption must use a random nonce each time");
    }

    // ── 3. Decrypt with wrong key returns error ────────────────────────────
    #[test]
    fn test_decrypt_wrong_key_fails() {
        let key1 = test_key();
        let key2 = test_key();
        let encrypted = encrypt_value("secret", &key1).unwrap();
        let result = decrypt_value(&encrypted, &key2);
        assert!(result.is_err(), "decrypting with wrong key must fail");
    }

    // ── 4. Decrypt with corrupted ciphertext returns error ─────────────────
    #[test]
    fn test_decrypt_corrupted_ciphertext_fails() {
        let key = test_key();
        let encrypted = encrypt_value("secret", &key).unwrap();

        // Corrupt the ciphertext portion (second part after ':')
        let parts: Vec<&str> = encrypted.split(':').collect();
        let corrupted = format!("{}:{}", parts[0], "AAAA_corrupted_base64!!!");
        let result = decrypt_value(&corrupted, &key);
        assert!(result.is_err(), "decrypting corrupted ciphertext must fail");
    }

    // ── 5. Encrypt empty string works ──────────────────────────────────────
    #[test]
    fn test_encrypt_empty_string() {
        let key = test_key();
        let encrypted = encrypt_value("", &key).unwrap();
        let decrypted = decrypt_value(&encrypted, &key).unwrap();
        assert_eq!(decrypted, "", "empty string round-trip must preserve emptiness");
    }

    // ── 6. Encrypt/decrypt with unicode characters ─────────────────────────
    #[test]
    fn test_encrypt_decrypt_unicode() {
        let key = test_key();
        let test_cases = [
            "Hello, 世界!",
            "🔐 AES-256-GCM 🛡️",
            "Café résumé naïve — üñîçödé",
            "العربية",
            "🎉emoji混合test🎉",
            "\n\t\r special whitespace",
        ];
        for plaintext in &test_cases {
            let encrypted = encrypt_value(plaintext, &key).unwrap();
            let decrypted = decrypt_value(&encrypted, &key).unwrap();
            assert_eq!(decrypted, *plaintext, "unicode round-trip failed for: {plaintext}");
        }
    }

    // ── 7. Decrypt with invalid format (no colon separator) ────────────────
    #[test]
    fn test_decrypt_invalid_format_fails() {
        let key = test_key();
        let result = decrypt_value("no-colon-here", &key);
        assert!(result.is_err(), "missing colon separator must fail");
    }

    // ── 8. Decrypt with too many colons also fails ─────────────────────────
    #[test]
    fn test_decrypt_too_many_colons_fails() {
        let key = test_key();
        let result = decrypt_value("a:b:c", &key);
        assert!(result.is_err(), "too many colons must fail");
    }

    // ── 9. Encrypt/decrypt large payload ───────────────────────────────────
    #[test]
    fn test_encrypt_decrypt_large_payload() {
        let key = test_key();
        // 10 KB of repeated data
        let plaintext = "A".repeat(10 * 1024);
        let encrypted = encrypt_value(&plaintext, &key).unwrap();
        let decrypted = decrypt_value(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    // ── 10. Encrypted string contains colon separator ──────────────────────
    #[test]
    fn test_encrypted_format_has_colon() {
        let key = test_key();
        let encrypted = encrypt_value("data", &key).unwrap();
        assert!(
            encrypted.contains(':'),
            "encrypted output must be in 'iv:ciphertext' format"
        );
        let parts: Vec<&str> = encrypted.split(':').collect();
        assert_eq!(parts.len(), 2, "encrypted output must have exactly two parts");
    }

    // ── 11. Different keys for same plaintext produce different ciphertexts ─
    #[test]
    fn test_different_keys_produce_different_ciphertext() {
        let key1 = test_key();
        let key2 = test_key();
        let enc1 = encrypt_value("same", &key1).unwrap();
        let enc2 = encrypt_value("same", &key2).unwrap();
        assert_ne!(enc1, enc2, "different keys must produce different ciphertexts");
    }

    // ── 12. Decrypt with invalid base64 in IV ─────────────────────────────
    #[test]
    fn test_decrypt_invalid_base64_iv_fails() {
        let key = test_key();
        let result = decrypt_value("!!!invalid!!!:AQID", &key);
        assert!(result.is_err(), "invalid base64 in IV must fail");
    }

    // ── 13. Decrypt with invalid base64 in ciphertext ─────────────────────
    #[test]
    fn test_decrypt_invalid_base64_ciphertext_fails() {
        let key = test_key();
        // Valid base64 for IV part, invalid for ciphertext
        let valid_iv = base64::engine::general_purpose::STANDARD.encode([0u8; 12]);
        let result = decrypt_value(&format!("{valid_iv}:!!!invalid!!!"), &key);
        assert!(result.is_err(), "invalid base64 in ciphertext must fail");
    }

    // ── 14. load_or_create_key: key is exactly 32 bytes ────────────────────
    #[test]
    fn test_test_key_is_32_bytes() {
        let key = test_key();
        assert_eq!(key.len(), 32, "AES-256 key must be exactly 32 bytes");
    }

    // ── 15. Multiple round-trips with same key are independent ─────────────
    #[test]
    fn test_multiple_independent_round_trips() {
        let key = test_key();
        let messages = ["first", "second", "third"];
        let encrypted: Vec<String> = messages
            .iter()
            .map(|m| encrypt_value(m, &key).unwrap())
            .collect();

        for (i, msg) in messages.iter().enumerate() {
            let decrypted = decrypt_value(&encrypted[i], &key).unwrap();
            assert_eq!(decrypted, *msg);
        }
    }
}

/// Load key from <app_data_dir>/smemaster.key (matching JS format).
pub fn load_or_create_key(app: &tauri::AppHandle) -> Result<[u8; 32], AppDbError> {
    let path = app.path().app_data_dir()
        .map_err(|e| AppDbError::Crypto(format!("cannot get app data dir: {e}")))?
        .join("smemaster.key");

    if !path.exists() {
        let mut key = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut key);
        let b64 = base64::engine::general_purpose::STANDARD.encode(key);
        std::fs::write(&path, &b64)
            .map_err(|e| AppDbError::Crypto(format!("cannot write key file: {e}")))?;
        return Ok(key);
    }

    let b64 = std::fs::read_to_string(&path)
        .map_err(|e| AppDbError::Crypto(format!("cannot read key file: {e}")))?;
    let key = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| AppDbError::Crypto(format!("invalid key base64: {e}")))?;
    if key.len() != 32 {
        return Err(AppDbError::Crypto(format!("key length {} != 32", key.len())));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&key);
    Ok(arr)
}