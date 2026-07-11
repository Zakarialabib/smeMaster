// ── Shared DB helpers ───────────────────────────────────────────────────────
//
// Common CRUD/query building patterns extracted from the per-table modules so
// that every `src-tauri/src/db/tables/**` module can stop copy-pasting them.
//
// PURE REFACTOR: these helpers mirror the exact SQL semantics, message styles,
// and runtime behavior of the original inline code in `contacts.rs`,
// `accounts.rs`, and `templates.rs`. No SQL strings are changed.

use sqlx::Row;
use sqlx::SqlitePool;
use sqlx::sqlite::SqliteArguments;

use crate::db::commands::UpdateFields;
use crate::db::error::AppDbError;

/// Map an `Option<T>` to a `Result<T, AppDbError>`, turning `None` into a
/// `NotFound` error with the same message style used by the table modules
/// (e.g. `"Contact with id 'x' not found"`).
pub fn fetch_or_not_found<T>(
    opt: Option<T>,
    id: &str,
    entity: &str,
) -> Result<T, AppDbError> {
    opt.ok_or_else(|| AppDbError::NotFound(format!("{entity} with id '{id}' not found")))
}

/// Execute a (dynamically-built) DELETE statement and map a zero-rows-affected
/// result to `NotFound`, mirroring the `delete` pattern in the table modules.
pub async fn delete_or_not_found(
    pool: &SqlitePool,
    sql: impl Into<String>,
    id: &str,
    entity: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql.into()))
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "{entity} with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Run a `SELECT COUNT(*)` query and return the scalar.
///
/// `bind` is a closure that adds positional bind values to the statement,
/// mirroring the inline `.bind(...)` calls used elsewhere, e.g.:
/// `count_rows(pool, sql, |a| { a.add(&pattern)?; a.add(&pattern)?; Ok(()) })`.
pub async fn count_rows<F>(
    pool: &SqlitePool,
    sql: &str,
    bind: F,
) -> Result<i64, AppDbError>
where
    F: FnOnce(&mut SqliteArguments) -> Result<(), Box<dyn std::error::Error + Send + Sync>>,
{
    let mut args = SqliteArguments::default();
    bind(&mut args).map_err(|e| AppDbError::Internal(e.to_string()))?;

    let row = sqlx::query_with(sqlx::AssertSqlSafe(sql.to_string()), args)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;

    let count: i64 = row.try_get(0).map_err(AppDbError::Database)?;
    Ok(count)
}

/// Whitelist a `sort_by` value into a safe `ORDER BY` fragment.
///
/// Returns the matched `"col ASC"`/`"col DESC"` string from `allowed`, or
/// `default` when `sort_by` is `None` or not whitelisted. Replaces the inline
/// `match sort_by { ... }` blocks found across the table modules.
pub fn build_sort_clause<'a>(
    allowed: &'a [(&'a str, &'a str)],
    default: &'a str,
    sort_by: Option<&str>,
) -> &'a str {
    match sort_by {
        Some(key) => allowed
            .iter()
            .find(|(k, _)| *k == key)
            .map(|(_, v)| *v)
            .unwrap_or(default),
        None => default,
    }
}

/// Generic version of the `update_fields` logic in `contacts.rs`.
///
/// Builds `SET "col" = ?` for each entry in `fields.set`, `SET "col" = NULL`
/// for each entry in `fields.unset`, always bumps `updated_at`, wraps the SQL
/// in `AssertSqlSafe`, and binds values handling `serde_json::Value::String`
/// (bound as a plain string) versus other JSON values exactly like the
/// original. Parameterized by `table` name. The "nothing to update still bumps
/// `updated_at`" early path is preserved.
pub async fn apply_field_updates(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    fields: &UpdateFields,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    let set_count = fields.set.len();
    if set_count == 0 && fields.unset.is_empty() {
        // Nothing to update — still bump updated_at
        let sql = format!("UPDATE {table} SET updated_at = ? WHERE id = ?");
        sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        return Ok(());
    }

    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + 1 + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(set_count);

    for key in &fields.unset {
        set_parts.push(format!("\"{key}\" = NULL"));
    }

    for (key, value) in &fields.set {
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }

    set_parts.push("\"updated_at\" = ?".to_string());

    let sql = format!(
        "UPDATE {table} SET {} WHERE id = ?",
        set_parts.join(", ")
    );

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values {
        // Extract plain strings to avoid JSON double-quoting
        match val {
            serde_json::Value::String(s) => q = q.bind(s.as_str()),
            other => q = q.bind(other),
        }
    }
    q = q.bind(now);
    q = q.bind(id);

    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Wrap a search term in SQL `LIKE` wildcards: `%q%`.
pub fn like_pattern(q: &str) -> String {
    format!("%{q}%")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Arguments;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();
        pool
    }

    #[test]
    fn test_fetch_or_not_found_none() {
        let err = fetch_or_not_found::<i32>(None, "x", "Thing").unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
        assert_eq!(err.to_string(), "Not found: Thing with id 'x' not found");
    }

    #[test]
    fn test_fetch_or_not_found_some() {
        let v = fetch_or_not_found(Some(42), "x", "Thing").unwrap();
        assert_eq!(v, 42);
    }

    #[test]
    fn test_build_sort_clause() {
        let allowed = &[
            ("display_name", "display_name ASC"),
            ("frequency", "frequency DESC"),
            ("created_at", "created_at DESC"),
        ];
        let default = "email ASC";

        assert_eq!(
            build_sort_clause(allowed, default, Some("frequency")),
            "frequency DESC"
        );
        assert_eq!(
            build_sort_clause(allowed, default, Some("display_name")),
            "display_name ASC"
        );
        // Unknown value falls back to default
        assert_eq!(build_sort_clause(allowed, default, Some("bogus")), default);
        // None falls back to default
        assert_eq!(build_sort_clause(allowed, default, None), default);
    }

    #[test]
    fn test_like_pattern() {
        assert_eq!(like_pattern("foo"), "%foo%");
        assert_eq!(like_pattern(""), "%%");
    }

    #[tokio::test]
    async fn test_count_rows() {
        let pool = create_test_pool().await;
        sqlx::query("INSERT INTO contacts (id, email) VALUES (?, ?)")
            .bind("c1")
            .bind("c1@test.com")
            .execute(&pool)
            .await
            .unwrap();

        let count = count_rows(&pool, "SELECT COUNT(*) FROM contacts", |_| Ok(()))
            .await
            .unwrap();
        assert_eq!(count, 1);

        // With a bound pattern
        let pattern = like_pattern("c1");
        let count = count_rows(
            &pool,
            "SELECT COUNT(*) FROM contacts WHERE email LIKE ?",
            |args| {
                args.add(pattern.as_str())?;
                Ok(())
            },
        )
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_delete_or_not_found() {
        let pool = create_test_pool().await;
        sqlx::query("INSERT INTO contacts (id, email) VALUES (?, ?)")
            .bind("c1")
            .bind("c1@test.com")
            .execute(&pool)
            .await
            .unwrap();

        // Existing row deletes successfully.
        delete_or_not_found(
            &pool,
            format!("DELETE FROM contacts WHERE id = '{}'", "c1"),
            "c1",
            "Company",
        )
        .await
        .unwrap();

        // Deleting again yields NotFound.
        let err = delete_or_not_found(
            &pool,
            format!("DELETE FROM contacts WHERE id = '{}'", "c1"),
            "c1",
            "Company",
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
        assert_eq!(
            err.to_string(),
            "Not found: Company with id 'c1' not found"
        );
    }

    #[tokio::test]
    async fn test_apply_field_updates() {
        let pool = create_test_pool().await;
        sqlx::query("INSERT INTO contacts (id, email, display_name, notes) VALUES (?, ?, ?, ?)")
            .bind("c1")
            .bind("c1@test.com")
            .bind("Old Name")
            .bind("Old Note")
            .execute(&pool)
            .await
            .unwrap();

        // Update the display_name via the generic helper.
        let mut set = std::collections::HashMap::new();
        set.insert(
            "display_name".to_string(),
            serde_json::Value::String("New Name".to_string()),
        );
        let fields = UpdateFields {
            set,
            unset: vec![],
        };
        apply_field_updates(&pool, "contacts", "c1", &fields)
            .await
            .unwrap();

        let row: (String,) = sqlx::query_as("SELECT display_name FROM contacts WHERE id = ?")
            .bind("c1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "New Name");

        // Unset path: clear the (nullable) notes column.
        let unset_fields = UpdateFields {
            set: std::collections::HashMap::new(),
            unset: vec!["notes".to_string()],
        };
        apply_field_updates(&pool, "contacts", "c1", &unset_fields)
            .await
            .unwrap();
        let row: (Option<String>,) =
            sqlx::query_as("SELECT notes FROM contacts WHERE id = ?")
                .bind("c1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(row.0.is_none());
    }
}
