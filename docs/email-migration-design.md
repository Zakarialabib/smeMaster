# Email Migration in SMEMaster — Workspace-Aligned Design

> This is a rewrite of the earlier generic migration notes, re-grounded in the
> actual SMEMaster codebase: a Tauri v2 + Rust (native) + React/TypeScript
> (UI) desktop app with a **local-first, Rust-owned SQLite** data layer.
> Where the original doc speculated about abstract "your system", this version
> points at concrete files, commands, and tables that already exist.

---

## 0. Where the relevant code actually lives

| Concern | Location |
| --- | --- |
| IMAP engine (fetch, sync, folders, flags) | `src-tauri/src/imap/` (7 files) + `src/features/mail/services/imap/tauriCommands.ts` (19 wrappers) |
| OAuth (Gmail + Microsoft Graph, PKCE) | `src-tauri/src/oauth.rs`, `src-tauri/src/oauth/monitor.rs`, `src/shared/services/oauth/customTabAuth.ts` |
| Local account discovery (no password read) | `src-tauri/src/commands/account_import.rs` (`scan_system_accounts`, `validate_discovered_account`) |
| Persistence / schema | `src/shared/services/db/schema.sql`, `src-tauri/src/db/` |
| Mail data model | `accounts`, `labels`, `threads`, `messages`, `attachments`, `folder_sync_state` (`schema.sql`) |
| Resumable email sync state | `folder_sync_state` table (`uidvalidity`, `last_uid`, `modseq`, `last_sync_at`) |
| P2P document sync (not email migration) | `src-tauri/src/sync_engine/` (automerge CRDT + mDNS/TCP) |
| Layer boundaries | `docs/01-ARCHITECTURE/01-overview.md` |

> **Important distinction:** the `sync_engine` module is a CRDT-based
> device-to-device sync layer for app documents, **not** an email-migration
> engine. Email import/resume lives in the IMAP engine + `folder_sync_state`.

---

## 1. User-Facing Migration Pain Points (mapped to the real schema)

| Pain point | Why it matters | What SMEMaster already provides |
| --- | --- | --- |
| **Folder/Label mapping mismatch** | Gmail uses labels; IMAP uses a folder hierarchy; Outlook uses folders. Users expect structure to survive. | `labels` has both `type`, `color_bg/fg`, and `imap_folder_path` + `imap_special_use`. The IMAP engine does RFC 6154 + name-heuristic special-use detection (`folder.rs`), so `INBOX`/`Sent`/`Trash` map naturally. |
| **Threading model differences** | Gmail threads by `Message-ID` + `References`; Outlook by conversation index. Broken threading destroys context. | `messages` stores `message_id_header`, `references_header`, `in_reply_to_header`. Threading is reconstructed from these headers rather than trusting provider-specific threading. |
| **Inline image / attachment breakage** | Inline images may be `cid:`-referenced blobs vs. real attachments. | `attachments` carries `content_id`, `is_inline`, `imap_part_id`, and `local_path`. The IMAP engine extracts attachments by MIME part ID (`fetch.rs`) so inline vs. attached is preserved and written to local disk. |
| **Read / Starred / Flagged state loss** | Losing curated state feels like losing bookmarks. | `threads` + `messages` persist `is_read`, `is_starred`, `is_important`, `is_pinned`, `is_muted`, `is_snoozed`. IMAP flags are round-tripped via `flags.rs` (`UID STORE +/-FLAGS`). |
| **Search index loss** | Local search indexes don't transfer; slow re-index feels blind. | `messages_fts` is an FTS5 trigram virtual table with `AFTER INSERT/UPDATE/DELETE` triggers. Because the index is **local SQLite**, search works instantly the moment bodies are committed — no remote re-index wait. |
| **OAuth token lifecycle** | Gmail refresh tokens can expire; silent failure feels broken. | OAuth uses **PKCE** (no client secret) and `OAuthTokenMonitor` auto-refreshes at startup via `check_and_refresh`. Tokens are encrypted with AES-256-GCM before SQLite (`db::crypto`). |
| **Rate limiting during bulk import** | Aggressive IMAP sync gets throttled / banned. | Fetching is batched (`BODY[]`, configurable **batch size 50** by default) and delta-synced via `UIDVALIDITY` + `UIDNEXT` tracking (`sync.rs`) instead of blind re-pulls. |

---

## 2. Migration Architecture (aligned to the 3-layer stack)

SMEMaster's rule: **UI never touches the DB, services are plain async functions, Rust owns the data.** Migration follows the same shape.

```
React (AccountSetupStep / Settings → Accounts)
   │  calls plain async service fn
   ▼
Service Layer (TS)  — wraps invoke()
   │  invoke("scan_system_accounts") / invoke("imap_fetch_messages") / ...
   ▼
Rust Commands (src-tauri/src/commands/*)
   │  open session, fetch, parse, upsert
   ▼
SQLite (WAL) — schema.sql-owned tables
   accounts · labels · threads · messages · attachments · folder_sync_state
```

### A. Two-phase model (what the IMAP engine already supports)

```
Phase 1 — Historical Backfill (cold)
  └─ imap_fetch_new_uids / imap_search_all_uids → get UID set
  └─ imap_fetch_messages → BODY[] in batches of 50 (default)
  └─ Checkpoint into folder_sync_state every batch (uidvalidity + last_uid)

Phase 2 — Live Cutover (hot)
  └─ imap_delta_check / imap_sync_folder → diff from last_uid + modseq
  └─ Repeat on idle / interval until caught up
```

The **checkpoint** is the `folder_sync_state` row:
`(account_id, folder_path) → uidvalidity, last_uid, modseq, last_sync_at`.
If `UIDVALIDITY` changes, the IMAP engine treats the folder as a full resync —
message IDs are `imap-{accountId}-{folder}-{uid}`, so validity changes are
predictable and don't silently duplicate.

### B. The "Ghost Mailbox" pattern

SMEMaster is **local-first**: the imported mailbox is fully readable offline the
moment it's committed to SQLite. A user can:
- Keep the old account connected and view both (mirror mode is just "two accounts").
- Start composing/sending from the new address immediately (default `send_as` identity).
- Rely on `folder_sync_state` delta sync to keep the old account drained in the background.

### C. Conflict resolution (mapped to real keys)

| Scenario | Rule in SMEMaster |
| --- | --- |
| Same message exists in source + local | Keyed by `(account_id, id)`; `messages` also indexes `message_id_header` and `(account_id, imap_folder, imap_uid)`. Source wins on active import. |
| Source has newer flags | `imap_set_flags` writes via `UID STORE`; `flags.rs` owns flag state. |
| Local has newer flags (user interacted) | Local read/starred state is authoritative for UI; logged if differs. |
| Folder renamed in source post-import | `labels.imap_folder_path` is re-detected by special-use; already-imported items are not retroactively moved. |

---

## 3. The Seamless Workflow (real commands, in order)

**Step 1 — Credential capture (zero-trust).**
- `scan_system_accounts` reads **only** host/port/security/method from
  Apple Mail, Outlook, Thunderbird, Windows Mail, Evolution. It **never reads
  or stores passwords** (see header comment in `account_import.rs`).
- For OAuth providers, `start_oauth_server` / `start_oauth_browser` + PKCE flow
  exchanges tokens in Rust (`reqwest`, no CORS). Gmail ✅, Microsoft Graph
  ⚠️ backend-ready / frontend pending.
- `validate_discovered_account` sanity-checks before anything downloads.

**Step 2 — Discovery & estimation.**
- `imap_list_folders` returns folders with special-use detection.
- `imap_get_folder_status` returns `UIDNEXT`/`UIDVALIDITY`/counts → estimate
  message count + size. (UI should let users deselect folders like Spam.)

**Step 3 — Header-first preview.**
- `imap_fetch_messages` with header-only fetch gives instant browseable archive
  while bodies download in background. UI reads from SQLite synchronously
  (services are async, but local reads need no spinner).

**Step 4 — Body & attachment backfill.**
- `imap_fetch_message_body` / `imap_fetch_raw_message` via `BODY.PEEK[]`
  (won't mark source read).
- `mail-parser` normalizes MIME; inline images extracted by `imap_part_id`
  and stored to `local_path` under `attachments`. `body_html`/`body_text`
  committed to `messages`. `messages_fts` triggers index automatically.

**Step 5 — Cutover.**
- `imap_delta_check` closes the last-24h gap; `send_as_aliases` sets the new
  default send identity. (Forwarder setup on the old provider is out of scope
  for a local-first desktop client but can be offered as a manual step.)

**Step 6 — Decommission / archive.**
- User choice: keep syncing (mirror), stop sync but keep local archive, or
  prune after a window. All backed by `folder_sync_state.last_sync_at` and the
  local-only SQLite store — no cloud coordination required.

---

## 4. Connection to the actual stack

| Constraint (real) | Migration implication (real) |
| --- | --- |
| Tauri v2 + Rust owns the DB | All sync/auth/crypto happens in Rust; React only renders progress. IMAP engine is `async-imap` 0.10 with a raw-TCP fallback for Exchange/DavMail quirks. |
| Local-first SQLite (WAL) | Migration is pausable/resumable with no server. `folder_sync_state` is the resume checkpoint; `pending_operations` table can hold retryable ops. |
| Windows is a first-class target | `scan_windows()` discovers Thunderbird/Outlook/Windows Mail; `cfg(target_os=...)`-gated so Android build stays clean. |
| OAuth PKCE + AES-256-GCM tokens | No plaintext secrets on disk; refresh monitor keeps sync alive without re-auth prompts. |
| 19 IMAP wrappers + 504 DB wrappers | Frontend never writes SQL; every migration action is a typed `invoke()`. |
| `messages_fts` trigram index | Search is usable immediately post-import, satisfying the "I can't find my 2022 invoice" fear. |

---

## 5. What to build first (grounded in known gaps)

1. **Resumable backfill driven by `folder_sync_state`.** It exists as a table;
   wire the IMAP batch fetcher to write `last_uid`/`modseq` per batch so a crash
   resumes instead of re-pulling. *Highest leverage, already half-built.*
2. **Label ⇄ folder mapping UI.** `labels.imap_folder_path` + special-use
   detection already exist; expose a drag/select mapping step before backfill.
3. **OAuth Microsoft Graph frontend.** Backend is done; the custom-tab flow in
   `customTabAuth.ts` needs to complete the MS Graph branch so Outlook 365 users
   don't fall back to password IMAP.
4. **IMAP engine unit tests (P1).** The module has zero tests today and a raw
   TCP diagnostic path for malformed Exchange responses — cover `sync.rs`,
   `flags.rs`, and `folder.rs` before marketing bulk import as safe.
5. **Conflict audit log.** Capture source-vs-local flag/state divergences in
   `pending_operations` or a dedicated log so "my starred items moved" is
   explainable, not mysterious.

---

## 6. Data Model for the Resumable Sync Engine

The hard part of "seamless migration" is not fetching mail — it's **surviving
an interrupted fetch** and **knowing exactly where to resume**. SMEMaster
already has `folder_sync_state` as the per-folder checkpoint. To make a full
migration resumable we extend it additively (per the repo's "additive repairs,
no destructive migration" rule in `docs/01-ARCHITECTURE/03-data-model.md`) and
add a top-level job table.

### 6.1 Extend `folder_sync_state` (additive columns only)

```sql
ALTER TABLE folder_sync_state ADD COLUMN sync_phase TEXT NOT NULL DEFAULT 'discovered';
-- 'discovered' → 'headers' → 'backfill' → 'delta' → 'done'

ALTER TABLE folder_sync_state ADD COLUMN last_error TEXT;
ALTER TABLE folder_sync_state ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE folder_sync_state ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;
```

Why additive: `uidvalidity` / `last_uid` / `modseq` already give us the cursor.
`last_uid` is the resume point for Phase 1; `modseq` (when the server supports
`CONDSTORE`/`QRESYNC`) is the resume point for Phase 2 deltas. No existing
column is changed, so current installs keep syncing uninterrupted.

### 6.2 New `sync_jobs` table (one row per migration run)

```sql
CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'discovery',     -- discovery|backfill|cutover|done
  status TEXT NOT NULL DEFAULT 'running',       -- running|paused|failed|done
  total_folders INTEGER NOT NULL DEFAULT 0,
  done_folders INTEGER NOT NULL DEFAULT 0,
  estimated_messages INTEGER,
  synced_messages INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

This is the row the UI binds to: a single progress bar / timeline per account,
driven by `syncStore` (`src/shared/stores/syncStore.ts`) which already exists
for health/queue progress.

### 6.3 New `sync_conflicts` table (audit log, item #5 from §5)

```sql
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  message_id_header TEXT,
  conflict_type TEXT NOT NULL,   -- flag_divergence|folder_rename|duplicate_skip
  source_value TEXT,
  local_value TEXT,
  resolved TEXT NOT NULL DEFAULT 'pending',  -- pending|source_wins|local_wins
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_account ON sync_conflicts(account_id, resolved);
```

### 6.4 How a resume actually works

```
On app start / "Resume" click:
  1. SELECT * FROM sync_jobs WHERE account_id=? AND status IN ('running','paused')
  2. For each folder in folder_sync_state WHERE is_paused=0:
       phase='headers'  → imap_fetch_new_uids            (re-list UID set)
       phase='backfill' → imap_fetch_messages FROM last_uid+1  (BATCH 50)
       phase='delta'    → imap_delta_check (modseq diff)
  3. On success: update last_uid / modseq / last_sync_at / sync_phase
  4. On error:   retry_count++, last_error=msg; pause folder at retry_count>threshold
  5. When all folders phase='done' → sync_jobs.status='done', finished_at=now
```

This turns "migration failed halfway with cryptic errors" (the original §1
rate-limit pain) into "folder X paused after 3 retries; everything else
finished; click Resume."

---

## 7. User Story Flow for the Folder-Mapping UI

Built on `labels` (`imap_folder_path`, `imap_special_use`, `type`, `color_*`)
and the IMAP engine's RFC 6154 special-use detection in `folder.rs`. The UI
lives inside **Account Setup** (`src/features/onboarding/steps/AccountSetupStep.tsx`)
and **Settings → Accounts** (`src/features/settings/components/tabs/AccountsTab.tsx`),
rendered inside the `MainWorkspace` glass shell.

### 7.1 Stories

- **US-1 — Auto-map by special-use.** *As a migrating user, when I connect
  Gmail/Outlook, I want Sent/Trash/Drafts/Archive to land in the right
  SMEMaster labels automatically, so I don't re-organize by hand.*
  → Backed by `imap_special_use` populated during `imap_list_folders`.

- **US-2 — See the full source tree.** *As a user, I want to see every source
  folder as a row with its message count and size, so I know what's coming.*

- **US-3 — Deselect noise.** *As a user, I want to uncheck Spam / Promotions /
  All Mail, so backfill is faster and my archive is clean.* → Drives
  `total_folders` vs `done_folders` in `sync_jobs`.

- **US-4 — Manual map / rename.** *As a user with custom folders ("Client X",
  "2023 Invoices"), I want to drag a source folder onto an existing label or
  rename the target label, so my taxonomy survives.* → Writes
  `labels.imap_folder_path` + `name`.

- **US-5 — Preview before download.** *As a user, I want a live preview of the
  resulting label tree (source → SMEMaster label) before I hit Import, so there
  are no surprises.* → Pure read of `labels` + the discovered folder list; no
  fetch yet.

- **US-6 — Resume visibility.** *As a user whose import got interrupted, I want
  to see which folders finished (green), which are paused (amber), and overall
  % so I trust it's not starting over.* → Binds to `sync_jobs` +
  `folder_sync_state.sync_phase`.

### 7.2 Screen flow

```
Connect (OAuth / discovered account)
   │
   ▼
[Discovery]  imap_list_folders + imap_get_folder_status
   │           render folder rows w/ counts + special-use badges
   │           auto-map by imap_special_use  (US-1, US-2)
   ▼
[Map]  optional manual drag/rename + deselect  (US-3, US-4)
   │           live preview panel  (US-5)
   ▼
[Confirm]  create labels (imap_folder_path set) → insert sync_jobs (phase=backfill)
   │
   ▼
[Progress]  per-folder timeline from folder_sync_state.sync_phase (US-6)
   │           header-first: archive browsable immediately
   ▼
[Cutover]  imap_delta_check closes gap → send_as_aliases default set
```

### 7.3 What already exists vs. what's new

| Piece | Status |
| --- | --- |
| Special-use detection | ✅ `folder.rs` |
| `labels.imap_folder_path` column | ✅ schema |
| `folder_sync_state` checkpoint | ✅ schema |
| `syncStore` for progress | ✅ exists |
| Resumable-sync columns on `folder_sync_state` (`sync_phase`, `last_error`, `retry_count`, `is_paused`) | ✅ §6.1 — migration `019_sync_migration.sql` + `folder_sync_state.rs` helpers |
| `sync_jobs` table + commands | ✅ §6.2 — migration `019`, `db/tables/core/sync_jobs.rs`, 5 commands |
| `sync_conflicts` table + commands | ✅ §6.3 — migration `019`, `db/tables/core/sync_conflicts.rs`, 3 commands |
| Drag/select mapping screen + live preview | 🆕 §7.2 (frontend, next) |
| Deselect-to-skip wiring into backfill | 🆕 §3 Step 2 (frontend, next) |

---

### Bottom line

SMEMaster already has most of the hard parts for seamless email migration:
a local-first store, a real IMAP engine with delta sync + special-use folder
detection, an OAuth layer with silent refresh, and a `folder_sync_state`
checkpoint. The work left is **product glue** (resume wiring, mapping UI, MS
Graph frontend) and **test coverage**, not new architecture. Sections 6–7 above
turn the two open questions from the original draft — *the resumable sync data
model* and *the folder-mapping user story* — into concrete, schema-aligned
specs that drop into the code that's already in `src-tauri/src/imap/` and
`src/shared/services/db/schema.sql`.
