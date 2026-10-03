//! Core types for the resumable downloader.
//!
//! Ported from SignageMaster `plugin-downloader`, trimmed to SMEMaster needs
//! (AI model files + generic assets — no media/app-update categories).

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DownloadError {
    #[error("Invalid or malicious HTTP Range header: end < start or size overflow")]
    InvalidRangeHeader,
    #[error("Transfer stalled: no data received for {0}s")]
    Stalled(u64),
    #[error("Job interrupted by pause/cancel")]
    Interrupted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobCategory {
    AiModel,
    Generic,
}

impl JobCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobCategory::AiModel => "ai_model",
            JobCategory::Generic => "generic",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "ai_model" => JobCategory::AiModel,
            _ => JobCategory::Generic,
        }
    }
}

impl fmt::Display for JobCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Probing,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Queued => "queued",
            JobStatus::Probing => "probing",
            JobStatus::Downloading => "downloading",
            JobStatus::Paused => "paused",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "probing" => JobStatus::Probing,
            "downloading" => JobStatus::Downloading,
            "paused" => JobStatus::Paused,
            "completed" => JobStatus::Completed,
            "failed" => JobStatus::Failed,
            "cancelled" => JobStatus::Cancelled,
            _ => JobStatus::Queued,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, JobStatus::Completed | JobStatus::Cancelled)
    }
}

impl fmt::Display for JobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct DownloadJob {
    pub id: String,
    pub url: String,
    pub destination_path: String,
    pub category: JobCategory,
    pub status: JobStatus,
    pub total_bytes: i64,
    pub downloaded_bytes: i64,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub max_connections: i32,
    pub priority: i32,
    pub options_json: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DownloadChunk {
    pub id: String,
    pub job_id: String,
    pub chunk_index: i32,
    pub start_byte: i64,
    pub end_byte: i64,
    pub downloaded_bytes: i64,
    pub status: String,
    pub sha256: Option<String>,
    pub updated_at: String,
}

/// Per-job creation options (persisted as `options_json`).
///
/// `auth_bearer_token` authorizes private assets; the `hf_*` fields let boot
/// recovery re-run the HuggingFace cache finalize after an interrupted job.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadJobOptions {
    pub auth_bearer_token: Option<String>,
    pub hf_repo_id: Option<String>,
    pub hf_filename: Option<String>,
    pub hf_revision: Option<String>,
    pub hf_commit_hash: Option<String>,
}

/// Wire-format progress snapshot emitted over IPC (`downloader:progress`)
/// and returned by the downloader commands. camelCase per DTO convention.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadJobProgress {
    pub job_id: String,
    pub url: String,
    pub file_name: String,
    pub destination_path: String,
    pub category: JobCategory,
    pub status: JobStatus,
    pub total_bytes: i64,
    pub downloaded_bytes: i64,
    pub transfer_rate_bytes_per_sec: i64,
    pub eta_seconds: Option<i64>,
    pub progress_percentage: f64,
    pub active_connections: i32,
    pub priority: i32,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// IPC payload for `downloader_create_job` (camelCase DTO).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDownloadJob {
    pub url: String,
    pub destination_path: String,
    #[serde(default = "default_category")]
    pub category: JobCategory,
    pub expected_sha256: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default = "default_max_connections")]
    pub max_connections: i32,
    pub options: Option<DownloadJobOptions>,
}

fn default_category() -> JobCategory {
    JobCategory::Generic
}
fn default_priority() -> i32 {
    5
}
fn default_max_connections() -> i32 {
    8
}
