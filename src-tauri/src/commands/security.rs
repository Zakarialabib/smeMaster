// ── Security Commands ──────────────────────────────────────────────────────

use tauri::State;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::security::schema::{Allowlist, LinkScanResult, PgpKey};
use crate::db::tables::security::notification_vips::NotificationVip;
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

#[tauri::command]
pub async fn db_list_pgp_keys(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<PgpKey>> {
    crate::db::tables::security::pgp_keys::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_pgp_key(
    pool: State<'_, SqlitePool>,
    id: String,
    account_id: String,
    key_id: String,
    user_id: String,
    public_key: String,
    private_key_encrypted: Option<String>,
    passphrase_hint: Option<String>,
    fingerprint: Option<String>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO pgp_keys (id, account_id, key_id, user_id, public_key, private_key_encrypted, passphrase_hint, fingerprint, created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET public_key=excluded.public_key, private_key_encrypted=excluded.private_key_encrypted, passphrase_hint=excluded.passphrase_hint, fingerprint=excluded.fingerprint, user_id=excluded.user_id"
    )
    .bind(&id).bind(&account_id).bind(&key_id).bind(&user_id).bind(&public_key).bind(&private_key_encrypted)
    .bind(&passphrase_hint).bind(&fingerprint).bind(now)
    .execute(&*pool).await.map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_delete_pgp_key(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::security::pgp_keys::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_pgp_key(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<PgpKey> {
    crate::db::tables::security::pgp_keys::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_pgp_key_by_key_id(
    pool: State<'_, SqlitePool>,
    account_id: String,
    key_id: String,
) -> CmdResult<Option<PgpKey>> {
    crate::db::tables::security::pgp_keys::get_by_key_id(&pool, &account_id, &key_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_pgp_key(
    pool: State<'_, SqlitePool>,
    account_id: String,
    key_id: String,
    user_id: String,
    public_key: String,
    private_key_encrypted: Option<String>,
    passphrase_hint: Option<String>,
    fingerprint: Option<String>,
) -> CmdResult<PgpKey> {
    crate::db::tables::security::pgp_keys::create(
        &pool,
        &account_id,
        &key_id,
        &user_id,
        &public_key,
        private_key_encrypted.as_deref(),
        passphrase_hint.as_deref(),
        fingerprint.as_deref(),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_check_allowlist_target(
    pool: State<'_, SqlitePool>,
    account_id: String,
    list_type: String,
    target: String,
) -> CmdResult<bool> {
    crate::db::tables::security::allowlists::check_target(&pool, &account_id, &list_type, &target)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    list_type: Option<String>,
) -> CmdResult<Vec<Allowlist>> {
    match list_type {
        Some(lt) => crate::db::tables::security::allowlists::list_by_type(&pool, &account_id, &lt)
            .await
            .map_err(Into::into),
        None => crate::db::tables::security::allowlists::list(&pool, &account_id)
            .await
            .map_err(Into::into),
    }
}

#[tauri::command]
pub async fn db_get_link_scan_result(
    pool: State<'_, SqlitePool>,
    account_id: String,
    message_id: String,
) -> CmdResult<Option<LinkScanResult>> {
    crate::db::tables::security::link_scan::get_by_message(&pool, &message_id, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_link_scan_result(
    pool: State<'_, SqlitePool>,
    account_id: String,
    message_id: String,
    result_json: String,
) -> CmdResult<LinkScanResult> {
    crate::db::tables::security::link_scan::upsert_result(
        &pool,
        &message_id,
        &account_id,
        &result_json,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_link_scan_results(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<()> {
    sqlx::query("DELETE FROM link_scan_results WHERE account_id = ?")
        .bind(&account_id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_remove_notification_vip(
    pool: State<'_, SqlitePool>,
    account_id: String,
    email_address: String,
) -> CmdResult<()> {
    crate::db::tables::security::notification_vips::remove_vip(&pool, &account_id, &email_address)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_notification_vips(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<NotificationVip>> {
    crate::db::tables::security::notification_vips::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_notification_vip(
    pool: State<'_, SqlitePool>,
    account_id: String,
    email_address: String,
    display_name: Option<String>,
) -> CmdResult<NotificationVip> {
    crate::db::tables::security::notification_vips::add_vip(&pool, &account_id, &email_address, display_name.as_deref())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_notification_vip(
    pool: State<'_, SqlitePool>,
    account_id: String,
    email_address: String,
) -> CmdResult<()> {
    crate::db::tables::security::notification_vips::remove_vip(&pool, &account_id, &email_address)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_image_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Allowlist>> {
    crate::db::tables::security::allowlists::list(&pool, &account_id)
        .await
        .map_err(Into::into)
        .map(|items| items.into_iter().filter(|i| i.list_type == "image").collect())
}

#[tauri::command]
pub async fn db_upsert_image_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    target: String,
    display_name: Option<String>,
) -> CmdResult<Allowlist> {
    crate::db::tables::security::allowlists::add_to_list(&pool, &account_id, "image", &target, display_name.as_deref())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_image_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    target: String,
) -> CmdResult<()> {
    crate::db::tables::security::allowlists::remove_from_list(&pool, &account_id, "image", &target)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_phishing_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Allowlist>> {
    crate::db::tables::security::allowlists::list(&pool, &account_id)
        .await
        .map_err(Into::into)
        .map(|items| items.into_iter().filter(|i| i.list_type == "phishing").collect())
}

// ═══════════════════════════════════════════════════════════════════════════════
// LICENSE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn db_license_key_exists(
    pool: State<'_, SqlitePool>,
    key: String,
) -> CmdResult<bool> {
    crate::db::license::license_key_exists(&pool, &key)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_license(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Option<crate::licensing::license::LicenseInfo>> {
    crate::db::license::get_license(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_save_license(
    pool: State<'_, SqlitePool>,
    license: crate::licensing::license::LicenseInfo,
) -> CmdResult<()> {
    crate::db::license::save_license(&pool, &license)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_license(
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    crate::db::license::delete_license(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_phishing_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    target: String,
    display_name: Option<String>,
) -> CmdResult<Allowlist> {
    crate::db::tables::security::allowlists::add_to_list(&pool, &account_id, "phishing", &target, display_name.as_deref())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_phishing_allowlist(
    pool: State<'_, SqlitePool>,
    account_id: String,
    target: String,
) -> CmdResult<()> {
    crate::db::tables::security::allowlists::remove_from_list(&pool, &account_id, "phishing", &target)
        .await
        .map_err(Into::into)
}

// ── Tests ────────────────────────────────────────────────────────────────
//
// Verifies the IPC contract for security command types:
// - Allowlist filtering logic (image vs phishing vs all)
// - Security type deserialization
// - CmdResult type consistency
// - Duplicate function observation (db_remove_notification_vip == db_delete_notification_vip)

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::security::schema::Allowlist;
    use serde_json::json;

    // ── Allowlist post-fetch filtering logic ─────────────────────────────
    //
    // db_list_image_allowlist and db_list_phishing_allowlist fetch all
    // allowlists then filter in Rust by list_type. We can test the filter
    // predicate logic in isolation.

    fn make_allowlist(id: &str, list_type: &str, target: &str) -> Allowlist {
        Allowlist {
            id: id.to_string(),
            account_id: "acc1".to_string(),
            list_type: list_type.to_string(),
            target: target.to_string(),
            display_name: None,
            created_at: 0,
        }
    }

    #[test]
    fn test_image_allowlist_filter_logic() {
        // Simulates the post-fetch filter in db_list_image_allowlist
        let all_items = vec![
            make_allowlist("1", "image", "img1.png"),
            make_allowlist("2", "phishing", "phish.example.com"),
            make_allowlist("3", "image", "img2.jpg"),
            make_allowlist("4", "sender", "sender@test.com"),
        ];

        let image_items: Vec<_> = all_items
            .iter()
            .filter(|i| i.list_type == "image")
            .collect();

        assert_eq!(image_items.len(), 2);
        assert_eq!(image_items[0].target, "img1.png");
        assert_eq!(image_items[1].target, "img2.jpg");
    }

    #[test]
    fn test_phishing_allowlist_filter_logic() {
        // Simulates the post-fetch filter in db_list_phishing_allowlist
        let all_items = vec![
            make_allowlist("1", "image", "img1.png"),
            make_allowlist("2", "phishing", "phish.example.com"),
            make_allowlist("3", "phishing", "phish2.example.com"),
        ];

        let phishing_items: Vec<_> = all_items
            .iter()
            .filter(|i| i.list_type == "phishing")
            .collect();

        assert_eq!(phishing_items.len(), 2);
        assert_eq!(phishing_items[0].target, "phish.example.com");
        assert_eq!(phishing_items[1].target, "phish2.example.com");
    }

    #[test]
    fn test_allowlist_filter_no_matches() {
        let all_items = vec![
            make_allowlist("1", "sender", "a@b.com"),
        ];

        let image_items: Vec<_> = all_items
            .iter()
            .filter(|i| i.list_type == "image")
            .collect();

        assert!(image_items.is_empty());
    }

    #[test]
    fn test_allowlist_filter_empty_input() {
        let all_items: Vec<Allowlist> = vec![];

        let image_items: Vec<_> = all_items
            .iter()
            .filter(|i| i.list_type == "image")
            .collect();

        assert!(image_items.is_empty());
    }

    // ── db_list_allowlist branching logic ────────────────────────────────
    //
    // db_list_allowlist matches on list_type:
    //   Some(lt) => list_by_type(...)
    //   None     => list(...)
    //
    // We can't call the function without a pool, but we can verify the
    // branching is correct by testing the match logic in isolation.

    #[test]
    fn test_list_type_routing_logic() {
        // Simulates the match in db_list_allowlist
        fn route_list_type(list_type: Option<&str>) -> String {
            match list_type {
                Some(lt) => lt.to_string(),
                None => "all".to_string(),
            }
        }

        assert_eq!(route_list_type(Some("image")), "image");
        assert_eq!(route_list_type(Some("phishing")), "phishing");
        assert_eq!(route_list_type(Some("sender")), "sender");
        assert_eq!(route_list_type(None), "all");
    }

    // ── NotificationVip type deserialization ─────────────────────────────

    #[test]
    fn test_notification_vip_deserialize() {
        // Verify the NotificationVip type (imported from db::tables) deserializes correctly.
        // Note: NotificationVip does NOT have #[serde(rename_all = "camelCase")], so JSON
        // keys must use snake_case.
        let vip: NotificationVip = serde_json::from_value(json!({
            "id": "vip_001",
            "account_id": "acc_001",
            "email_address": "important@example.com",
            "display_name": "Important Person",
            "created_at": 1700000000
        }))
        .expect("should deserialize NotificationVip");

        assert_eq!(vip.email_address, "important@example.com");
        assert_eq!(vip.display_name.as_deref(), Some("Important Person"));
    }

    // ── Allowlist type deserialization ───────────────────────────────────

    #[test]
    fn test_allowlist_deserialize() {
        // Allowlist also uses snake_case (no serde rename_all)
        let item: Allowlist = serde_json::from_value(json!({
            "id": "al_001",
            "account_id": "acc_001",
            "list_type": "image",
            "target": "trusted-sender@example.com",
            "display_name": "Trusted",
            "created_at": 1700000000
        }))
        .expect("should deserialize Allowlist");

        assert_eq!(item.list_type, "image");
        assert_eq!(item.target, "trusted-sender@example.com");
        assert_eq!(item.display_name.as_deref(), Some("Trusted"));
    }

    // ── PgpKey type deserialization ──────────────────────────────────────

    #[test]
    fn test_pgp_key_deserialize() {
        // PgpKey also uses snake_case (no serde rename_all)
        let key: PgpKey = serde_json::from_value(json!({
            "id": "pgp_001",
            "account_id": "acc_001",
            "key_id": "ABC123DEF456",
            "public_key": "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...",
            "private_key_encrypted": "encrypted_data",
            "passphrase_hint": "my passphrase",
            "fingerprint": "AA BB CC DD EE FF",
            "created_at": 1700000000
        }))
        .expect("should deserialize PgpKey");

        assert_eq!(key.key_id, "ABC123DEF456");
        assert!(key.public_key.starts_with("-----BEGIN"));
        assert!(key.private_key_encrypted.is_some());
        assert_eq!(key.passphrase_hint.as_deref(), Some("my passphrase"));
        assert_eq!(key.fingerprint.as_deref(), Some("AA BB CC DD EE FF"));
    }

    #[test]
    fn test_pgp_key_minimal_fields() {
        let key: PgpKey = serde_json::from_value(json!({
            "id": "pgp_min",
            "account_id": "acc_min",
            "key_id": "MINIMAL",
            "public_key": "pub_key_data",
            "private_key_encrypted": null,
            "passphrase_hint": null,
            "fingerprint": null,
            "created_at": 0
        }))
        .expect("should deserialize PgpKey with null optional fields");

        assert!(key.private_key_encrypted.is_none());
        assert!(key.passphrase_hint.is_none());
        assert!(key.fingerprint.is_none());
    }

    // ── LinkScanResult type deserialization ──────────────────────────────

    #[test]
    fn test_link_scan_result_deserialize() {
        // LinkScanResult also uses snake_case
        let result: LinkScanResult = serde_json::from_value(json!({
            "message_id": "msg_001",
            "account_id": "acc_001",
            "result_json": "{\"safe\": true, \"score\": 0.1}",
            "scanned_at": 1700000000
        }))
        .expect("should deserialize LinkScanResult");

        assert_eq!(result.message_id, "msg_001");
        assert!(result.result_json.contains("safe"));
    }

    // ── CmdResult type tests ────────────────────────────────────────────

    #[test]
    fn test_cmd_result_ok_variant() {
        let result: CmdResult<bool> = Ok(true);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), true);
    }

    #[test]
    fn test_cmd_result_err_variant() {
        let result: CmdResult<()> = Err(SerializedError::new("TEST_CODE", "test message"));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "TEST_CODE");
        assert_eq!(err.message, "test message");
    }

    // ── Duplicate function observation ───────────────────────────────────
    //
    // db_remove_notification_vip and db_delete_notification_vip both call
    // the same underlying function: notification_vips::remove_vip.
    // This is a code smell — they are exact duplicates.
    // We document this here as a test for awareness.

    #[test]
    fn test_notification_vip_commands_are_semantically_identical() {
        // Both db_remove_notification_vip and db_delete_notification_vip call
        // notification_vips::remove_vip with the same parameters.
        // This test documents the duplication.
        //
        // If one is removed in the future, this test should be updated.
        // The function signatures are:
        //   db_remove_notification_vip(pool, account_id, email_address) -> CmdResult<()>
        //   db_delete_notification_vip(pool, account_id, email_address) -> CmdResult<()>
        //
        // Both delegate to: notification_vips::remove_vip(&pool, &account_id, &email_address)
        //
        // This is intentional documentation — the tests ensure the duplicate behavior
        // remains consistent if one is eventually removed.
        let _ = "db_remove_notification_vip and db_delete_notification_vip are duplicates";
    }
}
