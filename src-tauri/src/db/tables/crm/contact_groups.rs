//! Contact-groups query functions.
//!
//! Manages the `contact_groups` table and its `contact_group_pivot` membership
//! links. Functions are async and return `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::{Contact, ContactGroup, IdOnly};

/// List all groups for a given account, ordered by `name`.
pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<ContactGroup>, AppDbError> {
    sqlx::query_as::<_, ContactGroup>(
        "SELECT * FROM contact_groups WHERE company_id = ? ORDER BY name ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single group by its primary key.
///
/// Returns `AppDbError::NotFound` when no group matches.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<ContactGroup, AppDbError> {
    let opt = sqlx::query_as::<_, ContactGroup>("SELECT * FROM contact_groups WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "ContactGroup")
}

/// Create a new contact group.
///
/// # Parameters
/// - `company_id`: owning account.
/// - `name`: group display name.
/// - `description`: optional group description.
///
/// # Returns
/// The newly created `ContactGroup` via `RETURNING *`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`. `id` is auto-generated
/// (UUID v4) and `created_at` is set to `now`.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<ContactGroup, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, ContactGroup>(
        r#"
        INSERT INTO contact_groups (id, company_id, name, description, created_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(description)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a group by its primary key.
///
/// # Parameters
/// - `id`: the group's primary key.
///
/// # Returns
/// `Ok(())` when a row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `ContactGroup with id '{id}' not found` when no row matches
/// (zero rows affected).
pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_groups WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactGroup with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Add a contact to a group via the pivot table.
pub async fn add_member(
    pool: &SqlitePool,
    contact_id: &str,
    group_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "INSERT OR IGNORE INTO contact_group_pivot (contact_id, group_id) VALUES (?, ?)",
    )
    .bind(contact_id)
    .bind(group_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Remove a contact from a group.
pub async fn remove_member(
    pool: &SqlitePool,
    contact_id: &str,
    group_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "DELETE FROM contact_group_pivot WHERE contact_id = ? AND group_id = ?",
    )
    .bind(contact_id)
    .bind(group_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Insert or update a contact group by (account_id, name).
///
/// Uses `ON CONFLICT(account_id, name) DO UPDATE` to upsert.
pub async fn upsert_group(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query(
        r#"
        INSERT INTO contact_groups (id, company_id, name, description, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(company_id, name) DO UPDATE SET
            name        = EXCLUDED.name,
            description = COALESCE(EXCLUDED.description, contact_groups.description)
        "#,
    )
    .bind(id)
    .bind(company_id)
    .bind(name)
    .bind(description)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Delete a group by id, scoped to account_id for safety.
///
/// Returns `AppDbError::NotFound` when no matching group exists.
pub async fn delete_group(
    pool: &SqlitePool,
    id: &str,
    company_id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM contact_groups WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "ContactGroup with id '{id}' not found for account '{company_id}'"
        )));
    }
    Ok(())
}

/// Count members of a group via the `contact_group_pivot` table.
///
/// # Parameters
/// - `group_id`: the group whose membership to count.
///
/// # Returns
/// The member count as `i64` (zero when the group has no members).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_member_count(
    pool: &SqlitePool,
    group_id: &str,
) -> Result<i64, AppDbError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as count FROM contact_group_pivot WHERE group_id = ?",
    )
    .bind(group_id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(row.0)
}

/// Get the contact IDs belonging to a group via the `contact_group_pivot` table.
///
/// # Parameters
/// - `group_id`: the group whose member IDs to return.
///
/// # Returns
/// A `Vec<IdOnly>` (contact ids) for the group's members, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_group_members(
    pool: &SqlitePool,
    group_id: &str,
) -> Result<Vec<IdOnly>, AppDbError> {
    sqlx::query_as::<_, IdOnly>(
        "SELECT contact_id FROM contact_group_pivot WHERE group_id = ?",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get the full contacts belonging to a group via the `contact_group_pivot` table.
///
/// # Parameters
/// - `group_id`: the group whose members to return.
///
/// # Returns
/// A `Vec<Contact>` for the group's members ordered by `email ASC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_members(pool: &SqlitePool, group_id: &str) -> Result<Vec<Contact>, AppDbError> {
    sqlx::query_as::<_, Contact>(
        r#"
        SELECT c.* FROM contacts c
        JOIN contact_group_pivot p ON p.contact_id = c.id
        WHERE p.group_id = ?
        ORDER BY c.email ASC
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get all groups a specific contact belongs to via the `contact_group_pivot` table.
///
/// # Parameters
/// - `contact_id`: the contact whose groups to return.
///
/// # Returns
/// A `Vec<ContactGroup>` ordered by `name ASC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_by_contact_id(pool: &SqlitePool, contact_id: &str) -> Result<Vec<ContactGroup>, AppDbError> {
    sqlx::query_as::<_, ContactGroup>(
        r#"
        SELECT cg.* FROM contact_groups cg
        INNER JOIN contact_group_pivot cgm ON cg.id = cgm.group_id
        WHERE cgm.contact_id = ?
        ORDER BY cg.name ASC
        "#
    )
    .bind(contact_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_list_contact_groups() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "account-1").await;
        helpers::insert_test_account(&pool, "account-2").await;

        create(&pool, "account-1", "VIP Clients", Some("High priority")).await.unwrap();
        create(&pool, "account-1", "Newsletter", None).await.unwrap();
        create(&pool, "account-2", "Other", None).await.unwrap();

        let groups = list(&pool, "account-1").await.unwrap();
        assert_eq!(groups.len(), 2);
        assert!(groups.iter().any(|g| g.name == "VIP Clients"));
        assert!(groups.iter().any(|g| g.name == "Newsletter"));
    }

    #[tokio::test]
    async fn test_get_by_id_contact_group() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "a1").await;

        let group = create(&pool, "a1", "Test Group", Some("A test group")).await.unwrap();
        let gid = group.id.clone();

        let fetched = get_by_id(&pool, &gid).await.unwrap();
        assert_eq!(fetched.name, "Test Group");
        assert_eq!(fetched.description.as_deref(), Some("A test group"));

        // Not found
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_create_contact_group() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "a1").await;

        let group = create(&pool, "a1", "New Group", Some("Description")).await.unwrap();
        assert!(!group.id.is_empty());
        assert_eq!(group.company_id, "a1");
        assert_eq!(group.name, "New Group");
        assert_eq!(group.description.as_deref(), Some("Description"));
    }

    #[tokio::test]
    async fn test_delete_by_id_contact_group() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "a1").await;

        let group = create(&pool, "a1", "To Delete", None).await.unwrap();
        let gid = group.id.clone();

        delete_by_id(&pool, &gid).await.unwrap();

        let err = get_by_id(&pool, &gid).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));

        // Delete non-existent returns NotFound
        let err = delete_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_add_and_remove_member() {
        let pool = helpers::create_memory_pool().await;

        helpers::insert_test_contact(&pool, "c1").await;
        helpers::insert_test_contact(&pool, "c2").await;
        helpers::insert_test_account(&pool, "a1").await;
        let group = create(&pool, "a1", "Members Group", None).await.unwrap();
        let gid = group.id.clone();

        add_member(&pool, "c1", &gid).await.unwrap();
        add_member(&pool, "c2", &gid).await.unwrap();

        let members = get_members(&pool, &gid).await.unwrap();
        assert_eq!(members.len(), 2);
        assert!(members.iter().any(|m| m.email == "c1@test.local"));

        // Remove one member
        remove_member(&pool, "c1", &gid).await.unwrap();
        let members = get_members(&pool, &gid).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].email, "c2@test.local");
    }
}
