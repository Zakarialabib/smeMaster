//! Database commands for the calendar domain.
//!
//! Thin `#[tauri::command]` wrappers over the calendar DB modules
//! (`crate::db::tables::calendar::*`). Each command pulls the `SqlitePool` from
//! Tauri `State`, delegates to the corresponding DB function, and maps
//! `AppDbError` into the frontend-facing `SerializedError`. The actual DB
//! logic, SQL, and error semantics live in the DB layer — these commands only
//! translate request payloads and propagate errors.

use serde::Deserialize;
use tauri::State;
use sqlx::SqlitePool;

use crate::calendar::driver::CalendarDriver;
use crate::db::calendar::schema::{Calendar, CalendarEvent, SnoozePreset};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

/// Request payload for creating a calendar.
///
/// Deserialized from camelCase JSON (e.g. `companyId`, `remoteId`,
/// `isPrimary`, `isVisible`). All fields map directly onto the DB `create`
/// arguments.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCalendarRequest {
    /// Owning account/company id.
    pub company_id: String,
    /// Provider key (e.g. `"google"`).
    pub provider: String,
    /// Remote provider calendar identifier.
    pub remote_id: String,
    /// Optional human-readable name.
    pub display_name: Option<String>,
    /// Optional hex color.
    pub color: Option<String>,
    /// Optional primary flag (defaults to `false` if omitted).
    pub is_primary: Option<bool>,
    /// Optional visibility flag (defaults to `true` if omitted).
    pub is_visible: Option<bool>,
}

/// Request payload for updating a calendar.
///
/// Deserialized from camelCase JSON. `Option<Option<String>>` fields
/// (`sync_token`, `ctag`) distinguish "set to NULL" (`Some(None)`) from
/// "leave unchanged" (`None`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCalendarRequest {
    /// Optional new display name.
    pub display_name: Option<String>,
    /// Optional new color.
    pub color: Option<String>,
    /// Optional new primary flag.
    pub is_primary: Option<bool>,
    /// Optional new visibility flag.
    pub is_visible: Option<bool>,
    /// Optional sync token; `Some(None)` clears it.
    pub sync_token: Option<Option<String>>,
    /// Optional ctag; `Some(None)` clears it.
    pub ctag: Option<Option<String>>,
}

/// Request payload for creating a calendar event.
///
/// Deserialized from camelCase JSON. All fields map onto the DB `create`
/// arguments; `None` optional fields are passed through as `NULL`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCalendarEventRequest {
    /// Owning account/company id.
    pub company_id: String,
    /// Optional parent calendar id.
    pub calendar_id: Option<String>,
    /// Remote Google event identifier.
    pub google_event_id: String,
    /// Optional remote provider event id.
    pub remote_event_id: Option<String>,
    /// Optional human-readable summary.
    pub summary: Option<String>,
    /// Optional description.
    pub description: Option<String>,
    /// Optional location.
    pub location: Option<String>,
    /// Event start time as epoch seconds.
    pub start_time: i64,
    /// Event end time as epoch seconds.
    pub end_time: i64,
    /// Whether the event spans the whole day.
    pub is_all_day: bool,
    /// Event status (e.g. `"confirmed"`).
    pub status: String,
    /// Optional organizer email.
    pub organizer_email: Option<String>,
    /// Optional attendees as a JSON string.
    pub attendees_json: Option<String>,
    /// Optional HTML link to the event.
    pub html_link: Option<String>,
    /// Optional entity tag for change detection.
    pub etag: Option<String>,
    /// Optional iCalendar data.
    pub ical_data: Option<String>,
    /// Optional UID.
    pub uid: Option<String>,
}

/// Request payload for updating a calendar event.
///
/// Deserialized from camelCase JSON. `Option<Option<String>>` fields
/// (`summary`, `description`, `location`, `organizer_email`, `attendees_json`,
/// `html_link`, `etag`, `ical_data`, `uid`) distinguish "set to NULL"
/// (`Some(None)`) from "leave unchanged" (`None`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCalendarEventRequest {
    /// Optional summary; `Some(None)` clears it.
    pub summary: Option<Option<String>>,
    /// Optional description; `Some(None)` clears it.
    pub description: Option<Option<String>>,
    /// Optional location; `Some(None)` clears it.
    pub location: Option<Option<String>>,
    /// Optional new start time.
    pub start_time: Option<i64>,
    /// Optional new end time.
    pub end_time: Option<i64>,
    /// Optional new all-day flag.
    pub is_all_day: Option<bool>,
    /// Optional new status.
    pub status: Option<String>,
    /// Optional organizer email; `Some(None)` clears it.
    pub organizer_email: Option<Option<String>>,
    /// Optional attendees JSON; `Some(None)` clears it.
    pub attendees_json: Option<Option<String>>,
    /// Optional HTML link; `Some(None)` clears it.
    pub html_link: Option<Option<String>>,
    /// Optional etag; `Some(None)` clears it.
    pub etag: Option<Option<String>>,
    /// Optional iCalendar data; `Some(None)` clears it.
    pub ical_data: Option<Option<String>>,
    /// Optional UID; `Some(None)` clears it.
    pub uid: Option<Option<String>>,
}

/// Request payload for creating a snooze preset.
///
/// Deserialized from camelCase JSON. `is_recurring` and `sort_order` default
/// to `false`/`0` when omitted.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnoozePresetRequest {
    /// Owning account/company id.
    pub company_id: String,
    /// Display label for the preset.
    pub label: String,
    /// Snooze duration in minutes.
    pub duration_minutes: i64,
    /// Optional recurring flag (defaults to `false`).
    pub is_recurring: Option<bool>,
    /// Optional ordering position (defaults to `0`).
    pub sort_order: Option<i64>,
}

// ── Register function ──────────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

// ── Commands ───────────────────────────────────────────────────────────────

/// List all calendars for an account.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `company_id` — Owning account/company id.
///
/// # Returns
/// `Vec<Calendar>` ordered by `display_name ASC`.
///
/// # Errors
/// Surfaces any `AppDbError` (e.g. `AppDbError::Database`) as `SerializedError`.
#[tauri::command]
pub async fn db_list_calendars(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<Calendar>> {
    crate::db::tables::calendar::calendars::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_calendar_events(
    pool: State<'_, SqlitePool>,
    company_id: String,
    calendar_id: Option<String>,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> CmdResult<Vec<CalendarEvent>> {
    crate::db::tables::calendar::calendar_events::list(
        &pool,
        &company_id,
        calendar_id.as_deref(),
        start_time,
        end_time,
    )
    .await
    .map_err(Into::into)
}

/// Fetch a single calendar by id.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `id` — Calendar primary key.
///
/// # Returns
/// The `Calendar` row.
///
/// # Errors
/// Surfaces `AppDbError::NotFound` (or `AppDbError::Database`) as
/// `SerializedError`.
#[tauri::command]
pub async fn db_get_calendar_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Calendar> {
    crate::db::tables::calendar::calendars::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a new calendar.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `calendar` — `CreateCalendarRequest` payload.
///
/// # Returns
/// The newly created `Calendar` row.
///
/// # Errors
/// Surfaces `AppDbError::Database` (e.g. duplicate or FK violation) as
/// `SerializedError`.
#[tauri::command]
pub async fn db_create_calendar(
    pool: State<'_, SqlitePool>,
    calendar: CreateCalendarRequest,
) -> CmdResult<Calendar> {
    crate::db::tables::calendar::calendars::create(
        &pool,
        &calendar.company_id,
        &calendar.provider,
        &calendar.remote_id,
        calendar.display_name.as_deref(),
        calendar.color.as_deref(),
        calendar.is_primary.unwrap_or(false),
        calendar.is_visible.unwrap_or(true),
    )
    .await
    .map_err(Into::into)
}

/// Update mutable fields on a calendar.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `id` — Calendar primary key.
/// - `fields` — `UpdateCalendarRequest` payload.
///
/// # Returns
/// `()` on success.
///
/// # Errors
/// Surfaces `AppDbError::Database` as `SerializedError`.
#[tauri::command]
pub async fn db_update_calendar(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateCalendarRequest,
) -> CmdResult<()> {
    crate::db::tables::calendar::calendars::update(
        &pool,
        &id,
        fields.display_name.as_deref(),
        fields.color.as_deref(),
        fields.is_primary,
        fields.is_visible,
        fields.sync_token.as_ref().map(|v| v.as_deref()),
        fields.ctag.as_ref().map(|v| v.as_deref()),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_calendar(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::calendar::calendars::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Fetch a single calendar event by id.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `id` — Event primary key.
///
/// # Returns
/// The `CalendarEvent` row.
///
/// # Errors
/// Surfaces `AppDbError::NotFound` (or `AppDbError::Database`) as
/// `SerializedError`.
#[tauri::command]
pub async fn db_get_calendar_event_by_id(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<CalendarEvent> {
    crate::db::tables::calendar::calendar_events::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

/// Create a new calendar event.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `event` — `CreateCalendarEventRequest` payload.
///
/// # Returns
/// The newly created `CalendarEvent` row.
///
/// # Errors
/// Surfaces `AppDbError::Database` (e.g. FK violation) as `SerializedError`.
#[tauri::command]
pub async fn db_create_calendar_event(
    pool: State<'_, SqlitePool>,
    event: CreateCalendarEventRequest,
) -> CmdResult<CalendarEvent> {
    crate::db::tables::calendar::calendar_events::create(
        &pool,
        &event.company_id,
        event.calendar_id.as_deref(),
        &event.google_event_id,
        event.remote_event_id.as_deref(),
        event.summary.as_deref(),
        event.description.as_deref(),
        event.location.as_deref(),
        event.start_time,
        event.end_time,
        event.is_all_day,
        &event.status,
        event.organizer_email.as_deref(),
        event.attendees_json.as_deref(),
        event.html_link.as_deref(),
        event.etag.as_deref(),
        event.ical_data.as_deref(),
        event.uid.as_deref(),
    )
    .await
    .map_err(Into::into)
}

/// Update mutable fields on a calendar event.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `id` — Event primary key.
/// - `fields` — `UpdateCalendarEventRequest` payload.
///
/// # Returns
/// `()` on success.
///
/// # Errors
/// Surfaces `AppDbError::Database` as `SerializedError`.
#[tauri::command]
pub async fn db_update_calendar_event(
    pool: State<'_, SqlitePool>,
    id: String,
    fields: UpdateCalendarEventRequest,
) -> CmdResult<()> {
    crate::db::tables::calendar::calendar_events::update(
        &pool,
        &id,
        fields.summary.as_ref().map(|v| v.as_deref()),
        fields.description.as_ref().map(|v| v.as_deref()),
        fields.location.as_ref().map(|v| v.as_deref()),
        fields.start_time,
        fields.end_time,
        fields.is_all_day,
        fields.status.as_deref(),
        fields.organizer_email.as_ref().map(|v| v.as_deref()),
        fields.attendees_json.as_ref().map(|v| v.as_deref()),
        fields.html_link.as_ref().map(|v| v.as_deref()),
        fields.etag.as_ref().map(|v| v.as_deref()),
        fields.ical_data.as_ref().map(|v| v.as_deref()),
        fields.uid.as_ref().map(|v| v.as_deref()),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_calendar_event(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::calendar::calendar_events::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_snooze_presets(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<SnoozePreset>> {
    crate::db::tables::calendar::snooze_presets::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_snooze_preset(
    pool: State<'_, SqlitePool>,
    preset: CreateSnoozePresetRequest,
) -> CmdResult<SnoozePreset> {
    crate::db::tables::calendar::snooze_presets::create(
        &pool,
        &preset.company_id,
        &preset.label,
        preset.duration_minutes,
        preset.is_recurring.unwrap_or(false),
        preset.sort_order.unwrap_or(0),
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_snooze_preset(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::calendar::snooze_presets::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

// ── Calendar lookups ─────────────────────────────────────────────────

/// Fetch a calendar by provider + remote id.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `provider` — Provider key.
/// - `remote_id` — Remote provider calendar identifier.
///
/// # Returns
/// The `Calendar` row.
///
/// # Errors
/// Surfaces `AppDbError::NotFound` (or `AppDbError::Database`) as
/// `SerializedError`.
#[tauri::command]
pub async fn db_get_calendar_by_remote_id(
    pool: State<'_, SqlitePool>,
    provider: String,
    remote_id: String,
) -> CmdResult<Calendar> {
    crate::db::tables::calendar::calendars::get_by_remote_id(&pool, &provider, &remote_id)
        .await
        .map_err(Into::into)
}

/// Fetch a calendar event by Google event id.
///
/// # Parameters
/// - `pool` — Injected `SqlitePool`.
/// - `company_id` — Owning account/company id.
/// - `google_event_id` — Remote Google event identifier.
///
/// # Returns
/// The `CalendarEvent` row.
///
/// # Errors
/// Surfaces `AppDbError::NotFound` (or `AppDbError::Database`) as
/// `SerializedError`.
#[tauri::command]
pub async fn db_get_calendar_event_by_google_id(
    pool: State<'_, SqlitePool>,
    company_id: String,
    google_event_id: String,
) -> CmdResult<CalendarEvent> {
    crate::db::tables::calendar::calendar_events::get_by_google_id(
        &pool, &company_id, &google_event_id,
    )
    .await
    .map_err(Into::into)
}

// ── CalendarDriver (provider-abstracted) commands ─────────────────────────
//
// These commands dispatch to the configured `CalendarDriver` for an account
// (CalDAV today; Google Calendar / Microsoft Graph in Phase 2). They exercise
// the trait methods that the build warns about (`list_calendars`, `test_connection`,
// `create_event`, `update_event`, `delete_event`, `provider_type`) plus the
// registry's `create_for_calendar` helper.

// ── Driver error → SerializedError ─────────────────────────────────────────

fn map_calendar_driver_err(e: crate::calendar::driver::CalendarDriverError) -> SerializedError {
    SerializedError::new(e.code, e.message)
}

/// Look up the calendar's `provider` from the DB and return the driver-type
/// string (e.g. `"caldav"`). Surfaced to the UI so it can show provider info.
#[tauri::command]
pub async fn db_calendar_provider_type(
    pool: State<'_, SqlitePool>,
    calendar_id: String,
) -> CmdResult<String> {
    let registry = crate::calendar::drivers::CalendarDriverRegistry::new(pool.inner().clone());
    let driver = registry
        .create_for_calendar(&calendar_id)
        .await
        .map_err(map_calendar_driver_err)?;
    Ok(driver.provider_type().to_string())
}

/// List all calendars visible to the account via its calendar driver.
#[tauri::command]
pub async fn db_calendar_list_calendars(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<Calendar>> {
    // The "caldav" provider is the only one wired today, so create it directly.
    // Once we have provider discovery, this can go through a registry.
    let driver = crate::calendar::drivers::caldav::CalDavDriver::new(pool.inner().clone());
    driver
        .list_calendars(&account_id)
        .await
        .map_err(map_calendar_driver_err)
}

/// Test connectivity and authentication with the calendar provider.
#[tauri::command]
pub async fn db_calendar_test_connection(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<()> {
    let driver = crate::calendar::drivers::caldav::CalDavDriver::new(pool.inner().clone());
    driver
        .test_connection(&account_id)
        .await
        .map_err(map_calendar_driver_err)
}

/// Create a remote event on the account's primary calendar via the configured
/// driver. Returns the remote event id.
#[tauri::command]
pub async fn db_calendar_create_event(
    pool: State<'_, SqlitePool>,
    account_id: String,
    calendar_id: String,
    event: CalendarEvent,
) -> CmdResult<String> {
    let driver = crate::calendar::drivers::caldav::CalDavDriver::new(pool.inner().clone());
    driver
        .create_event(&account_id, &calendar_id, &event)
        .await
        .map_err(map_calendar_driver_err)
}

/// Update an event on the remote calendar via the configured driver.
#[tauri::command]
pub async fn db_calendar_update_event(
    pool: State<'_, SqlitePool>,
    account_id: String,
    event_id: String,
    event: CalendarEvent,
) -> CmdResult<()> {
    let driver = crate::calendar::drivers::caldav::CalDavDriver::new(pool.inner().clone());
    driver
        .update_event(&account_id, &event_id, &event)
        .await
        .map_err(map_calendar_driver_err)
}

/// Delete an event on the remote calendar via the configured driver.
#[tauri::command]
pub async fn db_calendar_delete_event(
    pool: State<'_, SqlitePool>,
    account_id: String,
    event_id: String,
) -> CmdResult<()> {
    let driver = crate::calendar::drivers::caldav::CalDavDriver::new(pool.inner().clone());
    driver
        .delete_event(&account_id, &event_id)
        .await
        .map_err(map_calendar_driver_err)
}