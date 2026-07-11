use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub security: String,    // "tls", "starttls", "none"
    pub username: String,
    pub password: String,    // plaintext password or OAuth2 access token
    pub auth_method: String, // "password" or "oauth2"
    #[serde(default)]
    pub accept_invalid_certs: bool,
    /// Optional SMTP timeout in seconds (defaults to 30 if not set).
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpSendResult {
    pub success: bool,
    pub message: String,
}
