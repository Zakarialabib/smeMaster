// ── SMEMaster ML Sidecar ─────────────────────────────────────────────────────
//
// JSON-RPC 2.0 protocol over stdin/stdout.
// Launched by the main SMEMaster process as a Tauri sidecar binary.
// Handles all heavy ML/RAG operations: embeddings, vector search,
// document parsing, model management.
//
// Architecture decisions:
//   • stdin/stdout line-delimited JSON-RPC — no network port, no auth needed
//   • Stderr for logging — stdout is reserved for JSON-RPC responses
//   • Model weights lazy-loaded on first embed() call, not at startup
//   • Single-threaded async-free loop — all ML ops are CPU-bound anyway
//
// Protocol:
//   Request:  { "jsonrpc": "2.0", "id": 1, "method": "<method>", "params": {…} }
//   Response: { "jsonrpc": "2.0", "id": 1, "result": … }
//   Error:    { "jsonrpc": "2.0", "id": 1, "error": { "code": -1, "message": "…" } }
//   Notification (no id): method execution without response
//
// Startup:
//   1. Read "init" from stdin with { "app_data_dir": "/path/to/data" }
//   2. Reply { "status": "ok" }
//   3. Process requests until shutdown

use std::io::{self, BufRead, Write};

use serde::{Deserialize, Serialize};

// ── JSON-RPC types ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct Request {
    jsonrpc: String,
    #[serde(default)]
    id: Option<u64>,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
}

#[derive(Serialize)]
struct Response {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Serialize)]
struct RpcError {
    code: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

// ── Sidecar state ───────────────────────────────────────────────────────────

/// Holds all runtime state for the sidecar process.
/// Model weights are loaded lazily — the struct itself is cheap to construct.
struct SidecarState {
    initialized: bool,
    app_data_dir: Option<String>,
}

impl SidecarState {
    fn new() -> Self {
        Self {
            initialized: false,
            app_data_dir: None,
        }
    }
}

// ── Method dispatcher ───────────────────────────────────────────────────────

fn handle_request(req: Request, state: &mut SidecarState) -> Response {
    let id = req.id;

    match req.method.as_str() {
        // ── Lifecycle ──────────────────────────────────────────────────
        "init" => {
            let dir = req
                .params
                .get("app_data_dir")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            state.app_data_dir = dir;
            state.initialized = true;
            eprintln!(
                "[ml-sidecar] Initialized (app_data_dir: {:?})",
                state.app_data_dir
            );
            ok(
                id,
                serde_json::json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }),
            )
        }

        "ping" => {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            ok(id, serde_json::json!({ "pong": true, "ts": ts }))
        }

        "shutdown" => {
            eprintln!("[ml-sidecar] Shutdown requested");
            std::process::exit(0);
        }

        // ── Model management ──────────────────────────────────────────
        "load_embedding_model" => {
            let repo_id = req
                .params
                .get("repo_id")
                .and_then(|v| v.as_str())
                .unwrap_or("BAAI/bge-small-en-v1.5");
            eprintln!("[ml-sidecar] load_embedding_model: {repo_id}");
            // TODO: real candle + hf-hub loading
            // let api = hf_hub::api::sync::Api::new()?;
            // let model_path = api.model(repo_id.to_string()).get("model.safetensors")?;
            // let tokenizer_path = api.model(repo_id.to_string()).get("tokenizer.json")?;
            // let engine = candle::LocalEngine::load(model_path, tokenizer_path)?;
            ok(
                id,
                serde_json::json!({
                    "status": "loaded",
                    "repo_id": repo_id,
                    "dimension": 384,
                    "note": "stub — real loading requires protoc build"
                }),
            )
        }

        "unload_model" => {
            eprintln!("[ml-sidecar] Unloading model");
            ok(id, serde_json::json!({ "status": "unloaded" }))
        }

        // ── Embeddings ────────────────────────────────────────────────
        "embed" => {
            let texts: Vec<String> = req
                .params
                .get("texts")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            eprintln!("[ml-sidecar] embed: {} texts", texts.len());
            // TODO: compute embeddings via candle
            // let embeddings: Vec<Vec<f32>> = engine.embed(&texts)?;
            // Return zero vectors as stub
            let dim = 384;
            let embeddings: Vec<Vec<f32>> = texts.iter().map(|_| vec![0.0_f32; dim]).collect();
            ok(
                id,
                serde_json::json!({
                    "embeddings": embeddings,
                    "dimension": dim,
                    "count": texts.len(),
                }),
            )
        }

        // ── RAG / Vector DB ──────────────────────────────────────────
        "ensure_vector_db" => {
            let db_path = req
                .params
                .get("db_path")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            eprintln!("[ml-sidecar] ensure_vector_db: {db_path}");
            // TODO: open/create LanceDB connection
            // let db = lancedb::connect(db_path).execute()?;
            // let tbl = db.open_table("knowledge_base").execute()?;
            ok(
                id,
                serde_json::json!({
                    "status": "ok",
                    "db_path": db_path,
                    "note": "stub — real LanceDB requires protoc build"
                }),
            )
        }

        "index_vectors" => {
            let vectors: Vec<Vec<f32>> = req
                .params
                .get("vectors")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let count = vectors.len();
            eprintln!("[ml-sidecar] index_vectors: {count} vectors");
            // TODO: insert into LanceDB
            ok(id, serde_json::json!({ "indexed": count }))
        }

        "query_rag" => {
            let query = req
                .params
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let top_k = req
                .params
                .get("top_k")
                .and_then(|v| v.as_u64())
                .unwrap_or(5);
            eprintln!("[ml-sidecar] query_rag: query='{query}' top_k={top_k}");
            // TODO: vector search + return results
            let results: Vec<serde_json::Value> = Vec::new();
            ok(
                id,
                serde_json::json!({
                    "query": query,
                    "results": results,
                    "total": 0,
                }),
            )
        }

        // ── Document parsing ─────────────────────────────────────────
        "parse_document" => {
            let path = req
                .params
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            eprintln!("[ml-sidecar] parse_document: {path}");
            // TODO: detect format and parse via docx-rs / lopdf / calamine
            ok(
                id,
                serde_json::json!({
                    "status": "parsed",
                    "path": path,
                    "text": "",
                    "note": "stub — real parsing requires protoc build",
                }),
            )
        }

        _ => err(
            id,
            -32601,
            format!("Method '{}' not found", req.method),
            None,
        ),
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn ok(id: Option<u64>, result: serde_json::Value) -> Response {
    Response {
        jsonrpc: "2.0".into(),
        id,
        result: Some(result),
        error: None,
    }
}

fn err(
    id: Option<u64>,
    code: i64,
    message: impl Into<String>,
    data: Option<serde_json::Value>,
) -> Response {
    Response {
        jsonrpc: "2.0".into(),
        id,
        result: None,
        error: Some(RpcError {
            code,
            message: message.into(),
            data,
        }),
    }
}

// ── Main loop — read JSON-RPC from stdin, write to stdout ────────────────

fn main() {
    // Stderr logging — stdout is reserved for JSON-RPC responses
    eprintln!("[ml-sidecar] Starting v{}", env!("CARGO_PKG_VERSION"));
    eprintln!("[ml-sidecar] Protocol: JSON-RPC 2.0 over stdin/stdout");

    // optional chrono is not in Cargo.toml yet — use simple timestamp
    eprintln!("[ml-sidecar] Ready");

    let stdin = io::stdin();
    let mut state = SidecarState::new();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[ml-sidecar] stdin error: {e}");
                break;
            }
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: Request = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                let resp = err(None, -32700, format!("Parse error: {e}"), None);
                let out = serde_json::to_string(&resp).unwrap();
                let _ = writeln!(io::stdout(), "{out}");
                continue;
            }
        };

        let resp = handle_request(req, &mut state);
        if let Ok(out) = serde_json::to_string(&resp) {
            let _ = writeln!(io::stdout(), "{out}");
        }
    }

    eprintln!("[ml-sidecar] stdin closed — exiting");
}
