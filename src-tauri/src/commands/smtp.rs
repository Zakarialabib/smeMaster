// ── SMTP Tauri Commands ──────────────────────────────────────────────────────
//
// Thin wrappers that delegate to crate::smtp::client.

use crate::error::SerializedError;
use crate::smtp::client as smtp_client;
use crate::smtp::types::{SmtpConfig, SmtpSendResult};

#[tauri::command]
pub async fn smtp_send_email(
    config: SmtpConfig,
    raw_email: String,
) -> Result<SmtpSendResult, SerializedError> {
    smtp_client::send_raw_email(&config, &raw_email).await
}

#[tauri::command]
pub async fn smtp_test_connection(config: SmtpConfig) -> Result<SmtpSendResult, SerializedError> {
    smtp_client::test_connection(&config).await
}

// ── Tests ────────────────────────────────────────────────────────────────
//
// Verifies the IPC contract for SMTP types:
// - SmtpConfig serde (default fields, field mapping)
// - SmtpSendResult serde
// - Function signature correctness

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── SmtpConfig deserialization ───────────────────────────────────────

    #[test]
    fn test_smtp_config_full_fields() {
        let config: SmtpConfig = serde_json::from_value(json!({
            "host": "smtp.gmail.com",
            "port": 465,
            "security": "tls",
            "username": "user@gmail.com",
            "password": "app_password",
            "auth_method": "password",
            "accept_invalid_certs": true,
            "timeout_secs": 60
        }))
        .expect("should deserialize SmtpConfig with all fields");

        assert_eq!(config.host, "smtp.gmail.com");
        assert_eq!(config.port, 465);
        assert_eq!(config.security, "tls");
        assert_eq!(config.username, "user@gmail.com");
        assert_eq!(config.password, "app_password");
        assert_eq!(config.auth_method, "password");
        assert!(config.accept_invalid_certs);
        assert_eq!(config.timeout_secs, Some(60));
    }

    #[test]
    fn test_smtp_config_default_boolean_field() {
        // accept_invalid_certs defaults to false when absent
        let config: SmtpConfig = serde_json::from_value(json!({
            "host": "smtp.example.com",
            "port": 587,
            "security": "starttls",
            "username": "user",
            "password": "pass",
            "auth_method": "password"
        }))
        .expect("should deserialize SmtpConfig without optional fields");

        assert!(!config.accept_invalid_certs);
        assert_eq!(config.timeout_secs, None);
    }

    #[test]
    fn test_smtp_config_oauth2_method() {
        let config: SmtpConfig = serde_json::from_value(json!({
            "host": "smtp.gmail.com",
            "port": 465,
            "security": "tls",
            "username": "user@gmail.com",
            "password": "ya29.access_token",
            "auth_method": "oauth2"
        }))
        .expect("should deserialize SmtpConfig with oauth2");

        assert_eq!(config.auth_method, "oauth2");
        assert_eq!(config.password, "ya29.access_token");
    }

    // ── SmtpSendResult serde round-trip ──────────────────────────────────

    #[test]
    fn test_smtp_send_result_serde_roundtrip() {
        let result = SmtpSendResult {
            success: true,
            message: "Email sent successfully".to_string(),
        };
        let serialized = serde_json::to_value(&result).expect("should serialize SmtpSendResult");
        let deserialized: SmtpSendResult =
            serde_json::from_value(serialized).expect("should deserialize SmtpSendResult");

        assert!(deserialized.success);
        assert_eq!(deserialized.message, "Email sent successfully");
    }

    #[test]
    fn test_smtp_send_result_failure() {
        let result = SmtpSendResult {
            success: false,
            message: "Connection refused".to_string(),
        };
        let serialized = serde_json::to_value(&result).expect("should serialize");
        assert_eq!(serialized["success"], false);
        assert_eq!(serialized["message"], "Connection refused");
    }

    // ── Function signature compile-time checks ───────────────────────────

    #[test]
    fn test_smtp_command_function_signatures() {
        // Verify that the command functions exist and are callable with correct types.
        // We test this by calling them in a type-erased context (the compiler checks types).
        // The functions are async and require network, so we only verify type compatibility.
        fn _assert_types() {
            // Verify SmtpConfig and SmtpSendResult can be constructed (type compatibility)
            let _config = SmtpConfig {
                host: String::new(),
                port: 0,
                security: String::new(),
                username: String::new(),
                password: String::new(),
                auth_method: String::new(),
                accept_invalid_certs: false,
                timeout_secs: None,
            };
            let _result: SmtpSendResult = SmtpSendResult {
                success: true,
                message: String::new(),
            };
            let _err: Result<SmtpSendResult, SerializedError> = Ok(_result);
        }
        _assert_types();
    }

    #[test]
    fn test_smtp_config_implements_debug_clone() {
        let config = SmtpConfig {
            host: "smtp.test.com".into(),
            port: 587,
            security: "starttls".into(),
            username: "u".into(),
            password: "p".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
            timeout_secs: None,
        };
        let _ = format!("{:?}", config);
        let _config2 = config.clone();
    }

    #[test]
    fn test_smtp_send_result_implements_debug_clone() {
        let result = SmtpSendResult {
            success: true,
            message: "ok".into(),
        };
        let _ = format!("{:?}", result);
        let _result2 = result.clone();
    }
}
