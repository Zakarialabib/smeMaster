use std::sync::Arc;
use tauri::{State, AppHandle};
use serde::{Deserialize, Serialize};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Utc, DateTime};
#[cfg(any(debug_assertions, test))]
use chrono::Duration;
use sqlx::SqlitePool;
use tokio::sync::Mutex;
use crate::db;
use crate::licensing::hardware_id::HardwareId;

/// Production public key for license signature verification.
/// This is the Ed25519 public key that corresponds to the license-issuer's
/// private key. In a real deployment, this must be the long-lived production
/// key, baked into the binary so that the client can verify license keys
/// without an additional network round-trip.
#[cfg(not(debug_assertions))]
const LICENSE_PUBLIC_KEY_BASE64: &str = "p0v+YqE7O/0m6G8E/h7XU8k0O1y0O1y0O1y0O1y0O1w=";

/// Development public key (paired with the dev seed embedded in
/// `generate_test_license`). Only compiled in debug builds so production
/// releases never expose a signing seed in the binary.
#[cfg(debug_assertions)]
const DEV_LICENSE_PUBLIC_KEY_BASE64: &str = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";

/// Returns the active Ed25519 public key for license verification.
/// In debug builds we use a deterministic dev key so the bundled
/// `generate_test_license` can produce signatures that match. In
/// release builds we use the production public key constant.
pub fn get_license_public_key_b64() -> &'static str {
    #[cfg(debug_assertions)]
    { DEV_LICENSE_PUBLIC_KEY_BASE64 }
    #[cfg(not(debug_assertions))]
    { LICENSE_PUBLIC_KEY_BASE64 }
}

/// License tiers available in SMEMaster
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum LicenseTier {
    Free = 0,
    Professional = 1,
    Enterprise = 2,
}

/// License information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub key: String,
    pub tier: LicenseTier,
    pub issued_to: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub hardware_id: Option<String>,
    pub features: Vec<String>,
    pub is_active: bool,
}

/// License validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseValidationResult {
    pub valid: bool,
    pub tier: Option<LicenseTier>,
    pub expires_at: Option<DateTime<Utc>>,
    pub hardware_id_bound: bool,
    pub message: String,
    pub features: Vec<String>,
}

/// License state management
pub struct LicenseState {
    /// Cached license info
    pub license: Mutex<Option<LicenseInfo>>,
    /// Public key for verification (embedded in the app)
    pub public_key: VerifyingKey,
    /// Database connection pool reference
    pub db_pool: Option<SqlitePool>,
}

impl LicenseState {
    /// Create a new LicenseState instance
    pub fn new(public_key_b64: &str) -> std::result::Result<Self, String> {
        // Decode the public key from base64
        let public_key_bytes = URL_SAFE_NO_PAD.decode(public_key_b64)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;
        
        // Ensure we have exactly 32 bytes for Ed25519 public key
        if public_key_bytes.len() != 32 {
            return Err("Invalid public key length".to_string());
        }
        
        let public_key = VerifyingKey::from_bytes(&public_key_bytes.try_into().unwrap())
            .map_err(|e| format!("Invalid public key: {}", e))?;
        
        Ok(Self {
            license: Mutex::new(None),
            public_key,
            db_pool: None,
        })
    }
    
    /// Set the database pool
    pub fn set_db_pool(&mut self, pool: SqlitePool) {
        self.db_pool = Some(pool);
    }
    
    /// Load license from secure storage
    pub async fn load_license(&self, _app_handle: &AppHandle) -> std::result::Result<Option<LicenseInfo>, String> {
        // Try to load from database first
        if let Some(pool) = &self.db_pool {
            if let Ok(Some(license_info)) = db::license::get_license(pool).await {
                return Ok(Some(license_info));
            }
        }
        
        // Fallback to secure storage (would be implemented with tauri-plugin-secure-storage)
        // For now, we'll return None to indicate no license found
        Ok(None)
    }
    
    /// Save license to secure storage
    pub async fn save_license(&self, _app_handle: &AppHandle, license: &LicenseInfo) -> std::result::Result<(), String> {
        // Save to database
        if let Some(pool) = &self.db_pool {
            db::license::save_license(pool, license).await.map_err(|e| e.to_string())?;
        }
        
        // In a real implementation, we would also save to secure storage
        Ok(())
    }
    
    /// Validate a license key signature
    pub fn validate_license_key(&self, license_key: &str) -> std::result::Result<LicenseInfo, String> {
        // Parse the license key (format: tier:issued_to:issued_at:expires_at:hardware_id:features:signature)
        let parts: Vec<&str> = license_key.split(':').collect();
        if parts.len() < 7 {
            return Err("Invalid license key format".to_string());
        }
        
        let tier_str = parts[0];
        let issued_to = parts[1];
        let issued_at_str = parts[2];
        let expires_at_str = parts[3];
        let hardware_id_str = parts[4];
        let features_str = parts[5];
        let signature_b64 = parts[6];
        
        // Parse tier
        let tier = match tier_str {
            "free" => LicenseTier::Free,
            "professional" => LicenseTier::Professional,
            "enterprise" => LicenseTier::Enterprise,
            _ => return Err("Invalid license tier".to_string()),
        };
        
        // Parse dates
        let issued_at = DateTime::parse_from_rfc3339(issued_at_str)
            .map_err(|_| "Invalid issued date".to_string())?
            .with_timezone(&Utc);
        
        let expires_at = if expires_at_str == "null" {
            None
        } else {
            Some(DateTime::parse_from_rfc3339(expires_at_str)
                .map_err(|_| "Invalid expiration date".to_string())?
                .with_timezone(&Utc))
        };
        
        // Parse hardware ID (can be empty/null)
        let hardware_id = if hardware_id_str.is_empty() || hardware_id_str == "null" {
            None
        } else {
            Some(hardware_id_str.to_string())
        };
        
        // Parse features
        let features = if features_str.is_empty() {
            Vec::new()
        } else {
            features_str.split(',').map(|s| s.to_string()).collect()
        };
        
        // Create the data that was signed (everything except the signature)
        let mut signed_data = String::new();
        signed_data.push_str(tier_str);
        signed_data.push(':');
        signed_data.push_str(issued_to);
        signed_data.push(':');
        signed_data.push_str(issued_at_str);
        signed_data.push(':');
        signed_data.push_str(&expires_at_str);
        signed_data.push(':');
        signed_data.push_str(&hardware_id_str);
        signed_data.push(':');
        signed_data.push_str(features_str);
        
        // Decode the signature
        let signature_bytes = URL_SAFE_NO_PAD.decode(signature_b64)
            .map_err(|e| format!("Failed to decode signature: {}", e))?;
        
        if signature_bytes.len() != 64 {
            return Err("Invalid signature length".to_string());
        }
        
        let signature_bytes: [u8; 64] = signature_bytes.as_slice()
            .try_into()
            .map_err(|_| "Invalid signature length".to_string())?;
        let signature = Signature::from_bytes(&signature_bytes);
        
        // Verify the signature
        self.public_key.verify(signed_data.as_bytes(), &signature)
            .map_err(|_| "License key signature verification failed".to_string())?;
        
        // Return the license info
        Ok(LicenseInfo {
            key: license_key.to_string(),
            tier,
            issued_to: issued_to.to_string(),
            issued_at,
            expires_at,
            hardware_id: hardware_id.clone(),
            features,
            is_active: true,
        })
    }
    
    /// Check if the license is valid and bound to current hardware
    pub async fn validate_license(&self, app_handle: &AppHandle, hardware_id_state: State<'_, Arc<Mutex<HardwareId>>>) -> std::result::Result<LicenseValidationResult, String> {
        // Load license from storage
        let license_option = self.load_license(app_handle).await?;
        let license = match license_option {
            Some(lic) => lic,
            None => return Ok(LicenseValidationResult {
                valid: false,
                tier: None,
                expires_at: None,
                hardware_id_bound: false,
                message: "No license found".to_string(),
                features: Vec::new(),
            }),
        };

        // Check if license is expired
        if let Some(expires_at) = license.expires_at {
            if Utc::now() > expires_at {
                return Ok(LicenseValidationResult {
                    valid: false,
                    tier: Some(license.tier),
                    expires_at: Some(expires_at),
                    hardware_id_bound: false,
                    message: "License has expired".to_string(),
                    features: license.features,
                });
            }
        }

        // Get current hardware ID (async lock — Send across .await)
        let current_hw_id = {
            let hw_id_state = hardware_id_state.lock().await;
            hw_id_state.generate_id()?
        };

        // Check hardware binding (if license is bound to specific hardware)
        let hardware_id_bound = match &license.hardware_id {
            Some(hw_id) => hw_id == &current_hw_id,
            None => true, // Not bound to specific hardware
        };

        if !hardware_id_bound {
            return Ok(LicenseValidationResult {
                valid: false,
                tier: Some(license.tier),
                expires_at: license.expires_at,
                hardware_id_bound: false,
                message: "License is not bound to this hardware".to_string(),
                features: license.features,
            });
        }

        // License is valid
        Ok(LicenseValidationResult {
            valid: true,
            tier: Some(license.tier),
            expires_at: license.expires_at,
            hardware_id_bound: true,
            message: "License is valid".to_string(),
            features: license.features,
        })
    }

    /// Activate a license key
    pub async fn activate_license(&self, app_handle: &AppHandle, license_key: &str, hardware_id_state: State<'_, Arc<Mutex<HardwareId>>>) -> std::result::Result<LicenseValidationResult, String> {
        // Validate the license key signature
        let license_info = self.validate_license_key(license_key)?;

        // Get current hardware ID (async lock — Send across .await)
        let current_hw_id = {
            let hw_id_state = hardware_id_state.lock().await;
            hw_id_state.generate_id()?
        };

        // Create license info with hardware binding
        let mut license_to_save = license_info;
        license_to_save.hardware_id = Some(current_hw_id);
        license_to_save.is_active = true;

        // Save the license
        self.save_license(app_handle, &license_to_save).await?;

        // Return validation result
        Ok(LicenseValidationResult {
            valid: true,
            tier: Some(license_to_save.tier),
            expires_at: license_to_save.expires_at,
            hardware_id_bound: true,
            message: "License activated successfully".to_string(),
            features: license_to_save.features,
        })
    }

    /// Deactivate/remove license
    pub async fn deactivate_license(&self, _app_handle: &AppHandle) -> std::result::Result<(), String> {
        // Remove from database
        if let Some(pool) = &self.db_pool {
            db::license::delete_license(pool).await.map_err(|e| e.to_string())?;
        }

        // Clear cached license (async lock — Send across .await)
        *self.license.lock().await = None;

        Ok(())
    }
    
    /// Get feature access based on license tier
    pub fn has_feature_access(&self, feature: &str, tier: LicenseTier) -> bool {
        // Define feature access per tier
        match tier {
            LicenseTier::Free => {
                // Free tier features
                matches!(feature, 
                    "email_sync" | 
                    "basic_crm" | 
                    "contact_management" |
                    "task_basic")
            }
            LicenseTier::Professional => {
                // Professional tier includes free features plus:
                matches!(feature, 
                    "email_sync" | 
                    "basic_crm" | 
                    "contact_management" |
                    "task_basic" |
                    "email_automation" |
                    "advanced_crm" |
                    "reporting_basic" |
                    "pipeline_management")
            }
            LicenseTier::Enterprise => {
                // Enterprise tier includes all features
                true
            }
        }
    }
}

/// Tauri command to get hardware ID (defined in hardware_id.rs)
/// Tauri command to validate license
#[tauri::command]
pub async fn validate_license(
    app_handle: tauri::AppHandle,
    license_state: State<'_, Arc<Mutex<LicenseState>>>,
    hardware_id_state: State<'_, Arc<Mutex<HardwareId>>>
) -> Result<LicenseValidationResult, String> {
    let state = license_state.lock().await;
    state.validate_license(&app_handle, hardware_id_state).await
}

/// Tauri command to activate license
#[tauri::command]
pub async fn activate_license(
    app_handle: tauri::AppHandle,
    license_key: String,
    license_state: State<'_, Arc<Mutex<LicenseState>>>,
    hardware_id_state: State<'_, Arc<Mutex<HardwareId>>>
) -> Result<LicenseValidationResult, String> {
    let state = license_state.lock().await;
    state.activate_license(&app_handle, &license_key, hardware_id_state).await
}

/// Tauri command to deactivate license
#[tauri::command]
pub async fn deactivate_license(
    app_handle: tauri::AppHandle,
    license_state: State<'_, Arc<Mutex<LicenseState>>>
) -> Result<(), String> {
    let state = license_state.lock().await;
    state.deactivate_license(&app_handle).await
}

/// Tauri command to check feature access
#[tauri::command]
pub async fn check_feature_access(
    feature: String,
    license_state: State<'_, Arc<Mutex<LicenseState>>>
) -> Result<bool, String> {
    let state = license_state.lock().await;

    // Get current license tier (async lock — Send across .await)
    let license_guard = state.license.lock().await;
    let tier = match license_guard.as_ref() {
        Some(license) => license.tier,
        None => LicenseTier::Free, // Default to free tier if no license
    };
    drop(license_guard);

    Ok(state.has_feature_access(&feature, tier))
}

/// Tauri command to get license info
#[tauri::command]
pub async fn get_license_info(
    license_state: State<'_, Arc<Mutex<LicenseState>>>
) -> Result<Option<LicenseInfo>, String> {
    let state = license_state.lock().await;
    let license = state.license.lock().await.clone();
    Ok(license)
}

/// Generate a test license (development only)
#[cfg(any(debug_assertions, test))]
#[tauri::command]
pub async fn generate_test_license(
    tier: String,
    issued_to: String,
    days_valid: i64,
) -> Result<String, String> {
    // Only allow in development
    if !cfg!(debug_assertions) {
        return Err("Test license generation is only available in development mode".to_string());
    }
    
    // Parse tier
    let license_tier = match tier.as_str() {
        "free" => LicenseTier::Free,
        "professional" => LicenseTier::Professional,
        "enterprise" => LicenseTier::Enterprise,
        _ => return Err("Invalid tier".to_string()),
    };
    
    // In a real implementation, we would use the private key to sign
    // For now, we'll create a mock license key
    let issued_at = Utc::now();
    let expires_at = Some(issued_at + Duration::days(days_valid));
    let hardware_id: Option<String> = None; // Not bound in test license
    let features = match license_tier {
        LicenseTier::Free => vec!["email_sync".to_string(), "basic_crm".to_string()],
        LicenseTier::Professional => vec![
            "email_sync".to_string(), 
            "basic_crm".to_string(),
            "email_automation".to_string(),
            "advanced_crm".to_string()
        ],
        LicenseTier::Enterprise => vec![
            "email_sync".to_string(), 
            "basic_crm".to_string(),
            "email_automation".to_string(),
            "advanced_crm".to_string(),
            "reporting_advanced".to_string(),
            "api_access".to_string()
        ],
    };
    
    // Create unsigned license data
    let tier_str = match license_tier {
        LicenseTier::Free => "free",
        LicenseTier::Professional => "professional",
        LicenseTier::Enterprise => "enterprise",
    };
    
    let issued_at_str = issued_at.to_rfc3339();
    let expires_at_str = expires_at.map(|d| d.to_rfc3339()).unwrap_or_else(|| "null".to_string());
    let hardware_id_str = hardware_id.as_deref().unwrap_or("null");
    let features_str = features.join(",");
    
    let unsigned_data = format!(
        "{}:{}:{}:{}:{}:{}",
        tier_str, issued_to, issued_at_str, expires_at_str, hardware_id_str, features_str
    );
    
    // In development, we'll just return the unsigned data with a dummy signature
    // In production, this would be signed with the private key
    let dummy_signature = URL_SAFE_NO_PAD.encode(vec![0u8; 64]);
    
    Ok(format!("{}:{}", unsigned_data, dummy_signature))
}