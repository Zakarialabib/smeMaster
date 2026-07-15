# Rust/Tauri Backend Structure

> **What you need to know:** The Rust backend owns the Tauri command surface, database access, native integrations, and background services. Every database operation goes through Rust — TypeScript never touches SQL directly.

---

## The Big Picture

```
src-tauri/src/
├── lib.rs              # Tauri setup, command registration, tray, window events
├── main.rs             # Entry point (minimal)
│
├── commands/           # 29 domain command files (verified 2026-07-15) — each a #[tauri::command] file
│   ├── core.rs         # ~67  — Accounts, Messages, Threads, Labels
│   ├── contacts.rs     # ~93  — CRM Contacts, Groups, Labels, Segments, Tags, Files
│   ├── crm.rs          # ~48  — Campaigns, Backup Schedules, Deliverability, Bounces
│   ├── comms.rs        # ~110 — Templates, Signatures, Drafts, Filters, Quick Steps
│   ├── tasks.rs        # ~27  — Tasks + Task Tags
│   ├── calendar.rs     # ~15  — Calendars, Events, Snooze Presets
│   ├── ai.rs           # ~9   — AI Cache, AI Config
│   ├── security.rs     # ~21  — PGP Keys, Allowlists, Link Scan, Notification VIPs
│   ├── compliance.rs   # ~13  — Compliance Profiles + Checks
│   ├── deliverability.rs # ~27 — Config, Events, Blacklist, ARF Reports
│   ├── workflows.rs    # ~28  — Workflow Rules, Follow-ups, Pending Ops
│   ├── settings.rs     # ~11  — Settings + Attachment Cache
│   ├── db.rs           # ~5   — Admin (search, insert, v56 cleanup)
│   ├── imap.rs         # ~28  — IMAP operations
│   └── smtp.rs         # ~2   — SMTP operations
│
├── db/                 # Database layer — schema, migrations, queries
│   ├── connection.rs   # SQLite pool creation (WAL mode, busy_timeout, FK enforcement)
│   ├── migrations.rs   # run_migrations() — idempotent, runs every startup
│   ├── schema.rs       # 48 Rust structs mapping to ALL tables
│   ├── crypto.rs       # AES-256-GCM encrypt/decrypt, key management
│   ├── error.rs        # AppDbError → SerializedError conversion
│   ├── dual_write.rs   # Transaction helpers for v55 compatibility writes
│   └── tables/         # 67 query files across 11 domain directories
│       ├── core/       # accounts, messages, threads, labels, attachments...
│       ├── crm/        # contacts, entity_pivots, engagement_log...
│       ├── comms/      # filter_rules, templates, signatures...
│       ├── ai/         # ai_cache, ai_config
│       ├── campaigns/  # campaigns, utm_links, backup_schedules...
│       ├── deliverability/ # config, events, blacklist, arf_reports...
│       ├── security/   # pgp_keys, allowlists, link_scan...
│       ├── tasks/      # tasks, task_tags
│       ├── calendar/   # calendars, calendar_events, snooze_presets
│       ├── workflows/  # workflow_rules, follow_up_reminders, pending_operations
│       └── compliance/ # profiles, checks
│
├── oauth.rs            # PKCE OAuth flow (Rust HTTP, no CORS needed)
├── dns.rs              # SPF/DKIM/DMARC DNS lookup
├── contacts/csv.rs     # Flexible CSV parser
├── deliverability/dnsbl.rs # Spamhaus/Barracuda/SpamCop/SURBL checks
├── export/             # mbox, PDF report, backup scheduler
├── imap/               # 7 files — connect, fetch, flags, folder, sync, types
├── pgp/                # cache, crypto, keyring
├── smtp/               # client (lettre), types
├── vault/              # file ops, PDF text extraction
└── services/           # Service registry, watchdog (30s health check loop)
```

---

## How Commands Work

Every command follows the same pattern:

```rust
type CmdResult<T> = Result<T, SerializedError>;

#[tauri::command]
pub async fn db_get_account(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Account> {
    crate::db::tables::core::accounts::get_by_id(&pool, &account_id)
        .await
        .map_err(Into::into)  // AppDbError → SerializedError
}
```

**Key rules:**

- All DB commands use `db_` prefix — distinguishes them from native Tauri commands
- Each command is a thin wrapper that delegates to a `db/tables/` query function
- Errors flow through `AppDbError` → `SerializedError` — typed error codes on the frontend
- Token fields (access_token, refresh_token, imap_password) are encrypted/decrypted _inside_ query functions — the command sees plaintext

---

## The Three-Tier DB Architecture

```
Frontend (React)
    │  invoke("db_get_account", { account_id: "abc" })
    ▼
commands/<domain>.rs   ← 490+ thin wrappers (one function ≈ one SQL query)
    │
    ▼
db/tables/<domain>/    ← 67 query files using sqlx (parameterized, type-safe)
    │
    ▼
SQLite                  ← WAL mode, connection pool managed in lib.rs
```

**Why three tiers?**

- Commands handle Tauri concerns (state extraction, serialization)
- Query files handle SQL concerns (joins, filtering, pagination)
- SQLite handles data concerns (storage, indexing, FK enforcement)

---

## Core Systems

### Service Registry

Long-running background services (Database, PGP, ImapSync) are managed through a centralized registry.

- **Phased init**: Services initialize in priority order (P10 → P30 → P50)
- **Progress events**: Emits `init:progress` and `init:ready` for the splash screen

### Watchdog

Every 30 seconds, the watchdog pings all registered services:

- **Health checks**: If a service doesn't respond, it gets flagged
- **Self-healing**: Failed services are automatically restarted
- **Exponential backoff**: Prevents restart loops on persistent failures

---

## Startup Sequence

In `lib.rs` setup hook:

```rust
// Phase 0 — Database pool + migration
let app_data_dir = app.path().app_data_dir()...;
let pool = db::connection::create_pool(app_data_dir).await?;
app.manage(pool.clone());
db::migrations::run_migrations(&pool).await?;
```

That's it. Two function calls and the DB layer is ready. The old TypeScript `runMigrations()` was removed — Rust owns migrations now.

---

## Key Rust Crates

| Crate                                         | Purpose        |
| --------------------------------------------- | -------------- |
| `tauri` 2.11 + 8 plugins                      | App framework  |
| `async-imap` 0.11.2 + `tokio-rustls`          | IMAP client    |
| `lettre` 0.11 + `tokio1-rustls-tls`           | SMTP client    |
| `pgp` 0.19.0                                  | PGP encryption |
| `trust-dns-resolver` 0.23                     | DNS lookups    |
| `reqwest` 0.13.4 + `rustls-tls`               | HTTP (OAuth)   |
| `mail-parser` 0.11                            | MIME parsing   |

**TLS:** `rustls` 0.23.40 by default. `native-tls` optional for legacy builds.

---

## IPC Name Convention

All IPC commands use consistent prefixes so you know what you're calling:

| Prefix  | Module              | Example                               |
| ------- | ------------------- | ------------------------------------- |
| `db_`   | Database operations | `db_get_account`, `db_create_contact` |
| `pgp_`  | PGP operations      | `pgp_cache_passphrase`, `pgp_encrypt` |
| `imap_` | IMAP operations     | `imap_sync_folder`, `imap_set_flags`  |
| `smtp_` | SMTP operations     | `smtp_send_email`                     |

No prefix mismatches. ✅ All verified.

---

## Related

- [Data model →](03-data-model.md) — schema ownership, domains, and consolidation patterns
- [Reuse patterns →](../05-DEVELOPMENT/05-reuse-patterns.md) — code reuse analysis across backend/frontend
