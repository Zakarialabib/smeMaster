// ── Contacts query functions ──────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::common::{apply_field_updates, build_sort_clause, fetch_or_not_found, like_pattern};
use crate::db::error::AppDbError;
use crate::db::contacts::schema::{
    Contact, ContactEngagementData, ContactWithStats, IdEmailPair,
};
use crate::commands::contacts::{UpsertContactRequest, ContactStats};
use crate::db::commands::UpdateFields;

/// List contacts with pagination, optional sort, and optional search.
///
/// # Parameters
/// - `limit` / `offset`: pagination window (rows `OFFSET`..`OFFSET+limit`).
/// - `sort_by`: whitelisted column to sort by (`email`, `display_name`,
///   `frequency`, `created_at`); falls back to `email ASC` for `None` or an
///   unrecognized value (see `build_sort_clause`).
/// - `search_query`: when `Some(q)`, filters rows where `email` or
///   `display_name` matches `%q%` (built via `like_pattern`).
///
/// # Returns
/// A `Vec<Contact>`, possibly empty. A missing match is not an error.
///
/// # SQL-safety
/// The `ORDER BY` fragment is whitelisted through `build_sort_clause` and the
/// `LIKE` patterns are bound parameters, so the assembled statement is wrapped
/// in `AssertSqlSafe` safely (no raw user input reaches the SQL text).
pub async fn list(
    pool: &SqlitePool,
    limit: i64,
    offset: i64,
    sort_by: Option<&str>,
    search_query: Option<&str>,
) -> Result<Vec<Contact>, AppDbError> {
    let allowed = &[
        ("display_name", "display_name ASC"),
        ("frequency", "frequency DESC"),
        ("created_at", "created_at DESC"),
    ];
    let sort_column = build_sort_clause(allowed, "email ASC", sort_by);

    match search_query {
        Some(q) => {
            let pattern = like_pattern(q);
            let sql = format!(
                "SELECT * FROM contacts \
                 WHERE email LIKE ? OR display_name LIKE ? \
                 ORDER BY {} LIMIT ? OFFSET ?",
                sort_column
            );
            // SQL-safety: `sort_column` is whitelisted via `build_sort_clause`
            // and `pattern` is bound, so the statement is safe under AssertSqlSafe.
            sqlx::query_as::<_, Contact>(sqlx::AssertSqlSafe(sql))
                .bind(&pattern)
                .bind(&pattern)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await
                .map_err(AppDbError::Database)
        }
        None => {
            let sql = format!(
                "SELECT * FROM contacts ORDER BY {} LIMIT ? OFFSET ?",
                sort_column
            );
            sqlx::query_as::<_, Contact>(sqlx::AssertSqlSafe(sql))
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await
                .map_err(AppDbError::Database)
        }
    }
}

/// Fetch a single contact by its primary key.
///
/// # Parameters
/// - `id`: the contact's primary key.
///
/// # Returns
/// The matching `Contact`.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `Contact with id '{id}' not found` when no row matches `id`.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Contact, AppDbError> {
    let opt = sqlx::query_as::<_, Contact>("SELECT * FROM contacts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "Contact")
}

/// Look up a contact by email address.
///
/// Returns `None` (not an error) when no contact matches.
pub async fn get_by_email(pool: &SqlitePool, email: &str) -> Result<Option<Contact>, AppDbError> {
    sqlx::query_as::<_, Contact>("SELECT * FROM contacts WHERE email = ?")
        .bind(email)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Insert or update a contact by email (`ON CONFLICT(email) DO UPDATE`).
///
/// # Parameters
/// - `req`: an `UpsertContactRequest` with `email` (required) plus optional
///   `id`, `display_name`, `avatar_url`, `notes`, `frequency`, and
///   `last_contacted_at`.
///
/// # Returns
/// The full `Contact` row via `RETURNING *`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `id` is auto-generated
/// when `req.id` is `None`; `engagement_score` starts at `0.0` and
/// `health_status` at `'cold'`.
pub async fn upsert(pool: &SqlitePool, req: UpsertContactRequest) -> Result<Contact, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = req.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    sqlx::query_as::<_, Contact>(
        r#"
        INSERT INTO contacts (
            id, email, display_name, avatar_url, frequency,
            last_contacted_at, first_contacted_at, notes,
            engagement_score, health_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, 'cold', ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            display_name   = COALESCE(EXCLUDED.display_name, contacts.display_name),
            avatar_url     = COALESCE(EXCLUDED.avatar_url, contacts.avatar_url),
            frequency      = COALESCE(EXCLUDED.frequency, contacts.frequency),
            last_contacted_at = COALESCE(EXCLUDED.last_contacted_at, contacts.last_contacted_at),
            notes          = COALESCE(EXCLUDED.notes, contacts.notes),
            first_contacted_at = COALESCE(contacts.first_contacted_at, EXCLUDED.first_contacted_at),
            engagement_score = COALESCE(EXCLUDED.engagement_score, contacts.engagement_score),
            updated_at     = EXCLUDED.updated_at
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(&req.email)
    .bind(&req.display_name)
    .bind(&req.avatar_url)
    .bind(req.frequency.unwrap_or(1))
    .bind(req.last_contacted_at)
    .bind(None::<i64>) // first_contacted_at
    .bind(&req.notes)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Partially update a contact's fields via the shared `apply_field_updates`.
///
/// # Parameters
/// - `id`: primary key of the contact to update.
/// - `fields`: an `UpdateFields` describing `set` (column → JSON value) and
///   `unset` (columns to set to `NULL`).
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `updated_at` is always
/// bumped to `now`; when both `set` and `unset` are empty only `updated_at`
/// is written.
///
/// # SQL-safety
/// Column names come from the `fields` keys but are emitted as quoted
/// identifiers with bound values, so the generated `UPDATE` is wrapped in
/// `AssertSqlSafe` (no raw user input reaches the SQL text).
pub async fn update_fields(
    pool: &SqlitePool,
    id: &str,
    fields: &UpdateFields,
) -> Result<(), AppDbError> {
    apply_field_updates(pool, "contacts", id, fields).await
}

/// Delete a contact by its primary key.
///
/// # Parameters
/// - `id`: the contact's primary key.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `Contact with id '{id}' not found` when no row matches (zero rows affected).
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contacts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Contact with id '{id}' not found")));
    }
    Ok(())
}

/// Compute aggregate engagement statistics for a contact by email.
///
/// Returns counts of emails, meetings, calls, last interaction timestamp,
/// and an engagement trend label.
pub async fn get_stats(pool: &SqlitePool, email: &str) -> Result<ContactStats, AppDbError> {
    let row = sqlx::query_as::<_, (i64, i64, i64, Option<i64>, String)>(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN el.event_type = 'email'   THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN el.event_type = 'meeting' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN el.event_type = 'call'    THEN 1 ELSE 0 END), 0),
            MAX(el.created_at),
            'stable'
        FROM engagement_log el
        JOIN contacts c ON el.contact_id = c.id
        WHERE c.email = ?
        "#,
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(ContactStats {
        total_emails: row.0,
        total_meetings: row.1,
        total_calls: row.2,
        last_interaction: row.3,
        engagement_trend: row.4,
    })
}

/// Full-text search contacts by email or display_name.
pub async fn search_contacts(
    pool: &SqlitePool,
    query: &str,
    limit: i64,
) -> Result<Vec<Contact>, AppDbError> {
    let pattern = like_pattern(query);
    sqlx::query_as::<_, Contact>(
        "SELECT * FROM contacts WHERE email LIKE ? OR display_name LIKE ? \
         ORDER BY frequency DESC, display_name ASC LIMIT ?",
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get a single contact joined with computed task and email counts.
///
/// # Parameters
/// - `contact_id`: the contact's primary key.
///
/// # Returns
/// `Ok(Some(ContactWithStats))` when the contact exists, or `Ok(None)` (not an
/// error) when no contact matches `contact_id`. `task_count` and `email_count`
/// are `COALESCE(..., 0)`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_with_stats(
    pool: &SqlitePool,
    contact_id: &str,
) -> Result<Option<ContactWithStats>, AppDbError> {
    sqlx::query_as::<_, ContactWithStats>(
        r#"
        SELECT c.*,
               COALESCE(tc.task_count, 0) as task_count,
               COALESCE(ec.email_count, 0) as email_count
        FROM contacts c
        LEFT JOIN (
            SELECT contact_id, COUNT(*) as task_count
            FROM tasks GROUP BY contact_id
        ) tc ON tc.contact_id = c.id
        LEFT JOIN (
            SELECT from_address, COUNT(*) as email_count
            FROM messages GROUP BY from_address
        ) ec ON ec.from_address = c.email
        WHERE c.id = ?
        "#,
    )
    .bind(contact_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update a contact's `engagement_score`, `last_engaged_at`, and `health_status`.
///
/// # Parameters
/// - `contact_id`: the contact's primary key.
/// - `score`: new `engagement_score`.
/// - `last_engaged_at`: new `last_engaged_at` timestamp.
/// - `health_status`: new `health_status` label.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `updated_at` is set to
/// `unixepoch()` (server time).
pub async fn update_score(
    pool: &SqlitePool,
    contact_id: &str,
    score: f64,
    last_engaged_at: i64,
    health_status: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE contacts SET engagement_score = ?, last_engaged_at = ?, health_status = ?, \
         updated_at = unixepoch() WHERE id = ?",
    )
    .bind(score)
    .bind(last_engaged_at)
    .bind(health_status)
    .bind(contact_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Update a contact's last_contacted_at by email address.
pub async fn update_last_contacted_by_email(
    pool: &SqlitePool,
    email: &str,
    timestamp: i64,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE contacts SET last_contacted_at = MAX(COALESCE(last_contacted_at, 0), ?), updated_at = unixepoch() WHERE email = ?"
    )
    .bind(timestamp)
    .bind(email)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Get contacts whose `updated_at` is `NULL` or older than the cutoff.
///
/// # Parameters
/// - `cutoff_hours`: contacts last updated more than this many hours ago
///   (relative to now) are returned.
/// - `limit`: maximum number of rows returned.
///
/// # Returns
/// A `Vec<IdEmailPair>` (id + email) ordered by `updated_at ASC NULLS FIRST`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_needing_score_update(
    pool: &SqlitePool,
    cutoff_hours: i64,
    limit: i64,
) -> Result<Vec<IdEmailPair>, AppDbError> {
    let cutoff_ts = chrono::Utc::now().timestamp() - (cutoff_hours * 3600);
    sqlx::query_as::<_, IdEmailPair>(
        "SELECT id, email FROM contacts \
         WHERE updated_at IS NULL OR updated_at < ? \
         ORDER BY updated_at ASC NULLS FIRST LIMIT ?",
    )
    .bind(cutoff_ts)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get a contact engagement summary by email.
///
/// # Parameters
/// - `email`: the contact's email used to match `contacts.email` and to count
///   related `messages`.
/// - `thirty_days_ago`: cutoff timestamp for `recent_email_count` (messages with
///   `date >= thirty_days_ago`).
///
/// # Returns
/// A `ContactEngagementData` with `last_contacted_at`, total `email_count`,
/// `recent_email_count`, and `reply_count` (messages where the contact appears
/// in `to_addresses`).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. A missing contact yields
/// a `last_contacted_at` of `None` rather than an error.
pub async fn get_engagement_data(
    pool: &SqlitePool,
    email: &str,
    thirty_days_ago: i64,
) -> Result<ContactEngagementData, AppDbError> {
    let last_contacted: Option<(Option<i64>,)> =
        sqlx::query_as("SELECT last_contacted_at FROM contacts WHERE email = ?")
            .bind(email)
            .fetch_optional(pool)
            .await
            .map_err(AppDbError::Database)?;

    let recent_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as cnt FROM messages WHERE from_address = ? AND date >= ?",
    )
    .bind(email)
    .bind(thirty_days_ago)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    let total_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as cnt FROM messages WHERE from_address = ?",
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    let reply_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as cnt FROM messages \
         WHERE to_addresses LIKE '%' || ? || '%' \
         AND body_text IS NOT NULL AND body_text != ''",
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(ContactEngagementData {
        last_contacted_at: last_contacted.and_then(|r| r.0),
        email_count: total_count.0,
        recent_email_count: recent_count.0,
        reply_count: reply_count.0,
    })
}

/// Merge `merge_id` into `keep_id` transactionally.
///
/// # Parameters
/// - `keep_id`: the surviving contact's primary key.
/// - `merge_id`: the contact to absorb and then delete.
///
/// # Behavior
/// Re-assigns `contact_tag_pivot` and `contact_group_pivot` rows from `merge_id`
/// to `keep_id`, de-duplicates pivot rows (keeping one per tag/group), then
/// deletes the `merge_id` contact. All steps run inside a single transaction.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Database failures (including FK/constraint violations) surface as
/// `AppDbError::Database`; the transaction is rolled back.
pub async fn merge_contacts(
    pool: &SqlitePool,
    keep_id: &str,
    merge_id: &str,
) -> Result<(), AppDbError> {
    let mut tx = pool.begin().await.map_err(AppDbError::Database)?;

    // 1. Re-assign tag pivots from merge to keep
    sqlx::query(
        "UPDATE contact_tag_pivot SET contact_id = ? WHERE contact_id = ?",
    )
    .bind(keep_id)
    .bind(merge_id)
    .execute(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    // 2. Re-assign group pivots from merge to keep
    sqlx::query(
        "UPDATE contact_group_pivot SET contact_id = ? WHERE contact_id = ?",
    )
    .bind(keep_id)
    .bind(merge_id)
    .execute(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    // 3. Delete duplicate tag pivots (keep only one per tag_id)
    sqlx::query(
        "DELETE FROM contact_tag_pivot WHERE contact_id = ? AND rowid NOT IN (\
         SELECT MIN(rowid) FROM contact_tag_pivot WHERE contact_id = ? GROUP BY tag_id\
         )",
    )
    .bind(keep_id)
    .bind(keep_id)
    .execute(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    // 4. Delete duplicate group pivots
    sqlx::query(
        "DELETE FROM contact_group_pivot WHERE contact_id = ? AND rowid NOT IN (\
         SELECT MIN(rowid) FROM contact_group_pivot WHERE contact_id = ? GROUP BY group_id\
         )",
    )
    .bind(keep_id)
    .bind(keep_id)
    .execute(&mut *tx)
    .await
    .map_err(AppDbError::Database)?;

    // 5. Delete the merged contact
    sqlx::query("DELETE FROM contacts WHERE id = ?")
        .bind(merge_id)
        .execute(&mut *tx)
        .await
        .map_err(AppDbError::Database)?;

    tx.commit().await.map_err(AppDbError::Database)?;
    Ok(())
}

// ── Dashboard aggregate queries ────────────────────────────────────────────────

/// Count all contacts in the database.
///
/// # Returns
/// Total contact count as `i64`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn count_all(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contacts")
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Count contacts with engagement in the last 30 days.
///
/// # Returns
/// Count of distinct `contact_id`s in `engagement_log` with
/// `created_at >= now - 30 days`, as `i64`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn count_active(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let cutoff = chrono::Utc::now().timestamp() - 30 * 86400;
    let row: (i64,) = sqlx::query_as("SELECT COUNT(DISTINCT contact_id) FROM engagement_log WHERE created_at >= ?")
        .bind(cutoff)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Count contacts created in the last 7 days.
///
/// # Returns
/// Count of contacts with `created_at >= now - 7 days`, as `i64`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn count_new_week(pool: &SqlitePool) -> Result<i64, AppDbError> {
    let cutoff = chrono::Utc::now().timestamp() - 7 * 86400;
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contacts WHERE created_at >= ?")
        .bind(cutoff)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Count contacts, optionally filtered by an `email`/`display_name` substring.
///
/// # Parameters
/// - `search_query`: when `Some(q)`, counts contacts whose `email` or
///   `display_name` matches `%q%` (built via `like_pattern`); when `None`,
///   counts every contact.
///
/// # Returns
/// The matching row count as `i64`.
pub async fn count_with_search(
    pool: &SqlitePool,
    search_query: Option<&str>,
) -> Result<i64, AppDbError> {
    match search_query {
        Some(q) => {
            let pattern = like_pattern(q);
            let row: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM contacts WHERE email LIKE ? OR display_name LIKE ?"
            )
            .bind(&pattern)
            .bind(&pattern)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)?;
            Ok(row.0)
        }
        None => {
            let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contacts")
                .fetch_one(pool)
                .await
                .map_err(AppDbError::Database)?;
            Ok(row.0)
        }
    }
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
    async fn test_list_contacts() {
        let pool = create_test_pool().await;

        // Insert test contacts
        let req1 = UpsertContactRequest {
            id: None,
            email: "alice@example.com".to_string(),
            display_name: Some("Alice".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(3),
            last_contacted_at: None,
        };
        let req2 = UpsertContactRequest {
            id: None,
            email: "bob@example.com".to_string(),
            display_name: Some("Bob".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req1).await.unwrap();
        upsert(&pool, req2).await.unwrap();

        let contacts = list(&pool, 10, 0, None, None).await.unwrap();
        assert_eq!(contacts.len(), 2, "should list both contacts");

        // Search by email
        let results = list(&pool, 10, 0, None, Some("alice")).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].email, "alice@example.com");

        // Sort by frequency descending
        let sorted = list(&pool, 10, 0, Some("frequency"), None).await.unwrap();
        assert!(sorted[0].frequency >= sorted[1].frequency);
    }

    #[tokio::test]
    async fn test_get_by_id_contact() {
        let pool = create_test_pool().await;
        let req = UpsertContactRequest {
            id: Some("contact-1".to_string()),
            email: "findme@example.com".to_string(),
            display_name: Some("Find Me".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req).await.unwrap();

        let contact = get_by_id(&pool, "contact-1").await.unwrap();
        assert_eq!(contact.email, "findme@example.com");
        assert_eq!(contact.display_name.as_deref(), Some("Find Me"));

        // Not found
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_email_contact() {
        let pool = create_test_pool().await;
        let req = UpsertContactRequest {
            id: None,
            email: "byemail@example.com".to_string(),
            display_name: Some("By Email".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req).await.unwrap();

        let result = get_by_email(&pool, "byemail@example.com").await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().display_name.as_deref(), Some("By Email"));

        // Missing email returns None (not an error)
        let missing = get_by_email(&pool, "nobody@example.com").await.unwrap();
        assert!(missing.is_none());
    }

    #[tokio::test]
    async fn test_upsert_contact_create_and_update() {
        let pool = create_test_pool().await;

        // Create
        let req = UpsertContactRequest {
            id: None,
            email: "upsert@example.com".to_string(),
            display_name: Some("Original".to_string()),
            avatar_url: None,
            notes: Some("Initial note".to_string()),
            frequency: Some(1),
            last_contacted_at: None,
        };
        let created = upsert(&pool, req).await.unwrap();
        assert_eq!(created.email, "upsert@example.com");
        assert_eq!(created.display_name.as_deref(), Some("Original"));

        // Update same email
        let update_req = UpsertContactRequest {
            id: None,
            email: "upsert@example.com".to_string(),
            display_name: Some("Updated".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(5),
            last_contacted_at: None,
        };
        let updated = upsert(&pool, update_req).await.unwrap();
        assert_eq!(updated.display_name.as_deref(), Some("Updated"));
        // frequency should have been updated to 5
        assert_eq!(updated.frequency, 5);
        // notes should remain "Initial note" because COALESCE preserves original on update when new is NULL
        assert_eq!(updated.notes.as_deref(), Some("Initial note"));
    }

    #[tokio::test]
    async fn test_update_fields_contact() {
        let pool = create_test_pool().await;
        let req = UpsertContactRequest {
            id: Some("field-update-test".to_string()),
            email: "fields@example.com".to_string(),
            display_name: Some("Before".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req).await.unwrap();

        let mut set_map = std::collections::HashMap::new();
        set_map.insert("display_name".to_string(), serde_json::Value::String("After".to_string()));
        let fields = UpdateFields {
            set: set_map,
            unset: vec![],
        };
        update_fields(&pool, "field-update-test", &fields).await.unwrap();

        let contact = get_by_id(&pool, "field-update-test").await.unwrap();
        assert_eq!(contact.display_name.as_deref(), Some("After"));

        // Test unset
        let unset_fields = UpdateFields {
            set: std::collections::HashMap::new(),
            unset: vec!["display_name".to_string()],
        };
        update_fields(&pool, "field-update-test", &unset_fields).await.unwrap();
        let contact = get_by_id(&pool, "field-update-test").await.unwrap();
        assert!(contact.display_name.is_none());
    }

    #[tokio::test]
    async fn test_delete_contact() {
        let pool = create_test_pool().await;
        let req = UpsertContactRequest {
            id: Some("delete-me".to_string()),
            email: "delete@example.com".to_string(),
            display_name: Some("Delete Me".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req).await.unwrap();

        delete(&pool, "delete-me").await.unwrap();

        let err = get_by_id(&pool, "delete-me").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));

        // Delete non-existent returns NotFound
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_stats_contact() {
        let pool = create_test_pool().await;

        // Insert a contact
        let contact_id = "stats-contact".to_string();
        let req = UpsertContactRequest {
            id: Some(contact_id.clone()),
            email: "stats@example.com".to_string(),
            display_name: Some("Stats".to_string()),
            avatar_url: None,
            notes: None,
            frequency: Some(1),
            last_contacted_at: None,
        };
        upsert(&pool, req).await.unwrap();

        // Log engagement events directly (engagement_log table exists from schema)
        let now = chrono::Utc::now().timestamp();
        for (event_type, count) in [("email", 3), ("meeting", 1), ("call", 2)] {
            for _ in 0..count {
                let eid = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO engagement_log (id, contact_id, event_type, score_delta, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&eid)
                .bind(&contact_id)
                .bind(event_type)
                .bind(1.0)
                .bind(Some("contact"))
                .bind(Some(&contact_id))
                .bind("{}")
                .bind(now)
                .execute(&pool)
                .await
                .unwrap();
            }
        }

        let stats = get_stats(&pool, "stats@example.com").await.unwrap();
        assert_eq!(stats.total_emails, 3);
        assert_eq!(stats.total_meetings, 1);
        assert_eq!(stats.total_calls, 2);
        assert_eq!(stats.engagement_trend, "stable");
    }
}
