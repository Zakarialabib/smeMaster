# SQLite WAL Deletion — Behavior & Recovery

> **Applies to:** `smemaster.db-wal` and `smemaster.db-shm` files in the app data directory.
> **Reference:** `docs/05-DEVELOPMENT/03-manual-tests.md` §3 (manual test procedure)
> **Last updated:** 2026-07-09

---

## What Happens When WAL/SHM Files Are Deleted

SQLite's **Write-Ahead Log** (`-wal`) and **Shared Memory** (`-shm`) files are transient — they cache uncheckpointed writes and synchronise reader/writer state. Deleting them while the app is **stopped** is safe; deleting them while the app is **running** can cause data loss.

### Scenario 1: App is Stopped

| Action | Result |
|--------|--------|
| Delete `smemaster.db-wal` | No corruption. The database is consistent at the last checkpoint. **Any uncheckpointed writes in the deleted WAL are permanently lost.** |
| Delete `smemaster.db-shm` | No corruption. SQLite recreates it on next connection. No data loss (SHM is a read-only cache). |
| Delete both | Same as WAL deletion — DB consistent at last checkpoint; uncheckpointed writes lost. |
| Delete `smemaster.db` | **Data loss.** The main database file is the authoritative store. Without it, all data is gone (recoverable only from backup). |

### Scenario 2: App is Running

| Action | Result |
|--------|--------|
| Delete `-wal` during a write | **Potential corruption.** The in-progress write may be lost. SQLite may detect inconsistency on next open and refuse to connect. |
| Delete `-shm` while readers active | Readers may see inconsistent snapshot (stale cache). Next reader recreates it. |

---

## Recovery Steps

### If WAL/SHM deleted while app is stopped:

1. **Start the app normally.** SQLite creates fresh empty `-wal` and `-shm` files on the first write connection.
2. **Re-run any interrupted operations:** re-sync accounts, re-import data, re-send queued messages.
3. **No database repair needed.** The main DB is consistent.

### If WAL/SHM deleted while app is running (or corruption detected):

1. **Stop the app** gracefully.
2. **Run integrity check:**
   ```sql
   PRAGMA integrity_check;
   ```
   (Access via `sqlite3` CLI on the main DB file.)
3. **If integrity_check passes:** Delete the stale `-wal` / `-shm` files (if any remain) and restart.
4. **If integrity_check fails:** Restore from the latest backup (see `backup_restore.rs` / `VACUUM INTO` feature).

---

## Prevention

- The app sets `PRAGMA wal_autocheckpoint=1000` — the WAL is automatically checkpointed every 1000 pages (~4 MB), limiting potential data loss to recent writes.
- On graceful shutdown, `PRAGMA wal_checkpoint(TRUNCATE)` is issued, fully checkpointing and truncating the WAL.
- The watchdog subsystem (`orchestrator/watchdog.rs`) does **not** monitor WAL file presence — SQLite's own recovery mechanisms handle this.
- Backups created via `VACUUM INTO` produce a standalone `.db` file that does not depend on WAL/SHM files.

---

## Verification

See `docs/05-DEVELOPMENT/03-manual-tests.md` §3 for the manual test procedure that validates this behavior end-to-end.
