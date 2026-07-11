//! Sync-job table data-access layer.
//!
//! One row per migration / backfill run (see report.md §6.2). Tracks overall
//! progress across folders so the UI can show a single resume-able timeline
//! and the orchestrator can drive a run to completion across app restarts.
//!
//! Request structs live in `crate::commands::core` (mirroring the
//! `folder_sync_state` convention) and are imported here.

use sqlx::SqlitePool;

use crate::commands::core::CreateSyncJobRequest;
use crate::db::error::AppDbError;
use crate::db::mail::schema::SyncJob;

/// Create a new sync job (one row per migration run).
pub async fn create(pool: &SqlitePool, req: &CreateSyncJobRequest) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"
        INSERT INTO sync_jobs (
            id, account_id, phase, status,
            total_folders, done_folders, estimated_messages, synced_messages,
            started_at, created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
        "#,
    )
    .bind(&req.id)
    .bind(&req.account_id)
    .bind(req.phase.clone().unwrap_or_else(|| "discovery".to_string()))
    .bind(req.status.clone().unwrap_or_else(|| "running".to_string()))
    .bind(req.total_folders.unwrap_or(0))
    .bind(req.estimated_messages)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Fetch a single sync job by id. Returns `None` when absent.
pub async fn get(pool: &SqlitePool, job_id: &str) -> Result<Option<SyncJob>, AppDbError> {
    sqlx::query_as::<_, SyncJob>("SELECT * FROM sync_jobs WHERE id = ?")
        .bind(job_id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// List sync jobs for an account, newest first.
pub async fn list_by_account(pool: &SqlitePool, account_id: &str) -> Result<Vec<SyncJob>, AppDbError> {
    sqlx::query_as::<_, SyncJob>(
        "SELECT * FROM sync_jobs WHERE account_id = ?1 ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update folder / message progress counters for a running job.
pub async fn update_progress(
    pool: &SqlitePool,
    job_id: &str,
    done_folders: i64,
    synced_messages: i64,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE sync_jobs SET done_folders = ?, synced_messages = ? WHERE id = ?",
    )
    .bind(done_folders)
    .bind(synced_messages)
    .bind(job_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Advance a job's high-level phase (discovery → backfill → cutover → done).
pub async fn set_phase(pool: &SqlitePool, job_id: &str, phase: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE sync_jobs SET phase = ? WHERE id = ?")
        .bind(phase)
        .bind(job_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Mark a job complete and stamp the finish time.
pub async fn mark_done(pool: &SqlitePool, job_id: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE sync_jobs SET status = 'done', phase = 'done', finished_at = ? WHERE id = ?",
    )
    .bind(now)
    .bind(job_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::db::migrations::run_migrations;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    async fn seed_account(pool: &SqlitePool, id: &str, email: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, created_at, updated_at) VALUES (?, ?, 'imap', 'password', '{}', ?, ?)",
        )
        .bind(id)
        .bind(email)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    fn make_req(id: &str, account_id: &str) -> CreateSyncJobRequest {
        CreateSyncJobRequest {
            id: id.to_string(),
            account_id: account_id.to_string(),
            phase: None,
            status: None,
            total_folders: Some(3),
            estimated_messages: Some(1200),
        }
    }

    #[tokio::test]
    async fn test_create_and_get() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_sj_1", "sj1@example.com").await;

        create(&pool, &make_req("job_1", "acc_sj_1")).await.unwrap();
        let job = get(&pool, "job_1").await.unwrap().unwrap();
        assert_eq!(job.account_id, "acc_sj_1");
        assert_eq!(job.phase, "discovery");
        assert_eq!(job.status, "running");
        assert_eq!(job.total_folders, 3);
        assert_eq!(job.done_folders, 0);
    }

    #[tokio::test]
    async fn test_progress_and_done() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_sj_2", "sj2@example.com").await;
        create(&pool, &make_req("job_2", "acc_sj_2")).await.unwrap();

        update_progress(&pool, "job_2", 2, 800).await.unwrap();
        set_phase(&pool, "job_2", "cutover").await.unwrap();
        mark_done(&pool, "job_2").await.unwrap();

        let job = get(&pool, "job_2").await.unwrap().unwrap();
        assert_eq!(job.done_folders, 2);
        assert_eq!(job.synced_messages, 800);
        assert_eq!(job.status, "done");
        assert!(job.finished_at.is_some());
    }

    #[tokio::test]
    async fn test_list_by_account() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_sj_3", "sj3@example.com").await;
        create(&pool, &make_req("job_a", "acc_sj_3")).await.unwrap();
        create(&pool, &make_req("job_b", "acc_sj_3")).await.unwrap();

        let jobs = list_by_account(&pool, "acc_sj_3").await.unwrap();
        assert_eq!(jobs.len(), 2);
    }
}
