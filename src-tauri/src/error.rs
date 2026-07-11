use serde::Serialize;
use std::fmt;

/// Structured error returned to the frontend across IPC.
/// Frontend can match on `code` instead of parsing error strings.
#[derive(Debug, Clone, Serialize)]
pub struct SerializedError {
    /// Machine-readable error code (e.g., "CONNECTION_TIMEOUT", "AUTH_FAILED", "FILE_NOT_FOUND")
    pub code: String,
    /// Human-readable error message (localized on frontend)
    pub message: String,
    /// Optional detailed error info (stack trace, debug info — never localized)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl SerializedError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

impl fmt::Display for SerializedError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for SerializedError {}

// ── From impls for common error types ──────────────────────────────

impl From<String> for SerializedError {
    fn from(msg: String) -> Self {
        Self {
            code: ERR_INTERNAL.to_string(),
            message: msg,
            details: None,
        }
    }
}

impl From<&str> for SerializedError {
    fn from(msg: &str) -> Self {
        SerializedError::from(msg.to_string())
    }
}

impl From<std::io::Error> for SerializedError {
    fn from(e: std::io::Error) -> Self {
        let code = match e.kind() {
            std::io::ErrorKind::NotFound => ERR_FILE_NOT_FOUND,
            std::io::ErrorKind::PermissionDenied => ERR_AUTH_FAILED,
            std::io::ErrorKind::ConnectionRefused
            | std::io::ErrorKind::ConnectionReset
            | std::io::ErrorKind::ConnectionAborted
            | std::io::ErrorKind::TimedOut => ERR_CONNECTION_TIMEOUT,
            std::io::ErrorKind::AlreadyExists => ERR_INVALID_INPUT,
            _ => ERR_FILE_IO,
        };
        Self {
            code: code.to_string(),
            message: e.to_string(),
            details: None,
        }
    }
}

impl From<serde_json::Error> for SerializedError {
    fn from(e: serde_json::Error) -> Self {
        Self {
            code: ERR_PARSE.to_string(),
            message: e.to_string(),
            details: None,
        }
    }
}

// ── Helper macro for quick error construction ──────────────────────
// Usage: bail!("AUTH_FAILED", "Invalid credentials")
// Usage: bail!("AUTH_FAILED", "Invalid credentials: {}", extra_info)
#[macro_export]
macro_rules! bail {
    ($code:expr, $msg:literal $(, $arg:expr)* $(,)?) => {
        return Err($crate::error::SerializedError::new(
            $code,
            format!($msg $(, $arg)*),
        ))
    };
}

// Common error code constants
// Some codes are used immediately after migration — remaining are ready for future modules.
// Some codes are used immediately after migration — remaining are ready for future modules.
#[allow(dead_code)]
pub const ERR_CONNECTION_TIMEOUT: &str = "CONNECTION_TIMEOUT";
#[allow(dead_code)]
pub const ERR_AUTH_FAILED: &str = "AUTH_FAILED";
#[allow(dead_code)]
pub const ERR_NETWORK: &str = "NETWORK_ERROR";
#[allow(dead_code)]
pub const ERR_FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";
#[allow(dead_code)]
pub const ERR_FILE_IO: &str = "FILE_IO_ERROR";
#[allow(dead_code)]
pub const ERR_PARSE: &str = "PARSE_ERROR";
#[allow(dead_code)]
pub const ERR_INVALID_INPUT: &str = "INVALID_INPUT";
#[allow(dead_code)]
pub const ERR_INTERNAL: &str = "INTERNAL_ERROR";
#[allow(dead_code)]
pub const ERR_DB: &str = "DATABASE_ERROR";
#[allow(dead_code)]
pub const ERR_NOT_FOUND: &str = "NOT_FOUND";
#[allow(dead_code)]
pub const ERR_TIMEOUT: &str = "TIMEOUT";
#[allow(dead_code)]
pub const ERR_BUSY: &str = "RESOURCE_BUSY";
#[allow(dead_code)]
pub const ERR_DISK: &str = "DISK_ERROR";
#[allow(dead_code)]
pub const ERR_DISK_FULL: &str = "DISK_FULL";
#[allow(dead_code)]
pub const ERR_DB_BUSY: &str = "DATABASE_BUSY";
#[allow(dead_code)]
pub const ERR_DB_CORRUPT: &str = "DATABASE_CORRUPT";
#[allow(dead_code)]
pub const ERR_DB_CANTOPEN: &str = "DATABASE_CANNOT_OPEN";
