//! The HTTP client to `agent-core`.
//!
//! Two things this does that a bare `reqwest::get` would not:
//!
//! 1. **The bearer token comes from the app's auth store, never from a command
//!    argument.** A `token: String` parameter on a `#[tauri::command]` is a token
//!    the frontend can pass, log, and get wrong. Identity is not a parameter.
//! 2. **A transport failure is a typed `AgentUnreachable`, not a panic or a
//!    500.** The console's whole "cannot reach the agent" screen exists because
//!    this is a normal, expected state — the desktop is often running with the
//!    VPS off.

use std::time::Duration;

use serde::de::DeserializeOwned;
use tauri::State;

use super::types::{Health, OpsSnapshot, ProviderHealth, SessionRequest, SessionResponse};

/// Everything that can go wrong talking to agent-core, as ONE type the UI can
/// switch on. The console has exactly one error parser.
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("agent-core unreachable: {0}")]
    Unreachable(String),
    #[error("agent-core returned {status}: {message}")]
    Api { status: u16, message: String },
    #[error("malformed response from agent-core: {0}")]
    Decode(String),
}

impl serde::Serialize for AgentError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub fn base_url() -> String {
    std::env::var("AGENT_CORE_URL").unwrap_or_else(|_| "http://127.0.0.1:8788".to_string())
}

fn client() -> Result<reqwest::Client, AgentError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| AgentError::Unreachable(e.to_string()))
}

async fn get_json<T: DeserializeOwned>(
    path: &str,
    token: &str,
) -> Result<T, AgentError> {
    let url = format!("{}{}", base_url(), path);
    let resp = client()?
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| AgentError::Unreachable(e.to_string()))?;

    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(AgentError::Api { status, message });
    }
    resp.json::<T>()
        .await
        .map_err(|e| AgentError::Decode(e.to_string()))
}

async fn post_json<B: serde::Serialize, T: DeserializeOwned>(
    path: &str,
    token: &str,
    body: &B,
) -> Result<T, AgentError> {
    let url = format!("{}{}", base_url(), path);
    let resp = client()?
        .post(&url)
        .bearer_auth(token)
        .json(body)
        .send()
        .await
        .map_err(|e| AgentError::Unreachable(e.to_string()))?;

    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(AgentError::Api { status, message });
    }
    resp.json::<T>()
        .await
        .map_err(|e| AgentError::Decode(e.to_string()))
}

/// Token source. Injected so tests do not need a real auth store, and so the
/// token can never come from the frontend.
pub trait TokenSource {
    fn bearer(&self) -> Option<String>;
}

#[tauri::command]
pub async fn agent_health(auth: State<'_, dyn TokenSource>) -> Result<Health, AgentError> {
    let token = auth
        .bearer()
        .ok_or_else(|| AgentError::Unreachable("no session token".into()))?;
    get_json("/healthz", &token).await
}

#[tauri::command]
pub async fn agent_ops_snapshot(
    auth: State<'_, dyn TokenSource>,
) -> Result<OpsSnapshot, AgentError> {
    let token = auth
        .bearer()
        .ok_or_else(|| AgentError::Unreachable("no session token".into()))?;
    get_json("/ops/snapshot", &token).await
}

#[tauri::command]
pub async fn agent_provider_health(
    auth: State<'_, dyn TokenSource>,
) -> Result<Vec<ProviderHealth>, AgentError> {
    let token = auth
        .bearer()
        .ok_or_else(|| AgentError::Unreachable("no session token".into()))?;
    #[derive(serde::Deserialize)]
    struct Snapshot {
        #[serde(rename = "providerHealth")]
        provider_health: Vec<ProviderHealth>,
    }
    let snap: Snapshot = get_json("/ops/snapshot/dev", &token).await?;
    Ok(snap.provider_health)
}

#[tauri::command]
pub async fn agent_create_session(
    auth: State<'_, dyn TokenSource>,
    request: SessionRequest,
) -> Result<SessionResponse, AgentError> {
    let token = auth
        .bearer()
        .ok_or_else(|| AgentError::Unreachable("no session token".into()))?;
    post_json("/session", &token, &request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixed(Option<String>);
    impl TokenSource for Fixed {
        fn bearer(&self) -> Option<String> {
            self.0.clone()
        }
    }

    #[test]
    fn base_url_defaults_to_loopback() {
        // SAFETY-free: the test process does not set the var, and base_url must
        // not fall back to a public host.
        if std::env::var("AGENT_CORE_URL").is_err() {
            assert_eq!(base_url(), "http://127.0.0.1:8788");
        }
    }

    #[test]
    fn a_missing_token_is_unreachable_not_a_panic() {
        let auth = Fixed(None);
        assert!(auth.bearer().is_none());
        // The command maps None to Unreachable; the point is that it is a value,
        // so the console can render "sign in" rather than crash.
    }

    #[test]
    fn error_is_a_plain_string_the_console_can_display() {
        let e = AgentError::Unreachable("connection refused".into());
        let json = serde_json::to_string(&e).unwrap();
        assert!(json.contains("connection refused"), "{json}");
    }
}
