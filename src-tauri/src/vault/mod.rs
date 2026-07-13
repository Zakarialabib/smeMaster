/// Register all command handlers with the Tauri builder.
///
/// NOTE: This module's #[tauri::command] functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// Each module's `register()` is now a no-op pass-through because
/// Tauri v2 keeps only the LAST `invoke_handler(...)` call — calling
/// it here would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

pub mod ops;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::{Builder, Manager, Wry};
use sha2::{Digest, Sha256};

#[cfg(target_os = "android")]
use tauri_plugin_biometric::BiometricExt;

use crate::error::SerializedError;

// ---------------------------------------------------------------------------
// Desktop PIN verification helpers
// ---------------------------------------------------------------------------

/// Maximum failed PIN attempts before lockout.
const MAX_PIN_ATTEMPTS: u32 = 5;

/// Lockout duration after exceeding max attempts.
const LOCKOUT_DURATION: Duration = Duration::from_secs(30);

/// Global state for PIN attempt tracking (per-app singleton).
static PIN_ATTEMPTS: OnceLock<AtomicU32> = OnceLock::new();
static LOCKOUT_UNTIL: OnceLock<std::sync::Mutex<Instant>> = OnceLock::new();

fn pin_attempts() -> &'static AtomicU32 {
    PIN_ATTEMPTS.get_or_init(|| AtomicU32::new(0))
}

fn lockout_until() -> &'static std::sync::Mutex<Instant> {
    LOCKOUT_UNTIL.get_or_init(|| std::sync::Mutex::new(Instant::now()))
}

/// Check if we're currently in lockout period. If so, return remaining seconds.
pub(crate) fn check_lockout() -> Option<u64> {
    let until = lockout_until().lock().unwrap();
    if Instant::now() < *until {
        return Some(until.duration_since(Instant::now()).as_secs() + 1);
    }
    None
}

/// Record a failed PIN attempt. Returns true if lockout is now active.
pub(crate) fn record_failed_attempt() -> bool {
    let attempts = pin_attempts().fetch_add(1, Ordering::SeqCst) + 1;
    if attempts >= MAX_PIN_ATTEMPTS {
        let mut until = lockout_until().lock().unwrap();
        *until = Instant::now() + LOCKOUT_DURATION;
        pin_attempts().store(0, Ordering::SeqCst);
        true
    } else {
        false
    }
}

/// Clear failed attempts on success.
pub(crate) fn clear_attempts() {
    pin_attempts().store(0, Ordering::SeqCst);
}

/// Verify PIN against the stored hash using argon2 (with SHA-256 fallback for legacy).
pub(crate) async fn verify_pin_hash(app: &tauri::AppHandle, pin: &str) -> Result<bool, SerializedError> {
    let vault_root = app
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new(crate::error::ERR_FILE_IO, e.to_string()))?
        .join("vault");
    let pin_file = vault_root.join(".vault_pin");

    if !tokio::fs::try_exists(&pin_file).await.unwrap_or(false) {
        return Ok(false);
    }

    let stored = tokio::fs::read_to_string(&pin_file).await?;

    // Try argon2 verification first (new format: "$argon2id$...")
    if stored.trim().starts_with("$argon2") {
        let parsed = argon2::password_hash::PasswordHash::new(stored.trim())
            .map_err(|e| SerializedError::new(crate::error::ERR_INTERNAL, format!("Invalid pin hash: {e}")))?;
        return argon2::password_hash::PasswordVerifier::verify_password(
            &argon2::Argon2::default(),
            pin.as_bytes(),
            &parsed,
        )
        .map(|_| true)
        .map_err(|_| SerializedError::new(crate::error::ERR_INTERNAL, "PIN verify error"));
    }

    // Fallback: legacy unsalted SHA-256
    let input_hash = format!("{:x}", Sha256::digest(pin.as_bytes()));
    Ok(stored.trim() == input_hash)
}

/// Hash a PIN using argon2 (modern, salted, memory-hard).
pub(crate) async fn hash_pin(pin: &str) -> Result<String, SerializedError> {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};

    let salt = SaltString::generate(&mut OsRng);
    let hash = argon2::Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|e| SerializedError::new(crate::error::ERR_INTERNAL, format!("PIN hash failed: {e}")))?;
    Ok(hash.to_string())
}

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

/// Require authentication before accessing vault operations.
///
/// - **Android**: Uses biometric plugin (fingerprint / face).
/// - **Desktop**: Enforces lockout policy. The frontend must call
///   `verify_vault_pin` before invoking protected commands.
pub async fn require_biometric(app: &tauri::AppHandle, _reason: &str) -> Result<(), SerializedError> {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_biometric::BiometricExt;
        app.biometric()
            .authenticate(_reason.to_string(), Default::default())
            .map_err(|e| SerializedError::new(crate::error::ERR_AUTH_FAILED, format!("Biometric required: {}", e)))
    }
    #[cfg(not(target_os = "android"))]
    {
        // Check lockout first
        if let Some(remaining) = check_lockout() {
            return Err(SerializedError::new(
                crate::error::ERR_AUTH_FAILED,
                format!("Too many failed attempts. Try again in {} seconds.", remaining),
            ));
        }

        // Check if a PIN is set
        let vault_root = app
            .path()
            .app_data_dir()
            .map_err(|e| SerializedError::new(crate::error::ERR_FILE_IO, e.to_string()))?
            .join("vault");
        let pin_file = vault_root.join(".vault_pin");

        if !tokio::fs::try_exists(&pin_file).await.unwrap_or(false) {
            // No PIN set — vault is unprotected (first-run state)
            return Ok(());
        }

        // PIN is set but we can't prompt interactively from a pure backend command.
        // The frontend is responsible for calling `verify_vault_pin` before invoking
        // protected commands. This gate enforces the lockout policy.
        Ok(())
    }
}
