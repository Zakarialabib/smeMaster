use sqlx::{Pool, Sqlite};
use crate::db::error::AppResult;
use crate::licensing::license::{LicenseInfo, LicenseTier};
use crate::db::error::AppDbError;

/// Save license information to the database
pub async fn save_license(pool: &Pool<Sqlite>, license: &LicenseInfo) -> AppResult<()> {
    // Ensure the licenses table exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            tier INTEGER NOT NULL,
            issued_to TEXT NOT NULL,
            issued_at TEXT NOT NULL,
            expires_at TEXT,
            hardware_id TEXT,
            features TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Insert or update the license
    sqlx::query(
        r#"
        INSERT INTO licenses (
            key, tier, issued_to, issued_at, expires_at, hardware_id, features, is_active, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
            tier = excluded.tier,
            issued_to = excluded.issued_to,
            issued_at = excluded.issued_at,
            expires_at = excluded.expires_at,
            hardware_id = excluded.hardware_id,
            features = excluded.features,
            is_active = excluded.is_active,
            updated_at = datetime('now')
        "#,
    )
    .bind(&license.key)
    .bind(license.tier as i32)
    .bind(&license.issued_to)
    .bind(license.issued_at.to_rfc3339())
    .bind(license.expires_at.as_ref().map(|dt| dt.to_rfc3339()))
    .bind(&license.hardware_id)
    .bind(license.features.join(","))
    .bind(license.is_active)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get the current license from the database
pub async fn get_license(pool: &Pool<Sqlite>) -> AppResult<Option<LicenseInfo>> {
    let row: Option<LicenseRow> = sqlx::query_as(
        "SELECT key, tier, issued_to, issued_at, expires_at, hardware_id, features, is_active \
         FROM licenses WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    let license = match row {
        Some(row) => {
            // Parse features from comma-separated string
            let features = if row.features.is_empty() {
                Vec::new()
            } else {
                row.features.split(',').map(|s| s.to_string()).collect()
            };

            Some(LicenseInfo {
                key: row.key,
                tier: match row.tier {
                    0 => LicenseTier::Free,
                    1 => LicenseTier::Professional,
                    2 => LicenseTier::Enterprise,
                    _ => return Err(AppDbError::Validation("Invalid license tier in database".to_string())),
                },
                issued_to: row.issued_to,
                issued_at: row.issued_at.parse().map_err(|e| AppDbError::Validation(format!("Failed to parse issued_at: {}", e)))?,
                expires_at: row.expires_at.as_deref().map(|s| s.parse()).transpose()
                    .map_err(|e| AppDbError::Validation(format!("Failed to parse expires_at: {}", e)))?,
                hardware_id: row.hardware_id,
                features,
                is_active: row.is_active != 0,
            })
        }
        None => None,
    };

    Ok(license)
}

/// Delete license from the database
pub async fn delete_license(pool: &Pool<Sqlite>) -> AppResult<()> {
    sqlx::query(
        r#"
        DELETE FROM licenses
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Check if a license key exists in the database
pub async fn license_key_exists(pool: &Pool<Sqlite>, key: &str) -> AppResult<bool> {
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM licenses WHERE key = ?",
    )
    .bind(key)
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

// Internal row structure for database queries
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct LicenseRow {
    key: String,
    tier: i32,
    issued_to: String,
    issued_at: String,
    expires_at: Option<String>,
    hardware_id: Option<String>,
    features: String,
    is_active: i32,
}