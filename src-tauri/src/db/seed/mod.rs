// ── Seed Module ─────────────────────────────────────────────────────────────
//
// Loads demo seed data from embedded JSON files at compile time via include_str!()
// and inserts them into the database in a single transaction.
//
// Each JSON file follows the SeedFile schema:
// ```json
// {
//   "table": "companies",
//   "timestamp_fields": ["created_at", "updated_at"],
//   "records": [
//     { "id": "demo-company-1", "name": "SME Master Demo", "created_at": -31536000, "updated_at": 0 }
//   ]
// }
// ```
//
// Timestamp values are RELATIVE offsets from the current time:
//   •   0  = now (unixepoch)
//   •  -86400 = 1 day ago
//   •   86400 = 1 day from now
//   •  -31536000 = 365 days ago
//
// The loader resolves them to absolute unix timestamps at insertion time.
// ─────────────────────────────────────────────────────────────────────────────

pub mod loader;

/// Re-export the main entry point.
pub use loader::seed_all;
