//! Real-network smoke test for the resumable HuggingFace downloader.
//!
//! Phase 5 of the resumable-downloader workstream: this example drives the
//! **actual** production code paths (`download_hf_file_cached`, the chunked
//! engine, the SQLite job/chunk persistence, the hf-hub cache finalize)
//! against **real** HuggingFace models — no Tauri app, no UI, no mocks.
//!
//! It is the real-network vehicle complementing `cargo test` (which covers
//! offline/unit paths). The historical `0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND`
//! harness blocker is fixed by `build.rs` embedding the comctl32 v6 manifest
//! into test and example binaries; this example additionally proves what unit
//! tests cannot: actual bytes over the wire.
//!
//! What it proves:
//!   A. SSRF guard (`validate_url`) rejects loopback, accepts huggingface.co
//!   B. Small file (BAAI/bge-small-en-v1.5/tokenizer.json): download,
//!      job-row byte accounting, SHA-256 == job.actual_sha256, hf-hub
//!      offline resolution, instant cache-hit re-call
//!   C. 33 MB `model.safetensors`: cooperative pause → `Err("Download paused")`
//!      with bytes + chunk rows persisted, then resume-from-chunks →
//!      Completed with SHA-256 == LFS etag == actual_sha256
//!   D. `--big`: same pause/resume contract on a ~400 MB Qwen GGUF
//!
//! Exit code: 0 = no FAIL (SKIPs are allowed for environment-blocked
//! coverage — e.g. a host whose network corrupts large TLS transfers,
//! documented in AGENTS.md), 1 = at least one FAIL or a hard error.

use anyhow::{anyhow, Context, Result};
use app_lib::downloader::commands::validate_url;
use app_lib::downloader::db;
use app_lib::downloader::engine::EngineContext;
use app_lib::downloader::hf;
use app_lib::downloader::types::JobStatus;
use app_lib::downloader::{download_hf_file_cached, DownloaderState};
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};
use std::io::Read;
use std::path::Path;
use std::time::{Duration, Instant};

// ── Result tracking ─────────────────────────────────────────────────────────

struct Suite {
    passed: u32,
    failed: u32,
    skipped: u32,
}

impl Suite {
    fn new() -> Self {
        Self {
            passed: 0,
            failed: 0,
            skipped: 0,
        }
    }

    fn check(&mut self, name: &str, ok: bool) {
        if ok {
            self.passed += 1;
            println!("PASS: {name}");
        } else {
            self.failed += 1;
            println!("FAIL: {name}");
        }
    }

    fn skip(&mut self, name: &str, reason: &str) {
        self.skipped += 1;
        println!("SKIP: {name} — {reason}");
    }

    fn summary_and_exit(self) -> ! {
        println!(
            "=== SUMMARY: {} passed, {} failed, {} skipped ===",
            self.passed, self.failed, self.skipped
        );
        if self.failed > 0 {
            std::process::exit(1);
        }
        std::process::exit(0);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Streamed SHA-256 of a file on disk (independent of the engine's hash).
fn sha256_file(path: &Path) -> Result<String> {
    let mut file = std::fs::File::open(path)
        .with_context(|| format!("cannot open {} for hashing", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Sum of on-disk `*.part_chunk_*` bytes next to the destination — the
/// persisted resume offsets a paused job will continue from.
fn partial_chunk_bytes(destination_path: &str) -> u64 {
    let Some(parent) = Path::new(destination_path).parent() else {
        return 0;
    };
    let Ok(rd) = std::fs::read_dir(parent) else {
        return 0;
    };
    rd.flatten()
        .filter(|e| e.file_name().to_string_lossy().contains("part_chunk"))
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// Transport-shaped failures that mean the *host network* broke the TLS
/// stream, not our code. This machine is documented in AGENTS.md as failing
/// large transfers (`SEC_E_DECRYPT_FAILURE` — reproduced independently with
/// stock `curl.exe`/schannel; PMTUD itself is healthy per a ping DF sweep).
/// Such failures downgrade coverage to SKIP, never FAIL; logic/DB/sha
/// mismatches still FAIL.
fn is_env_network_error(msg: &str) -> bool {
    const MARKERS: [&str; 9] = [
        "cannot decrypt",
        "sec_e_decrypt_failure",
        "error reading a body from connection",
        "error decoding response body",
        "connection closed",
        "connection reset",
        "broken pipe",
        "operation timed out",
        "unexpected eof",
    ];
    let m = msg.to_ascii_lowercase();
    MARKERS.iter().any(|k| m.contains(k))
}

/// Full terminal-state verification: status, byte accounting, local SHA-256
/// vs the DB rows, and hf-hub offline resolution of the snapshot path.
async fn verify_completed(
    suite: &mut Suite,
    pool: &Pool<Sqlite>,
    cache: &Path,
    repo: &str,
    filename: &str,
    path: &str,
    require_lfs_etag: bool,
) -> Result<()> {
    let label = format!("[{filename}]");
    let url = hf::resolve_url(repo, filename, "main");
    let job = db::get_latest_job_by_url(pool, &url)
        .await?
        .ok_or_else(|| anyhow!("no job row for {url}"))?;

    suite.check(
        &format!("{label} job status == Completed"),
        job.status == JobStatus::Completed,
    );

    let len = std::fs::metadata(path)
        .with_context(|| format!("missing downloaded file {path}"))?
        .len() as i64;
    suite.check(
        &format!(
            "{label} file size ({len}) == job total_bytes ({}) == downloaded_bytes ({})",
            job.total_bytes, job.downloaded_bytes
        ),
        len > 0 && len == job.total_bytes && len == job.downloaded_bytes,
    );

    let sha = sha256_file(Path::new(path))?;
    println!(
        "{label} sha256: local={sha} actual={:?} expected={:?}",
        job.actual_sha256, job.expected_sha256
    );
    suite.check(
        &format!("{label} job.actual_sha256 == locally computed sha256"),
        job.actual_sha256.as_deref() == Some(sha.as_str()),
    );
    let etag_ok = job
        .expected_sha256
        .as_deref()
        .map(|e| e.len() == 64 && e.eq_ignore_ascii_case(&sha))
        .unwrap_or(false);
    if require_lfs_etag {
        suite.check(
            &format!("{label} job.expected_sha256 (LFS etag) == locally computed sha256"),
            etag_ok,
        );
    } else {
        suite.check(
            &format!(
                "{label} job.expected_sha256 matches local sha (or is a non-LFS git oid: {:?})",
                job.expected_sha256
            ),
            etag_ok || job.expected_sha256.is_none(),
        );
    }

    // hf-hub offline contract: CacheRepo::get() must resolve the very path
    // we downloaded, with zero network I/O.
    let hf_cache = hf_hub::Cache::new(cache.to_path_buf());
    let resolved = hf_cache
        .repo(hf_hub::Repo::new(
            repo.to_string(),
            hf_hub::RepoType::Model,
        ))
        .get(filename);
    println!("{label} hf-hub CacheRepo::get → {resolved:?}");
    suite.check(
        &format!("{label} hf-hub offline resolution == downloaded path"),
        resolved.as_deref() == Some(Path::new(path)),
    );
    Ok(())
}

/// Steps C & D: pause a real in-flight download from a flipper task, prove
/// the cooperative pause contract, then resume to a fully verified file.
async fn pause_resume_case(
    suite: &mut Suite,
    state: &DownloaderState,
    pool: &Pool<Sqlite>,
    cache: &Path,
    repo: &str,
    filename: &str,
) -> Result<()> {
    let label = format!("[{filename}]");
    let url = hf::resolve_url(repo, filename, "main");

    // Flipper: poll the job row every 50 ms; the moment real bytes are
    // persisted (first DB flush — 800 ms in the chunked engine), flip the
    // status to Paused so the engine's cooperative check aborts its streams.
    let fpool = pool.clone();
    let furl = url.clone();
    let flip = tokio::spawn(async move {
        let deadline = Instant::now() + Duration::from_secs(120);
        while Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(50)).await;
            let Ok(Some(job)) = db::get_latest_job_by_url(&fpool, &furl).await else {
                continue;
            };
            if job.status == JobStatus::Completed {
                return "completed_before_pause".to_string();
            }
            let bytes_partial = job.downloaded_bytes > 0
                && (job.total_bytes <= 0 || job.downloaded_bytes < job.total_bytes);
            if bytes_partial
                && matches!(
                    job.status,
                    JobStatus::Downloading | JobStatus::Probing | JobStatus::Queued
                )
            {
                // Guard against a status check/read race: never pause a row
                // that is no longer active.
                let _ = db::update_job_status(&fpool, &job.id, JobStatus::Paused, None, None).await;
                return "paused".to_string();
            }
        }
        "flipper_timeout".to_string()
    });

    let t0 = Instant::now();
    let first = download_hf_file_cached(state, cache, repo, filename).await;
    let first_elapsed = t0.elapsed();
    let outcome = flip
        .await
        .unwrap_or_else(|e| format!("flipper-join-error: {e}"));
    println!(
        "{label} first attempt finished in {first_elapsed:?} (flipper: {outcome})"
    );

    let job = match first {
        Ok(path) => {
            // Known race: the whole file landed before the first 800 ms DB
            // flush, so no pause could ever be observed. Not a failure.
            suite.skip(
                &format!("{label} cooperative pause → Err(\"Download paused\")"),
                &format!(
                    "download finished in {first_elapsed:?} before a pause could land \
                     (flipper: {outcome}); verifying the full download instead"
                ),
            );
            verify_completed(suite, pool, cache, repo, filename, &path, true).await?;
            return Ok(());
        }
        Err(e) if e == "Download paused" => {
            suite.check(
                &format!("{label} pause path returned Err(\"Download paused\")"),
                true,
            );
            db::get_latest_job_by_url(pool, &url)
                .await?
                .ok_or_else(|| anyhow!("no job row for {url}"))?
        }
        Err(e) if is_env_network_error(&e) => {
            suite.skip(
                &format!("{label} cooperative pause → Err(\"Download paused\")"),
                &format!(
                    "host network broke the TLS stream before a pause could land ({e}); \
                     see AGENTS.md Troubleshooting"
                ),
            );
            return Ok(());
        }
        Err(e) => {
            suite.check(
                &format!("{label} pause path returned Err(\"Download paused\")"),
                false,
            );
            println!("{label} unexpected error instead: {e}");
            return Ok(());
        }
    };

    // ── Pause proof: row is Paused, bytes and chunk rows are persisted ────
    suite.check(
        &format!("{label} job status == Paused after pause"),
        job.status == JobStatus::Paused,
    );
    suite.check(
        &format!("{label} downloaded_bytes ({}) > 0 at pause", job.downloaded_bytes),
        job.downloaded_bytes > 0,
    );
    let chunks = db::get_chunks(pool, &job.id).await?;
    suite.check(
        &format!("{label} chunk rows persisted ({})", chunks.len()),
        !chunks.is_empty(),
    );
    let parts = partial_chunk_bytes(&job.destination_path);
    suite.check(
        &format!("{label} partial chunk bytes on disk ({parts}) > 0"),
        parts > 0,
    );
    println!(
        "{label} PAUSE PROOF: {}/{} bytes persisted, {} chunk rows, {parts} part-file bytes on disk",
        job.downloaded_bytes, job.total_bytes, chunks.len()
    );

    // ── Resume: identical args → must complete from persisted chunks ──────
    let t1 = Instant::now();
    let resumed = match download_hf_file_cached(state, cache, repo, filename).await {
        Ok(p) => p,
        Err(e) if is_env_network_error(&e) => {
            suite.skip(
                &format!("{label} resume → Completed + SHA-256 == LFS etag verified"),
                &format!(
                    "host network broke the TLS stream mid-transfer ({e}) — environment, \
                     not code: stock curl.exe reproduces with SEC_E_DECRYPT_FAILURE; \
                     see AGENTS.md Troubleshooting"
                ),
            );
            return Ok(());
        }
        Err(e) => return Err(anyhow!("{label} resume failed: {e}")),
    };
    let resume_elapsed = t1.elapsed();
    println!(
        "{label} resume finished in {resume_elapsed:?} → {resumed} \
         (paused at {} / {} bytes)",
        job.downloaded_bytes, job.total_bytes
    );
    verify_completed(suite, pool, cache, repo, filename, &resumed, true).await?;
    Ok(())
}

/// Step D: resolve the actual GGUF filename from the HF model API.
async fn pick_qwen_gguf(client: &reqwest::Client) -> Result<String> {
    let api = "https://huggingface.co/api/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF";
    let v: serde_json::Value = client
        .get(api)
        .send()
        .await
        .with_context(|| format!("GET {api}"))?
        .error_for_status()?
        .json()
        .await
        .context("parsing HF model API response")?;

    let names: Vec<String> = v
        .get("siblings")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| s.get("rfilename").and_then(|n| n.as_str()))
                .map(String::from)
                .filter(|n| n.to_lowercase().ends_with(".gguf"))
                .collect()
        })
        .unwrap_or_default();

    if let Some(hit) = names.iter().find(|n| n.to_lowercase().contains("q4_k_m")) {
        return Ok(hit.clone());
    }
    names
        .into_iter()
        .next()
        .ok_or_else(|| anyhow!("no *.gguf sibling listed by {api}"))
}

// ── Main ────────────────────────────────────────────────────────────────────

async fn run() -> Result<()> {
    // reqwest is declared with `rustls-no-provider` in Cargo.toml; the main
    // app installs the ring provider (lib.rs) before any Client is built —
    // the example must do the same or `Client::builder().build()` panics.
    let _ = rustls::crypto::ring::default_provider().install_default();

    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init()
        .ok();

    let base = std::env::temp_dir().join(format!("smemaster-hf-smoke-{}", std::process::id()));
    let cache = base.join("models");
    std::fs::create_dir_all(&cache)?;
    println!("hf_smoke base dir : {}", base.display());
    println!("hf_smoke cache root: {}", cache.display());

    let pool = db::memory_pool_with_migrations().await?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .user_agent("SMEMaster-hf_smoke/1.0")
        .build()?;
    // `app: None` → the engine skips Tauri event emission (no UI here).
    let state = DownloaderState {
        engine: EngineContext {
            pool: pool.clone(),
            client: client.clone(),
            app: None,
        },
    };

    let mut suite = Suite::new();

    // ── Step A: SSRF guard sanity ──────────────────────────────────────────
    let a1 = validate_url("http://127.0.0.1:8000/x");
    println!("A: validate_url(\"http://127.0.0.1:8000/x\") → {a1:?}");
    suite.check("A: SSRF guard rejects loopback URL", a1.is_err());
    let a2 = validate_url("https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/x");
    println!("A: validate_url(\"https://huggingface.co/...\") → {a2:?}");
    suite.check("A: validate_url accepts huggingface.co", a2.is_ok());

    // ── Step B: small file (tokenizer.json) ────────────────────────────────
    const REPO: &str = "BAAI/bge-small-en-v1.5";
    const TOK: &str = "tokenizer.json";

    let tb = Instant::now();
    let path = download_hf_file_cached(&state, &cache, REPO, TOK)
        .await
        .map_err(|e| anyhow!("B: tokenizer.json download failed: {e}"))?;
    let b_elapsed = tb.elapsed();
    println!("B: downloaded {TOK} in {b_elapsed:?} → {path}");

    let tok_len = std::fs::metadata(&path)
        .with_context(|| format!("B: file missing at {path}"))?
        .len();
    suite.check(
        &format!("B: downloaded file exists with size > 0 ({tok_len} bytes)"),
        tok_len > 0,
    );
    verify_completed(&mut suite, &pool, &cache, REPO, TOK, &path, false).await?;

    // Cache-hit re-call: pure fs check, must be instant and return the
    // exact same path.
    let t_hit = Instant::now();
    let path2 = download_hf_file_cached(&state, &cache, REPO, TOK)
        .await
        .map_err(|e| anyhow!("B: cache-hit re-call failed: {e}"))?;
    let hit_elapsed = t_hit.elapsed();
    suite.check(
        "B: cache-hit re-call returns the same path",
        path2 == path,
    );
    suite.check(
        &format!("B: cache-hit re-call instant ({hit_elapsed:?} < 1s)"),
        hit_elapsed < Duration::from_secs(1),
    );

    // ── Step C: pause/resume on model.safetensors (~33 MB) ─────────────────
    pause_resume_case(&mut suite, &state, &pool, &cache, REPO, "model.safetensors").await?;

    // ── Step D: --big → pause/resume on a ~400 MB Qwen GGUF ────────────────
    if std::env::args().any(|a| a == "--big") {
        const QWEN: &str = "Qwen/Qwen2.5-0.5B-Instruct-GGUF";
        let gguf = pick_qwen_gguf(&client).await?;
        println!("D: chosen GGUF file: {gguf}");
        pause_resume_case(&mut suite, &state, &pool, &cache, QWEN, &gguf).await?;
    } else {
        suite.skip("D: Qwen GGUF ~400MB pause/resume", "--big not passed");
    }

    // Temp cache is disposable — but keep it for diagnosis when a check failed.
    if suite.failed == 0 {
        match std::fs::remove_dir_all(&base) {
            Ok(()) => println!("cleaned up {}", base.display()),
            Err(e) => println!("cleanup of {} skipped: {e}", base.display()),
        }
    } else {
        println!("keeping {} for diagnosis", base.display());
    }

    suite.summary_and_exit()
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("FATAL: {e:#}");
        std::process::exit(1);
    }
}
