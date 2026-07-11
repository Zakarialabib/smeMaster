// ── Domain table modules ────────────────────────────────────────────────────
pub mod ai;
pub mod calendar;
pub mod campaigns;
pub mod comms;
pub mod compliance;
pub mod core;
pub mod crm;
pub mod deliverability;
pub mod security;
pub mod tasks;
pub mod workflows;

#[cfg(test)]
pub(crate) mod test_helpers;
