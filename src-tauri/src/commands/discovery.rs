// ── Email Provider Discovery ────────────────────────────────────────────
//
// Discovers the best email provider/protocol for a given email address.
// Strategies used (in order):
//   1. Domain-based known-provider mapping (gmail.com, outlook.com, etc.)
//   2. JMAP session discovery via `/.well-known/jmap`
//   3. Fallback to IMAP/SMTP for unknown / private domains
//
// Frontend can use the returned `provider_type` and `confidence` to decide
// which account-setup UI to show and whether to auto-configure.

use serde::Serialize;
use tauri::State;

use crate::drivers::DriverRegistry;
use crate::error::SerializedError;

/// Result returned to the frontend after provider discovery.
#[derive(Debug, Serialize)]
pub struct DiscoveryResult {
    /// Provider type identifier (e.g. "gmail_api", "microsoft_graph", "jmap",
    /// "imap_smtp").
    pub provider_type: String,
    /// Human-readable label (e.g. "Google (Gmail API)").
    pub label: String,
    /// Confidence level: "high" for known domains, "medium" after successful
    /// JMAP discovery on an unknown domain, "low" for IMAP fallback.
    pub confidence: String,
    /// Alternative provider types the user can fall back to.
    pub alternatives: Vec<String>,
}

/// CalDAV discovery result
#[derive(Debug, Serialize)]
pub struct CalDavDiscoveryResult {
    pub provider_name: Option<String>,
    pub caldav_url: Option<String>,
    pub auth_method: String,
    pub needs_app_password: bool,
}

/// Discover the likely email provider for an email address.
///
/// Uses multiple strategies to determine the best protocol to use:
/// 1. **Domain-based provider mapping** — known domains like gmail.com,
///    outlook.com are matched immediately with `"high"` confidence.
/// 2. **JMAP session discovery** — for unknown domains (and Yahoo), we
///    probe `https://<domain>/.well-known/jmap` to check JMAP support.
/// 3. **Fallback** — if nothing else works, we return `"imap_smtp"` with
///    `"low"` confidence.
#[tauri::command]
pub async fn discover_provider(
    email: String,
    _registry: State<'_, DriverRegistry>,
) -> Result<DiscoveryResult, SerializedError> {
    let domain = email
        .split('@')
        .nth(1)
        .ok_or_else(|| SerializedError::new("INVALID_EMAIL", "Email address has no domain"))?
        .to_lowercase();

    // ── Strategy 1: Known domain map ─────────────────────────────────
    match domain.as_str() {
        // Google / Gmail
        "gmail.com" | "googlemail.com" => Ok(DiscoveryResult {
            provider_type: "gmail_api".into(),
            label: "Google (Gmail API)".into(),
            confidence: "high".into(),
            alternatives: vec!["imap_smtp".into()],
        }),

        // Microsoft / Outlook
        "outlook.com" | "hotmail.com" | "live.com" | "outlook.fr" | "outlook.de" | "office365.com" | "microsoft.com" => {
            Ok(DiscoveryResult {
                provider_type: "microsoft_graph".into(),
                label: "Microsoft (Graph API)".into(),
                confidence: "high".into(),
                alternatives: vec!["imap_smtp".into()],
            })
        }

        // Yahoo — supports JMAP; verify with session discovery
        "yahoo.com" | "ymail.com" | "rocketmail.com" => {
            match try_jmap_discovery(&domain).await {
                Ok(()) => Ok(DiscoveryResult {
                    provider_type: "jmap".into(),
                    label: "JMAP (Yahoo)".into(),
                    confidence: "high".into(),
                    alternatives: vec!["imap_smtp".into()],
                }),
                Err(_) => Ok(DiscoveryResult {
                    provider_type: "jmap".into(),
                    label: "JMAP (Yahoo)".into(),
                    confidence: "medium".into(),
                    alternatives: vec!["imap_smtp".into()],
                }),
            }
        }

        // ── Strategy 2 & 3: Unknown domain ──────────────────────────
        _ => {
            // Try JMAP discovery first
            match try_jmap_discovery(&domain).await {
                Ok(()) => Ok(DiscoveryResult {
                    provider_type: "jmap".into(),
                    label: "JMAP".into(),
                    confidence: "medium".into(),
                    alternatives: vec!["imap_smtp".into()],
                }),
                Err(_) => Ok(DiscoveryResult {
                    provider_type: "imap_smtp".into(),
                    label: "IMAP/SMTP".into(),
                    confidence: "low".into(),
                    alternatives: vec![],
                }),
            }
        }
    }
}

/// Probe whether the domain serves a JMAP session resource.
///
/// Sends a GET request to `https://<domain>/.well-known/jmap` with a 5-second
/// timeout. Returns `Ok(())` if the endpoint responds with a success status.
///
/// This is deliberately a lightweight check — we don't parse the session
/// response here since we only need to know _that_ JMAP is supported.
async fn try_jmap_discovery(domain: &str) -> Result<(), SerializedError> {
    let client = reqwest::Client::builder()
        .user_agent("SMEMaster/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| {
            SerializedError::new("HTTP_ERROR", format!("Failed to build HTTP client: {e}"))
        })?;

    let url = format!("https://{domain}/.well-known/jmap");
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| {
            SerializedError::new(
                "DISCOVERY_FAILED",
                "JMAP discovery request failed — domain may not support JMAP",
            )
        })?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(SerializedError::new(
            "NO_JMAP",
            format!(
                "Domain does not support JMAP (HTTP {})",
                resp.status().as_u16()
            ),
        ))
    }
}

/// Discover CalDAV settings for a domain.
///
/// Uses multiple strategies to determine the CalDAV endpoint:
/// 1. Known provider presets (Google, iCloud, Fastmail, Zoho, GMX)
/// 2. RFC 6764 well-known CalDAV discovery (`/.well-known/caldav`)
/// 3. Nextcloud detection (`/remote.php/dav/`)
#[tauri::command]
pub async fn discover_caldav_settings(email: String) -> Result<CalDavDiscoveryResult, SerializedError> {
    let domain = email
        .split('@')
        .nth(1)
        .ok_or_else(|| SerializedError::new("INVALID_EMAIL", "Email address has no domain"))?
        .to_lowercase();

    // Known provider presets
    let presets = [
        ("google.com", "Google", "https://apidata.googleusercontent.com/caldav/v2/", "oauth2"),
        ("gmail.com", "Google", "https://apidata.googleusercontent.com/caldav/v2/", "oauth2"),
        ("googlemail.com", "Google", "https://apidata.googleusercontent.com/caldav/v2/", "oauth2"),
        ("outlook.com", "Microsoft", "https://outlook.office365.com/calendar/", "oauth2"),
        ("hotmail.com", "Microsoft", "https://outlook.office365.com/calendar/", "oauth2"),
        ("live.com", "Microsoft", "https://outlook.office365.com/calendar/", "oauth2"),
        ("office365.com", "Microsoft", "https://outlook.office365.com/calendar/", "oauth2"),
        ("microsoft.com", "Microsoft", "https://outlook.office365.com/calendar/", "oauth2"),
        ("icloud.com", "iCloud", "https://caldav.icloud.com/", "basic"),
        ("me.com", "iCloud", "https://caldav.icloud.com/", "basic"),
        ("mac.com", "iCloud", "https://caldav.icloud.com/", "basic"),
        ("fastmail.com", "Fastmail", "https://caldav.fastmail.com/", "basic"),
        ("fastmail.fm", "Fastmail", "https://caldav.fastmail.com/", "basic"),
        ("messagingengine.com", "Fastmail", "https://caldav.fastmail.com/", "basic"),
        ("zoho.com", "Zoho", "https://calendar.zoho.com/caldav/", "basic"),
        ("zohomail.com", "Zoho", "https://calendar.zoho.com/caldav/", "basic"),
        ("gmx.com", "GMX", "https://caldav.gmx.net/", "basic"),
        ("gmx.net", "GMX", "https://caldav.gmx.net/", "basic"),
        ("gmx.de", "GMX", "https://caldav.gmx.net/", "basic"),
    ];

    for (preset_domain, name, url, auth) in presets {
        if preset_domain == domain {
            return Ok(CalDavDiscoveryResult {
                provider_name: Some(name.to_string()),
                caldav_url: Some(url.to_string()),
                auth_method: auth.to_string(),
                needs_app_password: name == "iCloud",
            });
        }
    }

    // Try well-known CalDAV discovery (RFC 6764)
    let client = reqwest::Client::builder()
        .user_agent("SMEMaster/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| SerializedError::new("HTTP_ERROR", format!("Failed to build HTTP client: {e}")))?;

    let well_known_url = format!("https://{domain}/.well-known/caldav");
    if let Ok(resp) = client.get(&well_known_url).send().await {
        if resp.status() == 301 || resp.status() == 302 {
            if let Some(location) = resp.headers().get("Location") {
                let loc = location.to_str().unwrap_or("");
                let url = if loc.starts_with('/') {
                    format!("https://{domain}{loc}")
                } else {
                    loc.to_string()
                };
                return Ok(CalDavDiscoveryResult {
                    provider_name: None,
                    caldav_url: Some(url),
                    auth_method: "basic".to_string(),
                    needs_app_password: false,
                });
            }
        }
    }

    // Try Nextcloud detection
    let nextcloud_url = format!("https://{domain}/remote.php/dav/");
    if let Ok(resp) = client.request(reqwest::Method::OPTIONS, &nextcloud_url).send().await {
        if resp.status().is_success() || resp.status() == 401 {
            return Ok(CalDavDiscoveryResult {
                provider_name: Some("Nextcloud".to_string()),
                caldav_url: Some(nextcloud_url),
                auth_method: "basic".to_string(),
                needs_app_password: false,
            });
        }
    }

    Ok(CalDavDiscoveryResult {
        provider_name: None,
        caldav_url: None,
        auth_method: "basic".to_string(),
        needs_app_password: false,
    })
}
