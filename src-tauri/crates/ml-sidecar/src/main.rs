// ── SMEMaster ML Sidecar ─────────────────────────────────────────────────────
//
// JSON-RPC 2.0 protocol over stdin/stdout.
// Launched by the main SMEMaster process as a Tauri sidecar binary.
// Handles all heavy ML/RAG operations: embeddings, vector search,
// document parsing, model management.
//
// Protocol:
//   Request:  { "jsonrpc": "2.0", "id": 1, "method": "<method>", "params": {…} }
//   Response: { "jsonrpc": "2.0", "id": 1, "result": … }
//   Error:    { "jsonrpc": "2.0", "id": 1, "error": { "code": -1, "message": "…" } }
//   Notification (no id): method execution without response
//
// Startup signals (read from stdin before first request):
//   { "method": "init", "params": { "app_data_dir": "/path/to/data" } }

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
        "init" => {
            let dir = req
                .params
                .get("app_data_dir")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            state.app_data_dir = dir;
            state.initialized = true;
            log::info!("[ml-sidecar] Initialized");
            ok(id, serde_json::json!({ "status": "ok" }))
        }

        "ping" => ok(id, serde_json::json!({ "pong": true })),

        "shutdown" => {
            log::info!("[ml-sidecar] Shutdown requested");
            std::process::exit(0);
        }

        // ── Model management ──────────────────────────────────────────
        "load_embedding_model" => {
            let _repo_id = req.params.get("repo_id").and_then(|v| v.as_str());
            // TODO: load candle BGE-small model via hf-hub
            log::info!("[ml-sidecar] load_embedding_model not yet implemented");
            err(id, -32000, "Not implemented", None)
        }

        "unload_model" => {
            // TODO: drop model from memory
            ok(id, serde_json::json!({ "unloaded": true }))
        }

        // ── Embeddings ────────────────────────────────────────────────
        "embed" => {
            let _texts: Vec<String> = req
                .params
                .get("texts")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            // TODO: compute embeddings via candle
            log::info!(
                "[ml-sidecar] embed not yet implemented ({} texts)",
                _texts.len()
            );
            err(id, -32000, "Not implemented", None)
        }

        // ── RAG / Vector DB ──────────────────────────────────────────
        "ensure_vector_db" => {
            let _db_path = req.params.get("db_path").and_then(|v| v.as_str());
            // TODO: open LanceDB connection
            log::info!("[ml-sidecar] ensure_vector_db not yet implemented");
            err(id, -32000, "Not implemented", None)
        }

        "index_vectors" => {
            let _vectors: Vec<Vec<f32>> = req
                .params
                .get("vectors")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let _metadata: Vec<serde_json::Value> = req
                .params
                .get("metadata")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            // TODO: insert into LanceDB table
            log::info!("[ml-sidecar] index_vectors not yet implemented");
            err(id, -32000, "Not implemented", None)
        }

        "query_rag" => {
            let _query = req
                .params
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let _top_k = req
                .params
                .get("top_k")
                .and_then(|v| v.as_u64())
                .unwrap_or(5);
            // TODO: vector search via LanceDB
            log::info!("[ml-sidecar] query_rag not yet implemented");
            err(id, -32000, "Not implemented", None)
        }

        // ── Document parsing ─────────────────────────────────────────
        "parse_document" => {
            let _path = req
                .params
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            // TODO: parse docx/pdf/xlsx via docx-rs/lopdf/calamine
            log::info!("[ml-sidecar] parse_document not yet implemented");
            err(id, -32000, "Not implemented", None)
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
    eprintln!("[ml-sidecar] Starting...");

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
}
