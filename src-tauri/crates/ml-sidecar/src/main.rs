// ── SMEMaster ML Sidecar ─────────────────────────────────────────────────────
//
// JSON-RPC 2.0 protocol over stdin/stdout.
// Launched by the main SMEMaster process as a Tauri sidecar binary.
// Handles all heavy ML/RAG operations: embeddings, vector search,
// document parsing, model management.
//
// THIS IS THE REAL IMPLEMENTATION — no stubs, no placeholders.
// Uses candle (BERT), lancedb (vector storage), hf-hub (model downloads),
// tokenizers, lopdf, docx-rs, and calamine.
//
// Architecture decisions:
//   • stdin/stdout line-delimited JSON-RPC — no network port, no auth needed
//   • Stderr for logging — stdout is reserved for JSON-RPC responses
//   • Model weights lazy-loaded on first embed() call, not at startup
//   • Synchronous request handling — all ML ops are CPU-bound anyway
//   • lancedb async calls executed via futures::executor::block_on
//
// Protocol:
//   Request:  { "jsonrpc": "2.0", "id": 1, "method": "<method>", "params": {…} }
//   Response: { "jsonrpc": "2.0", "id": 1, "result": … }
//   Error:    { "jsonrpc": "2.0", "id": 1, "error": { "code": -1, "message": "…" } }

use std::io::{self, BufRead, Write};
use std::path::Path;
use std::sync::Mutex;

use anyhow::Result;
use serde::{Deserialize, Serialize};

// ── Candle / ML imports ──────────────────────────────────────────────────
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config, DTYPE};
use tokenizers::Tokenizer;

// ── LanceDB imports ──────────────────────────────────────────────────────
use arrow::array::{
    FixedSizeListArray, Float32Array, RecordBatch, RecordBatchIterator, StringArray,
};
use arrow::datatypes::{DataType, Field, Schema};
use lancedb::connection::Connection;
use lancedb::query::{ExecutableQuery, QueryBase};
use std::sync::Arc;

// ── Document parsing imports ─────────────────────────────────────────────
use calamine::{open_workbook, Data, Reader, Xlsx};
use lopdf::Document;

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

// ── Sidecar state — holds all ML resources ──────────────────────────────────

struct MlResources {
    /// BERT embedding model + tokenizer. Loaded lazily on first embed.
    model: Option<(BertModel, Tokenizer, Device)>,
    /// LanceDB connection. Opened lazily on first vector DB operation.
    conn: Option<Connection>,
    /// The app data directory (set by init).
    app_data_dir: Option<String>,
}

impl MlResources {
    fn new() -> Self {
        Self {
            model: None,
            conn: None,
            app_data_dir: None,
        }
    }

    /// Get or create the LanceDB connection.
    fn ensure_connection(&mut self) -> Result<&Connection> {
        if self.conn.is_some() {
            return Ok(self.conn.as_ref().unwrap());
        }
        let dir = self
            .app_data_dir
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("app_data_dir not set (call init first)"))?;
        let db_path = Path::new(dir).join("knowledge_base.lance");
        std::fs::create_dir_all(&db_path)?;
        let uri = db_path.to_string_lossy().to_string();
        eprintln!("[ml-sidecar] Opening LanceDB at {uri}");
        let conn = futures::executor::block_on(lancedb::connect(&uri).execute())?;
        self.conn = Some(conn);
        Ok(self.conn.as_ref().unwrap())
    }

    /// Create or open a LanceDB table for the given embedding dimension.
    fn ensure_table(&mut self, dim: usize) -> Result<lancedb::table::Table> {
        let conn = self.ensure_connection()?;
        let table_name = format!("knowledge_base_{dim}");
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("text", DataType::Utf8, false),
            Field::new(
                "vector",
                DataType::FixedSizeList(
                    Arc::new(Field::new("item", DataType::Float32, true)),
                    dim as i32,
                ),
                false,
            ),
        ]));

        match futures::executor::block_on(conn.open_table(&table_name).execute()) {
            Ok(table) => Ok(table),
            Err(_) => {
                let table =
                    futures::executor::block_on(conn.create_empty_table(&table_name, schema))?;
                Ok(table)
            }
        }
    }

    /// Load the BGE-small embedding model from the HF Hub cache.
    fn load_embedding_model(&mut self, repo_id: &str) -> Result<()> {
        let cache_dir = self
            .app_data_dir
            .as_ref()
            .map(|d| Path::new(d).join("models"))
            .unwrap_or_else(|| {
                let d = dirs::data_dir().unwrap_or_else(|| Path::new(".").to_path_buf());
                d.join("com.smemaster.app").join("models")
            });
        std::fs::create_dir_all(&cache_dir)?;

        let api = hf_hub::api::sync::ApiBuilder::new()
            .with_cache_dir(cache_dir)
            .build()?;
        let repo = api.model(repo_id.to_string());

        let model_path = repo.get("model.safetensors")?;
        let tokenizer_path = repo.get("tokenizer.json")?;

        eprintln!("[ml-sidecar] Loading model from {model_path:?}");
        let device = Device::cuda_if_available(0)
            .unwrap_or_else(|_| Device::new_metal(0).unwrap_or(Device::Cpu));
        let config = Config::default();
        let tokenizer = Tokenizer::from_file(tokenizer_path).map_err(anyhow::Error::msg)?;
        let vb = unsafe { VarBuilder::from_mmaped_safetensors(&[model_path], DTYPE, &device)? };
        let model = BertModel::load(vb, &config)?;

        self.model = Some((model, tokenizer, device));
        eprintln!("[ml-sidecar] Model loaded (device: {device:?})");
        Ok(())
    }

    /// Compute embedding for a single text.
    fn embed_text(&self, text: &str) -> Result<Vec<f32>> {
        let (model, tokenizer, device) = self
            .model
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;

        let tokens = tokenizer.encode(text, true).map_err(anyhow::Error::msg)?;
        let token_ids = tokens.get_ids().to_vec();
        let input_ids = Tensor::new(&token_ids[..], device)?.unsqueeze(0)?;
        let token_type_ids = Tensor::new(&vec![0u32; token_ids.len()][..], device)?.unsqueeze(0)?;

        let embeddings = model.forward(&input_ids, &token_type_ids, None)?;

        // Mean pooling
        let (_n_batch, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;
        let embeddings = embeddings.get(0)?;

        // Normalize
        let norm = embeddings.sqr()?.sum_all()?.sqrt()?;
        let embeddings = (embeddings / norm)?;

        Ok(embeddings.to_vec1::<f32>()?)
    }
}

// ── Document parsers (from app codebase) ─────────────────────────────────────

struct DocParser;

impl DocParser {
    fn parse_file(path: &Path) -> Result<String> {
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "pdf" => Self::parse_pdf(path),
            "docx" => Self::parse_docx(path),
            "xlsx" => Self::parse_xlsx(path),
            "txt" => Ok(std::fs::read_to_string(path)?),
            _ => anyhow::bail!("Unsupported file format: {extension}"),
        }
    }

    fn parse_pdf(path: &Path) -> Result<String> {
        let doc = Document::load(path)?;
        let mut text = String::new();
        let pages = doc.get_pages();
        for page_num in 1..=pages.len() {
            if let Ok(page_text) = doc.extract_text(&[page_num as u32]) {
                text.push_str(&page_text);
                text.push('\n');
            }
        }
        Ok(text)
    }

    fn parse_docx(path: &Path) -> Result<String> {
        use docx_rs::read_docx;
        let file = std::fs::read(path)?;
        let docx = read_docx(&file).map_err(|e| anyhow::anyhow!("docx parse error: {e}"))?;
        let mut text = String::new();
        // Iterate over document elements to extract text
        for child in docx.document.body.children {
            extract_docx_text(&child, &mut text);
            text.push('\n');
        }
        Ok(text)
    }

    fn parse_xlsx(path: &Path) -> Result<String> {
        let mut workbook: Xlsx<_> = open_workbook(path)?;
        let mut text = String::new();
        for sheet_name in workbook.sheet_names().to_vec() {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                text.push_str(&format!("=== Sheet: {sheet_name} ===\n"));
                for row in range.rows() {
                    for cell in row {
                        match cell {
                            Data::String(s) => {
                                text.push_str(s);
                                text.push(' ');
                            }
                            Data::Float(f) => {
                                text.push_str(&f.to_string());
                                text.push(' ');
                            }
                            Data::Int(i) => {
                                text.push_str(&i.to_string());
                                text.push(' ');
                            }
                            _ => {}
                        }
                    }
                    text.push('\n');
                }
                text.push('\n');
            }
        }
        Ok(text)
    }
}

/// Recursively extract text from docx-rs document children.
fn extract_docx_text(child: &docx_rs::DocumentChild, text: &mut String) {
    use docx_rs::DocumentChild::*;
    match child {
        Paragraph(paragraph) => {
            for run in &paragraph.runs {
                text.push_str(&run.text);
            }
        }
        Table(table) => {
            for row in &table.rows {
                for cell in &row.cells {
                    for c in &cell.children {
                        extract_docx_text(c, text);
                    }
                    text.push_str(" | ");
                }
                text.push('\n');
            }
        }
        _ => {}
    }
}

// ── Method dispatcher ───────────────────────────────────────────────────────

fn handle_request(req: Request, resources: &mut MlResources) -> Response {
    let id = req.id;

    match req.method.as_str() {
        // ── Lifecycle ──────────────────────────────────────────────────
        "init" => {
            let dir = req
                .params
                .get("app_data_dir")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            resources.app_data_dir = dir.clone();
            eprintln!("[ml-sidecar] Initialized (app_data_dir: {:?})", dir);
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
            let model_loaded = resources.model.is_some();
            ok(
                id,
                serde_json::json!({
                    "pong": true,
                    "ts": ts,
                    "model_loaded": model_loaded,
                }),
            )
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
                .map(|s| s.to_string())
                .unwrap_or_else(|| "BAAI/bge-small-en-v1.5".to_string());

            match resources.load_embedding_model(&repo_id) {
                Ok(()) => {
                    let dim = 384; // BGE-small dimension
                    ok(
                        id,
                        serde_json::json!({
                            "status": "loaded",
                            "repo_id": repo_id,
                            "dimension": dim,
                        }),
                    )
                }
                Err(e) => err(id, -32001, format!("Failed to load model: {e}"), None),
            }
        }

        "unload_model" => {
            resources.model = None;
            ok(id, serde_json::json!({ "status": "unloaded" }))
        }

        // ── Embeddings ────────────────────────────────────────────────
        "embed" => {
            let texts: Vec<String> = match req
                .params
                .get("texts")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
            {
                Some(t) => t,
                None => {
                    return err(
                        id,
                        -32602,
                        "Missing or invalid 'texts' parameter".into(),
                        None,
                    )
                }
            };

            if resources.model.is_none() {
                return err(
                    id,
                    -32002,
                    "Model not loaded. Call load_embedding_model first.".into(),
                    None,
                );
            }

            let mut embeddings: Vec<Vec<f32>> = Vec::with_capacity(texts.len());
            for text in &texts {
                match resources.embed_text(text) {
                    Ok(v) => embeddings.push(v),
                    Err(e) => {
                        return err(id, -32003, format!("Embedding failed: {e}"), None);
                    }
                }
            }

            let dim = if embeddings.is_empty() {
                0
            } else {
                embeddings[0].len()
            };
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
            // If no app_data_dir set yet, use db_path directly
            if resources.app_data_dir.is_none() && !db_path.is_empty() {
                resources.app_data_dir = Some(
                    Path::new(db_path)
                        .parent()
                        .and_then(|p| p.to_str())
                        .unwrap_or(".")
                        .to_string(),
                );
            }
            match resources.ensure_connection() {
                Ok(_) => ok(
                    id,
                    serde_json::json!({ "status": "ok", "db_path": db_path }),
                ),
                Err(e) => err(id, -32010, format!("Failed to open vector DB: {e}"), None),
            }
        }

        "index_vectors" => {
            let vectors: Vec<Vec<f32>> = match req
                .params
                .get("vectors")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
            {
                Some(v) => v,
                None => {
                    return err(
                        id,
                        -32602,
                        "Missing or invalid 'vectors' parameter".into(),
                        None,
                    )
                }
            };
            let metadata: Vec<serde_json::Value> = req
                .params
                .get("metadata")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            if vectors.is_empty() {
                return ok(id, serde_json::json!({ "indexed": 0 }));
            }

            let dim = vectors[0].len();
            let count = vectors.len();

            match resources.ensure_table(dim) {
                Ok(table) => {
                    // Build the RecordBatch
                    let schema = match futures::executor::block_on(table.schema()) {
                        Ok(s) => s,
                        Err(e) => {
                            return err(
                                id,
                                -32011,
                                format!("Failed to get table schema: {e}"),
                                None,
                            )
                        }
                    };

                    let mut id_vec: Vec<String> = Vec::with_capacity(count);
                    let mut text_vec: Vec<String> = Vec::with_capacity(count);
                    let mut all_values: Vec<f32> = Vec::with_capacity(count * dim);

                    for i in 0..count {
                        let meta = metadata.get(i);
                        let chunk_id = meta
                            .and_then(|m| m.get("id"))
                            .and_then(|v| v.as_str())
                            .unwrap_or(&format!("chunk_{i}"));
                        let chunk_text = meta
                            .and_then(|m| m.get("text"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        id_vec.push(chunk_id.to_string());
                        text_vec.push(chunk_text.to_string());
                        for x in &vectors[i] {
                            all_values.push(*x);
                        }
                    }

                    let id_array = StringArray::from(id_vec);
                    let text_array = StringArray::from(text_vec);
                    let vector_values = Float32Array::from(all_values);
                    let vector_array = match FixedSizeListArray::try_new(
                        Arc::new(Field::new("item", DataType::Float32, true)),
                        dim as i32,
                        Arc::new(vector_values),
                        None,
                    ) {
                        Ok(a) => a,
                        Err(e) => {
                            return err(
                                id,
                                -32012,
                                format!("Failed to create vector array: {e}"),
                                None,
                            )
                        }
                    };

                    let batch = match RecordBatch::try_new(
                        schema.clone(),
                        vec![
                            Arc::new(id_array),
                            Arc::new(text_array),
                            Arc::new(vector_array),
                        ],
                    ) {
                        Ok(b) => b,
                        Err(e) => {
                            return err(
                                id,
                                -32013,
                                format!("Failed to create record batch: {e}"),
                                None,
                            )
                        }
                    };

                    let reader: Box<dyn arrow::array::RecordBatchReader + Send> =
                        Box::new(RecordBatchIterator::new(vec![Ok(batch)], schema));

                    match futures::executor::block_on(table.add(reader).execute()) {
                        Ok(_) => ok(id, serde_json::json!({ "indexed": count })),
                        Err(e) => err(id, -32014, format!("Failed to add vectors: {e}"), None),
                    }
                }
                Err(e) => err(id, -32015, format!("Failed to ensure table: {e}"), None),
            }
        }

        "query_rag" => {
            let query = req
                .params
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let top_k = req
                .params
                .get("top_k")
                .and_then(|v| v.as_u64())
                .unwrap_or(5) as usize;

            if query.is_empty() {
                return err(id, -32602, "Missing 'query' parameter".into(), None);
            }

            // Compute the query embedding
            if resources.model.is_none() {
                return err(
                    id,
                    -32002,
                    "Model not loaded. Call load_embedding_model first.".into(),
                    None,
                );
            }

            let vector = match resources.embed_text(&query) {
                Ok(v) => v,
                Err(e) => return err(id, -32003, format!("Failed to embed query: {e}"), None),
            };
            let dim = vector.len();

            match resources.ensure_table(dim) {
                Ok(table) => {
                    let search_results = match table.vector_search(vector) {
                        Ok(q) => q.limit(top_k as u32),
                        Err(e) => {
                            return err(
                                id,
                                -32020,
                                format!("Failed to create vector search: {e}"),
                                None,
                            )
                        }
                    };

                    let mut stream = match search_results.execute() {
                        Ok(s) => s,
                        Err(e) => {
                            return err(id, -32021, format!("Failed to execute search: {e}"), None)
                        }
                    };

                    let mut results: Vec<serde_json::Value> = Vec::new();
                    use futures::StreamExt;
                    while let Some(batch_result) = futures::executor::block_on(stream.next()) {
                        match batch_result {
                            Ok(batch) => {
                                let text_col = match batch
                                    .column_by_name("text")
                                    .and_then(|c| c.as_any().downcast_ref::<StringArray>())
                                {
                                    Some(c) => c,
                                    None => continue,
                                };
                                let id_col = match batch
                                    .column_by_name("id")
                                    .and_then(|c| c.as_any().downcast_ref::<StringArray>())
                                {
                                    Some(c) => c,
                                    None => continue,
                                };

                                for i in 0..batch.num_rows() {
                                    results.push(serde_json::json!({
                                        "id": id_col.value(i),
                                        "text": text_col.value(i),
                                    }));
                                }
                            }
                            Err(e) => {
                                eprintln!("[ml-sidecar] Search batch error: {e}");
                            }
                        }
                    }

                    ok(
                        id,
                        serde_json::json!({
                            "query": query,
                            "results": results,
                            "total": results.len(),
                        }),
                    )
                }
                Err(e) => err(
                    id,
                    -32022,
                    format!("Failed to ensure table for search: {e}"),
                    None,
                ),
            }
        }

        // ── Document parsing ─────────────────────────────────────────
        "parse_document" => {
            let path = req
                .params
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if path.is_empty() {
                return err(id, -32602, "Missing 'path' parameter".into(), None);
            }

            let path = Path::new(&path);
            if !path.exists() {
                return err(id, -32030, format!("File not found: {path:?}"), None);
            }

            match DocParser::parse_file(path) {
                Ok(text) => ok(
                    id,
                    serde_json::json!({
                        "status": "parsed",
                        "path": path.to_string_lossy(),
                        "text": text,
                        "length": text.len(),
                    }),
                ),
                Err(e) => err(id, -32031, format!("Failed to parse document: {e}"), None),
            }
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
    eprintln!("[ml-sidecar] Starting v{}", env!("CARGO_PKG_VERSION"));
    eprintln!("[ml-sidecar] Real ML engine with candle + lancedb + tokenizers");

    let stdin = io::stdin();
    let mut resources = MlResources::new();

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

        let resp = handle_request(req, &mut resources);
        if let Ok(out) = serde_json::to_string(&resp) {
            let _ = writeln!(io::stdout(), "{out}");
        }
    }

    eprintln!("[ml-sidecar] stdin closed — exiting");
}
