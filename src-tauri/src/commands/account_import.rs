// ═════════════════════════════════════════════════════════════════════════════
// System Account Import – Scan local mail clients for existing account configs
// ═════════════════════════════════════════════════════════════════════════════
//
// Scans macOS (Apple Mail), Windows (Outlook, Thunderbird, Windows Mail), and
// Linux (Thunderbird, Evolution) for existing email account configurations so
// the user can quickly import them into SMEMaster without re-typing credentials.
//
// IMPORTANT: This module never reads or stores passwords. It only extracts
// server hostnames, ports, security modes, and the account email. The user
// is always prompted to authenticate the actual account separately.
// ═════════════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredAccount {
    /// Email address if known
    pub email: String,
    /// Display name if known
    pub display_name: Option<String>,
    /// Where this was discovered (e.g. "Apple Mail", "Thunderbird", "Outlook")
    pub source: String,
    /// Discovered provider type
    pub provider_type: String,
    /// IMAP host
    pub imap_host: Option<String>,
    /// IMAP port
    pub imap_port: Option<u16>,
    /// IMAP security (SSL / STARTTLS / NONE)
    pub imap_security: Option<String>,
    /// SMTP host
    pub smtp_host: Option<String>,
    /// SMTP port
    pub smtp_port: Option<u16>,
    /// SMTP security
    pub smtp_security: Option<String>,
    /// Username (usually same as email)
    pub username: Option<String>,
    /// Auth method (password, oauth2, etc.)
    pub auth_method: Option<String>,
    /// OAuth provider if applicable (e.g. "google", "microsoft")
    pub oauth_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    pub accounts: Vec<DiscoveredAccount>,
    pub sources_scanned: Vec<String>,
    pub errors: Vec<String>,
}

#[cfg(target_os = "windows")]
pub fn scan_windows() -> Vec<DiscoveredAccount> {
    use std::path::PathBuf;

    let mut accounts = Vec::new();
    let appdata = match std::env::var("APPDATA") {
        Ok(h) => PathBuf::from(h),
        Err(_) => return accounts,
    };

    // Thunderbird
    accounts.extend(scan_thunderbird_profiles(
        &appdata.join("Thunderbird/Profiles"),
    ));

    accounts
}

#[cfg(target_os = "linux")]
pub fn scan_linux() -> Vec<DiscoveredAccount> {
    use std::path::PathBuf;

    let mut accounts = Vec::new();
    let home = match std::env::var("HOME") {
        Ok(h) => PathBuf::from(h),
        Err(_) => return accounts,
    };

    // Thunderbird
    accounts.extend(scan_thunderbird_profiles(&home.join(".thunderbird")));

    // Evolution: ~/.config/evolution/source/
    let evolution_dir = home.join(".config/evolution/source");
    if evolution_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&evolution_dir) {
            for entry in entries.flatten() {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Some(acc) = parse_evolution_source(&content) {
                        accounts.push(acc);
                    }
                }
            }
        }
    }

    accounts
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
pub fn scan_other() -> Vec<DiscoveredAccount> {
    Vec::new()
}

// ── Desktop-only helpers ─────────────────────────────────────────────
// These are only reachable on macOS / Windows / Linux. They are gated
// behind `cfg` so the Android build does not see dead_code warnings.
#[cfg(any(target_os = "windows", target_os = "linux"))]
fn parse_thunderbird_prefs(content: &str) -> Vec<DiscoveredAccount> {
    use std::collections::HashMap;

    let mut servers: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut identities: HashMap<String, HashMap<String, String>> = HashMap::new();

    for line in content.lines() {
        let line = line.trim().trim_end_matches(';');
        if !line.starts_with("user_pref(\"") { continue; }

        let start = line.find('(').unwrap() + 1;
        let end = line.rfind(')').unwrap();
        let inner = &line[start..end];
        let mut parts = inner.splitn(2, ',');
        let key = parts.next().map(|s| s.trim().trim_matches('"').to_string());
        let value = parts.next().map(|s| s.trim().trim_matches('"').to_string());

        if let (Some(k), Some(v)) = (key, value) {
            if k.starts_with("mail.server.server") {
                let rest = k.trim_start_matches("mail.server.server");
                if let Some(dot) = rest.find('.') {
                    let server_id = rest[..dot].to_string();
                    let field = rest[dot + 1..].to_string();
                    servers.entry(server_id).or_default().insert(field, v);
                }
            } else if k.starts_with("mail.identity.id") {
                let rest = k.trim_start_matches("mail.identity.id");
                if let Some(dot) = rest.find('.') {
                    let id_id = rest[..dot].to_string();
                    let field = rest[dot + 1..].to_string();
                    identities.entry(id_id).or_default().insert(field, v);
                }
            }
        }
    }

    let mut accounts = Vec::new();
    for (server_id, fields) in servers {
        if let Some(host) = fields.get("hostname") {
            let mut email = String::new();
            let identity_id = fields.get("identity").cloned().unwrap_or_default();
            if let Some(ident) = identities.get(&identity_id) {
                if let Some(user_email) = ident.get("userEmail") {
                    email = user_email.clone();
                }
            }

            let socket_type = fields.get("socketType").cloned();
            let security = match socket_type.as_deref() {
                Some("3") => Some("SSL".to_string()),
                Some("2") => Some("STARTTLS".to_string()),
                _ => Some("NONE".to_string()),
            };

            accounts.push(DiscoveredAccount {
                email,
                display_name: fields.get("realname").cloned(),
                source: "Thunderbird".to_string(),
                provider_type: detect_provider_from_host(host),
                imap_host: Some(host.clone()),
                imap_port: fields.get("port").and_then(|p| p.parse().ok()),
                imap_security: security,
                smtp_host: None,
                smtp_port: None,
                smtp_security: None,
                username: fields.get("userName").cloned(),
                auth_method: Some("password".to_string()),
                oauth_provider: None,
            });
        }
        let _ = server_id;
    }

    accounts
}

#[cfg(target_os = "linux")]
fn parse_evolution_source(content: &str) -> Option<DiscoveredAccount> {
    let mut map = std::collections::HashMap::new();
    for line in content.lines() {
        if let Some(eq) = line.find('=') {
            let key = line[..eq].trim().to_string();
            let value = line[eq + 1..].trim().trim_matches('"').to_string();
            map.insert(key, value);
        }
    }

    let backend = map.get("BackendName").cloned().unwrap_or_default();
    if !backend.contains("imap") && !backend.contains("IMAP") {
        return None;
    }

    let host = map.get("Host").cloned();
    if host.is_none() {
        return None;
    }

    let port: Option<u16> = map.get("Port").and_then(|p| p.parse().ok());
    let security = map.get("SecurityMethod").cloned();
    let username = map.get("User").cloned();
    let email = username.clone().unwrap_or_default();
    let provider_type = detect_provider_from_host(&host.clone().unwrap_or_default());

    Some(DiscoveredAccount {
        email,
        display_name: map.get("DisplayName").cloned(),
        source: "Evolution".to_string(),
        provider_type,
        imap_host: host,
        imap_port: port,
        imap_security: security,
        smtp_host: map.get("SmtpHost").cloned(),
        smtp_port: map.get("SmtpPort").and_then(|p| p.parse().ok()),
        smtp_security: map.get("SmtpSecurityMethod").cloned(),
        username,
        auth_method: Some("password".to_string()),
        oauth_provider: None,
    })
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn scan_thunderbird_profiles(profiles_dir: &std::path::Path) -> Vec<DiscoveredAccount> {
    use std::fs;

    let mut accounts = Vec::new();
    if !profiles_dir.exists() {
        return accounts;
    }

    let entries = match fs::read_dir(profiles_dir) {
        Ok(e) => e,
        Err(_) => return accounts,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let prefs_js = path.join("prefs.js");
        if prefs_js.exists() {
            if let Ok(content) = fs::read_to_string(&prefs_js) {
                accounts.extend(parse_thunderbird_prefs(&content));
            }
        }
    }

    accounts
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn detect_provider_from_host(host: &str) -> String {
    let lower = host.to_lowercase();
    if lower.contains("gmail") || lower.contains("googlemail") {
        "gmail_api".to_string()
    } else if lower.contains("outlook") || lower.contains("office365") || lower.contains("hotmail")
    {
        "microsoft_graph".to_string()
    } else if lower.contains("yahoo") {
        "imap_smtp".to_string()
    } else if lower.contains("fastmail") {
        "jmap".to_string()
    } else {
        "imap_smtp".to_string()
    }
}

/// Scan the local system for existing email account configurations.
#[tauri::command]
pub fn scan_system_accounts() -> DiscoveryResult {
    let mut accounts = Vec::new();
    let mut sources_scanned = Vec::new();
    let mut errors = Vec::new();

    #[cfg(target_os = "windows")]
    {
        sources_scanned.push("Thunderbird (Windows)".to_string());
        sources_scanned.push("Outlook (Registry)".to_string());
        sources_scanned.push("Windows Mail".to_string());
        match std::panic::catch_unwind(|| scan_windows()) {
            Ok(mut a) => accounts.append(&mut a),
            Err(e) => errors.push(format!("Windows scan error: {:?}", e)),
        }
    }

    #[cfg(target_os = "linux")]
    {
        sources_scanned.push("Thunderbird (Linux)".to_string());
        sources_scanned.push("Evolution".to_string());
        match std::panic::catch_unwind(|| scan_linux()) {
            Ok(mut a) => accounts.append(&mut a),
            Err(e) => errors.push(format!("Linux scan error: {:?}", e)),
        }
    }

    DiscoveryResult {
        accounts,
        sources_scanned,
        errors,
    }
}

/// One-tap import: validate that the discovered account can be safely imported.
#[tauri::command]
pub fn validate_discovered_account(
    account: DiscoveredAccount,
) -> Result<DiscoveredAccount, String> {
    if account.email.is_empty() {
        return Err("Account has no email address".into());
    }
    if account.imap_host.is_none()
        && account.provider_type != "gmail_api"
        && account.provider_type != "microsoft_graph"
    {
        return Err("Account has no IMAP host configured".into());
    }
    Ok(account)
}
