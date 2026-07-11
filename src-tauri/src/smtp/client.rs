use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use lettre::{
    transport::smtp::{
        authentication::{Credentials, Mechanism},
        client::{Tls, TlsParametersBuilder},
    },
    AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tokio::time::timeout;

use super::types::{SmtpConfig, SmtpSendResult};
use crate::bail;
use crate::error::{SerializedError, ERR_INTERNAL, ERR_PARSE, ERR_TIMEOUT};

/// Decode a base64url-encoded string (Gmail format) to raw bytes.
fn decode_base64url(input: &str) -> Result<Vec<u8>, SerializedError> {
    URL_SAFE_NO_PAD
        .decode(input)
        .map_err(|e| SerializedError::new(ERR_PARSE, format!("Base64 decode error: {}", e)))
}

/// Generate a hash key for an SMTP config to use as a pool key.
fn config_hash(config: &SmtpConfig) -> u64 {
    let mut hasher = DefaultHasher::new();
    config.host.hash(&mut hasher);
    config.port.hash(&mut hasher);
    config.security.hash(&mut hasher);
    config.username.hash(&mut hasher);
    config.auth_method.hash(&mut hasher);
    hasher.finish()
}

/// Global SMTP connection pool keyed by config hash.
fn smtp_pool() -> &'static Mutex<HashMap<u64, AsyncSmtpTransport<Tokio1Executor>>> {
    static POOL: OnceLock<Mutex<HashMap<u64, AsyncSmtpTransport<Tokio1Executor>>>> =
        OnceLock::new();
    POOL.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Port/security mapping:
///   - Port 587 → use STARTTLS (security: "starttls"): `starttls_relay()`
///   - Port 465 → use implicit TLS (security: "tls"): `.relay()`
///   - Port 25  → use no encryption (security: "none"): `builder_dangerous()`
fn build_standalone_transport(
    config: &SmtpConfig,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, SerializedError> {
    let credentials = Credentials::new(config.username.clone(), config.password.clone());

    let auth_mechanisms = if config.auth_method == "oauth2" {
        vec![Mechanism::Xoauth2]
    } else {
        vec![Mechanism::Plain, Mechanism::Login]
    };

    let transport_timeout = config.timeout_secs.map(Duration::from_secs);

    match config.security.as_str() {
        "tls" => {
            let mut builder = AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
                .map_err(|e| {
                    SerializedError::new(ERR_INTERNAL, format!("SMTP relay error: {}", e))
                })?
                .port(config.port)
                .credentials(credentials)
                .authentication(auth_mechanisms);

            if let Some(timeout) = transport_timeout {
                builder = builder.timeout(Some(timeout));
            }

            if config.accept_invalid_certs {
                let tls_params = TlsParametersBuilder::new(config.host.clone())
                    .dangerous_accept_invalid_certs(true)
                    .dangerous_accept_invalid_hostnames(true)
                    .build()
                    .map_err(|e| {
                        SerializedError::new(
                            ERR_INTERNAL,
                            format!("SMTP TLS params error: {}", e),
                        )
                    })?;
                builder = builder.tls(Tls::Required(tls_params));
            }

            Ok(builder.build())
        }
        "starttls" => {
            let mut builder =
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
                    .map_err(|e| {
                        SerializedError::new(
                            ERR_INTERNAL,
                            format!("SMTP STARTTLS error: {}", e),
                        )
                    })?
                    .port(config.port)
                    .credentials(credentials)
                    .authentication(auth_mechanisms);

            if let Some(timeout) = transport_timeout {
                builder = builder.timeout(Some(timeout));
            }

            if config.accept_invalid_certs {
                let tls_params = TlsParametersBuilder::new(config.host.clone())
                    .dangerous_accept_invalid_certs(true)
                    .dangerous_accept_invalid_hostnames(true)
                    .build()
                    .map_err(|e| {
                        SerializedError::new(
                            ERR_INTERNAL,
                            format!("SMTP TLS params error: {}", e),
                        )
                    })?;
                builder = builder.tls(Tls::Required(tls_params));
            }

            Ok(builder.build())
        }
        _ => {
            let mut builder =
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                    .port(config.port)
                    .credentials(credentials)
                    .authentication(auth_mechanisms);

            if let Some(timeout) = transport_timeout {
                builder = builder.timeout(Some(timeout));
            }

            Ok(builder.build())
        }
    }
}

/// Build or retrieve a cached SMTP transport from the global pool.
/// Uses the Entry API for atomic get‑or‑insert, preventing duplicate connections.
fn get_or_create_transport(
    config: &SmtpConfig,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, SerializedError> {
    let hash = config_hash(config);

    let mut pool = smtp_pool()
        .lock()
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Pool lock poisoned: {}", e)))?;

    if let Some(transport) = pool.get(&hash) {
        return Ok(transport.clone());
    }

    let transport = build_standalone_transport(config)?;
    pool.entry(hash).or_insert(transport.clone());
    Ok(transport)
}

/// Extract an SMTP envelope (sender + recipients) from raw RFC 2822 bytes.
fn extract_envelope(raw: &[u8]) -> Result<lettre::address::Envelope, SerializedError> {
    let message = mail_parser::MessageParser::default()
        .parse(raw)
        .ok_or_else(|| {
            SerializedError::new(ERR_PARSE, "Failed to parse email for envelope extraction")
        })?;

    let from = message
        .from()
        .and_then(|list| list.first())
        .and_then(|addr| addr.address())
        .ok_or_else(|| SerializedError::new(ERR_PARSE, "No From address found in email"))?;

    let from_addr: lettre::Address = from.parse().map_err(|e| {
        SerializedError::new(ERR_PARSE, format!("Invalid From address '{}': {}", from, e))
    })?;

    let mut recipients: Vec<lettre::Address> = Vec::new();

    for addrs in [message.to(), message.cc(), message.bcc()] {
        if let Some(list) = addrs {
            for addr in list.iter() {
                if let Some(email) = addr.address() {
                    if let Ok(a) = email.parse::<lettre::Address>() {
                        recipients.push(a);
                    }
                }
            }
        }
    }

    if recipients.is_empty() {
        bail!(ERR_PARSE, "No recipients found in email");
    }

    lettre::address::Envelope::new(Some(from_addr), recipients)
        .map_err(|e| SerializedError::new(ERR_PARSE, format!("Envelope error: {}", e)))
}

/// Determine whether an SMTP error is permanent (5xx) and should NOT be retried.
fn is_permanent_smtp_error(e: &lettre::transport::smtp::Error) -> bool {
    e.is_permanent()
}

/// Send a pre-built RFC 2822 email via SMTP with timeout and retry logic.
pub async fn send_raw_email(
    config: &SmtpConfig,
    raw_email_base64url: &str,
) -> Result<SmtpSendResult, SerializedError> {
    let raw_bytes = decode_base64url(raw_email_base64url)?;
    let envelope = extract_envelope(&raw_bytes)?;

    let timeout_duration = Duration::from_secs(config.timeout_secs.unwrap_or(30));
    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 0..=max_retries {
        if attempt > 0 {
            let delay = Duration::from_secs(1 << (attempt - 1));
            tokio::time::sleep(delay).await;
            let hash = config_hash(config);
            if let Ok(mut pool) = smtp_pool().lock() {
                pool.remove(&hash);
            }
        }

        let transport = get_or_create_transport(config)?;
        let hash = config_hash(config);

        let result = tokio::time::timeout(timeout_duration, transport.send_raw(&envelope, &raw_bytes)).await;

        match result {
            Ok(Ok(_response)) => {
                return Ok(SmtpSendResult {
                    success: true,
                    message: "Email sent successfully".to_string(),
                });
            }
            Ok(Err(e)) => {
                last_error = format!("SMTP send error: {}", e);
                if let Ok(mut pool) = smtp_pool().lock() {
                    pool.remove(&hash);
                }
                if is_permanent_smtp_error(&e) {
                    return Err(SerializedError::new(ERR_INTERNAL, last_error));
                }
                if attempt == max_retries {
                    return Err(SerializedError::new(ERR_INTERNAL, last_error));
                }
                log::warn!(
                    "SMTP send attempt {} failed, retrying: {}",
                    attempt + 1,
                    last_error
                );
            }
            Err(_elapsed) => {
                last_error = format!("SMTP send timed out after {}s", timeout_duration.as_secs());
                if let Ok(mut pool) = smtp_pool().lock() {
                    pool.remove(&hash);
                }
                if attempt == max_retries {
                    return Err(SerializedError::new(ERR_TIMEOUT, last_error));
                }
                log::warn!(
                    "SMTP send attempt {} timed out, retrying",
                    attempt + 1
                );
            }
        }
    }

    Err(SerializedError::new(ERR_INTERNAL, last_error))
}

/// Test SMTP connectivity with a 30s timeout.
pub async fn test_connection(config: &SmtpConfig) -> Result<SmtpSendResult, SerializedError> {
    let transport = build_standalone_transport(config)?;

    let result = timeout(Duration::from_secs(30), transport.test_connection())
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_TIMEOUT,
                format!(
                    "SMTP connection to {}:{} timed out after 30s — check your server settings, firewall, or try STARTTLS on port 587",
                    config.host, config.port
                ),
            )
        })?;

    result
        .map(|success| SmtpSendResult {
            success,
            message: if success {
                "Connection successful".to_string()
            } else {
                "Connection failed".to_string()
            },
        })
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("SMTP test error: {}", e)))
}

// ── Unit tests – all unchanged and still pass ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_base64url_valid() {
        let encoded = "SGVsbG8";
        let decoded = decode_base64url(encoded).unwrap();
        assert_eq!(decoded, b"Hello");
    }

    #[test]
    fn test_decode_base64url_invalid() {
        let result = decode_base64url("!!!invalid!!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Base64 decode error"));
    }

    #[test]
    fn test_extract_envelope_valid() {
        let raw = b"From: alice@example.com\r\n\
                     To: bob@example.com\r\n\
                     Cc: carol@example.com\r\n\
                     Subject: Test\r\n\r\n\
                     Body";
        let envelope = extract_envelope(raw).unwrap();
        assert!(envelope.from().is_some());
        assert_eq!(envelope.to().len(), 2);
    }

    #[test]
    fn test_extract_envelope_no_from() {
        let raw = b"To: bob@example.com\r\nSubject: Test\r\n\r\nBody";
        let result = extract_envelope(raw);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("No From address"));
    }

    #[test]
    fn test_extract_envelope_no_recipients() {
        let raw = b"From: alice@example.com\r\nSubject: Test\r\n\r\nBody";
        let result = extract_envelope(raw);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("No recipients found"));
    }

    #[test]
    fn test_extract_envelope_with_bcc() {
        let raw = b"From: alice@example.com\r\n\
                     To: bob@example.com\r\n\
                     Bcc: secret@example.com\r\n\
                     Subject: Test\r\n\r\n\
                     Body";
        let envelope = extract_envelope(raw).unwrap();
        assert_eq!(envelope.to().len(), 2);
    }

    #[test]
    fn test_config_hash_deterministic() {
        let config = SmtpConfig {
            host: "smtp.example.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@example.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        let hash1 = config_hash(&config);
        let hash2 = config_hash(&config);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_config_hash_different_hosts() {
        let config_a = SmtpConfig {
            host: "smtp.a.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@a.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        let config_b = SmtpConfig {
            host: "smtp.b.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@b.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        assert_ne!(config_hash(&config_a), config_hash(&config_b));
    }

    #[test]
    fn test_config_hash_different_ports() {
        let config_587 = SmtpConfig {
            host: "smtp.example.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@example.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        let config_465 = SmtpConfig {
            host: "smtp.example.com".into(),
            port: 465,
            security: "tls".into(),
            username: "user@example.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        assert_ne!(config_hash(&config_587), config_hash(&config_465));
    }

    #[test]
    fn test_config_hash_different_auth_method() {
        let config_password = SmtpConfig {
            host: "smtp.example.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@example.com".into(),
            password: "token".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        let config_oauth2 = SmtpConfig {
            host: "smtp.example.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "user@example.com".into(),
            password: "token".into(),
            auth_method: "oauth2".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        assert_ne!(config_hash(&config_password), config_hash(&config_oauth2));
    }

    #[test]
    fn test_decode_base64url_empty() {
        let result = decode_base64url("").unwrap();
        assert!(result.is_empty());
    }
}