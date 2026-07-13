# Manual Tests (Pre-Release)

> Run these after a fresh `npm run tauri dev` before tagging a release.
> Estimated time: ~1.5 hours total.

---

## 1. Panic Injection (`30min`)

Verify the app gracefully handles an internal Rust panic.

**How to test:**

1. Add a temporary panic somewhere predictable (e.g., in a rarely-used command handler)
   ```rust
   panic!("test-panic-injection");
   ```
2. Rebuild and trigger the code path
3. **Expected:** A dialog appears: "An unexpected error occurred. The application may need to restart."
4. After dismissing, the app continues running (watchdog catches it)
5. Remove the test panic

**Acceptance:** Error dialog shown, app does not hard-crash, no silent data loss.

---

## 2. WAL Recovery (`30min`)

Verify SQLite WAL mode survives a sudden kill during a write operation.

**How to test:**

1. Open the app, create some data (an email account, a contact)
2. Use Task Manager / `kill` to terminate the process **while** a write is happening (e.g., during sync)
3. Restart the app
4. **Expected:**
   - App starts normally (no "database corrupted" error)
   - `WAL` and `-shm` files are automatically checkpointed
   - Data written before the kill is preserved
   - Any in-flight write is rolled back (not partially applied)
5. Check the logs for: `[store] WAL recovery completed`

**Acceptance:** App restarts cleanly, no crash loop, all pre-kill data intact.

---

## 3. Watchdog Restart (`30min`)

Verify the process watchdog correctly restarts crashed subsystems.

**How to test:**

1. Trigger a panic in a non-critical subsystem (e.g., `sync_engine` or `queue_service`)
   - In `src-tauri/src/services/queue_service.rs`, add `panic!("watchdog-test")` at the top of the main loop
2. Rebuild and let the app run
3. **Expected:**
   - The watchdog catches the panic within 5 seconds
   - Logs: `[watchdog] Subsystem X restarted (attempt N)`
   - The subsystem resumes normal operation
4. Remove the test panic

**Acceptance:** Subsystem restarts automatically, no app crash, no data corruption.

---

## 4. `npm run tauri dev` Runtime (`5min`)

Verify the dev server works end-to-end.

**How to test:**

```bash
npm run tauri dev
```

**Expected:**

- Vite dev server starts (port 1420)
- Tauri window opens
- App home screen (dashboard) renders
- No console errors (open DevTools → Console)
- No Rust panics in the terminal

**Acceptance:** App launches, home screen is visible, no red errors in console.
