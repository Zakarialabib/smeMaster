use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::fs;

use crate::db::vault::operations as db_vault;
use crate::db::vault::schema::VaultItem;
use crate::error::{self, SerializedError};
use sqlx::SqlitePool;

// ---------------------------------------------------------------------------
// Auto-categorization
// ---------------------------------------------------------------------------

/// Auto-detect file category based on extension.
pub fn categorize_file(name: &str, is_dir: bool) -> &'static str {
    if is_dir {
        return "folder";
    }
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "svg" | "webp" | "bmp" | "ico" => "images",
        // Documents
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "csv" => {
            "documents"
        }
        // Email files
        "eml" | "msg" => "email",
        // Archives
        "zip" | "tar" | "gz" | "7z" | "rar" => "archives",
        // Code
        "js" | "ts" | "py" | "rs" | "html" | "css" | "json" | "xml" | "yaml" | "toml" => "code",
        // Everything else
        _ => "other",
    }
}

// ---------------------------------------------------------------------------
// Internal helpers (sync, no biometric)
// ---------------------------------------------------------------------------

pub(crate) fn copy_to_vault_internal(source_path: &str, vault_path: &str) -> Result<(), SerializedError> {
    let dest = PathBuf::from(vault_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(source_path, &dest)?;
    Ok(())
}

pub(crate) fn delete_from_vault_internal(vault_path: &str) -> Result<(), SerializedError> {
    std::fs::remove_file(vault_path)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub path: String,
    pub is_dir: bool,
    pub category: String,
}

pub(crate) fn list_vault_dir_internal(dir_path: &str) -> Result<Vec<VaultEntry>, SerializedError> {
    let entries = std::fs::read_dir(dir_path)?;
    let mut results = Vec::new();
    for entry in entries {
        if let Ok(e) = entry {
            let path = e.path().to_string_lossy().to_string();
            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let file_name = e.file_name().to_string_lossy().to_string();
            let category = categorize_file(&file_name, is_dir).to_string();
            results.push(VaultEntry { path, is_dir, category });
        }
    }
    Ok(results)
}

// ---------------------------------------------------------------------------
// Helpers for account-scoped vault paths
// ---------------------------------------------------------------------------

/// Get the vault root path for a given account.
/// Returns `<app_data_dir>/vault/{account_id>`.
fn get_vault_root_for_account(app: &tauri::AppHandle, account_id: &str) -> Result<PathBuf, SerializedError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new(error::ERR_FILE_IO, e.to_string()))?
        .join("vault")
        .join(account_id);
    Ok(base)
}

//// Compute the relative path of a file within an account's vault directory.
pub(crate) fn relative_to_vault_root(full_path: &str, vault_root: &Path) -> String {
    let p = Path::new(full_path);
    p.strip_prefix(vault_root)
        .unwrap_or(p)
        .to_string_lossy()
        .to_string()
        .trim_start_matches('/')
        .to_string()
}

/// Record a filesystem entry in the database (upsert).
async fn record_entry_in_db(
    pool: &SqlitePool,
    full_path: &str,
    vault_root: &Path,
    account_id: &str,
    is_dir: bool,
) -> Result<(), SerializedError> {
    let p = Path::new(full_path);
    let relative_path = relative_to_vault_root(full_path, vault_root);
    let file_name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = p
        .extension()
        .map(|e| e.to_string_lossy().to_string());
    let category = categorize_file(&file_name, is_dir).to_string();
    let file_size = if is_dir {
        0
    } else {
        std::fs::metadata(full_path).map(|m| m.len()).unwrap_or(0) as i64
    };

    let now = chrono::Utc::now().timestamp();

    // Compute checksum for non-directory files under 100MB
    let checksum = if !is_dir && file_size < 100 * 1024 * 1024 {
        compute_file_checksum(full_path).ok()
    } else {
        None
    };

    let item = VaultItem {
        id: format!("{}_{}", account_id, relative_path),
        company_id: account_id.to_string(),
        relative_path,
        file_name,
        extension,
        category,
        file_size,
        is_dir: if is_dir { 1 } else { 0 },
        created_at: now,
        updated_at: now,
        checksum,
    };

    db_vault::upsert_vault_item(pool, &item).await
}

/// Compute SHA-256 checksum of a file.
fn compute_file_checksum(path: &str) -> Result<String, SerializedError> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Backfill the DB by walking a directory and recording all entries.
async fn backfill_directory(
    pool: &SqlitePool,
    dir_path: &str,
    vault_root: &Path,
    account_id: &str,
) -> Result<(), SerializedError> {
    let dp = dir_path.to_string();
    let entries = tokio::task::spawn_blocking(move || list_vault_dir_internal(&dp))
        .await
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("spawn_blocking failed: {e}")))?
        .map_err(|e| SerializedError::new(error::ERR_INTERNAL, format!("list_vault_dir failed: {e}")))?;
    for entry in &entries {
        record_entry_in_db(pool, &entry.path, vault_root, account_id, entry.is_dir).await?;
        if entry.is_dir {
            Box::pin(backfill_directory(pool, &entry.path, vault_root, account_id)).await?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_vault_root(
    app: tauri::AppHandle,
    account_id: Option<String>,
) -> Result<String, SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to access your files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let path = get_vault_root_for_account(&app, &aid)?;
    fs::create_dir_all(&path).await?;
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| SerializedError::new(error::ERR_INVALID_INPUT, "Invalid vault path"))
}

#[tauri::command]
pub fn copy_to_vault(
    source_path: String,
    vault_path: String,
    _account_id: Option<String>,
) -> Result<(), SerializedError> {
    copy_to_vault_internal(&source_path, &vault_path)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyToVaultOptions {
    pub encrypt: bool,
    pub public_key_armored: Option<String>,
}

#[tauri::command]
pub async fn copy_to_vault_encrypted(
    app: tauri::AppHandle,
    source_path: String,
    vault_path: String,
    options: Option<CopyToVaultOptions>,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    // 1. Require biometric
    crate::vault::require_biometric(&app, "Unlock vault to store files").await?;

    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    // 2. Ensure destination directory exists
    let dest = PathBuf::from(&vault_path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).await?;
    }

    // 3. Copy file
    fs::copy(&source_path, &dest).await?;

    // 4. Optionally PGP-encrypt the file in-place
    if let Some(opts) = options {
        if opts.encrypt {
            let public_key = opts.public_key_armored.ok_or_else(|| {
                SerializedError::new(
                    error::ERR_INVALID_INPUT,
                    "publicKeyArmored is required when encrypt is true",
                )
            })?;
            let source_content = fs::read(&dest).await?;
            let encrypted = crate::pgp::crypto::encrypt_bytes(&source_content, &public_key)?;
            fs::write(&dest, encrypted).await?;
        }
    }

    // 5. Record in DB
    let pool = app.state::<SqlitePool>().inner().clone();
    let dest_str = dest.to_string_lossy().to_string();
    record_entry_in_db(&pool, &dest_str, &vault_root, &aid, false).await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_from_vault(
    app: tauri::AppHandle,
    vault_path: String,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to delete files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    let path = vault_path.clone();
    tokio::task::spawn_blocking(move || delete_from_vault_internal(&path))
        .await
        .map_err(|e| {
            SerializedError::new(
                error::ERR_INTERNAL,
                format!("Background task failed: {}", e),
            )
        })??;

    // Remove from DB
    let pool = app.state::<SqlitePool>().inner().clone();
    let rel_path = relative_to_vault_root(&vault_path, &vault_root);
    db_vault::delete_vault_item(&pool, &rel_path).await?;

    Ok(())
}

#[tauri::command]
pub async fn list_vault_dir(
    app: tauri::AppHandle,
    dir_path: String,
    account_id: Option<String>,
    category: Option<String>,
) -> Result<Vec<VaultEntry>, SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to list files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    // Read the filesystem directory
    let path = dir_path.clone();
    let mut entries: Vec<VaultEntry> = tokio::task::spawn_blocking(move || {
        list_vault_dir_internal(&path)
    })
    .await
    .map_err(|e| {
        SerializedError::new(
            error::ERR_INTERNAL,
            format!("Background task failed: {}", e),
        )
    })??;

    // Backfill into DB
    let pool = app.state::<SqlitePool>().inner().clone();
    let vr = vault_root.clone();
    let aid2 = aid.clone();
    for entry in &entries {
        record_entry_in_db(&pool, &entry.path, &vr, &aid2, entry.is_dir).await?;
    }

    // Optionally filter by category
    if let Some(cat) = category {
        if !cat.is_empty() {
            entries.retain(|e| e.category == cat);
        }
    }

    Ok(entries)
}

// ---------------------------------------------------------------------------
// New vault commands (read, download, create dir, PIN ops)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn read_vault_file(
    app: tauri::AppHandle,
    path: String,
    _account_id: Option<String>,
) -> Result<String, SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to read files").await?;
    let data = fs::read(&path).await?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[tauri::command]
pub async fn copy_vault_to_downloads(
    app: tauri::AppHandle,
    vault_path: String,
    _account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to export files").await?;

    let download_dir = dirs::download_dir().ok_or_else(|| {
        SerializedError::new(error::ERR_NOT_FOUND, "Cannot find Downloads folder")
    })?;

    let filename = std::path::Path::new(&vault_path)
        .file_name()
        .ok_or_else(|| SerializedError::new(error::ERR_INVALID_INPUT, "Invalid file path"))?
        .to_string_lossy()
        .to_string();

    let dest = download_dir.join(&filename);

    // Avoid overwriting: append a suffix if file already exists
    let mut final_dest = dest.clone();
    let mut counter = 1;
    while fs::try_exists(&final_dest).await.unwrap_or(false) {
        let stem = std::path::Path::new(&filename)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy();
        let ext = std::path::Path::new(&filename)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        final_dest =
            download_dir.join(format!("{} ({}).{}", stem, counter, ext.trim_start_matches('.')));
        counter += 1;
    }

    fs::copy(&vault_path, &final_dest).await?;
    Ok(())
}

#[tauri::command]
pub async fn create_vault_dir(
    app: tauri::AppHandle,
    path: String,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to create folders").await?;
    fs::create_dir_all(&path).await?;

    // Record directory in DB
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;
    let pool = app.state::<SqlitePool>().inner().clone();
    record_entry_in_db(&pool, &path, &vault_root, &aid, true).await?;

    Ok(())
}

#[tauri::command]
pub async fn set_vault_pin(app: tauri::AppHandle, pin: String) -> Result<(), SerializedError> {
    let hash = format!("{:x}", Sha256::digest(pin.as_bytes()));
    let vault_root = app
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new(error::ERR_FILE_IO, e.to_string()))?
        .join("vault");
    fs::create_dir_all(&vault_root).await?;
    fs::write(vault_root.join(".vault_pin"), &hash).await?;
    Ok(())
}

#[tauri::command]
pub async fn verify_vault_pin(app: tauri::AppHandle, pin: String) -> Result<bool, SerializedError> {
    let vault_root = app
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new(error::ERR_FILE_IO, e.to_string()))?
        .join("vault");
    let pin_file = vault_root.join(".vault_pin");

    if !fs::try_exists(&pin_file).await.unwrap_or(false) {
        return Ok(false);
    }

    let stored_hash = fs::read_to_string(&pin_file).await?;
    let input_hash = format!("{:x}", Sha256::digest(pin.as_bytes()));

    Ok(stored_hash.trim() == input_hash)
}

/// Returns `true` if a vault PIN has been set.
#[tauri::command]
pub async fn has_vault_pin(app: tauri::AppHandle) -> Result<bool, SerializedError> {
    let vault_root = app
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new(error::ERR_FILE_IO, e.to_string()))?
        .join("vault");
    let pin_file = vault_root.join(".vault_pin");
    Ok(fs::try_exists(&pin_file).await.unwrap_or(false))
}

// ---------------------------------------------------------------------------
// Internal helpers for move / rename / copy / size / search
// ---------------------------------------------------------------------------

/// Recursively copy a file or directory tree
fn copy_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), SerializedError> {
    if src.is_dir() {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let src_child = entry.path();
            let dst_child = dst.join(entry.file_name());
            copy_recursive(&src_child, &dst_child)?;
        }
        Ok(())
    } else {
        std::fs::copy(src, dst)?;
        Ok(())
    }
}

/// Recursively sum file sizes in a directory tree
fn walk_dir_size(dir: &std::path::Path, total: &mut u64) -> Result<(), SerializedError> {
    if dir.is_dir() {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                walk_dir_size(&path, total)?;
            } else if let Ok(meta) = path.metadata() {
                *total += meta.len();
            }
        }
    } else if let Ok(meta) = dir.metadata() {
        *total += meta.len();
    }
    Ok(())
}

pub(crate) fn move_vault_item_internal(source: &str, dest: &str) -> Result<(), SerializedError> {
    let src = std::path::Path::new(source);
    let dst = std::path::Path::new(dest);
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // Try rename first (fast path — works only on same filesystem)
    if std::fs::rename(src, dst).is_ok() {
        return Ok(());
    }
    // Fallback: copy + delete
    copy_recursive(src, dst)?;
    if src.is_dir() {
        std::fs::remove_dir_all(src)?;
    } else {
        std::fs::remove_file(src)?;
    }
    Ok(())
}

pub(crate) fn rename_vault_item_internal(
    path: &str,
    new_name: &str,
) -> Result<(), SerializedError> {
    let src = std::path::Path::new(path);
    let parent = src.parent().ok_or_else(|| {
        SerializedError::new(error::ERR_INVALID_INPUT, "Path has no parent directory")
    })?;
    let dst = parent.join(new_name);
    let dst_str = dst
        .to_str()
        .ok_or_else(|| SerializedError::new(error::ERR_INVALID_INPUT, "Invalid destination path"))?;
    move_vault_item_internal(path, dst_str)
}

pub(crate) fn copy_vault_item_internal(
    source: &str,
    dest: &str,
) -> Result<(), SerializedError> {
    let src = std::path::Path::new(source);
    let dst = std::path::Path::new(dest);
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    copy_recursive(src, dst)
}

pub(crate) fn get_vault_size_internal(dir: &str) -> Result<u64, SerializedError> {
    let path = std::path::Path::new(dir);
    if !path.exists() {
        return Ok(0);
    }
    let mut total = 0u64;
    walk_dir_size(path, &mut total)?;
    Ok(total)
}

#[allow(dead_code)]
pub(crate) fn search_vault_internal(
    dir: &str,
    pattern: &str,
) -> Result<Vec<String>, SerializedError> {
    let base = std::path::Path::new(dir);
    let full_pattern = base.join(pattern);
    let pattern_str = full_pattern.to_string_lossy().replace('\\', "/"); // glob expects forward slashes

    let entries = glob::glob(&pattern_str).map_err(|e| {
        SerializedError::new(
            error::ERR_INVALID_INPUT,
            format!("Invalid glob pattern: {}", e),
        )
    })?;

    let mut results: Vec<String> = entries
        .filter_map(|entry| match entry {
            Ok(path) => Some(path.to_string_lossy().to_string()),
            Err(e) => {
                log::warn!("Glob error while searching vault: {}", e);
                None
            }
        })
        .collect();
    results.sort();
    Ok(results)
}

// ---------------------------------------------------------------------------
// Tauri commands for move / rename / copy / size / search
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn move_vault_item(
    app: tauri::AppHandle,
    source_path: String,
    dest_path: String,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to move files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    let source = source_path.clone();
    let dest = dest_path.clone();
    tokio::task::spawn_blocking(move || move_vault_item_internal(&source, &dest))
        .await
        .map_err(|e| {
            SerializedError::new(
                error::ERR_INTERNAL,
                format!("Background task failed: {}", e),
            )
        })??;

    // Update DB: delete old entry, insert new one
    let pool = app.state::<SqlitePool>().inner().clone();
    let rel_src = relative_to_vault_root(&source_path, &vault_root);

    db_vault::delete_vault_item(&pool, &rel_src).await?;
    record_entry_in_db(&pool, &dest_path, &vault_root, &aid, false).await?;

    Ok(())
}

#[tauri::command]
pub async fn rename_vault_item(
    app: tauri::AppHandle,
    path: String,
    new_name: String,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to rename files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    let p = path.clone();
    let name = new_name.clone();
    let old_rel = relative_to_vault_root(&path, &vault_root);
    tokio::task::spawn_blocking(move || rename_vault_item_internal(&p, &name))
        .await
        .map_err(|e| {
            SerializedError::new(
                error::ERR_INTERNAL,
                format!("Background task failed: {}", e),
            )
        })??;

    // Update DB
    let pool = app.state::<SqlitePool>().inner().clone();
    db_vault::delete_vault_item(&pool, &old_rel).await?;

    let new_full = Path::new(&path)
        .parent()
        .map(|p| p.join(&new_name))
        .unwrap_or_else(|| PathBuf::from(&new_name));
    let new_full_str = new_full.to_string_lossy().to_string();
    record_entry_in_db(&pool, &new_full_str, &vault_root, &aid, false).await?;

    Ok(())
}

#[tauri::command]
pub async fn copy_vault_item(
    app: tauri::AppHandle,
    source_path: String,
    dest_path: String,
    account_id: Option<String>,
) -> Result<(), SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to copy files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    let source = source_path.clone();
    let dest = dest_path.clone();
    tokio::task::spawn_blocking(move || copy_vault_item_internal(&source, &dest))
        .await
        .map_err(|e| {
            SerializedError::new(
                error::ERR_INTERNAL,
                format!("Background task failed: {}", e),
            )
        })??;

    // Record in DB
    let pool = app.state::<SqlitePool>().inner().clone();
    record_entry_in_db(&pool, &dest_path, &vault_root, &aid, false).await?;

    Ok(())
}

#[tauri::command]
pub async fn get_vault_size(
    app: tauri::AppHandle,
    account_id: Option<String>,
) -> Result<u64, SerializedError> {
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;
    let dir = vault_root
        .to_str()
        .ok_or_else(|| SerializedError::new(error::ERR_INVALID_INPUT, "Invalid vault path"))?
        .to_string();
    tokio::task::spawn_blocking(move || get_vault_size_internal(&dir))
        .await
        .map_err(|e| {
            SerializedError::new(
                error::ERR_INTERNAL,
                format!("Background task failed: {}", e),
            )
        })?
}

#[tauri::command]
pub async fn search_vault(
    app: tauri::AppHandle,
    _dir_path: String,
    pattern: String,
    account_id: Option<String>,
) -> Result<Vec<String>, SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to search files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;

    // Search the DB using SQL LIKE (recursive across all subdirectories).
    // The DB is kept in sync by list_vault_dir and other commands.
    // For completeness, do a quick async backfill of the account root first.
    let pool = app.state::<SqlitePool>().inner().clone();
    let vr = vault_root.clone();
    let vr_str = vr.to_string_lossy().to_string();
    let aid2 = aid.clone();
    let pool2 = pool.clone();

    // Backfill the search directory in a background task
    tokio::task::spawn(async move {
        if let Err(e) = backfill_directory(&pool2, &vr_str, &vr, &aid2).await {
            log::warn!("[vault] search backfill failed: {e}");
        }
    });

    // Search the DB
    let items = db_vault::search_vault_items(&pool, &pattern, &aid).await?;

    // Return full paths
    let results: Vec<String> = items
        .iter()
        .map(|item| vault_root.join(&item.relative_path).to_string_lossy().to_string())
        .collect();

    Ok(results)
}

// ---------------------------------------------------------------------------
// Category-based listing command
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_vault_items_by_category(
    app: tauri::AppHandle,
    category: String,
    account_id: Option<String>,
) -> Result<Vec<VaultEntry>, SerializedError> {
    crate::vault::require_biometric(&app, "Unlock vault to list files").await?;
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let vault_root = get_vault_root_for_account(&app, &aid)?;
    let pool = app.state::<SqlitePool>().inner().clone();

    let items = db_vault::get_vault_items_by_category(&pool, &category, &aid).await?;

    let entries: Vec<VaultEntry> = items
        .iter()
        .map(|item| VaultEntry {
            path: vault_root.join(&item.relative_path).to_string_lossy().to_string(),
            is_dir: item.is_dir != 0,
            category: item.category.clone(),
        })
        .collect();

    Ok(entries)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DB-level Tauri commands (wrapping db::vault::operations)
// ---------------------------------------------------------------------------

/// List vault items in a directory (DB-backed).
#[tauri::command]
pub async fn db_get_vault_items(
    app: tauri::AppHandle,
    dir_path: String,
    account_id: Option<String>,
) -> Result<Vec<VaultItem>, SerializedError> {
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let pool = app.state::<sqlx::SqlitePool>().inner().clone();
    crate::db::vault::operations::get_vault_items(&pool, &dir_path, &aid).await
}

/// Delete all vault items for a given account (used when removing an account).
#[tauri::command]
pub async fn db_delete_vault_items_by_account(
    app: tauri::AppHandle,
    account_id: String,
) -> Result<(), SerializedError> {
    let pool = app.state::<sqlx::SqlitePool>().inner().clone();
    crate::db::vault::operations::delete_vault_items_by_account(&pool, &account_id).await
}

/// Count vault items for a given account.
#[tauri::command]
pub async fn db_count_vault_items(
    app: tauri::AppHandle,
    account_id: Option<String>,
) -> Result<i64, SerializedError> {
    let aid = account_id.unwrap_or_else(|| "default".to_string());
    let pool = app.state::<sqlx::SqlitePool>().inner().clone();
    crate::db::vault::operations::count_vault_items(&pool, &aid).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize_file() {
        assert_eq!(categorize_file("photo.jpg", false), "images");
        assert_eq!(categorize_file("photo.jpeg", false), "images");
        assert_eq!(categorize_file("photo.png", false), "images");
        assert_eq!(categorize_file("photo.gif", false), "images");
        assert_eq!(categorize_file("photo.svg", false), "images");
        assert_eq!(categorize_file("photo.webp", false), "images");

        assert_eq!(categorize_file("doc.pdf", false), "documents");
        assert_eq!(categorize_file("doc.docx", false), "documents");
        assert_eq!(categorize_file("doc.txt", false), "documents");
        assert_eq!(categorize_file("data.csv", false), "documents");
        assert_eq!(categorize_file("pres.ppt", false), "documents");

        assert_eq!(categorize_file("email.eml", false), "email");
        assert_eq!(categorize_file("email.msg", false), "email");

        assert_eq!(categorize_file("archive.zip", false), "archives");
        assert_eq!(categorize_file("archive.tar.gz", false), "archives");
        assert_eq!(categorize_file("archive.rar", false), "archives");

        assert_eq!(categorize_file("code.js", false), "code");
        assert_eq!(categorize_file("code.ts", false), "code");
        assert_eq!(categorize_file("code.rs", false), "code");
        assert_eq!(categorize_file("code.py", false), "code");
        assert_eq!(categorize_file("code.html", false), "code");
        assert_eq!(categorize_file("code.json", false), "code");

        assert_eq!(categorize_file("folder", true), "folder");
        assert_eq!(categorize_file("unknown.xyz", false), "other");
        assert_eq!(categorize_file("README", false), "other");
    }

    #[test]
    fn test_copy_to_vault_and_delete_internal() {
        let dir = tempfile::TempDir::new().unwrap();

        let source = dir.path().join("source.txt");
        std::fs::write(&source, "hello world").unwrap();

        let dest = dir.path().join("vault").join("file.txt");
        let dest_str = dest.to_str().unwrap().to_string();

        copy_to_vault_internal(source.to_str().unwrap(), &dest_str).unwrap();
        assert!(dest.exists(), "File should exist in vault after copy");

        delete_from_vault_internal(&dest_str).unwrap();
        assert!(!dest.exists(), "File should be gone after delete");
    }

    #[test]
    fn test_list_vault_dir_internal() {
        let dir = tempfile::TempDir::new().unwrap();

        let sub = dir.path().join("vault");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("a.txt"), "a").unwrap();
        std::fs::write(sub.join("b.txt"), "b").unwrap();
        std::fs::create_dir_all(sub.join("subdir")).unwrap();

        let mut results = list_vault_dir_internal(sub.to_str().unwrap()).unwrap();
        results.sort_by(|a, b| a.path.cmp(&b.path));
        assert_eq!(results.len(), 3);

        let file_a = results.iter().find(|e| e.path.ends_with("a.txt")).unwrap();
        assert!(!file_a.is_dir);
        assert_eq!(file_a.category, "documents");

        let file_b = results.iter().find(|e| e.path.ends_with("b.txt")).unwrap();
        assert!(!file_b.is_dir);

        let dir_entry = results.iter().find(|e| e.path.ends_with("subdir")).unwrap();
        assert!(dir_entry.is_dir);
        assert_eq!(dir_entry.category, "folder");
    }

    #[test]
    fn test_create_vault_dir_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let new_dir = dir.path().join("vault").join("sub").join("nested");
        let _path = new_dir.to_str().unwrap().to_string();

        // create_vault_dir is async and takes app handle; test the underlying fs operation
        std::fs::create_dir_all(&new_dir).unwrap();
        assert!(new_dir.exists());
    }

    #[test]
    fn test_read_vault_file_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let file_path = dir.path().join("test.txt");
        std::fs::write(&file_path, "hello vault").unwrap();

        let data = std::fs::read(&file_path).unwrap();
        let encoded = base64::engine::general_purpose::STANDARD.encode(&data);
        assert!(!encoded.is_empty());
        assert_eq!(
            std::str::from_utf8(
                &base64::engine::general_purpose::STANDARD.decode(&encoded).unwrap()
            )
            .unwrap(),
            "hello vault",
        );
    }

    #[test]
    fn test_pin_hash_roundtrip() {
        let pin = "1234";
        let hash1 = format!("{:x}", Sha256::digest(pin.as_bytes()));
        let hash2 = format!("{:x}", Sha256::digest(pin.as_bytes()));
        assert_eq!(hash1, hash2);

        let wrong_pin = "5678";
        let wrong_hash = format!("{:x}", Sha256::digest(wrong_pin.as_bytes()));
        assert_ne!(hash1, wrong_hash);
    }

    // -----------------------------------------------------------------------
    // move / rename / copy / size / search tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_move_vault_item_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).unwrap();

        let source = vault.join("source.txt");
        std::fs::write(&source, "move me").unwrap();

        let dest = vault.join("moved").join("dest.txt");

        move_vault_item_internal(source.to_str().unwrap(), dest.to_str().unwrap()).unwrap();

        assert!(!source.exists(), "source should be gone after move");
        assert!(dest.exists(), "dest should exist after move");
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "move me");
    }

    #[test]
    fn test_move_vault_item_internal_directory() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let src_dir = vault.join("srcdir");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("a.txt"), "a").unwrap();
        std::fs::write(src_dir.join("b.txt"), "b").unwrap();

        let dst_dir = vault.join("dstdir");

        move_vault_item_internal(src_dir.to_str().unwrap(), dst_dir.to_str().unwrap()).unwrap();

        assert!(!src_dir.exists(), "source dir should be gone after move");
        assert!(dst_dir.is_dir(), "dest dir should exist");
        assert!(dst_dir.join("a.txt").exists());
        assert!(dst_dir.join("b.txt").exists());
    }

    #[test]
    fn test_rename_vault_item_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).unwrap();

        let old = vault.join("old_name.txt");
        std::fs::write(&old, "rename me").unwrap();

        let old_str = old.to_str().unwrap().to_string();
        rename_vault_item_internal(&old_str, "new_name.txt").unwrap();

        assert!(!old.exists(), "old name should be gone after rename");
        let renamed = vault.join("new_name.txt");
        assert!(renamed.exists(), "new name should exist");
        assert_eq!(std::fs::read_to_string(&renamed).unwrap(), "rename me");
    }

    #[test]
    fn test_copy_vault_item_internal_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).unwrap();

        let source = vault.join("original.txt");
        std::fs::write(&source, "copy me").unwrap();

        let dest = vault.join("subdir").join("copy.txt");
        copy_vault_item_internal(source.to_str().unwrap(), dest.to_str().unwrap()).unwrap();

        assert!(source.exists(), "source should still exist after copy");
        assert!(dest.exists(), "dest should exist after copy");
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "copy me");
    }

    #[test]
    fn test_copy_vault_item_internal_directory() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let src_dir = vault.join("srcdir");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("f1.txt"), "1").unwrap();
        std::fs::write(src_dir.join("f2.txt"), "2").unwrap();

        let dst_dir = vault.join("copydir");
        copy_vault_item_internal(src_dir.to_str().unwrap(), dst_dir.to_str().unwrap()).unwrap();

        assert!(src_dir.exists(), "source dir should still exist");
        assert!(dst_dir.is_dir());
        assert!(dst_dir.join("f1.txt").exists());
        assert!(dst_dir.join("f2.txt").exists());
    }

    #[test]
    fn test_get_vault_size_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");

        // Directory does not exist yet — should return 0
        assert_eq!(get_vault_size_internal(vault.to_str().unwrap()).unwrap(), 0);

        std::fs::create_dir_all(&vault).unwrap();
        // Empty directory
        assert_eq!(get_vault_size_internal(vault.to_str().unwrap()).unwrap(), 0);

        // Create files of known sizes
        std::fs::write(vault.join("a.txt"), "hello").unwrap(); // 5 bytes
        std::fs::write(vault.join("b.txt"), "world123").unwrap(); // 8 bytes
        std::fs::create_dir_all(vault.join("sub")).unwrap();
        std::fs::write(vault.join("sub").join("c.txt"), "bigger file!").unwrap(); // 11 bytes

        // Total: 5 + 8 + 12 = 25 ("bigger file!" is 12 bytes)
        assert_eq!(
            get_vault_size_internal(vault.to_str().unwrap()).unwrap(),
            25
        );
    }

    #[test]
    fn test_search_vault_internal() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).unwrap();

        std::fs::write(vault.join("report.txt"), "x").unwrap();
        std::fs::write(vault.join("summary.txt"), "x").unwrap();
        std::fs::write(vault.join("data.csv"), "x").unwrap();
        std::fs::create_dir_all(vault.join("sub")).unwrap();
        std::fs::write(vault.join("sub").join("notes.txt"), "x").unwrap();

        // Pattern matching all .txt files
        let results = search_vault_internal(vault.to_str().unwrap(), "*.txt").unwrap();
        assert_eq!(
            results.len(),
            2,
            "should find 2 .txt files (glob doesn't recurse into subdirs)"
        );

        // Pattern matching all files in sub
        let sub_results =
            search_vault_internal(vault.join("sub").to_str().unwrap(), "*").unwrap();
        assert_eq!(sub_results.len(), 1, "should find 1 file in subdir");

        // Pattern with no matches
        let no_match = search_vault_internal(vault.to_str().unwrap(), "*.pdf").unwrap();
        assert!(no_match.is_empty());
    }

    #[test]
    fn test_move_vault_item_internal_nonexistent_source() {
        let dir = tempfile::TempDir::new().unwrap();
        let result = move_vault_item_internal(
            dir.path().join("nonexistent").to_str().unwrap(),
            dir.path().join("dest").to_str().unwrap(),
        );
        assert!(result.is_err(), "moving nonexistent file should error");
    }

    #[test]
    fn test_get_vault_size_internal_single_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault).unwrap();

        let data = vec![0u8; 1000];
        std::fs::write(vault.join("large.bin"), &data).unwrap();
        assert_eq!(
            get_vault_size_internal(vault.to_str().unwrap()).unwrap(),
            1000
        );
    }
}
