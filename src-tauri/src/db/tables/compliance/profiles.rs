// ── ComplianceProfiles query functions ───────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::compliance::schema::ComplianceProfile;

/// List all compliance profiles, ordered by `code ASC`.
pub async fn list(pool: &SqlitePool) -> Result<Vec<ComplianceProfile>, AppDbError> {
    sqlx::query_as::<_, ComplianceProfile>(
        "SELECT * FROM compliance_profiles ORDER BY code ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a compliance profile by its unique `code`.
///
/// Returns `AppDbError::NotFound` when no profile matches.
pub async fn get_by_code(
    pool: &SqlitePool,
    code: &str,
) -> Result<ComplianceProfile, AppDbError> {
    sqlx::query_as::<_, ComplianceProfile>(
        "SELECT * FROM compliance_profiles WHERE code = ?",
    )
    .bind(code)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("ComplianceProfile with code '{code}' not found")))
}

/// Fetch a compliance profile by its primary key.
///
/// Returns `AppDbError::NotFound` when no profile matches.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<ComplianceProfile, AppDbError> {
    sqlx::query_as::<_, ComplianceProfile>("SELECT * FROM compliance_profiles WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("ComplianceProfile with id '{id}' not found")))
}

/// Create a new compliance profile and return the full row.
///
/// Auto-generates `id` (UUID v4), sets `is_active = 1`, `is_default = 0`,
/// and `created_at` to the current epoch second.
pub async fn create(
    pool: &SqlitePool,
    code: &str,
    name: &str,
    description: Option<&str>,
    region_hint: &str,
    rules_json: &str,
    is_default: bool,
) -> Result<ComplianceProfile, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let default = if is_default { 1_i64 } else { 0_i64 };

    sqlx::query_as::<_, ComplianceProfile>(
        r#"
        INSERT INTO compliance_profiles (id, code, name, description, region_hint, rules_json, is_active, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(description)
    .bind(region_hint)
    .bind(rules_json)
    .bind(default)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields on a compliance profile.
///
/// Only `Some` fields are applied; `None` fields are left unchanged.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: Option<&str>,
    description: Option<Option<&str>>,
    region_hint: Option<&str>,
    rules_json: Option<&str>,
    is_active: Option<bool>,
    is_default: Option<bool>,
) -> Result<(), AppDbError> {
    let mut sets: Vec<String> = Vec::new();

    if let Some(v) = name {
        sets.push(format!("\"name\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = description {
        if let Some(val) = v {
            sets.push(format!("\"description\" = '{}'", val.replace('\'', "''")));
        } else {
            sets.push("\"description\" = NULL".to_string());
        }
    }
    if let Some(v) = region_hint {
        sets.push(format!("\"region_hint\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = rules_json {
        sets.push(format!(
            "\"rules_json\" = '{}'",
            v.replace('\'', "''")
        ));
    }
    if let Some(v) = is_active {
        sets.push(format!("\"is_active\" = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = is_default {
        sets.push(format!("\"is_default\" = {}", if v { 1 } else { 0 }));
    }

    if sets.is_empty() {
        return Ok(());
    }

    let sql = format!("UPDATE compliance_profiles SET {} WHERE id = ?", sets.join(", "));
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ComplianceProfile with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Delete a compliance profile by its primary key.
///
/// Returns `AppDbError::NotFound` when no profile matches.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM compliance_profiles WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ComplianceProfile with id '{id}' not found"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = create_test_pool().await;

        let profile = create(
            &pool,
            "gdpr",
            "GDPR Compliance",
            Some("GDPR profile for EU region"),
            "EU",
            r#"{"rules":["unsubscribe"]}"#,
            false,
        )
        .await
        .unwrap();
        assert_eq!(profile.code, "gdpr");
        assert_eq!(profile.name, "GDPR Compliance");
        assert_eq!(
            profile.description.as_deref(),
            Some("GDPR profile for EU region")
        );
        assert_eq!(profile.region_hint, "EU");
        assert_eq!(profile.rules_json, r#"{"rules":["unsubscribe"]}"#);
        assert_eq!(profile.is_active, 1);
        assert_eq!(profile.is_default, 0);

        let fetched = get_by_id(&pool, &profile.id).await.unwrap();
        assert_eq!(fetched.id, profile.id);
        assert_eq!(fetched.code, "gdpr");
        assert_eq!(fetched.name, "GDPR Compliance");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;

        let err = get_by_id(&pool, "nonexistent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_code() {
        let pool = create_test_pool().await;

        let profile = create(&pool, "can-spam", "CAN-SPAM", None, "US", r#"{}"#, true)
            .await
            .unwrap();
        assert_eq!(profile.is_default, 1);

        let fetched = get_by_code(&pool, "can-spam").await.unwrap();
        assert_eq!(fetched.id, profile.id);
        assert_eq!(fetched.name, "CAN-SPAM");
        assert_eq!(fetched.region_hint, "US");
    }

    #[tokio::test]
    async fn test_get_by_code_not_found() {
        let pool = create_test_pool().await;

        let err = get_by_code(&pool, "nonexistent-code").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_returns_all_profiles_ordered_by_code() {
        let pool = create_test_pool().await;

        create(&pool, "can-spam", "CAN-SPAM", None, "US", r#"{}"#, false)
            .await
            .unwrap();
        create(&pool, "gdpr", "GDPR", None, "EU", r#"{}"#, false)
            .await
            .unwrap();

        let profiles = list(&pool).await.unwrap();
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].code, "can-spam");
        assert_eq!(profiles[1].code, "gdpr");
    }

    #[tokio::test]
    async fn test_update_modifies_all_fields() {
        let pool = create_test_pool().await;

        let profile = create(
            &pool,
            "test-code",
            "Original Name",
            Some("Original desc"),
            "US",
            r#"{"rules":[]}"#,
            false,
        )
        .await
        .unwrap();

        update(
            &pool,
            &profile.id,
            Some("Updated Name"),
            Some(Some("Updated desc")),
            Some("EU"),
            Some(r#"{"rules":["unsubscribe"]}"#),
            Some(false),
            Some(true),
        )
        .await
        .unwrap();

        let updated = get_by_id(&pool, &profile.id).await.unwrap();
        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.description.as_deref(), Some("Updated desc"));
        assert_eq!(updated.region_hint, "EU");
        assert_eq!(updated.rules_json, r#"{"rules":["unsubscribe"]}"#);
        assert_eq!(updated.is_active, 0);
        assert_eq!(updated.is_default, 1);
    }

    #[tokio::test]
    async fn test_update_can_set_description_to_null() {
        let pool = create_test_pool().await;

        let profile = create(
            &pool,
            "nullable",
            "Has Description",
            Some("Will be cleared"),
            "US",
            r#"{}"#,
            false,
        )
        .await
        .unwrap();

        // Set description to NULL
        update(
            &pool,
            &profile.id,
            None,
            Some(None),
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        let updated = get_by_id(&pool, &profile.id).await.unwrap();
        assert!(updated.description.is_none());
    }

    #[tokio::test]
    async fn test_update_no_changes_returns_ok() {
        let pool = create_test_pool().await;

        let profile = create(&pool, "noop", "No-Op", None, "US", r#"{}"#, false)
            .await
            .unwrap();

        // All None — nothing to update, should return Ok(())
        update(
            &pool,
            &profile.id,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        let fetched = get_by_id(&pool, &profile.id).await.unwrap();
        assert_eq!(fetched.name, "No-Op");
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let pool = create_test_pool().await;

        let err = update(
            &pool,
            "nonexistent-id",
            Some("Name"),
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_removes_profile() {
        let pool = create_test_pool().await;

        let profile = create(&pool, "to-delete", "To Delete", None, "US", r#"{}"#, false)
            .await
            .unwrap();

        delete(&pool, &profile.id).await.unwrap();

        let err = get_by_id(&pool, &profile.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = create_test_pool().await;

        let err = delete(&pool, "nonexistent-id").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
