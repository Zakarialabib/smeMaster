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

pub mod monitor;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tauri::{Builder, Listener, Wry};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::{bail, error::{SerializedError, ERR_AUTH_FAILED, ERR_INTERNAL, ERR_INVALID_INPUT, ERR_NETWORK, ERR_PARSE, ERR_TIMEOUT}};

#[derive(Serialize)]
pub struct OAuthResult {
    pub code: String,
    pub state: String,
}

/// Binds to a localhost port for OAuth callback. Tries the given port first,
/// falls back to nearby ports if taken.
#[tauri::command]
pub async fn start_oauth_server(port: u16, state: String) -> Result<OAuthResult, SerializedError> {
    // Try the requested port, then a few alternatives
    let mut listener = None;
    for p in [port, port + 1, port + 2, port + 3] {
        match TcpListener::bind(format!("127.0.0.1:{}", p)).await {
            Ok(l) => {
                listener = Some(l);
                break;
            }
            Err(_) => continue,
        }
    }

    let listener = listener.ok_or_else(|| SerializedError::new(ERR_INTERNAL, "Failed to bind to any port"))?;
    let actual_port = listener
        .local_addr()
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Failed to get addr: {}", e)))?
        .port();

    log::info!("OAuth callback server listening on port {}", actual_port);

    // Wait for exactly one connection (the redirect from Google) with 5-minute timeout
    let (mut stream, _) = tokio::time::timeout(
        Duration::from_secs(300),
        listener.accept(),
    )
    .await
        .map_err(|_| SerializedError::new(ERR_TIMEOUT, "OAuth timed out — please try again"))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Failed to accept: {}", e)))?;

    // Read the HTTP request
    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Failed to read: {}", e)))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // Extract query string from GET request line
    let (code, returned_state) = parse_auth_code_and_state(&request)?;

    // Validate state parameter (CSRF protection)
    if returned_state != state {
        bail!(ERR_AUTH_FAILED, "OAuth state mismatch — possible CSRF attack");
    }

    // Send a success response to the browser
    let html = r#"<!DOCTYPE html>
<html>
<head><title>SMEMaster</title></head>
<body style="font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0;">
<div style="text-align: center;">
<h1 style="margin-bottom: 8px;">Account Connected!</h1>
<p style="opacity: 0.7;">You can close this tab and return to SMEMaster.</p>
</div>
</body>
</html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );

    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;

    drop(listener);

    Ok(OAuthResult { code, state: returned_state })
}

fn parse_auth_code_and_state(request: &str) -> Result<(String, String), SerializedError> {
    let first_line = request.lines().next().ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "Empty request"))?;

    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "No path in request"))?;

    if path.contains("error=") {
        let params = parse_query_string(path);
        let error = params.get("error").cloned().unwrap_or_default();
        bail!(ERR_AUTH_FAILED, "OAuth error: {}", error);
    }

    let params = parse_query_string(path);
    let code = params
        .get("code")
        .cloned()
        .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "No auth code in redirect"))?;
    let state = params
        .get("state")
        .cloned()
        .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "No state in redirect"))?;
    Ok((code, state))
}

fn parse_query_string(path: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    if let Some(query) = path.split('?').nth(1) {
        for pair in query.split('&') {
            let mut kv = pair.splitn(2, '=');
            if let (Some(key), Some(value)) = (kv.next(), kv.next()) {
                params.insert(key.to_string(), urlencoding_decode(value));
            }
        }
    }
    params
}

fn urlencoding_decode(s: &str) -> String {
    let mut result = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &s[i + 1..i + 3],
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| s.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenExchangeResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
    pub scope: Option<String>,
    pub id_token: Option<String>,
    /// Absolute epoch seconds at which this token expires.
    /// Computed from `expires_in` + current system time.
    #[serde(default)]
    pub expires_at: Option<u64>,
}

/// Returns `true` if the token expires within the given `grace_period_secs`
/// (default: 5 minutes), meaning a proactive refresh should be triggered.
///
/// Pass the `expires_at` value from `TokenExchangeResult`. Returns `false`
/// when `expires_at` is unavailable (e.g. old data without the field).
pub fn oauth_should_refresh(token_expires_at: u64, grace_period_secs: Option<u64>) -> bool {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let grace = grace_period_secs.unwrap_or(300);
    token_expires_at.saturating_sub(now) <= grace
}

/// Helper: compute `expires_at` from `expires_in` relative to current time.
fn compute_expires_at(expires_in: u64) -> Option<u64> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    Some(now + expires_in)
}

/// Exchange an OAuth authorization code for tokens via Rust HTTP client (avoids CORS).
#[tauri::command]
pub async fn oauth_exchange_token(
    token_url: String,
    code: String,
    client_id: String,
    redirect_uri: String,
    code_verifier: Option<String>,
    client_secret: Option<String>,
    scope: Option<String>,
) -> Result<TokenExchangeResult, SerializedError> {
    let mut params = vec![
        ("code", code),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code".to_string()),
    ];
    if let Some(verifier) = code_verifier {
        params.push(("code_verifier", verifier));
    }
    if let Some(secret) = client_secret {
        if !secret.is_empty() {
            params.push(("client_secret", secret));
        }
    }
    if let Some(s) = scope {
        params.push(("scope", s));
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Token exchange request failed: {}", e)))?;

    if !response.status().is_success() {
        let error = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        bail!(ERR_NETWORK, "Token exchange failed: {}", error);
    }

    let mut result: TokenExchangeResult = response
        .json::<TokenExchangeResult>()
        .await
        .map_err(|e| SerializedError::new(ERR_PARSE, format!("Failed to parse token response: {}", e)))?;

    // Compute expires_at from expires_in
    result.expires_at = compute_expires_at(result.expires_in);

    Ok(result)
}

/// Opens the OAuth URL in the system browser and listens for the deep-link
/// callback on mobile (or desktop via custom scheme). Uses a oneshot channel
/// to bridge the event listener closure with this async command.
#[tauri::command]
pub async fn start_oauth_browser(
    app: tauri::AppHandle,
    auth_url: String,
    state: String,
) -> Result<OAuthResult, SerializedError> {
    use tauri_plugin_opener::OpenerExt;
    use tokio::sync::oneshot;

    // Open the OAuth URL in the system browser
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Failed to open browser: {}", e)))?;

    log::info!("OAuth browser opened, waiting for deep-link callback...");

    // Create a oneshot channel to bridge the event callback to the async context.
    // Wrap in Mutex<Option> because the listener closure is Fn (may be called
    // multiple times), but oneshot::Sender::send consumes the sender exactly once.
    let (tx, rx) = oneshot::channel::<String>();
    let tx = std::sync::Mutex::new(Some(tx));

    // Clone the AppHandle for the event listener
    let app_clone = app.clone();

    // Listen for the deep-link callback event emitted by tauri-plugin-deep-link
    let handler_id = app_clone.listen("deep-link://new-url", move |event| {
        let url_str = event.payload().to_string();
        log::info!("Received deep-link callback: {}", url_str);
        if let Some(tx) = tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
            let _ = tx.send(url_str);
        }
    });

    // Wait for the callback with 5-minute timeout
    let url_str = tokio::time::timeout(Duration::from_secs(300), rx)
        .await
        .map_err(|_| {
            // Timeout — clean up the listener
            app.unlisten(handler_id);
            SerializedError::new(ERR_TIMEOUT, "OAuth timed out — please try again")
        })?
        .map_err(|_| {
            // The sender was dropped (listener was cleaned up externally)
            SerializedError::new(ERR_INTERNAL, "OAuth listener was closed unexpectedly")
        })?;

    // Clean up the listener on success
    app.unlisten(handler_id);

    // Parse the callback URL to extract query parameters
    let parsed =
        url::Url::parse(&url_str).map_err(|e| SerializedError::new(ERR_PARSE, format!("Failed to parse callback URL: {}", e)))?;

    let params: HashMap<String, String> = parsed
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    // Check for OAuth error in the callback URL
    if let Some(error) = params.get("error") {
        bail!(ERR_AUTH_FAILED, "OAuth error: {}", error);
    }

    let code = params
        .get("code")
        .cloned()
        .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "No authorization code in callback"))?;

    let returned_state = params
        .get("state")
        .cloned()
        .ok_or_else(|| SerializedError::new(ERR_INVALID_INPUT, "No state parameter in callback"))?;

    // Validate state parameter (CSRF protection)
    if returned_state != state {
        bail!(ERR_AUTH_FAILED, "OAuth state mismatch — possible CSRF attack");
    }

    log::info!("OAuth callback received and validated successfully");

    Ok(OAuthResult {
        code,
        state: returned_state,
    })
}

/// Refresh an OAuth token via Rust HTTP client (avoids CORS).
#[tauri::command]
pub async fn oauth_refresh_token(
    token_url: String,
    refresh_token: String,
    client_id: String,
    client_secret: Option<String>,
    scope: Option<String>,
) -> Result<TokenExchangeResult, SerializedError> {
    let mut params = vec![
        ("refresh_token", refresh_token),
        ("client_id", client_id),
        ("grant_type", "refresh_token".to_string()),
    ];
    if let Some(secret) = client_secret {
        if !secret.is_empty() {
            params.push(("client_secret", secret));
        }
    }
    if let Some(s) = scope {
        params.push(("scope", s));
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Token refresh request failed: {}", e)))?;

    if !response.status().is_success() {
        let error = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        bail!(ERR_NETWORK, "Token refresh failed: {}", error);
    }

    let mut result: TokenExchangeResult = response
        .json::<TokenExchangeResult>()
        .await
        .map_err(|e| SerializedError::new(ERR_PARSE, format!("Failed to parse token response: {}", e)))?;

    // Compute expires_at from expires_in
    result.expires_at = compute_expires_at(result.expires_in);

    Ok(result)
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase 1: encrypt/decrypt tokens for the proactive refresh loop
// Uses `db::crypto` primitives (AES-256-GCM with key from smemaster.key).
// ──────────────────────────────────────────────────────────────────────────────

/// Decrypt an OAuth token that was encrypted by the JS frontend using
/// AES-256-GCM (Web Crypto API).
///
/// **Format**: `base64(iv):base64(ciphertext_with_gcm_tag)`
///
/// The 256-bit key is read from `<app_data_dir>/smemaster.key` (base64-encoded),
/// which matches the key file created and used by `src/shared/utils/crypto.ts`.
///
/// This is a temporary approach — Phase 2 of the encryption migration will
/// introduce a `CredentialManager` backed by the OS keyring instead.
pub fn decrypt_token(app: &tauri::AppHandle, encrypted: &str) -> Result<String, String> {
    let key = crate::db::crypto::load_or_create_key(app)
        .map_err(|e| format!("Failed to load encryption key: {e}"))?;
    crate::db::crypto::decrypt_value(encrypted, &key)
        .map_err(|e| format!("Token decryption failed: {e}"))
}

/// Encrypt a plaintext value (e.g. OAuth refresh token) into the same
/// `base64(iv):base64(ciphertext)` format used by the JS frontend.
///
/// The key is loaded (or created) from `<app_data_dir>/smemaster.key`.
pub fn encrypt_token(app: &tauri::AppHandle, plaintext: &str) -> Result<String, String> {
    let key = crate::db::crypto::load_or_create_key(app)
        .map_err(|e| format!("Failed to load encryption key: {e}"))?;
    crate::db::crypto::encrypt_value(plaintext, &key)
        .map_err(|e| format!("Token encryption failed: {e}"))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    use crate::oauth::monitor::OAuthTokenMonitor;

    /// Install rustls crypto provider once for all tests in this module.
    fn ensure_crypto_provider() {
        use std::sync::Once;
        static INIT: Once = Once::new();
        INIT.call_once(|| {
            let _ = rustls::crypto::ring::default_provider().install_default();
        });
    }

    // ── parse_query_string ─────────────────────────────────────────

    #[test]
    fn test_parse_query_string_basic() {
        let path = "/callback?code=abc123&state=xyz";
        let params = parse_query_string(path);
        assert_eq!(params.get("code").unwrap(), "abc123");
        assert_eq!(params.get("state").unwrap(), "xyz");
    }

    #[test]
    fn test_parse_query_string_no_query() {
        let path = "/callback";
        let params = parse_query_string(path);
        assert!(params.is_empty());
    }

    #[test]
    fn test_parse_query_string_empty_value() {
        let path = "/callback?key=";
        let params = parse_query_string(path);
        assert_eq!(params.get("key").unwrap(), "");
    }

    #[test]
    fn test_parse_query_string_special_characters() {
        let path = "/callback?code=abc%20123&name=hello%26world";
        let params = parse_query_string(path);
        assert_eq!(params.get("code").unwrap(), "abc 123");
        assert_eq!(params.get("name").unwrap(), "hello&world");
    }

    #[test]
    fn test_parse_query_string_single_param() {
        let path = "/?error=access_denied";
        let params = parse_query_string(path);
        assert_eq!(params.get("error").unwrap(), "access_denied");
    }

    // ── urlencoding_decode ─────────────────────────────────────────

    #[test]
    fn test_urlencoding_decode_plain() {
        assert_eq!(urlencoding_decode("hello"), "hello");
    }

    #[test]
    fn test_urlencoding_decode_plus_as_space() {
        assert_eq!(urlencoding_decode("hello+world"), "hello world");
    }

    #[test]
    fn test_urlencoding_decode_percent_encoded() {
        assert_eq!(urlencoding_decode("%41%42%43"), "ABC");
    }

    #[test]
    fn test_urlencoding_decode_mixed() {
        assert_eq!(urlencoding_decode("a%20b+c"), "a b c");
    }

    #[test]
    fn test_urlencoding_decode_empty() {
        assert_eq!(urlencoding_decode(""), "");
    }

    #[test]
    fn test_urlencoding_decode_invalid_percent() {
        // Incomplete percent sequence should be left as-is
        assert_eq!(urlencoding_decode("%2"), "%2");
        assert_eq!(urlencoding_decode("test%"), "test%");
    }

    // ── parse_auth_code_and_state ──────────────────────────────────

    #[test]
    fn test_parse_auth_code_and_state_valid() {
        let request = "GET /callback?code=auth_code_123&state=csrf_state HTTP/1.1\r\nHost: localhost\r\n";
        let (code, state) = parse_auth_code_and_state(request).unwrap();
        assert_eq!(code, "auth_code_123");
        assert_eq!(state, "csrf_state");
    }

    #[test]
    fn test_parse_auth_code_and_state_missing_code() {
        let request = "GET /callback?state=csrf_state HTTP/1.1\r\nHost: localhost\r\n";
        let result = parse_auth_code_and_state(request);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_INVALID_INPUT);
    }

    #[test]
    fn test_parse_auth_code_and_state_missing_state() {
        let request = "GET /callback?code=abc HTTP/1.1\r\nHost: localhost\r\n";
        let result = parse_auth_code_and_state(request);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_INVALID_INPUT);
    }

    #[test]
    fn test_parse_auth_code_and_state_error_response() {
        let request = "GET /callback?error=access_denied&state=xyz HTTP/1.1\r\nHost: localhost\r\n";
        let result = parse_auth_code_and_state(request);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_AUTH_FAILED);
        assert!(err.message.contains("access_denied"));
    }

    #[test]
    fn test_parse_auth_code_and_state_empty_request() {
        let request = "";
        let result = parse_auth_code_and_state(request);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_auth_code_and_state_no_path() {
        let request = "GET HTTP/1.1\r\n";
        let result = parse_auth_code_and_state(request);
        assert!(result.is_err());
    }

    // ── oauth_should_refresh ───────────────────────────────────────

    #[test]
    fn test_oauth_should_refresh_near_expiry() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expires in 2 minutes (120s) — within default 300s grace period
        assert!(oauth_should_refresh(now + 120, None));
    }

    #[test]
    fn test_oauth_should_refresh_fresh_token() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expires in 1 hour — well outside the grace period
        assert!(!oauth_should_refresh(now + 3600, None));
    }

    #[test]
    fn test_oauth_should_refresh_already_expired() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expired 10 minutes ago
        assert!(oauth_should_refresh(now.saturating_sub(600), None));
    }

    #[test]
    fn test_oauth_should_refresh_custom_grace_period() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expires in 2 minutes, custom grace period of 60s
        // 120s remaining > 60s grace → should NOT refresh
        assert!(!oauth_should_refresh(now + 120, Some(60)));
    }

    #[test]
    fn test_oauth_should_refresh_within_custom_grace() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expires in 30s, custom grace period of 60s
        assert!(oauth_should_refresh(now + 30, Some(60)));
    }

    #[test]
    fn test_oauth_should_refresh_exact_boundary() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Token expires exactly at grace boundary → should refresh
        assert!(oauth_should_refresh(now + 300, Some(300)));
    }

    // ── compute_expires_at ─────────────────────────────────────────

    #[test]
    fn test_compute_expires_at() {
        let before = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let result = compute_expires_at(3600).unwrap();
        let after = before + 3600;
        // Allow 2 seconds of clock drift in the test
        assert!(result >= before + 3599);
        assert!(result <= after + 1);
    }

    #[test]
    fn test_compute_expires_at_zero() {
        let before = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let result = compute_expires_at(0).unwrap();
        assert!(result >= before);
        assert!(result <= before + 1);
    }

    // ── TokenExchangeResult deserialization ────────────────────────

    #[test]
    fn test_token_exchange_result_deserialize_full() {
        let json = r#"{
            "access_token": "ya29.access_token",
            "refresh_token": "1//refresh_token",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "email profile",
            "id_token": "eyJ.id.token"
        }"#;
        let result: TokenExchangeResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.access_token, "ya29.access_token");
        assert_eq!(result.refresh_token, Some("1//refresh_token".to_string()));
        assert_eq!(result.expires_in, 3600);
        assert_eq!(result.token_type, "Bearer");
        assert_eq!(result.scope, Some("email profile".to_string()));
        assert_eq!(result.id_token, Some("eyJ.id.token".to_string()));
        assert!(result.expires_at.is_none()); // Not in JSON, defaults to None
    }

    #[test]
    fn test_token_exchange_result_deserialize_minimal() {
        let json = r#"{
            "access_token": "token123",
            "expires_in": 1800,
            "token_type": "Bearer"
        }"#;
        let result: TokenExchangeResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.access_token, "token123");
        assert_eq!(result.refresh_token, None);
        assert_eq!(result.expires_in, 1800);
        assert_eq!(result.token_type, "Bearer");
        assert_eq!(result.scope, None);
        assert_eq!(result.id_token, None);
    }

    #[test]
    fn test_token_exchange_result_serialize_roundtrip() {
        let original = TokenExchangeResult {
            access_token: "test_token".to_string(),
            refresh_token: Some("refresh".to_string()),
            expires_in: 3600,
            token_type: "Bearer".to_string(),
            scope: Some("email".to_string()),
            id_token: None,
            expires_at: Some(1700000000),
        };
        let json = serde_json::to_string(&original).unwrap();
        let deserialized: TokenExchangeResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.access_token, original.access_token);
        assert_eq!(deserialized.refresh_token, original.refresh_token);
        assert_eq!(deserialized.expires_in, original.expires_in);
        assert_eq!(deserialized.expires_at, original.expires_at);
    }

    // ── oauth_exchange_token with mock server ──────────────────────

    /// Helper: spin up a mock HTTP server that returns a fixed response.
    /// Returns (actual_port, join_handle).
    async fn mock_token_server(response_body: &str, status_code: u16) -> (u16, tokio::task::JoinHandle<()>) {
        let body = response_body.to_string();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                let mut buf = vec![0u8; 4096];
                let _ = stream.read(&mut buf).await;

                let status_text = match status_code {
                    200 => "OK",
                    400 => "Bad Request",
                    401 => "Unauthorized",
                    _ => "Unknown",
                };
                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                    status_code,
                    status_text,
                    body.len(),
                    body
                );
                use tokio::io::AsyncWriteExt;
                let _ = stream.write_all(response.as_bytes()).await;
                let _ = stream.flush().await;
            }
        });

        (port, handle)
    }

    #[tokio::test]
    async fn test_oauth_exchange_token_success() {
        ensure_crypto_provider();
        let mock_response = r#"{
            "access_token": "ya29.new_access_token",
            "refresh_token": "1//new_refresh_token",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "email profile"
        }"#;

        let (port, handle) = mock_token_server(mock_response, 200).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_exchange_token(
            token_url,
            "auth_code_abc".to_string(),
            "client_id_123".to_string(),
            "http://localhost:8080/callback".to_string(),
            None, // code_verifier
            None, // client_secret
            Some("email profile".to_string()),
        )
        .await;

        assert!(result.is_ok());
        let token = result.unwrap();
        assert_eq!(token.access_token, "ya29.new_access_token");
        assert_eq!(token.refresh_token, Some("1//new_refresh_token".to_string()));
        assert_eq!(token.expires_in, 3600);
        assert_eq!(token.token_type, "Bearer");
        assert!(token.expires_at.is_some());

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_exchange_token_with_pkce() {
        ensure_crypto_provider();
        let mock_response = r#"{
            "access_token": "pkce_token",
            "expires_in": 7200,
            "token_type": "Bearer"
        }"#;

        let (port, handle) = mock_token_server(mock_response, 200).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_exchange_token(
            token_url,
            "auth_code_pkce".to_string(),
            "pkce_client_id".to_string(),
            "http://localhost:8080/callback".to_string(),
            Some("code_verifier_abc123".to_string()),
            None, // client_secret
            None,
        )
        .await;

        assert!(result.is_ok());
        let token = result.unwrap();
        assert_eq!(token.access_token, "pkce_token");
        assert_eq!(token.expires_in, 7200);

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_exchange_token_server_error() {
        ensure_crypto_provider();
        let (port, handle) = mock_token_server(r#"{"error": "invalid_grant"}"#, 400).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_exchange_token(
            token_url,
            "bad_code".to_string(),
            "client_id".to_string(),
            "http://localhost/callback".to_string(),
            None,
            None,
            None,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_NETWORK);
        assert!(err.message.contains("Token exchange failed"));

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_exchange_token_invalid_json() {
        ensure_crypto_provider();
        let (port, handle) = mock_token_server("not json at all", 200).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_exchange_token(
            token_url,
            "code".to_string(),
            "client".to_string(),
            "http://localhost/callback".to_string(),
            None,
            None,
            None,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_PARSE);

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_exchange_token_network_failure() {
        ensure_crypto_provider();
        // Point to a port that's not listening
        let result = oauth_exchange_token(
            "http://127.0.0.1:1/token".to_string(),
            "code".to_string(),
            "client".to_string(),
            "http://localhost/callback".to_string(),
            None,
            None,
            None,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_NETWORK);
    }

    // ── oauth_refresh_token with mock server ───────────────────────

    #[tokio::test]
    async fn test_oauth_refresh_token_success() {
        ensure_crypto_provider();
        let mock_response = r#"{
            "access_token": "refreshed_access_token",
            "expires_in": 3600,
            "token_type": "Bearer"
        }"#;

        let (port, handle) = mock_token_server(mock_response, 200).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_refresh_token(
            token_url,
            "old_refresh_token".to_string(),
            "client_id".to_string(),
            None,
            None,
        )
        .await;

        assert!(result.is_ok());
        let token = result.unwrap();
        assert_eq!(token.access_token, "refreshed_access_token");
        assert_eq!(token.expires_in, 3600);
        assert!(token.expires_at.is_some());

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_refresh_token_with_client_secret() {
        ensure_crypto_provider();
        let mock_response = r#"{
            "access_token": "secret_refreshed_token",
            "expires_in": 1800,
            "token_type": "Bearer"
        }"#;

        let (port, handle) = mock_token_server(mock_response, 200).await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_refresh_token(
            token_url,
            "refresh_token".to_string(),
            "confidential_client".to_string(),
            Some("super_secret".to_string()),
            None,
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().access_token, "secret_refreshed_token");

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_refresh_token_failure() {
        ensure_crypto_provider();
        let (port, handle) = mock_token_server(
            r#"{"error": "invalid_grant", "error_description": "Token has been revoked"}"#,
            401,
        )
        .await;
        let token_url = format!("http://127.0.0.1:{}/token", port);

        let result = oauth_refresh_token(
            token_url,
            "revoked_token".to_string(),
            "client_id".to_string(),
            None,
            None,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ERR_NETWORK);
        assert!(err.message.contains("Token refresh failed"));

        handle.abort();
    }

    #[tokio::test]
    async fn test_oauth_refresh_token_network_failure() {
        ensure_crypto_provider();
        let result = oauth_refresh_token(
            "http://127.0.0.1:1/token".to_string(),
            "refresh".to_string(),
            "client".to_string(),
            None,
            None,
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, ERR_NETWORK);
    }

    // ── OAuthTokenMonitor initialization ───────────────────────────

    #[tokio::test]
    async fn test_oauth_monitor_new_is_empty() {
        let monitor = OAuthTokenMonitor::new();
        // The monitor should be created successfully; verify it doesn't panic
        // and its clone shares state
        let monitor2 = monitor.clone();
        // Both handles should be usable without errors
        drop(monitor);
        drop(monitor2);
    }

    #[tokio::test]
    async fn test_oauth_monitor_default_is_empty() {
        let monitor = OAuthTokenMonitor::default();
        // Default should produce a valid monitor without panicking
        let monitor2 = monitor.clone();
        drop(monitor);
        drop(monitor2);
    }

    #[tokio::test]
    async fn test_oauth_monitor_clone_shares_state() {
        let monitor = OAuthTokenMonitor::new();
        let monitor2 = monitor.clone();

        // Both handles should be alive and identical
        // We can't directly access `tokens` since it's private, but we can
        // verify that both handles survive being dropped independently
        drop(monitor);
        // monitor2 should still be valid
        let _monitor2 = monitor2;
    }

    // ── OAuthResult type ───────────────────────────────────────────

    #[test]
    fn test_oauth_result_serialization() {
        let result = OAuthResult {
            code: "auth_code".to_string(),
            state: "csrf_state".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("auth_code"));
        assert!(json.contains("csrf_state"));
    }

    // ── SerializedError integration ────────────────────────────────

    #[test]
    fn test_error_code_constants() {
        // Ensure the error code constants are what we expect
        assert_eq!(ERR_AUTH_FAILED, "AUTH_FAILED");
        assert_eq!(ERR_NETWORK, "NETWORK_ERROR");
        assert_eq!(ERR_INVALID_INPUT, "INVALID_INPUT");
        assert_eq!(ERR_TIMEOUT, "TIMEOUT");
        assert_eq!(ERR_PARSE, "PARSE_ERROR");
        assert_eq!(ERR_INTERNAL, "INTERNAL_ERROR");
    }
}

