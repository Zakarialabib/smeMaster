// ── Calendar Module ──────────────────────────────────────────────────────────
//
// Pluggable calendar provider driver system.
//
// This module follows the same architecture as the email `drivers` module:
//   - `driver.rs` defines the `CalendarDriver` trait and `CalendarDriverError`
//   - `drivers/mod.rs` provides the `CalendarDriverRegistry` factory
//   - `drivers/caldav.rs` implements `CalendarDriver` for CalDAV providers
//
// Future drivers (Google Calendar API, Microsoft Graph Calendar, etc.)
// should be added as additional files in the `drivers/` subdirectory.

pub mod driver;
pub mod drivers;
