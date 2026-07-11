//! Contact-labels query functions.
//!
//! Manages the `contact_labels` table (per-account labels/tags). Functions are
//! async and return `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::ContactLabel;

/// List all labels for a given account, ordered by `sort_order`.
///
/// # Parameters
/// - `company_id`: the account whose labels to return.
///
/// # Returns
/// A `Vec<ContactLabel>` ordered by `sort_order ASC` (possibly empty).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<ContactLabel>, AppDbError> {
    sqlx::query_as::<_, ContactLabel>(
        "SELECT * FROM contact_labels WHERE company_id = ? ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single label by its primary key.
///
/// # Parameters
/// - `id`: the label's primary key.
///
/// # Returns
/// The matching `ContactLabel`.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactLabel with id '{id}' not found` when no row matches `id`.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<ContactLabel, AppDbError> {
    let opt = sqlx::query_as::<_, ContactLabel>("SELECT * FROM contact_labels WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "ContactLabel")
}

/// Create a new contact label.
///
/// # Parameters
/// - `name`: label display name.
/// - `company_id`: owning account.
/// - `color`: optional label color (e.g. hex string).
///
/// # Returns
/// The newly created `ContactLabel` via `RETURNING *`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `id` is auto-generated
/// (UUID v4), `sort_order` is fixed to `0`, and `created_at` is set to `now`.
pub async fn create(
    pool: &SqlitePool,
    name: &str,
    company_id: &str,
    color: Option<&str>,
) -> Result<ContactLabel, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, ContactLabel>(
        r#"
        INSERT INTO contact_labels (id, company_id, name, color, sort_order, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(color)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a label by its primary key.
///
/// # Parameters
/// - `id`: the label's primary key.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactLabel with id '{id}' not found` when no row matches
/// (zero rows affected).
pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_labels WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactLabel with id '{id}' not found"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    #[tokio::test]
    async fn test_list_contact_labels() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;
        helpers::insert_test_account(&pool, "acct-2").await;

        create(&pool, "Important", "acct-1", Some("#ff0000")).await.unwrap();
        create(&pool, "Follow-up", "acct-1", Some("#00ff00")).await.unwrap();
        create(&pool, "Other-acct", "acct-2", None).await.unwrap();

        let labels = list(&pool, "acct-1").await.unwrap();
        assert_eq!(labels.len(), 2);
        assert!(labels.iter().any(|l| l.name == "Important"));
        assert!(labels.iter().any(|l| l.name == "Follow-up"));
    }

    #[tokio::test]
    async fn test_get_by_id_contact_label() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let label = create(&pool, "Urgent", "acct-1", Some("#ff6600")).await.unwrap();
        let lid = label.id.clone();

        let fetched = get_by_id(&pool, &lid).await.unwrap();
        assert_eq!(fetched.name, "Urgent");
        assert_eq!(fetched.color.as_deref(), Some("#ff6600"));

        // Not found
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_create_contact_label() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let label = create(&pool, "New Label", "acct-1", None).await.unwrap();
        assert!(!label.id.is_empty());
        assert_eq!(label.name, "New Label");
        assert_eq!(label.company_id, "acct-1");
        assert!(label.color.is_none());
        assert_eq!(label.sort_order, 0);
    }

    #[tokio::test]
    async fn test_delete_by_id_contact_label() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let label = create(&pool, "To Delete", "acct-1", None).await.unwrap();
        let lid = label.id.clone();

        delete_by_id(&pool, &lid).await.unwrap();

        let err = get_by_id(&pool, &lid).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));

        // Delete non-existent returns NotFound
        let err = delete_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
