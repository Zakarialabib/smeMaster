use crate::error::SerializedError;
use thiserror::Error;

/// Unified internal error type for all Rust modules.
/// Converted to `SerializedError` at command boundaries for IPC.
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialize(#[from] serde_json::Error),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Timed out: {0}")]
    Timeout(String),

    #[error("Resource busy: {0}")]
    Busy(String),

    #[error("Internal error: {0}")]
    Internal(String),

    /// Subsystem tool is not enabled in the tool registry.
    #[error("Subsystem not enabled: {tool:?} - {reason}")]
    SubsystemInactive {
        tool: Option<&'static str>,
        reason: String,
    },

    /// Subsystem is enabled but unavailable (startup failed, crashed).
    #[error("Subsystem unavailable: {name} ({message})")]
    SubsystemUnavailable {
        name: String,
        status: String,
        message: String,
    },

    /// Subsystem not found in registry.
    #[error("Subsystem not registered: {name}")]
    SubsystemNotFound { name: String },
}

impl From<AppError> for SerializedError {
    fn from(e: AppError) -> Self {
        match e {
            AppError::SubsystemInactive { tool, reason } => {
                SerializedError::new("SUBSYSTEM_INACTIVE", format!("{:?}: {}", tool, reason))
                    .with_details(reason)
            }
            AppError::SubsystemUnavailable {
                name,
                status,
                message,
            } => SerializedError::new("SUBSYSTEM_UNAVAILABLE", format!("{}: {}", name, message))
                .with_details(format!("status={}", status)),
            AppError::SubsystemNotFound { name } => SerializedError::new(
                "SUBSYSTEM_NOT_FOUND",
                format!("Unknown subsystem: {}", name),
            ),
            AppError::Database(_) => SerializedError::new(crate::error::ERR_DB, e.to_string()),
            AppError::Io(_) => SerializedError::new(crate::error::ERR_FILE_IO, e.to_string()),
            AppError::Serialize(_) => SerializedError::new(crate::error::ERR_PARSE, e.to_string()),
            AppError::Network(_) => SerializedError::new(crate::error::ERR_NETWORK, e.to_string()),
            AppError::Auth(_) => SerializedError::new(crate::error::ERR_AUTH_FAILED, e.to_string()),
            AppError::NotFound(_) => {
                SerializedError::new(crate::error::ERR_NOT_FOUND, e.to_string())
            }
            AppError::InvalidInput(_) => {
                SerializedError::new(crate::error::ERR_INVALID_INPUT, e.to_string())
            }
            AppError::Timeout(_) => SerializedError::new(crate::error::ERR_TIMEOUT, e.to_string()),
            AppError::Busy(_) => SerializedError::new(crate::error::ERR_BUSY, e.to_string()),
            AppError::Internal(_) => {
                SerializedError::new(crate::error::ERR_INTERNAL, e.to_string())
            }
        }
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::Internal(msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::Internal(msg.to_string())
    }
}
