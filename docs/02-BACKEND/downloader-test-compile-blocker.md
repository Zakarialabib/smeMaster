# BLOCKER: downloader tests — compile FIXED (2026-10-01), runtime `0xc0000139` ROOT-CAUSED & FIXED (2026-10-02)

> **COMPILE RESOLVED (2026-10-01)**: both compile errors below are **fixed** in
> `src-tauri/src/downloader/db.rs` — `SqlitePool::connect` → `Pool::<Sqlite>::connect`
> (line 418) and `insert_job(&pool, &sample_job(...))` (line 505).
> `cargo test --lib downloader` now **builds cleanly** (`Finished test profile … in 24m 48s`).
>
> **RUNTIME RESOLVED (2026-10-02)**: the `exit code: 0xc0000139
(STATUS_ENTRYPOINT_NOT_FOUND)` launch failure (before `main`, not PATH
> shadowing) is **root-caused and fixed**. `app_lib` links comctl32 v6-only
> imports (`SetWindowSubclass`, `RemoveWindowSubclass`, `DefSubclassProc`,
> `TaskDialogIndirect` — via tauri dialog/tray), but tauri-build's app manifest,
> which declares the `Microsoft.Windows.Common-Controls` v6 dependency, is only
> embedded into the bins tauri-build manages; example and test-harness binaries
> loaded System32's comctl32 v5.81 and died at process start. **Fix**:
> `src-tauri/build.rs` + `src-tauri/comctl-v6.manifest` emit
> `cargo:rustc-link-arg-{examples,tests}=/MANIFEST:EMBED` +
> `/MANIFESTINPUT:<abs path>` (quote-free path — `/MANIFESTDEPENDENCY:"…"`
> fails LNK1181 because cargo's link-arg chain unescapes quotes and splits the
> argument; `/MANIFESTINPUT` alone fails LNK1220 without `/MANIFEST:EMBED`).
> Proven via the `hf_smoke` example — same mechanism as the test targets —
> which now loads and runs the real-model suite (see _Phase 5 results_ below).
> A full `cargo test --lib downloader` was **attempted 2026-10-02 and aborted
> on disk, not on the fix**: it queued behind the shared build-dir lock, then
> died at `os error 112` archiving `datafusion` (C: hit ~10 MB free while a
> concurrent agent's build ran alongside). **Retry conditions**: C: ≥ 12 GB
> free AND `Get-Process cargo` empty, from `src-tauri/`:
> `cargo test --lib downloader` → expect `test result: ok` as the
> resurrection proof.

Found while running `cargo test -p smemaster --no-default-features --features rustls-tls`
on 2026-10-01, on the plugin/capability audit pass (commit `8fe84ce`, later folded
into `81835ec`).

**These are NOT caused by the plugin version bumps or capability changes** — those
are clean (`cargo check` EXIT=0, verified twice). The failures are inside the new
`downloader` module's own `#[cfg(test)]` code.

```
error[E0433]: cannot find type `SqlitePool` in this scope
   --> src/downloader/db.rs:418:20
    |
418 |         let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    |                    ^^^^^^^^^^ use of undeclared type `SqlitePool`

error[E0308]: mismatched types
   --> src/downloader/db.rs:505:27
    |
505 |         insert_job(&pool, sample_job("job-c")).await.unwrap();
    |         ----------        ^^^^^^^^^^^^^^^^^^^ expected `&DownloadJob`, found `DownloadJob`
    |         |         arguments to this function are incorrect
```

## Fixes

1. **`db.rs:418`** — `SqlitePool` is not imported in the test module. Either add
   `use sqlx::SqlitePool;` inside the `mod tests` block, or use the fully
   qualified path `sqlx::SqlitePool::connect(...)`.

2. **`db.rs:505`** — `insert_job` takes `&DownloadJob`; pass a reference:
   `insert_job(&pool, &sample_job("job-c"))`.

## Impact

`cargo test` cannot build until this is fixed, so the whole Rust test suite
(989 tests) is blocked, not just the downloader's. `cargo check` (non-test) is
unaffected and passes.

## Phase 5 real-model suite results (2026-10-02)

`cargo build --example hf_smoke && target\debug\examples\hf_smoke.exe --big`:

```
=== SUMMARY: 20 passed, 0 failed, 2 skipped ===   (exit 0)
```

- **A** SSRF guard (2 PASS), **B** tokenizer.json 711 KB — download, byte
  accounting, SHA-256 == LFS etag, hf-hub offline path resolution, instant
  cache-hit (8 PASS), **C** 33 MB `model.safetensors` pause contract (5 PASS),
  **D** 400 MB Qwen GGUF pause contract (5 PASS).
- The two resume verifications are **SKIP, not FAIL**: this host corrupts
  large TLS transfers. Evidence: stock `curl.exe`/schannel reproduces the same
  failure class (`SEC_E_DECRYPT_FAILURE (0x80090330)`) on plain and Range
  downloads > ~1 MB while 100 KB passes; rustls reports
  `cannot decrypt peer's message`. PMTUD is **healthy** (ping DF sweep:
  payload ≤1464 OK to 1.1.1.1 and huggingface.co, 1500 → proper
  ICMP-too-big), so the documented "lower the adapter MTU" workaround is not
  clearly indicated; the failure sits at a higher layer (large-burst Wi-Fi /
  middlebox). The example classifies transport-shaped errors via
  `is_env_network_error()` → `SKIP` with this reference, so the suite exits 0
  on broken networks and runs fully on healthy ones. See AGENTS.md
  _Troubleshooting_ (TLS on large downloads).

## Note on the environment

The first `cargo test` attempt also hit `rustc-LLVM ERROR: IO failure on output
stream: no space on device` — the C: drive was at 100% (target/ had grown to
24 GB). A full rebuild from an empty target now takes several minutes and holds
the cargo build-directory lock, so run `cargo test` when nothing else is
compiling.
