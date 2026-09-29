//! The HTTP client to `agent-core`.
//!
//! Two things this does that a bare `reqwest::get` would not:
//!
//! 1. **The bearer token is not a command parameter.** A `token: String`
//!    argument on a `#[tauri::command]` is a token the frontend can pass, log and
//!    get wrong. Identity is not a parameter. The token comes from
//!    [`AgentAuth`], managed state the frontend never sees.
//! 2. **A transport failure is a typed `AgentUnreachable`, not a panic or a
//!    500.** The console's whole "cannot reach the agent" screen exists because
//!    this is a normal, expected state — the desktop is often running with the
//!    VPS off.
//!
//! ## Why `AgentAuth` is a concrete struct and not a trait object
//!
//! The first version took `State<'_, dyn TokenSource>`, which does not compile:
//! Tauri v2 requires `State<'_, T>` with `T: Send + Sync + 'static`, and a
//! `dyn Trait` is neither sized nor shareable. The error is a wall of
//! `CommandArg` / `Send` / `Sync` diagnostics pointing at the `State`, which is
//! a confusing way to be told "a trait object is not a state type".
//!
//! A concrete newtype follows the pattern the rest of the app already uses
//! (`AiState`, `SqlitePool`) and satisfies the bounds without ceremony.

use std::sync::RwLock;

use serde::de::DeserializeOwned;
use tauri::State;

use super::types::{Health, OpsSnapshot, ProviderHealth, SessionRequest, SessionResponse};

/// Managed state holding the bearer token for agent-core calls.
///
/// Registered once in `lib.rs` via `app.manage(AgentAuth::default())`.
///
/// Deliberately NOT a command argument. A token that crosses the IPC boundary
/// is a token the frontend holds, can log, and can get wrong.
#[derive(Default)]
pub struct AgentAuth {
    token: RwLock<Option<String>>,
}

impl AgentAuth {
    /// Store the token after a successful sign-in.
    pub fn set(&self, token: impl Into<String>) {
        if let Ok(mut guard) = self.token.write() {
            *guard = Some(token.into());
        }
    }

    /// Clear it on sign-out. Leaving a token behind after logout is how a
    /// session outlives the user who created it.
    pub fn clear(&self) {
        if let Ok(mut guard) = self.token.write() {
            *guard = None;
        }
    }

    /// Current token, or `None` when signed out.
    pub fn bearer(&self) -> Option<String> {
        self.token.read().ok().and_then(|g| g.clone())
    }
}

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
    #[error("not signed in")]
    NoSession,
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
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AgentError::Unreachable(e.to_string()))
}

/// Build and send one request. `async` so the caller awaits a `Response`
/// rather than a `Result` — a sync fn returning Result here is the kind of
/// thing that compiles in every other language.
async fn send(
    method: reqwest::Method,
    path: &str,
    token: &str,
    body: Option<&str>,
) -> Result<reqwest::Response, AgentError> {
    let url = format!("{}{}", base_url(), path);
    let mut req = client()?
        .request(method, &url)
        .bearer_auth(token)
        .header("Content-Type", "application/json");
    if let Some(b) = body {
        req = req.body(b.to_string());
    }
    // `.send()` returns a Future; it must be awaited BEFORE map_err, not after.
    req.send()
        .await
        .map_err(|e| AgentError::Unreachable(e.to_string()))
}

async fn finish<T: DeserializeOwned>(resp: reqwest::Response) -> Result<T, AgentError> {
    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(AgentError::Api { status, message });
    }
    resp.json::<T>()
        .await
        .map_err(|e| AgentError::Decode(e.to_string()))
}

async fn get_json<T: DeserializeOwned>(path: &str, token: &str) -> Result<T, AgentError> {
    let resp = send(reqwest::Method::GET, path, token, None).await?;
    finish(resp).await
}

async fn post_json<T: DeserializeOwned>(
    path: &str,
    token: &str,
    body: &str,
) -> Result<T, AgentError> {
    let resp = send(reqwest::Method::POST, path, token, Some(body)).await?;
    finish(resp).await
}

fn require(auth: &AgentAuth) -> Result<String, AgentError> {
    auth.bearer().ok_or(AgentError::NoSession)
}

#[tauri::command]
pub async fn agent_health(auth: State<'_, AgentAuth>) -> Result<Health, AgentError> {
    let token = require(&auth)?;
    get_json("/healthz", &token).await
}

#[tauri::command]
pub async fn agent_ops_snapshot(auth: State<'_, AgentAuth>) -> Result<OpsSnapshot, AgentError> {
    let token = require(&auth)?;
    get_json("/ops/snapshot", &token).await
}

#[tauri::command]
pub async fn agent_provider_health(
    auth: State<'_, AgentAuth>,
) -> Result<Vec<ProviderHealth>, AgentError> {
    #[derive(serde::Deserialize)]
    struct Snapshot {
        #[serde(rename = "providerHealth")]
        provider_health: Vec<ProviderHealth>,
    }
    let token = require(&auth)?;
    let snap: Snapshot = get_json("/ops/snapshot/dev", &token).await?;
    Ok(snap.provider_health)
}

#[tauri::command]
pub async fn agent_create_session(
    auth: State<'_, AgentAuth>,
    request: SessionRequest,
) -> Result<SessionResponse, AgentError> {
    let token = require(&auth)?;
    let body = serde_json::to_string(&request).map_err(|e| AgentError::Decode(e.to_string()))?;
    post_json("/session", &token, &body).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_url_defaults_to_loopback() {
        // The test process does not set the var, and base_url must not fall
        // back to a public host.
        if std::env::var("AGENT_CORE_URL").is_err() {
            assert_eq!(base_url(), "http://127.0.0.1:8788");
        }
    }

    #[test]
    fn a_missing_token_is_a_value_not_a_panic() {
        let auth = AgentAuth::default();
        assert!(auth.bearer().is_none());
        // `require` maps this to a typed error the console can render as
        // "sign in", rather than a panic.
        assert!(matches!(require(&auth), Err(AgentError::NoSession)));
    }

    #[test]
    fn set_and_clear_round_trip() {
        let auth = AgentAuth::default();
        auth.set("t0ken");
        assert_eq!(auth.bearer().as_deref(), Some("t0ken"));
        auth.clear();
        assert!(auth.bearer().is_none(), "sign-out must not leave a token behind");
    }

    #[test]
    fn error_is_a_plain_string_the_console_can_display() {
        let e = AgentError::Unreachable("connection refused".into());
        let json = serde_json::to_string(&e).unwrap();
        assert!(json.contains("connection refused"), "{json}");
    }
}
