//! Contact-file query functions.
//!
//! Manages the `contact_files` table (attachments and records linked to
//! contacts and accounts) and its FTS5 full-text search. Functions are async
//! and return `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::ContactFile;

/// Get all files associated with a contact.
///
/// # Parameters
/// - `contact_id`: the contact whose files to return.
///
/// # Returns
/// A `Vec<ContactFile>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_by_contact(
    pool: &SqlitePool,
    contact_id: &str,
) -> Result<Vec<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>(
        "SELECT * FROM contact_files WHERE contact_id = ? ORDER BY created_at DESC",
    )
    .bind(contact_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get all files belonging to an account.
///
/// # Parameters
/// - `company_id`: the account whose files to return.
///
/// # Returns
/// A `Vec<ContactFile>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_by_account(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>(
        "SELECT * FROM contact_files WHERE company_id = ? ORDER BY created_at DESC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single file by its primary key.
///
/// # Parameters
/// - `id`: the file's primary key.
///
/// # Returns
/// `Ok(Some(ContactFile))` when a match exists, or `Ok(None)` (not an error)
/// when no file has that id.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>("SELECT * FROM contact_files WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Create a new contact file record.
pub async fn create(pool: &SqlitePool, file: &ContactFile) -> Result<(), AppDbError> {
    sqlx::query(
        "INSERT INTO contact_files \
         (id, company_id, contact_id, filename, original_name, mime_type, size, \
          category, starred, sender_email, message_id, local_path, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&file.id)
    .bind(&file.company_id)
    .bind(&file.contact_id)
    .bind(&file.filename)
    .bind(&file.original_name)
    .bind(&file.mime_type)
    .bind(file.size)
    .bind(&file.category)
    .bind(file.starred)
    .bind(&file.sender_email)
    .bind(&file.message_id)
    .bind(&file.local_path)
    .bind(file.created_at)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Delete a file record by its primary key.
///
/// # Parameters
/// - `id`: the file's primary key.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactFile with id '{id}' not found` when no row matches
/// (zero rows affected).
pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_files WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactFile with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Create a new contact file record with explicit fields.
pub async fn create_file(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    contact_id: Option<&str>,
    filename: &str,
    original_name: &str,
    mime_type: Option<&str>,
    size: Option<i64>,
    category: &str,
    sender_email: Option<&str>,
    message_id: Option<&str>,
    local_path: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO contact_files \
         (id, company_id, contact_id, filename, original_name, mime_type, size, \
          category, starred, sender_email, message_id, local_path, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(company_id)
    .bind(contact_id)
    .bind(filename)
    .bind(original_name)
    .bind(mime_type)
    .bind(size)
    .bind(category)
    .bind(sender_email)
    .bind(message_id)
    .bind(local_path)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Get files by sender email.
pub async fn get_by_sender(
    pool: &SqlitePool,
    sender_email: &str,
) -> Result<Vec<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>(
        "SELECT * FROM contact_files WHERE sender_email = ? ORDER BY created_at DESC",
    )
    .bind(sender_email)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get files by account and category.
pub async fn get_by_category(
    pool: &SqlitePool,
    company_id: &str,
    category: &str,
) -> Result<Vec<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>(
        "SELECT * FROM contact_files WHERE company_id = ? AND category = ? \
         ORDER BY created_at DESC",
    )
    .bind(company_id)
    .bind(category)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get distinct file categories for an account.
pub async fn get_categories(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<String>, AppDbError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT category FROM contact_files WHERE company_id = ? ORDER BY category",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Update a file's `category`.
///
/// # Parameters
/// - `id`: the file's primary key.
/// - `category`: the new category value.
///
/// # Returns
/// `Ok(())` on success (affects zero rows when `id` is unknown, not an error).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn update_category(
    pool: &SqlitePool,
    id: &str,
    category: &str,
) -> Result<(), AppDbError> {
    sqlx::query("UPDATE contact_files SET category = ? WHERE id = ?")
        .bind(category)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Toggle a file's `starred` flag (0 ↔ 1).
///
/// # Parameters
/// - `id`: the file's primary key.
///
/// # Returns
/// `Ok(())` on success (affects zero rows when `id` is unknown, not an error).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn toggle_starred(
    pool: &SqlitePool,
    id: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE contact_files SET starred = CASE WHEN starred = 1 THEN 0 ELSE 1 END WHERE id = ?",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a file record and return its `local_path` for caller-side cleanup.
///
/// # Parameters
/// - `id`: the file's primary key.
///
/// # Returns
/// `Ok(Some(local_path))` when the file existed and was deleted, or
/// `Err(AppDbError::NotFound)` with message
/// `ContactFile with id '{id}' not found` when no row matched.
///
/// # Errors
/// Returns `AppDbError::NotFound` when the file does not exist. Other database
/// failures surface as `AppDbError::Database`.
pub async fn delete_file(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<String>, AppDbError> {
    let file: Option<ContactFile> = sqlx::query_as::<_, ContactFile>(
        "SELECT * FROM contact_files WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;

    if let Some(ref f) = file {
        sqlx::query("DELETE FROM contact_files WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        Ok(f.local_path.clone())
    } else {
        Err(AppDbError::NotFound(format!(
            "ContactFile with id '{id}' not found"
        )))
    }
}

/// Full-text search across contact files using the FTS5 index.
///
/// # Parameters
/// - `query`: the FTS5 `MATCH` expression (user-supplied search terms).
///
/// # Returns
/// A `Vec<ContactFile>` whose `rowid` matches the FTS query, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
///
/// # SQL-safety
/// `query` is passed verbatim to the FTS5 `MATCH` operator as a bound parameter
/// (not concatenated into the SQL text), so it is safe under normal bind handling.
pub async fn search(
    pool: &SqlitePool,
    query: &str,
) -> Result<Vec<ContactFile>, AppDbError> {
    sqlx::query_as::<_, ContactFile>(
        "SELECT cf.* FROM contact_files cf \
         JOIN contact_files_fts fts ON cf.rowid = fts.rowid \
         WHERE contact_files_fts MATCH ?",
    )
    .bind(query)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_file(id: &str, contact_id: &str, company_id: &str, filename: &str) -> ContactFile {
        let now = chrono::Utc::now().timestamp();
        ContactFile {
            id: id.to_string(),
            company_id: company_id.to_string(),
            contact_id: Some(contact_id.to_string()),
            filename: filename.to_string(),
            original_name: filename.to_string(),
            mime_type: Some("application/pdf".to_string()),
            size: Some(1024),
            category: "general".to_string(),
            starred: 0,
            sender_email: Some("sender@example.com".to_string()),
            message_id: Some("msg-1".to_string()),
            local_path: Some("/tmp/test.pdf".to_string()),
            created_at: now,
        }
    }

    #[tokio::test]
    async fn test_create_and_get_by_contact() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "account-1").await;
        helpers::insert_test_contact(&pool, "contact-1").await;

        let file = make_file("file-1", "contact-1", "account-1", "report.pdf");
        create(&pool, &file).await.unwrap();

        let files = get_by_contact(&pool, "contact-1").await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "report.pdf");

        // No files for unknown contact
        let empty = get_by_contact(&pool, "no-such-contact").await.unwrap();
        assert!(empty.is_empty());
    }

    #[tokio::test]
    async fn test_get_by_account() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "acct-a").await;
        helpers::insert_test_account(&pool, "acct-b").await;
        helpers::insert_test_contact(&pool, "c1").await;
        helpers::insert_test_contact(&pool, "c2").await;
        helpers::insert_test_contact(&pool, "c3").await;

        let file1 = make_file("f1", "c1", "acct-a", "a.pdf");
        let file2 = make_file("f2", "c2", "acct-a", "b.pdf");
        let file3 = make_file("f3", "c3", "acct-b", "c.pdf");
        create(&pool, &file1).await.unwrap();
        create(&pool, &file2).await.unwrap();
        create(&pool, &file3).await.unwrap();

        let files = get_by_account(&pool, "acct-a").await.unwrap();
        assert_eq!(files.len(), 2);

        let files_b = get_by_account(&pool, "acct-b").await.unwrap();
        assert_eq!(files_b.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_contact_file() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "a1").await;
        helpers::insert_test_contact(&pool, "c1").await;

        let file = make_file("file-by-id", "c1", "a1", "doc.txt");
        create(&pool, &file).await.unwrap();

        let found = get_by_id(&pool, "file-by-id").await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().filename, "doc.txt");

        // Missing returns None
        let missing = get_by_id(&pool, "nonexistent").await.unwrap();
        assert!(missing.is_none());
    }

    #[tokio::test]
    async fn test_create_contact_file() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "a1").await;
        helpers::insert_test_contact(&pool, "c1").await;

        let file = make_file("new-file", "c1", "a1", "new.pdf");
        create(&pool, &file).await.unwrap();

        let found = get_by_id(&pool, "new-file").await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().original_name, "new.pdf");
    }

    #[tokio::test]
    async fn test_delete_by_id_contact_file() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "a1").await;
        helpers::insert_test_contact(&pool, "c1").await;

        let file = make_file("to-delete", "c1", "a1", "delete.pdf");
        create(&pool, &file).await.unwrap();

        delete_by_id(&pool, "to-delete").await.unwrap();

        let found = get_by_id(&pool, "to-delete").await.unwrap();
        assert!(found.is_none());

        // Delete non-existent returns NotFound
        let err = delete_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_search_contact_files() {
        let pool = helpers::create_memory_pool().await;

        // FK: contact_files.account_id → accounts, contact_files.contact_id → contacts
        helpers::insert_test_account(&pool, "a1").await;
        helpers::insert_test_contact(&pool, "c1").await;

        let file = make_file("search-test", "c1", "a1", "quarterly_report_2025.pdf");
        create(&pool, &file).await.unwrap();

        // Give FTS trigger a moment — it's synchronous in SQLite so this should be immediate
        let results = search(&pool, "quarterly").await.unwrap();
        assert_eq!(results.len(), 1, "should find by filename via FTS");
        assert_eq!(results[0].id, "search-test");

        // Search for something not present
        let empty = search(&pool, "nonexistent_document").await.unwrap();
        assert!(empty.is_empty());
    }
}
