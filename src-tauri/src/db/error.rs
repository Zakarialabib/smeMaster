use crate::error::SerializedError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppDbError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Encryption error: {0}")]
    Crypto(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Migration error: {0}")]
    Migration(String),

    /// Storage is full (common on mobile devices with limited flash).
    #[error("Storage full: cannot write to database")]
    StorageFull,

    /// Database file appears corrupted.
    #[error("Database corrupted: {0}")]
    DatabaseCorrupt(String),

    /// Cannot open database file (permissions, storage not mounted).
    #[error("Cannot open database: {0}")]
    CantOpen(String),

    /// Database is busy (WAL checkpoint contention, possible on mobile).
    #[error("Database busy, try again: {0}")]
    DatabaseBusy(String),

    /// Internal error (e.g. JSON serialization failure).
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<AppDbError> for SerializedError {
    fn from(e: AppDbError) -> Self {
        match &e {
            AppDbError::Database(sqlx_err) => {
                // Map SQLite-specific errors to mobile-friendly variants
                if let sqlx::Error::RowNotFound = sqlx_err {
                    return SerializedError::new(crate::error::ERR_NOT_FOUND, e.to_string());
                }

                // Check if the error description contains known SQLite error codes
                let msg = sqlx_err.to_string();
                if msg.contains("disk I/O error") || msg.contains("SQLITE_IOERR") {
                    return SerializedError::new(crate::error::ERR_DISK, msg);
                }
                if msg.contains("database or disk is full") || msg.contains("SQLITE_FULL") {
                    return SerializedError::new(crate::error::ERR_DISK_FULL, msg);
                }
                if msg.contains("database is locked") || msg.contains("SQLITE_BUSY") {
                    return SerializedError::new(crate::error::ERR_DB_BUSY, msg);
                }
                if msg.contains("file is not a database")
                    || msg.contains("database disk image is malformed")
                    || msg.contains("SQLITE_CORRUPT")
                {
                    return SerializedError::new(crate::error::ERR_DB_CORRUPT, msg);
                }
                if msg.contains("unable to open database") || msg.contains("SQLITE_CANTOPEN") {
                    return SerializedError::new(crate::error::ERR_DB_CANTOPEN, msg);
                }

                SerializedError::new(crate::error::ERR_DB, e.to_string())
            }
            AppDbError::StorageFull => {
                SerializedError::new(crate::error::ERR_DISK_FULL, e.to_string())
            }
            AppDbError::DatabaseCorrupt(msg) => {
                SerializedError::new(crate::error::ERR_DB_CORRUPT, msg)
            }
            AppDbError::CantOpen(msg) => SerializedError::new(crate::error::ERR_DB_CANTOPEN, msg),
            AppDbError::DatabaseBusy(msg) => SerializedError::new(crate::error::ERR_DB_BUSY, msg),
            AppDbError::NotFound(msg) => SerializedError::new(crate::error::ERR_NOT_FOUND, msg),
            _ => SerializedError::new(crate::error::ERR_INTERNAL, e.to_string()),
        }
    }
}

/// All Tauri DB commands return this type.
pub type AppResult<T> = Result<T, AppDbError>;
