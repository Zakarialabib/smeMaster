// ── ComplianceChecks query functions ─────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::compliance::schema::ComplianceCheck;

/// List compliance checks for an account, ordered by `checked_at DESC`.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<ComplianceCheck>, AppDbError> {
    sqlx::query_as::<_, ComplianceCheck>(
        "SELECT * FROM compliance_checks WHERE company_id = ? ORDER BY checked_at DESC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single compliance check by its primary key.
///
/// Returns `AppDbError::NotFound` when no check matches.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<ComplianceCheck, AppDbError> {
    sqlx::query_as::<_, ComplianceCheck>("SELECT * FROM compliance_checks WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("ComplianceCheck with id '{id}' not found")))
}

/// Create a new compliance check and return the full row.
///
/// Auto-generates `id` (UUID v4), and sets `checked_at` to the current epoch
/// second.
pub async fn create(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    email_draft_id: Option<&str>,
    campaign_id: Option<&str>,
    profile_ids: &str,
    score: f64,
    violations_json: Option<&str>,
) -> Result<ComplianceCheck, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = if id.is_empty() { uuid::Uuid::new_v4().to_string() } else { id.to_string() };

    sqlx::query_as::<_, ComplianceCheck>(
        r#"
        INSERT INTO compliance_checks (id, company_id, email_draft_id, campaign_id, profile_ids, score, violations_json, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(email_draft_id)
    .bind(campaign_id)
    .bind(profile_ids)
    .bind(score)
    .bind(violations_json)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete compliance checks older than the given timestamp.
///
/// Returns the number of rows deleted (can be zero, which is not an error).
pub async fn delete_old(
    pool: &SqlitePool,
    older_than: i64,
) -> Result<u64, AppDbError> {
    let result = sqlx::query("DELETE FROM compliance_checks WHERE checked_at < ?")
        .bind(older_than)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;

    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        helpers::insert_test_draft(&pool, "draft-1", "acc-1").await;

        let check = create(
            &pool,
            "",
            "acc-1",
            Some("draft-1"),
            None,
            "prof-1,prof-2",
            0.85,
            Some(r#"["no_unsubscribe"]"#),
        )
        .await
        .unwrap();
        assert_eq!(check.company_id, "acc-1");
        assert_eq!(check.email_draft_id.as_deref(), Some("draft-1"));
        assert!(check.campaign_id.is_none());
        assert_eq!(check.profile_ids, "prof-1,prof-2");
        assert!((check.score - 0.85).abs() < f64::EPSILON);
        assert_eq!(
            check.violations_json.as_deref(),
            Some(r#"["no_unsubscribe"]"#)
        );

        let fetched = get_by_id(&pool, &check.id).await.unwrap();
        assert_eq!(fetched.id, check.id);
        assert_eq!(fetched.score, check.score);
        assert_eq!(fetched.profile_ids, "prof-1,prof-2");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;

        let err = get_by_id(&pool, "nonexistent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_returns_checks_ordered_by_checked_at_desc() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        let now = chrono::Utc::now().timestamp();

        // Insert older check with a manual timestamp via raw SQL so ordering is deterministic
        let older_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO compliance_checks (id, company_id, profile_ids, score, checked_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&older_id)
        .bind("acc-1")
        .bind("prof-1")
        .bind(1.0_f64)
        .bind(now - 100)
        .execute(&pool)
        .await
        .unwrap();

        let newer_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO compliance_checks (id, company_id, profile_ids, score, checked_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&newer_id)
        .bind("acc-1")
        .bind("prof-2")
        .bind(0.5_f64)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        let checks = list(&pool, "acc-1").await.unwrap();
        assert_eq!(checks.len(), 2);
        // Most recent first (checked_at DESC)
        assert_eq!(checks[0].id, newer_id);
        assert_eq!(checks[1].id, older_id);
    }

    #[tokio::test]
    async fn test_list_filters_by_account() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        helpers::insert_test_account(&pool, "acc-2").await;

        create(&pool, "", "acc-1", None, None, "prof-1", 1.0, None)
            .await
            .unwrap();
        create(&pool, "", "acc-2", None, None, "prof-2", 0.5, None)
            .await
            .unwrap();

        let checks = list(&pool, "acc-1").await.unwrap();
        assert_eq!(checks.len(), 1);
        assert_eq!(checks[0].company_id, "acc-1");
    }

    #[tokio::test]
    async fn test_delete_old_removes_expired_checks() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        let now = chrono::Utc::now().timestamp();

        // Insert a very old check (30 days ago)
        let old_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO compliance_checks (id, account_id, profile_ids, score, checked_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&old_id)
        .bind("acc-1")
        .bind("prof-1")
        .bind(1.0_f64)
        .bind(now - 86400 * 30)
        .execute(&pool)
        .await
        .unwrap();

        // Insert a recent check
        let recent_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO compliance_checks (id, account_id, profile_ids, score, checked_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&recent_id)
        .bind("acc-1")
        .bind("prof-1")
        .bind(1.0_f64)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        // Delete older than 7 days
        let deleted = delete_old(&pool, now - 86400 * 7).await.unwrap();
        assert_eq!(deleted, 1);

        // Recent should still exist
        assert!(get_by_id(&pool, &recent_id).await.is_ok());
        // Old should be gone
        assert!(get_by_id(&pool, &old_id).await.is_err());
    }

    #[tokio::test]
    async fn test_delete_old_returns_zero_when_nothing_to_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-1").await;
        let now = chrono::Utc::now().timestamp();

        create(&pool, "", "acc-1", None, None, "prof-1", 1.0, None)
            .await
            .unwrap();

        // Delete older than now — nothing is older than now
        let deleted = delete_old(&pool, now).await.unwrap();
        assert_eq!(deleted, 0);
    }
}
