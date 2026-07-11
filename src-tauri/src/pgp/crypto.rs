use crate::error::{self, SerializedError};

pub fn encrypt_message(plaintext: &str, public_key_armored: &str) -> Result<String, SerializedError> {
    use base64::Engine;
    use pgp::composed::{Deserializable, MessageBuilder, SignedPublicKey};
    use pgp::crypto::sym::SymmetricKeyAlgorithm;
    use rand::rngs::OsRng;

    let (pub_key, _) = SignedPublicKey::from_string(public_key_armored)
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Parse public key failed: {e}")))?;

    let content = plaintext.as_bytes().to_vec();
    let mut builder = MessageBuilder::from_bytes("", content)
        .seipd_v1(&mut OsRng, SymmetricKeyAlgorithm::AES256);

    builder
        .encrypt_to_key(&mut OsRng, &pub_key)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Encryption failed: {e}")))?;

    let encrypted_bytes = builder
        .to_vec(&mut OsRng)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Serialize encrypted message failed: {e}")))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted_bytes))
}

/// Encrypt raw bytes using a PGP public key, returning raw encrypted bytes (not base64).
pub fn encrypt_bytes(content: &[u8], public_key_armored: &str) -> Result<Vec<u8>, SerializedError> {
    use pgp::composed::{Deserializable, MessageBuilder, SignedPublicKey};
    use pgp::crypto::sym::SymmetricKeyAlgorithm;
    use rand::rngs::OsRng;

    let (pub_key, _) = SignedPublicKey::from_string(public_key_armored)
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Parse public key failed: {e}")))?;

    let content_vec = content.to_vec();
    let mut builder = MessageBuilder::from_bytes("", content_vec)
        .seipd_v1(&mut OsRng, SymmetricKeyAlgorithm::AES256);

    builder
        .encrypt_to_key(&mut OsRng, &pub_key)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Encryption failed: {e}")))?;

    builder
        .to_vec(&mut OsRng)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Serialize encrypted message failed: {e}")))
}

pub fn decrypt_message(
    ciphertext_b64: &str,
    private_key_armored: &str,
    passphrase: &str,
) -> Result<String, SerializedError> {
    use base64::Engine;
    use pgp::composed::{Deserializable, Message, SignedSecretKey};
    use pgp::types::Password;

    let (sec_key, _) = SignedSecretKey::from_string(private_key_armored)
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Parse private key failed: {e}")))?;

    let ciphertext_bytes = base64::engine::general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Failed to decode base64 ciphertext: {e}")))?;

    let enc_msg = Message::from_bytes(std::io::Cursor::new(&ciphertext_bytes))
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Parse message failed: {e}")))?;

    let pwd = Password::from(passphrase);
    let mut dec_msg = enc_msg
        .decrypt(&pwd, &sec_key)
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Decryption failed: {e}")))?;

    dec_msg
        .as_data_string()
        .map_err(|e| SerializedError::new(error::ERR_PARSE, format!("Decrypted data is not valid UTF-8: {e}")))
}

#[tauri::command]
pub async fn encrypt(plaintext: String, public_key_armored: String) -> Result<String, SerializedError> {
    tokio::task::spawn_blocking(move || encrypt_message(&plaintext, &public_key_armored))
        .await
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("Task panicked: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pgp::keyring::generate_key_pair;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let (public, private) = generate_key_pair("test@example.com", "").unwrap();
        let ciphertext = encrypt_message("Hello, PGP World!", &public).unwrap();
        let decrypted = decrypt_message(&ciphertext, &private, "").unwrap();
        assert_eq!(decrypted, "Hello, PGP World!");
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let (public_alice, _private_alice) = generate_key_pair("alice@example.com", "").unwrap();
        let (_public_bob, private_bob) = generate_key_pair("bob@example.com", "").unwrap();
        let ciphertext = encrypt_message("Secret for Alice", &public_alice).unwrap();

        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = tx.send(decrypt_message(&ciphertext, &private_bob, ""));
        });

        match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(Err(_)) => {}
            Ok(Ok(_)) => panic!("Expected decryption to fail but it succeeded"),
            Err(_) => {}
        }
    }
}
