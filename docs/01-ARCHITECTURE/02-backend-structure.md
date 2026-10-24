# Rust/Tauri Backend Structure

> **What you need to know:** The Rust backend owns the Tauri command surface, database access, native integrations, and background services. Every database operation goes through Rust — TypeScript never touches SQL directly.

---

## The Big Picture

```
src-tauri/src/
├── lib.rs              # Tauri setup, command registration, tray, window events
├── main.rs             # Entry point (minimal)
│
├── commands/           # 31 domain command files — each a #[tauri::command] module
│   ├── core.rs         # Accounts, Messages, Threads, Labels
│   ├── contacts.rs     # CRM Contacts, Groups, Clients, Labels, Segments, Tags, Files
│   ├── crm.rs          # Campaigns, Backup Schedules, Deliverability, Bounces
│   ├── comms.rs        # Templates, Signatures, Drafts, Filters, Quick Steps
│   ├── invoicing.rs    # Invoices, Clients, Items, PDF/UBL, Morocco DGI
│   ├── db.rs           # Admin / generic DB ops (search, insert, maintenance)
│   ├── deliverability.rs # Config, Events, Blacklist, ARF Reports
│   ├── workflows.rs    # Workflow Rules, Follow-ups, Pending Ops
│   ├── tasks.rs        # Tasks + Task Tags
│   ├── calendar.rs     # Calendars, Events, Snooze Presets
│   ├── security.rs     # PGP Keys, Allowlists, Link Scan, Notification VIPs
│   ├── ai.rs           # AI Cache, AI Config, RAG
│   ├── pos.rs           # POS hardware (printer/scanner), transactions
│   ├── imap.rs         # IMAP operations
│   ├── smtp.rs         # SMTP operations
│   ├── compliance.rs   # Compliance Profiles + Checks
│   ├── discovery.rs    # local account discovery
│   ├── settings.rs     # Settings + Attachment Cache
│   ├── deals.rs        # Deal/Pipeline + Lead Scoring
│   ├── sync.rs         # sync engine commands
│   ├── onboarding_cmds.rs # onboarding flow
│   ├── wallet.rs       # company wallet (cash hub + ledger)
│   ├── accounting.rs   # ERP accounts / journal
│   ├── account_import.rs # account import
│   ├── updater_commands.rs # app auto-update
│   ├── system.rs / system_desktop.rs / system_android.rs # platform services
│   ├── idle.rs # idle/activity detection
│   └── logging.rs      # structured logging commands
│
├── agent/              # Agentic AI automation (email + social)
│   ├── mod.rs          # Module declarations + Tauri registration
│   ├── config.rs       # AgentConfig management (settings table)
│   ├── providers.rs    # Provider chain with fallback
│   ├── ops.rs          # Ops monitoring and alerts
│   ├── automation.rs   # Email/social automation rules
│   ├── types.rs        # Wire types (Health, OpsSnapshot, etc.)
│   └── commands.rs     # Tauri commands for config/ops/automation
│
├── db/                 # Database layer — schema, migrations, queries
│   ├── connection.rs   # SQLite pool creation (WAL mode, busy_timeout, FK enforcement)
│   ├── migrations.rs   # run_migrations() — idempotent, runs every startup
│   ├── core/schema.rs  # 120 Rust structs mapping to ALL tables (across db/)
│   ├── crypto.rs       # AES-256-GCM encrypt/decrypt, key management
│   ├── error.rs        # AppDbError → SerializedError conversion
│   ├── dual_write.rs   # Transaction helpers for v55 compatibility writes
│   └── tables/         # ~78 query files across 16 domain directories (+mod.rs, test_helpers.rs)
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
│       ├── compliance/ # profiles, checks
│       ├── invoicing/  # invoices, clients, items, journal
│       ├── accounting/ # ERP accounts
│       └── wallet/     # wallet + ledger
│
├── oauth.rs            # PKCE OAuth flow (Rust HTTP, no CORS needed)
├── dns.rs              # SPF/DKIM/DMARC DNS lookup
├── contacts/csv.rs     # Flexible CSV parser
├── deliverability/dnsbl.rs # Spamhaus/Barracuda/SpamCop/SURBL checks
├── export/             # mbox, PDF report, backup scheduler
├── imap/               # connect, fetch, flags, folder, sync, types
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
- Token fields (access*token, refresh_token, imap_password) are encrypted/decrypted _inside_ query functions — the command sees plaintext

---

## The Three-Tier DB Architecture

```
Frontend (React)
    │  invoke("db_get_account", { account_id: "abc" })
    ▼
commands/<domain>.rs   ← thin wrappers over db/tables queries
    │
    ▼
db/tables/<domain>/    ← query files using sqlx (parameterized, type-safe)
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

| Crate                                | Purpose        |
| ------------------------------------ | -------------- |
| `tauri` 2.11 + 14 plugins            | App framework  |
| `async-imap` 0.11.2 + `tokio-rustls` | IMAP client    |
| `lettre` 0.11 + `tokio1-rustls-tls`  | SMTP client    |
| `pgp` 0.19.0                         | PGP encryption |
| `trust-dns-resolver` 0.23            | DNS lookups    |
| `reqwest` 0.13.4 + `rustls-tls`      | HTTP (OAuth)   |
| `mail-parser` 0.11                   | MIME parsing   |

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
- [Agentic AI Automation →](08-agentic-ai-automation.md) — Rust agent module for email/social automation
