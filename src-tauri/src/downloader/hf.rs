//! HuggingFace Hub integration: metadata probe + cache-layout finalize.
//!
//! The goal is byte-for-byte compatibility with what `hf-hub 0.4` expects on
//! disk, because both the in-process `ModelManager` and the `ml-sidecar`
//! resolve files through `hf_hub::Api::repo().get(filename)`:
//!
//! ```text
//! <cache>/models--ORG--NAME/refs/main          ← commit hash (plain text)
//! <cache>/models--ORG--NAME/snapshots/<commit>/<filename>
//! ```
//!
//! `CacheRepo::get()` returns the path with **zero network I/O** iff both
//! files exist, so after our downloader finalizes a file the sidecar and the
//! local engine load it instantly — even offline.
//!
//! Metadata (commit hash + LFS ETag + size) is read the same way hf-hub does:
//! a `Range: bytes=0-0` GET on the `resolve` URL with redirects disabled,
//! reading `x-repo-commit` / `x-linked-etag` from the first response.

use anyhow::{anyhow, Context, Result};
use reqwest::header::{CONTENT_LENGTH, CONTENT_RANGE, RANGE};
use reqwest::{Client, redirect};
use std::path::{Path, PathBuf};

/// HuggingFace Hub endpoint (honours `HF_ENDPOINT` like hf-hub).
pub fn endpoint() -> String {
    std::env::var("HF_ENDPOINT").unwrap_or_else(|_| "https://huggingface.co".to_string())
}

pub fn resolve_url(repo_id: &str, filename: &str, revision: &str) -> String {
    let filename = filename.split('/').collect::<Vec<_>>().join("%2F");
    format!(
        "{}/{repo_id}/resolve/{revision}/{filename}",
        endpoint().trim_end_matches('/')
    )
}

/// hf-hub `Repo::folder_name()` for model repos:
/// `models--ORG--NAME` (slashes become `--`).
pub fn folder_name(repo_id: &str) -> String {
    format!("models--{}", repo_id).replace('/', "--")
}

/// Result of a HuggingFace resolve-URL probe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HfMetadata {
    /// `x-repo-commit` — commit hash used for `snapshots/<commit>/`.
    pub commit_hash: String,
    /// `x-linked-etag` (fallback `etag`), quotes stripped. For LFS files
    /// this **is** the SHA-256 of the payload.
    pub etag: String,
    /// Total size in bytes (from `Content-Range` on the CDN response).
    pub total_size: i64,
}

impl HfMetadata {
    /// The expected SHA-256 when the ETag is an LFS oid (64 hex chars).
    pub fn expected_sha256(&self) -> Option<String> {
        let e = self.etag.trim().trim_matches('"');
        if e.len() == 64 && e.chars().all(|c| c.is_ascii_hexdigit()) {
            Some(e.to_lowercase())
        } else {
            None
        }
    }
}

fn is_redirect(status: reqwest::StatusCode) -> bool {
    status.is_redirection()
}

/// Probe the resolve URL exactly like hf-hub's `Api::metadata`:
/// no-redirect `GET Range: bytes=0-0`, follow *relative* redirects only,
/// harvest `x-repo-commit` + `x-linked-etag`, then hop to the CDN once for
/// the authoritative `Content-Range` size.
pub async fn probe_metadata(client: &Client, url: &str) -> Result<HfMetadata> {
    let no_redirect = Client::builder()
        .redirect(redirect::Policy::none())
        .build()
        .context("failed to build probe client")?;

    let mut current = url.to_string();
    // Follow relative redirects (same-host) until the response is final or
    // points at an absolute CDN URL.
    let response = loop {
        let resp = no_redirect
            .get(&current)
            .header(RANGE, "bytes=0-0")
            .send()
            .await
            .with_context(|| format!("HF metadata request failed for {current}"))?;

        if is_redirect(resp.status()) {
            let location = resp
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            if let Some(loc) = location {
                if is_relative_location(&loc) {
                    current = join_url(&current, &loc)?;
                    continue;
                }
            }
        }
        break resp;
    };

    let commit_hash = header_str(&response, "x-repo-commit")
        .ok_or_else(|| anyhow!("HF response missing x-repo-commit header"))?
        .to_string();
    let etag = header_str(&response, "x-linked-etag")
        .or_else(|| header_str(&response, "etag"))
        .ok_or_else(|| anyhow!("HF response missing etag header"))?
        .trim_matches('"')
        .to_string();

    // Size: either the final response itself (206/200) or one follow-up hop
    // to the CDN location (302) — mirrors hf-hub.
    let total_size = if response.status().is_redirection() {
        let location = response
            .headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| anyhow!("HF redirect without location"))?
            .to_string();
        let cdn = client
            .get(&location)
            .header(RANGE, "bytes=0-0")
            .send()
            .await
            .context("HF CDN probe failed")?;
        size_from_headers(&cdn)?
    } else {
        size_from_headers(&response)?
    };

    Ok(HfMetadata {
        commit_hash,
        etag,
        total_size,
    })
}

fn header_str(resp: &reqwest::Response, name: &str) -> Option<String> {
    resp.headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn size_from_headers(resp: &reqwest::Response) -> Result<i64> {
    if let Some(cr) = header_str(resp, CONTENT_RANGE.as_str()) {
        if let Some(total) = cr.rsplit('/').next() {
            if let Ok(n) = total.parse::<i64>() {
                if n > 0 {
                    return Ok(n);
                }
            }
        }
    }
    if let Some(cl) = header_str(resp, CONTENT_LENGTH.as_str()) {
        if let Ok(n) = cl.parse::<i64>() {
            return Ok(n);
        }
    }
    Err(anyhow!("unable to determine file size from HF response"))
}

/// A location without a scheme/host is same-origin (HF uses these).
fn is_relative_location(loc: &str) -> bool {
    !loc.contains("://")
}

/// Join a relative redirect onto the current URL's origin+path.
fn join_url(base: &str, rel: &str) -> Result<String> {
    let rel = rel.trim_start_matches('/');
    // Keep only scheme://authority from base, then append the relative path.
    let scheme_end = base
        .find("://")
        .ok_or_else(|| anyhow!("malformed base URL"))?;
    let rest = &base[scheme_end + 3..];
    let authority_end = rest
        .find('/')
        .map(|i| scheme_end + 3 + i)
        .unwrap_or(base.len());
    let origin = &base[..authority_end];
    Ok(format!("{origin}/{rel}"))
}

// ── Cache layout (hf-hub compatible) ────────────────────────────────────────

pub fn repo_dir(cache_dir: &Path, repo_id: &str) -> PathBuf {
    cache_dir.join(folder_name(repo_id))
}

pub fn snapshot_path(
    cache_dir: &Path,
    repo_id: &str,
    revision: &str,
    commit_hash: &str,
    filename: &str,
) -> PathBuf {
    repo_dir(cache_dir, repo_id)
        .join("snapshots")
        .join(commit_hash)
        .join(filename)
}

fn ref_path(cache_dir: &Path, repo_id: &str, revision: &str) -> PathBuf {
    repo_dir(cache_dir, repo_id).join("refs").join(revision)
}

/// Mirror of `hf_hub::CacheRepo::get()` — resolves the local path of a
/// cached file with **no network access**: read `refs/<revision>` →
/// check `snapshots/<commit>/<filename>`.
pub fn cached_file(cache_dir: &Path, repo_id: &str, revision: &str, filename: &str) -> Option<PathBuf> {
    let commit = std::fs::read_to_string(ref_path(cache_dir, repo_id, revision)).ok()?;
    let commit = commit.trim();
    if commit.is_empty() {
        return None;
    }
    let path = snapshot_path(cache_dir, repo_id, revision, commit, filename);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// True when *every* listed file is already in the cache.
pub fn all_cached(
    cache_dir: &Path,
    repo_id: &str,
    revision: &str,
    filenames: &[&str],
) -> Option<Vec<PathBuf>> {
    let mut paths = Vec::with_capacity(filenames.len());
    for f in filenames {
        paths.push(cached_file(cache_dir, repo_id, revision, f)?);
    }
    Some(paths)
}

/// Publish a downloaded snapshot by writing `refs/<revision>` = commit hash.
/// This is the final step of a model download (the snapshot files themselves
/// are already in place).
pub fn publish_ref(
    cache_dir: &Path,
    repo_id: &str,
    revision: &str,
    commit_hash: &str,
) -> Result<()> {
    let path = ref_path(cache_dir, repo_id, revision);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, commit_hash.trim())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_name_matches_hf_hub() {
        // hf-hub: format!("models--{repo_id}").replace('/', "--")
        assert_eq!(folder_name("BAAI/bge-small-en-v1.5"), "models--BAAI--bge-small-en-v1.5");
        assert_eq!(
            folder_name("Qwen/Qwen2.5-0.5B-Instruct-GGUF"),
            "models--Qwen--Qwen2.5-0.5B-Instruct-GGUF"
        );
    }

    #[test]
    fn resolve_url_encodes_filename_and_honours_endpoint() {
        let url = resolve_url("org/name", "dir/file.bin", "main");
        assert_eq!(url, "https://huggingface.co/org/name/resolve/main/dir%2Ffile.bin");
        assert_eq!(
            resolve_url("a/b", "f.bin", "refs%2Fpr%2F1"),
            "https://huggingface.co/a/b/resolve/refs%2Fpr%2F1/f.bin"
        );
    }

    #[test]
    fn expected_sha256_only_for_lfs_oids() {
        let sha = "a".repeat(64);
        let meta = HfMetadata {
            commit_hash: "c".into(),
            etag: format!("\"{sha}\""),
            total_size: 10,
        };
        assert_eq!(meta.expected_sha256(), Some(sha));

        // git sha1 (40 hex) is not a sha256
        let meta = HfMetadata {
            commit_hash: "c".into(),
            etag: "0123456789abcdef0123456789abcdef01234567".into(),
            total_size: 10,
        };
        assert_eq!(meta.expected_sha256(), None);
    }

    #[test]
    fn relative_redirect_detection() {
        assert!(is_relative_location("/org/name/resolve/main/f"));
        assert!(is_relative_location("org/name/resolve/main/f"));
        assert!(!is_relative_location("https://cdn.example.com/f"));
        assert!(!is_relative_location("//cdn.example.com/f"));
    }

    #[test]
    fn join_url_keeps_origin_only() {
        assert_eq!(
            join_url("https://huggingface.co/org/repo/resolve/main/f", "/org/repo/resolve/main/f").unwrap(),
            "https://huggingface.co/org/repo/resolve/main/f"
        );
        assert_eq!(
            join_url("https://huggingface.co/a/b?x=1", "c/d").unwrap(),
            "https://huggingface.co/c/d"
        );
    }

    #[test]
    fn cache_roundtrip_ref_and_snapshot() {
        let tmp = std::env::temp_dir().join(format!("sm-hf-cache-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&tmp).unwrap();

        assert!(cached_file(&tmp, "org/name", "main", "model.bin").is_none());

        let dest = snapshot_path(&tmp, "org/name", "main", "deadbeef", "model.bin");
        std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
        std::fs::write(&dest, b"weights").unwrap();

        // File present but ref missing → still not "cached" (hf-hub agrees)
        assert!(cached_file(&tmp, "org/name", "main", "model.bin").is_none());

        publish_ref(&tmp, "org/name", "main", "deadbeef").unwrap();
        let found = cached_file(&tmp, "org/name", "main", "model.bin").unwrap();
        assert_eq!(found, dest);

        assert!(all_cached(&tmp, "org/name", "main", &["model.bin"]).is_some());
        assert!(all_cached(&tmp, "org/name", "main", &["model.bin", "tok.json"]).is_none());

        std::fs::remove_dir_all(&tmp).ok();
    }
}
