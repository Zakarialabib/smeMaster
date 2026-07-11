# Manual Test Procedures

> **Audience:** Developers running pre-release validation.
> **Applies to:** Tauri v2 desktop build (Rust backend + React/TypeScript frontend).
> **Last updated:** 2026-07-07

---

## Table of Contents

1. [Panic Injection Test](#1-panic-injection-test)
2. [WAL Recovery Test](#2-wal-recovery-test)
3. [WAL Deletion Behavior](#3-wal-deletion-behavior)
4. [Watchdog Restart Test](#4-watchdog-restart-test)
5. [Runtime Verification](#5-runtime-verification)

---

## 1. Panic Injection Test

### Objective

Verify that when a Rust panic occurs, the global panic hook in `src-tauri/src/lib.rs` captures it, writes a crash dump to `crash.log`, and the application surfaces the error to the user.

### Prerequisites

- Development build running (`npm run tauri dev`)
- Terminal open to watch Rust logs (`stdout` / `stderr`)
- `crash.log` path known:
  - **Windows:** `%APPDATA%\com.smemaster.app\crash.log`
  - **macOS:** `~/Library/Application Support/com.smemaster.app/crash.log`
  - **Linux:** `~/.local/share/com.smemaster.app/crash.log`
  - **Mobile:** `<app data dir>/com.smemaster.app/crash.log`

### Steps

1. **Start the app** with `npm run tauri dev` and let it fully initialise.

2. **Clear any previous crash log** to make verification unambiguous:

   ```powershell
   # Windows example
   Remove-Item "$env:APPDATA\com.smemaster.app\crash.log" -ErrorAction SilentlyContinue
   ```

3. **Trigger a panic** by invoking a backend command that contains a deliberate panic point.  
   The easiest approach — add a **temporary panic** to an existing command handler:

   In `src-tauri/src/commands/db.rs`, find the `db_health` command (or any trivial command) and insert:

   ```rust
   #[tauri::command]
   pub fn db_health(app: tauri::AppHandle) -> Result<DbHealth, String> {
       panic!("MANUAL_TEST_PANIC: intentional panic for crash-log verification");
   }
   ```

   > **Important:** Revert this change after the test.

   Trigger it from the frontend (DevTools console):

   ```js
   await invoke('db_health');
   ```

   Alternatively, if the F/E does not expose the command directly, reload the app so the startup sequence triggers the panic.

### Expected Behaviour

- **Terminal output** shows the panic message including `MANUAL_TEST_PANIC` and a full Rust backtrace.
- **`crash.log` is created/updated** at the platform-specific data directory. Content resembles:
  ```
  Panic: MANUAL_TEST_PANIC: intentional panic for crash-log verification
  Location: src-tauri/src/commands/db.rs:42
  Backtrace:
     0: std::panic::set_hook::{{closure}}
              at ...
     1: smemaster::commands::db::db_health
              at src-tauri/src/commands/db.rs:42
     ...
  ```
- **App behaviour** depends on the Tauri window manager:
  - If the panic occurs on the backend command thread, the command returns an error and the F/E promise rejects — the user sees an error toast/dialog.
  - If the panic occurs on the main thread, the app may show a native crash dialog (OS-dependent).

### Pass / Fail Criteria

| Criteria                                                               | Status   |
| ---------------------------------------------------------------------- | -------- |
| `crash.log` contains the panic message, source location, and backtrace | **PASS** |
| Terminal logs show the panic with `RUST_BACKTRACE=1` detail            | **PASS** |
| Frontend surfaces an error (toast / dialog / console.error)            | **PASS** |
| `crash.log` absent or empty                                            | **FAIL** |
| App hangs indefinitely without error feedback                          | **FAIL** |

### Cleanup

- **Revert the temporary panic** in `src-tauri/src/commands/db.rs`.
- Delete the test `crash.log` if desired.

---

## 2. WAL Recovery Test

### Objective

Verify that an abrupt termination (kill / crash) during a database write does **not** corrupt data. SQLite's WAL mode replays committed transactions on the next connection open.

### Prerequisites

- App running with `npm run tauri dev`
- A write-heavy operation available (e.g., email sync, campaign insertion, contact import)
- Knowledge of the SQLite database location:
  - **Desktop:** `<data_dir>/com.smemaster.app/smemaster.db`
  - Adjacent `-wal` and `-shm` files appear during writes.

### Steps

1. **Note baseline record counts** for a table that will receive writes.  
   Using the Tauri CLI or a direct query (example uses `sqlite3`):

   ```bash
   sqlite3 "$(echo $APPDATA)/com.smemaster.app/smemaster.db"
   SQLite> SELECT COUNT(*) FROM emails;
   SQLite> .quit
   ```

2. **Start a write operation** that takes several seconds — for example:
   - Trigger a full IMAP sync against an account with many messages.
   - Or run a bulk contact import via the UI.

3. **While the operation is in progress** (before the progress indicator finishes), **kill the app**:
   - **Desktop:** Close the window or kill the process (e.g., `taskkill /F /IM smemaster.exe` or `SIGKILL`).
   - **Mobile:** Swipe the app away from the recents screen or force-stop via system settings.

4. **Restart the app** with `npm run tauri dev`.

5. **Verify data integrity:**
   - Re-count the table used in step 1: `SELECT COUNT(*) FROM emails;`
   - The count should be **greater than or equal to** the baseline (committed rows survive).
   - Run a quick sanity check:
     ```sql
     PRAGMA integrity_check;
     -- Expected: 'ok'
     ```

6. **Check WAL file status:**
   - After restart, the `-wal` file should be **smaller or absent** — SQLite replays (checkpoints) the WAL on first connection.
   - Run a manual checkpoint to confirm:
     ```sql
     PRAGMA wal_checkpoint(TRUNCATE);
     ```
     Expected result: `0|N|0` (busy=0, checkpointed N pages, truncated).

### Expected Behaviour

- WAL replay is **automatic and transparent** — the app starts normally without corruption errors.
- All transactions that completed before the kill are present.
- Any transaction that was in-flight at kill time is rolled back (the DB is never left in a half-written state).

### Pass / Fail Criteria

| Criteria                                                      | Status   |
| ------------------------------------------------------------- | -------- |
| App starts without SQLite corruption errors in the console    | **PASS** |
| `PRAGMA integrity_check` returns `ok`                         | **PASS** |
| Record count is at least the pre-kill baseline                | **PASS** |
| `-wal` file is checkpointed after restart (size ~0 or absent) | **PASS** |
| App shows corruption dialog or fails to load DB               | **FAIL** |
| Record count is **less** than the baseline                    | **FAIL** |

---

## 3. WAL Deletion Behavior

### Objective

Document and verify the effect of manually deleting the SQLite WAL (`-wal`) and shared-memory (`-shm`) files while the app is **stopped**.

### Prerequisites

- App fully closed (no `smemaster` process running)
- Database directory accessible (see section 2 for path)

### Steps

1. **Close the app** completely. Verify no process remains:

   ```powershell
   Get-Process smemaster -ErrorAction SilentlyContinue
   ```

2. **Note the current state** of WAL files:

   ```powershell
   Get-ChildItem "$env:APPDATA\com.smemaster.app\" -Filter smemaster.db*
   ```

   Expected output shows `smemaster.db`, `smemaster.db-wal`, `smemaster.db-shm` (the latter two may be absent if fully checkpointed).

3. **Delete the WAL and SHM files**:

   ```powershell
   Remove-Item "$env:APPDATA\com.smemaster.app\smemaster.db-wal"
   Remove-Item "$env:APPDATA\com.smemaster.app\smemaster.db-shm"
   ```

4. **Start the app** with `npm run tauri dev`.

5. **Verify behaviour:**
   - The app starts normally — SQLite creates fresh empty `-wal` and `-shm` files on the first write connection.
   - Run `PRAGMA integrity_check;` to confirm the main DB file is still consistent.
   - Run application-level smoke checks: navigate between screens, load existing data.

### Expected Behaviour

- **If all writes were checkpointed** before deletion: no data loss. The main `smemaster.db` contains the complete state.
- **If uncheckpointed writes existed** in the deleted WAL: those writes are **permanently lost**. The DB is still consistent at the last checkpoint — no corruption, but data may be missing.
- The risk is **low for read-heavy workloads** (periodic syncs) and **moderate for write-heavy workloads** (bulk imports with long transactions).

### Recovery

| Scenario                                | Recovery Action                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Only WAL/SHM deleted, main DB intact    | No action needed — DB is consistent at last checkpoint. Re-run any interrupted operations (resync, reimport). |
| Main DB also deleted                    | Restore from backup (see `backup_restore.rs`).                                                                |
| App reports missing data after deletion | Re-sync the affected accounts or re-import the affected data.                                                 |

### Pass / Fail Criteria

| Criteria                                             | Status   |
| ---------------------------------------------------- | -------- |
| App starts without SQLite errors                     | **PASS** |
| `PRAGMA integrity_check` returns `ok`                | **PASS** |
| New `-wal` / `-shm` files are created on first write | **PASS** |
| App crashes or reports database corruption           | **FAIL** |

> **Note:** This test is informational — it documents the system's resilience boundaries. The watchdog subsystem in `src-tauri/src/orchestrator/watchdog.rs` does **not** monitor WAL file presence; that is left to SQLite's own recovery mechanisms.

---

## 4. Watchdog Restart Test

### Objective

Verify that the `Watchdog` (defined in `src-tauri/src/orchestrator/watchdog.rs`) correctly detects a failed service and executes the retry/backoff restart sequence.

### Prerequisites

- App running with `npm run tauri dev`
- Terminal open to watch Rust logs (watchdog logs lines containing `[Watchdog]`)
- A critical service that the watchdog monitors (e.g., the IMAP sync engine)
- Understanding of watchdog configuration:
  - Poll interval: **30 seconds**
  - Phase 1: Service health — `Degraded` → warning log, `Failed` → `attempt_restart()`
  - Phase 2: Subsystem health — failed → `require_active()` retry
  - Retry backoff: **1s, 2s, 4s** (3 attempts total, ~7 seconds worst case)

### Steps

1. **Confirm watchdog is running** — tail the logs and look for a line similar to:

   ```
   [Watchdog] Poll cycle starting — 5 services, 3 subsystems
   ```

2. **Induce a failure in a monitored service.**  
   The cleanest approach for a manual test — **stub the service health check** to return `Failed`.  
   In `src-tauri/src/orchestrator/watchdog.rs`, locate the service health-check logic and temporarily inject:

   ```rust
   // Temporary: force Degraded then Failed
   fn check_service_health(&self, name: &str) -> Health {
       if name == "sync_engine" {
           return Health::Failed("simulated failure for manual test".into());
       }
       // ... original logic
   }
   ```

   > **Important:** Revert this change after the test.

   Alternatively, if the sync engine connects to a real IMAP server, **cut network access** or **revoke the account credentials** so the sync task fails repeatedly.

3. **Wait for the next poll cycle** (up to 30 seconds). Watch logs for:

   ```
   [Watchdog] Service 'sync_engine' is Degraded: ...
   [Watchdog] Service 'sync_engine' is Failed: ..., attempting restart (attempt 1/3)
   ```

4. **Observe restart attempts:**
   - Log line showing attempt 1, then a 1-second delay.
   - If still failed: attempt 2 after 2-second delay.
   - If still failed: attempt 3 after 4-second delay.
   - Total backoff window: **~7 seconds**.

5. **Verify recovery.** Restore the service health (revert the stub or re-enable network access). Wait for the next poll cycle. Logs should show:
   ```
   [Watchdog] Service 'sync_engine' is Healthy
   ```

### Expected Behaviour

- Watchdog polls every 30 seconds (± small scheduler drift).
- `Degraded` state produces a **warning** but no automatic action.
- `Failed` state triggers `attempt_restart()` with exponential backoff (1s, 2s, 4s).
- After 3 failed retries, the watchdog logs an escalation message but does **not** crash the app.
- When the service recovers, the next poll cycle reports `Healthy`.

### Pass / Fail Criteria

| Criteria                                                                | Status   |
| ----------------------------------------------------------------------- | -------- |
| Watchdog log line appears within 35 seconds of app start                | **PASS** |
| Degraded service logs a warning                                         | **PASS** |
| Failed service triggers `attempt_restart()` with correct backoff timing | **PASS** |
| Service returns to `Healthy` after failure is resolved                  | **PASS** |
| No watchdog output appears for 60+ seconds                              | **FAIL** |
| Restart attempts fire without delay (ignoring backoff)                  | **FAIL** |
| App crashes when all retries are exhausted                              | **FAIL** |

### Cleanup

- **Revert any temporary stub** in `watchdog.rs`.
- Re-enable network / restore test credentials if applicable.

---

## 5. Runtime Verification

### Objective

Confirm that the application boots cleanly, all subsystems initialise, and there are no console-level errors before any feature testing begins.

### Prerequisites

- Clean build: `npm run tauri build` (or `npm run tauri dev` for development)
- No previous crash log present (optional but recommended)

### Steps

1. **Start the app:**

   ```bash
   npm run tauri dev
   ```

2. **Watch the terminal output** during startup. Expect in order:
   - Rust compiler output (if not pre-built) — no errors.
   - Tauri window opened log.
   - Database migration log: `[DB] Running migrations...`, `[DB] Migrations complete`.
   - Sync engine initialisation: `[Sync] Engine started for account <id>`.
   - Watchdog start: `[Watchdog] Poll cycle starting`.
   - Frontend bundle loaded — no 404s for assets.

3. **Open DevTools** (right-click → Inspect, or `Ctrl+Shift+I`) and check the **Console** tab:
   - No uncaught errors (red).
   - No network request failures to `tauri://` or `asset://` endpoints.
   - No React `StrictMode` double-effect warnings unless expected.

4. **Verify the UI renders:**
   - Main layout appears (sidebar + content area).
   - Account list loads (or shows "add account" if fresh).
   - No blank screens or infinite spinners.

5. **Quick database health check** via the Tauri CLI (or a console command):
   ```js
   // In DevTools console
   const health = await window.__TAURI__.invoke('db_health');
   console.log('DB Health:', health);
   ```
   Expected output:
   ```
   DB Health: { status: "ok", wal_size_bytes: <number>, connections: 5 }
   ```

### Expected Behaviour

- App window opens within **5 seconds** (development) or **2 seconds** (production build).
- All four startup log markers appear (migrations, sync, watchdog, UI).
- No red errors in DevTools Console.
- Database health returns `status: "ok"` with non-negative `wal_size_bytes`.

### Pass / Fail Criteria

| Criteria                                            | Status   |
| --------------------------------------------------- | -------- |
| Terminal shows no Rust compilation errors           | **PASS** |
| DB migrations log shows completion                  | **PASS** |
| Watchdog log shows poll cycle start                 | **PASS** |
| DevTools Console has zero uncaught errors           | **PASS** |
| UI renders main layout with sidebar + content       | **PASS** |
| `db_health` returns `{ status: "ok", ... }`         | **PASS** |
| Any compilation error or panic during startup       | **FAIL** |
| DevTools shows red uncaught errors                  | **FAIL** |
| UI shows blank screen or persistent loading spinner | **FAIL** |
| `db_health` returns error or times out              | **FAIL** |

---

## Appendix: Key Source Files Referenced

| Component                 | File                                     |
| ------------------------- | ---------------------------------------- |
| Global panic hook         | `src-tauri/src/lib.rs`                   |
| DB health command         | `src-tauri/src/commands/db.rs`           |
| WAL configuration         | `src-tauri/src/db/mod.rs`                |
| WAL backup / restore      | `src-tauri/src/export/backup_restore.rs` |
| Watchdog orchestrator     | `src-tauri/src/orchestrator/watchdog.rs` |
| PGP crypto (catch_unwind) | `src-tauri/src/pgp/crypto.rs`            |
