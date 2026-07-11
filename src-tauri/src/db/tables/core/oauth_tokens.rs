//! OAuth tokens table data-access layer.
//!
//! Store and refresh OAuth credentials per account (`oauth_tokens` table).
//! Every function takes a `&SqlitePool` and returns `Result<_, AppDbError>`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;

use crate::db::error::AppDbError;

// ── OAuthToken struct ───────────────────────────────────────────────────────

/// OAuth token record stored for an account (used to make authenticated API
/// calls and to refresh near-expiry tokens).
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OAuthToken {
    /// Primary key for the token row.
    pub id: String,
    /// Owning account primary key.
    pub account_id: String,
    /// Current access token.
    pub access_token: String,
    /// Refresh token used to obtain a new access token.
    pub refresh_token: String,
    /// Token type (e.g. `"B earer"`).
    pub token_type: String,
    /// Epoch-second expiry of the access token.
    pub expires_at: i64,
    /// Granted OAuth scope string.
    pub scope: String,
    /// Epoch-second when the row was created.
    pub created_at: i64,
    /// Epoch-second of the last successful refresh, if any.
    pub refreshed_at: Option<i64>,
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/// Fetch a single OAuth token by account_id.
///
/// Returns `AppDbError::NotFound` when no token matches.
#[allow(dead_code)]
pub async fn get_by_account_id(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<OAuthToken, AppDbError> {
    sqlx::query_as::<_, OAuthToken>(
        "SELECT * FROM oauth_tokens WHERE account_id = ?",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "OAuth token for account '{account_id}' not found"
        ))
    })
}

/// Upsert (INSERT OR REPLACE) an OAuth token record.
///
/// Uses `ON CONFLICT(account_id) DO UPDATE`, so re-saving a token for the same
/// account merges rather than fails; all columns are overwritten from `token`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `token` — the `OAuthToken` to persist.
///
/// # Returns
/// `Ok(())` once the row is inserted or replaced.
///
/// # Errors
/// Returns `AppDbError::Database` on failure.
///
/// # SQL safety
/// Every field of `token` is bound as a positional parameter (`?`).
#[allow(dead_code)]
pub async fn upsert(
    pool: &SqlitePool,
    token: &OAuthToken,
) -> Result<(), AppDbError> {
    sqlx::query(
        r#"
        INSERT INTO oauth_tokens (id, account_id, access_token, refresh_token,
                                   token_type, expires_at, scope, created_at, refreshed_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(account_id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            token_type = excluded.token_type,
            expires_at = excluded.expires_at,
            scope = excluded.scope,
            refreshed_at = excluded.refreshed_at
        "#,
    )
    .bind(&token.id)
    .bind(&token.account_id)
    .bind(&token.access_token)
    .bind(&token.refresh_token)
    .bind(&token.token_type)
    .bind(token.expires_at)
    .bind(&token.scope)
    .bind(token.created_at)
    .bind(token.refreshed_at)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete the OAuth token record for a given account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no token exists for the account
/// (zero rows affected).
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`) on a plain `DELETE` statement.
#[allow(dead_code)]
pub async fn delete_by_account_id(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM oauth_tokens WHERE account_id = ?")
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "OAuth token for account '{account_id}' not found"
        )));
    }
    Ok(())
}

/// Fetch all OAuth tokens that expire on or before the given threshold.
/// Used by the OAuth token monitor to proactively refresh near-expiry tokens.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `threshold_epoch` — epoch-second cutoff; tokens with `expires_at <=` this
///   value are returned.
///
/// # Returns
/// `Vec<OAuthToken>` ordered by `expires_at` ascending (most-urgent first).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound` (an empty list is a valid result).
///
/// # SQL safety
/// `threshold_epoch` is bound as a parameter (`?`); the `ORDER BY` column is a
/// constant.
#[allow(dead_code)]
pub async fn get_expiring(
    pool: &SqlitePool,
    threshold_epoch: i64,
) -> Result<Vec<OAuthToken>, AppDbError> {
    sqlx::query_as::<_, OAuthToken>(
        "SELECT * FROM oauth_tokens WHERE expires_at <= ? ORDER BY expires_at ASC",
    )
    .bind(threshold_epoch)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    fn make_token(account_id: &str) -> OAuthToken {
        OAuthToken {
            id: uuid::Uuid::new_v4().to_string(),
            account_id: account_id.to_string(),
            access_token: "ya29.mock_access_token".to_string(),
            refresh_token: "1//mock_refresh_token".to_string(),
            token_type: "Bearer".to_string(),
            expires_at: chrono::Utc::now().timestamp() + 3600,
            scope: "https://mail.google.com/".to_string(),
            created_at: chrono::Utc::now().timestamp(),
            refreshed_at: None,
        }
    }

    /// Helper: seed a minimal account so FK constraints pass.
    async fn seed_account(pool: &SqlitePool, id: &str) {
        sqlx::query("INSERT OR IGNORE INTO accounts (id, email) VALUES (?1, ?2)")
            .bind(id)
            .bind(format!("{id}@test.local"))
            .execute(pool)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_upsert_and_get_by_account_id() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_upsert_1").await;

        let token = make_token("acc_upsert_1");
        upsert(&pool, &token).await.unwrap();

        let fetched = get_by_account_id(&pool, "acc_upsert_1").await.unwrap();
        assert_eq!(fetched.account_id, "acc_upsert_1");
        assert_eq!(fetched.access_token, "ya29.mock_access_token");
        assert_eq!(fetched.token_type, "Bearer");
    }

    #[tokio::test]
    async fn test_upsert_updates_existing() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_upsert_2").await;

        let token1 = make_token("acc_upsert_2");
        upsert(&pool, &token1).await.unwrap();

        let mut token2 = make_token("acc_upsert_2");
        token2.access_token = "ya29.updated_token".to_string();
        token2.refreshed_at = Some(chrono::Utc::now().timestamp());
        upsert(&pool, &token2).await.unwrap();

        let fetched = get_by_account_id(&pool, "acc_upsert_2").await.unwrap();
        assert_eq!(fetched.access_token, "ya29.updated_token");
        assert!(fetched.refreshed_at.is_some());
    }

    #[tokio::test]
    async fn test_get_by_account_id_not_found() {
        let pool = create_test_pool().await;
        let err = get_by_account_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_by_account_id() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_delete").await;

        let token = make_token("acc_delete");
        upsert(&pool, &token).await.unwrap();

        delete_by_account_id(&pool, "acc_delete").await.unwrap();

        let err = get_by_account_id(&pool, "acc_delete").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = create_test_pool().await;
        let err = delete_by_account_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_expiring() {
        let pool = create_test_pool().await;
        seed_account(&pool, "acc_exp_1").await;
        seed_account(&pool, "acc_exp_2").await;

        let now = chrono::Utc::now().timestamp();

        // Token that expires in 1 hour (not expiring soon)
        let fresh = OAuthToken {
            expires_at: now + 3600,
            ..make_token("acc_exp_1")
        };
        upsert(&pool, &fresh).await.unwrap();

        // Token that already expired (should be returned)
        let expired = OAuthToken {
            expires_at: now - 60,
            ..make_token("acc_exp_2")
        };
        upsert(&pool, &expired).await.unwrap();

        let expiring = get_expiring(&pool, now).await.unwrap();
        assert_eq!(expiring.len(), 1);
        assert_eq!(expiring[0].account_id, "acc_exp_2");
    }

    #[tokio::test]
    async fn test_oauth_token_serde_roundtrip() {
        let token = make_token("serde_test");
        let json = serde_json::to_string(&token).unwrap();
        let deserialized: OAuthToken = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.account_id, "serde_test");
        assert_eq!(deserialized.access_token, "ya29.mock_access_token");
    }
}
