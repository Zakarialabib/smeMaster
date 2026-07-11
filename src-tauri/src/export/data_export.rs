// ── Data Export Module ──────────────────────────────────────────────────────
// Export user data to standard formats for portability (no vendor lock-in).
//
// Supports:
//   - Contacts → CSV / vCard 3.0
//   - Tasks → CSV
//   - Calendar → ICS (iCalendar RFC 5545)
//
// All exports are pure: they query the SQLite pool and write to a user-specified
// path. No network calls, no encryption (caller's responsibility).

use crate::error::{SerializedError, ERR_DB_CORRUPT, ERR_FILE_IO, ERR_INVALID_INPUT};
use sqlx::SqlitePool;
use std::path::Path;
use tokio::fs;

/// Export contacts to CSV format.
///
/// Columns: id, email, display_name, frequency, last_contacted_at, notes, health_status
#[tauri::command]
pub async fn export_contacts_csv(
    pool: tauri::State<'_, SqlitePool>,
    destination_path: String,
) -> Result<u32, SerializedError> {
    if destination_path.trim().is_empty() {
        return Err(SerializedError::new(ERR_INVALID_INPUT, "Destination path cannot be empty"));
    }

    let rows: Vec<(
        String,
        String,
        Option<String>,
        i64,
        Option<i64>,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT id, email, display_name, frequency, last_contacted_at, notes, health_status
         FROM contacts ORDER BY display_name, email",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| SerializedError::new(ERR_DB_CORRUPT, format!("Failed to query contacts: {e}")))?;

    let mut csv = String::from("id,email,display_name,frequency,last_contacted_at,notes,health_status\n");
    for (id, email, display_name, frequency, last_contacted_at, notes, health_status) in &rows {
        let last = last_contacted_at.map(unix_to_iso);
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(id),
            csv_escape(email),
            csv_escape_opt(display_name.as_deref()),
            frequency,
            csv_escape_opt(last.as_deref()),
            csv_escape_opt(notes.as_deref()),
            csv_escape_opt(health_status.as_deref()),
        ));
    }

    let path = Path::new(&destination_path);
    fs::write(path, &csv)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to write CSV file: {e}")))?;

    log::info!("[export] Wrote {} contacts to {:?}", rows.len(), path);
    Ok(rows.len() as u32)
}

/// Export contacts to vCard 3.0 format (one VCARD per contact).
#[tauri::command]
pub async fn export_contacts_vcard(
    pool: tauri::State<'_, SqlitePool>,
    destination_path: String,
) -> Result<u32, SerializedError> {
    if destination_path.trim().is_empty() {
        return Err(SerializedError::new(ERR_INVALID_INPUT, "Destination path cannot be empty"));
    }

    let rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, email, display_name FROM contacts ORDER BY display_name, email",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| SerializedError::new(ERR_DB_CORRUPT, format!("Failed to query contacts: {e}")))?;

    let mut vcf = String::new();
    for (id, email, display_name) in &rows {
        vcf.push_str("BEGIN:VCARD\r\n");
        vcf.push_str("VERSION:3.0\r\n");
        let name = display_name.as_deref().unwrap_or("");
        vcf.push_str(&format!("FN:{}\r\n", escape_vcard(name)));
        // N: Last;First;Middle;Prefix;Suffix — we have only a single display name
        // Split on first space if present to fill N field
        if let Some((first, last)) = split_name(name) {
            vcf.push_str(&format!("N:{};{};;;\r\n", escape_vcard(&last), escape_vcard(&first)));
        } else {
            vcf.push_str(&format!("N:;;;{}\r\n", escape_vcard(name)));
        }
        vcf.push_str(&format!("EMAIL;TYPE=INTERNET:{}\r\n", escape_vcard(email)));
        vcf.push_str(&format!("UID:{}\r\n", escape_vcard(id)));
        vcf.push_str("END:VCARD\r\n");
    }

    let path = Path::new(&destination_path);
    fs::write(path, &vcf)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to write vCard file: {e}")))?;

    log::info!("[export] Wrote {} contacts to {:?}", rows.len(), path);
    Ok(rows.len() as u32)
}

/// Export tasks to CSV format.
///
/// Columns: id, title, description, priority, is_completed, completed_at, due_date, created_at
#[tauri::command]
pub async fn export_tasks_csv(
    pool: tauri::State<'_, SqlitePool>,
    destination_path: String,
) -> Result<u32, SerializedError> {
    if destination_path.trim().is_empty() {
        return Err(SerializedError::new(ERR_INVALID_INPUT, "Destination path cannot be empty"));
    }

    let rows: Vec<(
        String,
        String,
        Option<String>,
        Option<String>,
        i64,
        Option<i64>,
        Option<i64>,
        Option<i64>,
    )> = sqlx::query_as(
        "SELECT id, title, description, priority, is_completed, completed_at, due_date, created_at
         FROM tasks ORDER BY due_date, created_at",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| SerializedError::new(ERR_DB_CORRUPT, format!("Failed to query tasks: {e}")))?;

    let mut csv = String::from("id,title,description,priority,is_completed,completed_at,due_date,created_at\n");
    for (id, title, description, priority, is_completed, completed_at, due_date, created_at) in &rows {
        let completed = completed_at.map(unix_to_iso);
        let due = due_date.map(unix_to_iso);
        let created = created_at.map(unix_to_iso);
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            csv_escape(id),
            csv_escape(&title),
            csv_escape_opt(description.as_deref()),
            csv_escape_opt(priority.as_deref()),
            is_completed,
            csv_escape_opt(completed.as_deref()),
            csv_escape_opt(due.as_deref()),
            csv_escape_opt(created.as_deref()),
        ));
    }

    let path = Path::new(&destination_path);
    fs::write(path, &csv)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to write CSV file: {e}")))?;

    log::info!("[export] Wrote {} tasks to {:?}", rows.len(), path);
    Ok(rows.len() as u32)
}

/// Export calendar events to ICS (iCalendar RFC 5545) format.
#[tauri::command]
pub async fn export_calendar_ics(
    pool: tauri::State<'_, SqlitePool>,
    destination_path: String,
) -> Result<u32, SerializedError> {
    if destination_path.trim().is_empty() {
        return Err(SerializedError::new(ERR_INVALID_INPUT, "Destination path cannot be empty"));
    }

    let rows: Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        i64,
        i64,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT id, summary, description, location, start_time, end_time, is_all_day, status
         FROM calendar_events ORDER BY start_time",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| SerializedError::new(ERR_DB_CORRUPT, format!("Failed to query calendar events: {e}")))?;

    let now = chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let mut ics = String::new();
    ics.push_str("BEGIN:VCALENDAR\r\n");
    ics.push_str("VERSION:2.0\r\n");
    ics.push_str("PRODID:-//SMEMaster//EN\r\n");
    ics.push_str("CALSCALE:GREGORIAN\r\n");
    ics.push_str("METHOD:PUBLISH\r\n");

    for (id, summary, description, location, start_time, end_time, is_all_day, status) in &rows {
        ics.push_str("BEGIN:VEVENT\r\n");
        ics.push_str(&format!("UID:{}@smemaster\r\n", escape_vcard(id)));
        ics.push_str(&format!("DTSTAMP:{}\r\n", now));
        if *is_all_day == 1 {
            // All-day events use DATE-only format
            ics.push_str(&format!("DTSTART;VALUE=DATE:{}\r\n", unix_to_ics_date(*start_time)));
            ics.push_str(&format!("DTEND;VALUE=DATE:{}\r\n", unix_to_ics_date(*end_time)));
        } else {
            ics.push_str(&format!("DTSTART:{}\r\n", unix_to_ics(*start_time)));
            ics.push_str(&format!("DTEND:{}\r\n", unix_to_ics(*end_time)));
        }
        ics.push_str(&format!(
            "SUMMARY:{}\r\n",
            ics_escape(summary.as_deref().unwrap_or(""))
        ));
        if let Some(d) = description {
            ics.push_str(&format!("DESCRIPTION:{}\r\n", ics_escape(d)));
        }
        if let Some(l) = location {
            ics.push_str(&format!("LOCATION:{}\r\n", ics_escape(l)));
        }
        if let Some(s) = status {
            ics.push_str(&format!("STATUS:{}\r\n", ics_escape(s)));
        }
        ics.push_str("END:VEVENT\r\n");
    }

    ics.push_str("END:VCALENDAR\r\n");

    let path = Path::new(&destination_path);
    fs::write(path, &ics)
        .await
        .map_err(|e| SerializedError::new(ERR_FILE_IO, format!("Failed to write ICS file: {e}")))?;

    log::info!("[export] Wrote {} calendar events to {:?}", rows.len(), path);
    Ok(rows.len() as u32)
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/// Escape a value for CSV (RFC 4180):
/// - Wrap in double quotes if it contains comma, quote, or newline
/// - Double any embedded quotes
fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn csv_escape_opt(value: Option<&str>) -> String {
    csv_escape(value.unwrap_or(""))
}

/// Escape per RFC 2426 (vCard 3.0):
/// - Backslash escape: `\`, `,`, `;` and newlines
fn escape_vcard(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(',', "\\,")
        .replace(';', "\\;")
        .replace('\n', "\\n")
}

/// Escape per RFC 5545 (iCalendar):
/// - Backslash escape: `\`, `;`, `,` and newlines
fn ics_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(',', "\\,")
        .replace(';', "\\;")
        .replace('\n', "\\n")
}

/// Split a display name on the first space into (first, last)
fn split_name(name: &str) -> Option<(String, String)> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(idx) = trimmed.find(' ') {
        let first = trimmed[..idx].trim().to_string();
        let last = trimmed[idx + 1..].trim().to_string();
        if first.is_empty() || last.is_empty() {
            None
        } else {
            Some((first, last))
        }
    } else {
        None
    }
}

/// Convert Unix timestamp (seconds) to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
fn unix_to_iso(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_default()
}

/// Convert Unix timestamp (seconds) to iCalendar UTC format (YYYYMMDDTHHMMSSZ)
fn unix_to_ics(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y%m%dT%H%M%SZ").to_string())
        .unwrap_or_default()
}

/// Convert Unix timestamp (seconds) to iCalendar DATE format (YYYYMMDD) for all-day events
fn unix_to_ics_date(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y%m%d").to_string())
        .unwrap_or_default()
}
