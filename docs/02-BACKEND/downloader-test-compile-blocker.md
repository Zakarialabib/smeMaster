# BLOCKER: `src-tauri/src/downloader/db.rs` unit tests do not compile — RESOLVED (compile), runtime still blocked on this host

> **RESOLUTION (2026-10-01)**: both compile errors below are **fixed** in
> `src-tauri/src/downloader/db.rs` — `SqlitePool::connect` → `Pool::<Sqlite>::connect`
> (line 418) and `insert_job(&pool, &sample_job(...))` (line 505).
> `cargo test --lib downloader` now **builds cleanly** (`Finished test profile … in 24m 48s`).
>
> **Still blocked**: the test binary cannot _launch_ on this host —
> `exit code: 0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` at process init (before `main`),
> reproduced with a direct exe launch and with a stripped `PATH`
> (`$env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"`). Not PATH shadowing;
> intrinsic host/toolchain linkage issue. Per the session playbook: rely on
> `cargo check` (green, 0 warnings) + real-model verification for now, and treat
> `cargo test` as CI-only until the host environment is diagnosed.

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

## Note on the environment

The first `cargo test` attempt also hit `rustc-LLVM ERROR: IO failure on output
stream: no space on device` — the C: drive was at 100% (target/ had grown to
24 GB). A full rebuild from an empty target now takes several minutes and holds
the cargo build-directory lock, so run `cargo test` when nothing else is
compiling.
