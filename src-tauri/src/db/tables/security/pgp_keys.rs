// ── PGP key query functions ─────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::security::schema::PgpKey;

/// List all PGP keys for an account, newest first.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<PgpKey>, AppDbError> {
    sqlx::query_as::<_, PgpKey>(
        "SELECT * FROM pgp_keys WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single PGP key by its primary key.
///
/// Returns `AppDbError::NotFound` when no key matches.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<PgpKey, AppDbError> {
    sqlx::query_as::<_, PgpKey>("SELECT * FROM pgp_keys WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("PgpKey with id '{id}' not found")))
}

/// Look up a PGP key by its key ID (hex fingerprint short ID).
///
/// Returns `None` when no key with that ID exists for the account.
pub async fn get_by_key_id(
    pool: &SqlitePool,
    account_id: &str,
    key_id: &str,
) -> Result<Option<PgpKey>, AppDbError> {
    sqlx::query_as::<_, PgpKey>(
        "SELECT * FROM pgp_keys WHERE account_id = ? AND key_id = ?",
    )
    .bind(account_id)
    .bind(key_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Import a new PGP key and return the full row.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    key_id: &str,
    user_id: &str,
    public_key: &str,
    private_key_encrypted: Option<&str>,
    passphrase_hint: Option<&str>,
    fingerprint: Option<&str>,
) -> Result<PgpKey, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, PgpKey>(
        r#"
        INSERT INTO pgp_keys (id, account_id, key_id, user_id, public_key, private_key_encrypted, passphrase_hint, fingerprint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(key_id)
    .bind(user_id)
    .bind(public_key)
    .bind(private_key_encrypted)
    .bind(passphrase_hint)
    .bind(fingerprint)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a PGP key by its primary key.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM pgp_keys WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("PgpKey with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-pgp-1";
        helpers::insert_test_account(&pool, account_id).await;

        let key = create(
            &pool,
            account_id,
            "0xDEADBEEF",
            "",
            "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...",
            None,
            None,
            Some("ABCD1234"),
        )
        .await
        .unwrap();

        assert_eq!(key.account_id, account_id);
        assert_eq!(key.key_id, "0xDEADBEEF");
        assert_eq!(key.fingerprint, Some("ABCD1234".to_string()));

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, key.id);
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-pgp-2").await;
        let key = create(&pool, "acc-pgp-2", "0xCAFE", "", "pubkey", None, None, None)
            .await
            .unwrap();

        let found = get_by_id(&pool, &key.id).await.unwrap();
        assert_eq!(found.key_id, "0xCAFE");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_key_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-pgp-3").await;
        create(
            &pool,
            "acc-pgp-3",
            "0x1234",
            "",
            "pubkey-1",
            Some("enc-priv-1"),
            Some("hint-1"),
            Some("FINGERPRINT1"),
        )
        .await
        .unwrap();

        let found = get_by_key_id(&pool, "acc-pgp-3", "0x1234")
            .await
            .unwrap()
            .expect("should find key");
        assert_eq!(found.public_key, "pubkey-1");
        assert_eq!(found.private_key_encrypted, Some("enc-priv-1".to_string()));
        assert_eq!(found.passphrase_hint, Some("hint-1".to_string()));
    }

    #[tokio::test]
    async fn test_get_by_key_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_key_id(&pool, "acc-pgp-4", "0xNONE").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-pgp-5").await;
        let key = create(&pool, "acc-pgp-5", "0x5678", "", "pubkey", None, None, None)
            .await
            .unwrap();
        delete(&pool, &key.id).await.unwrap();
        let err = get_by_id(&pool, &key.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
