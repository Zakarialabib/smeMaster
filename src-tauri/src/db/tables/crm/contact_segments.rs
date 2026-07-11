//! Contact-segments query functions.
//!
//! Manages the `contact_segments` table (saved, admin-authored contact queries)
//! and executes them against `contacts`. Functions are async and return
//! `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::{Contact, ContactSegment};

/// List all segments for a given account, ordered by `name`.
///
/// # Parameters
/// - `company_id`: the account whose segments to return.
///
/// # Returns
/// A `Vec<ContactSegment>` ordered by `name ASC` (possibly empty).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<ContactSegment>, AppDbError> {
    sqlx::query_as::<_, ContactSegment>(
        "SELECT * FROM contact_segments WHERE company_id = ? ORDER BY name ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single segment by its primary key.
///
/// # Parameters
/// - `id`: the segment's primary key.
///
/// # Returns
/// The matching `ContactSegment`.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactSegment with id '{id}' not found` when no row matches `id`.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<ContactSegment, AppDbError> {
    let opt = sqlx::query_as::<_, ContactSegment>("SELECT * FROM contact_segments WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "ContactSegment")
}

/// Create a new contact segment.
///
/// # Parameters
/// - `company_id`: owning account.
/// - `name`: segment display name.
/// - `query`: the segment's SQL query (stored as-is).
/// - `is_dynamic`: whether the segment is dynamically evaluated.
///
/// # Returns
/// The newly created `ContactSegment` via `RETURNING *`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `id` is auto-generated
/// (UUID v4) and `created_at` is set to `now`.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    query: &str,
    is_dynamic: bool,
) -> Result<ContactSegment, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let is_dynamic_int: i64 = if is_dynamic { 1 } else { 0 };

    sqlx::query_as::<_, ContactSegment>(
        r#"
        INSERT INTO contact_segments (id, company_id, name, query, is_dynamic, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(query)
    .bind(is_dynamic_int)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a segment by its primary key.
///
/// # Parameters
/// - `id`: the segment's primary key.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactSegment with id '{id}' not found` when no row matches
/// (zero rows affected).
pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_segments WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactSegment with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Insert or update a segment by `ON CONFLICT(company_id, name) DO UPDATE`.
///
/// # Parameters
/// - `id`: primary key to use on insert (ignored on conflict update).
/// - `company_id`: owning account; part of the conflict key.
/// - `name`: segment name; part of the conflict key.
/// - `query`: the segment's SQL query.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `is_dynamic` is fixed to
/// `1` and `created_at` to `now`.
pub async fn upsert_segment(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    query: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query(
        r#"
        INSERT INTO contact_segments (id, company_id, name, query, is_dynamic, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(company_id, name) DO UPDATE SET
            name  = EXCLUDED.name,
            query = EXCLUDED.query
        "#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(query)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Delete a segment by id, scoped to `company_id` for safety.
///
/// # Parameters
/// - `id`: the segment's primary key.
/// - `company_id`: the owning account; the delete only matches rows where
///   `company_id` also matches.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactSegment with id '{id}' not found for account '{company_id}'` when no
/// row matches (zero rows affected).
pub async fn delete_segment(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_segments WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactSegment with id '{id}' not found for account '{company_id}'"
        )));
    }
    Ok(())
}

/// Execute a segment's stored SQL query against the `contacts` table.
///
/// # Parameters
/// - `segment_id`: primary key of the segment whose `query` is executed.
///
/// # Returns
/// The `Contact` rows returned by the segment's query.
///
/// # Errors
/// Returns `AppDbError::NotFound` (via `get_by_id`) when the segment does not
/// exist. Other database failures surface as `AppDbError::Database`.
///
/// # SQL-safety (intentionally unsafe by design)
/// `segment.query` is admin-authored SQL stored in the database and is passed
/// directly to `AssertSqlSafe` with no parameterization or whitelisting. This is
/// deliberate: segments are trusted, admin-created queries. Do NOT feed
/// untrusted input here.
pub async fn execute(pool: &SqlitePool, segment_id: &str) -> Result<Vec<Contact>, AppDbError> {
    let segment = get_by_id(pool, segment_id).await?;

    sqlx::query_as::<_, Contact>(sqlx::AssertSqlSafe(segment.query))
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    use sqlx::SqlitePool;

    async fn insert_contact(pool: &SqlitePool, id: &str, email: &str, name: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO contacts (id, email, display_name, frequency, engagement_score, health_status, created_at, updated_at) VALUES (?, ?, ?, 1, 0.0, 'cold', ?, ?)",
        )
        .bind(id)
        .bind(email)
        .bind(name)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn test_list_contact_segments() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;
        helpers::insert_test_account(&pool, "acct-2").await;

        create(&pool, "acct-1", "Active Users", "SELECT * FROM contacts WHERE 1=1", false).await.unwrap();
        create(&pool, "acct-1", "Inactive", "SELECT * FROM contacts WHERE 1=0", false).await.unwrap();
        create(&pool, "acct-2", "Other", "SELECT 1", false).await.unwrap();

        let segments = list(&pool, "acct-1").await.unwrap();
        assert_eq!(segments.len(), 2);
        assert!(segments.iter().any(|s| s.name == "Active Users"));
    }

    #[tokio::test]
    async fn test_get_by_id_contact_segment() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let segment = create(&pool, "acct-1", "Test Segment", "SELECT * FROM contacts", true).await.unwrap();
        let sid = segment.id.clone();

        let fetched = get_by_id(&pool, &sid).await.unwrap();
        assert_eq!(fetched.name, "Test Segment");
        assert_eq!(fetched.is_dynamic, 1);

        // Not found
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_create_contact_segment() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let segment = create(&pool, "acct-1", "Dynamic Segment", "SELECT * FROM contacts WHERE frequency > 5", true).await.unwrap();
        assert!(!segment.id.is_empty());
        assert_eq!(segment.name, "Dynamic Segment");
        assert_eq!(segment.is_dynamic, 1);
        assert_eq!(segment.query, "SELECT * FROM contacts WHERE frequency > 5");
    }

    #[tokio::test]
    async fn test_delete_by_id_contact_segment() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        let segment = create(&pool, "acct-1", "To Delete", "SELECT 1", false).await.unwrap();
        let sid = segment.id.clone();

        delete_by_id(&pool, &sid).await.unwrap();

        let err = get_by_id(&pool, &sid).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));

        // Delete non-existent returns NotFound
        let err = delete_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_execute_segment() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct-1").await;

        // Insert some contacts
        insert_contact(&pool, "ec1", "alpha@example.com", "Alpha").await;
        insert_contact(&pool, "ec2", "beta@example.com", "Beta").await;
        insert_contact(&pool, "ec3", "gamma@other.com", "Gamma").await;

        // Segment that matches contacts with @example.com
        let segment = create(
            &pool,
            "acct-1",
            "Example Users",
            "SELECT * FROM contacts WHERE email LIKE '%example.com' ORDER BY email ASC",
            false,
        ).await.unwrap();
        let sid = segment.id.clone();

        let results = execute(&pool, &sid).await.unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].email, "alpha@example.com");
        assert_eq!(results[1].email, "beta@example.com");

        // Segment that matches no contacts
        let segment_empty = create(
            &pool,
            "acct-1",
            "Empty Set",
            "SELECT * FROM contacts WHERE 1=0",
            false,
        ).await.unwrap();
        let empty_results = execute(&pool, &segment_empty.id).await.unwrap();
        assert!(empty_results.is_empty());

        // Execute non-existent segment returns NotFound
        let err = execute(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
