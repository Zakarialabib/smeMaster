# ML Sidecar Architecture

> **Last updated:** 2026-07-20
> **Status:** Implementation complete — runtime stubs pending real candle/LanceDB wiring
> **Cross-reference:** Simple-Signage `AI_SIDECAR.md` v2 (aligned), `08-sidecar-gap-analysis.md` (improvement candidates)

## Overview

SMEMaster uses a **sidecar process architecture** for all on-device ML/AI workloads: embeddings, vector search (RAG), document parsing, and model management. The sidecar is a **separate OS process** (`ml-sidecar`) that communicates with the main app over **stdin/stdout JSON-RPC 2.0**.

```
┌─────────────────────────────────────────────────────┐
│  Main Process (smemaster)                           │
│                                                     │
│  ┌──────────────┐   ┌─────────────────────────┐     │
│  │ AI Commands  │──▶│ MlSidecarService         │     │
│  │ (tauri cmd)  │   │   • spawn / health-check │     │
│  │              │   │   • watchdog auto-restart │     │
│  │  fallback ───┤   │   • JSON-RPC IPC         │     │
│  │  AiState     │   └─────────┬───────────────┬─┘     │
│  │  (in-process)│             │               │       │
│  └──────────────┘         stdin              stdout   │
└──────────────────────────────────────┬──────────┘──────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────┐
│  Sidecar Process (ml-sidecar)                       │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ JSON-RPC Dispatcher                          │   │
│  │   • init / ping / shutdown                   │   │
│  │   • load_embedding_model / unload_model      │   │
│  │   • embed (text → vector)                    │   │
│  │   • ensure_vector_db / index_vectors         │   │
│  │   • query_rag (vector search)                │   │
│  │   • parse_document (docx/pdf/xlsx)           │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                            │
│  ┌──────────────────────▼───────────────────────┐   │
│  │ ML Libraries (only here)                     │   │
│  │   candle-core / candle-nn / candle-transform │   │
│  │   hf-hub (model downloads)                   │   │
│  │   tokenizers                                 │   │
│  │   lancedb + arrow (vector DB)                │   │
│  │   calamine (xlsx parsing)                    │   │
│  │   docx-rs (docx parsing)                     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Benefits

### 1. Build-time isolation: Zero protoc requirement

**Problem before:** The main `smemaster` crate depended on `lancedb`, `arrow`, `candle-core`, etc. These crates transitively pull in `protoc` (the Protocol Buffers compiler) via `lancedb` → `protox` → `protobuf`. Every developer needed protoc installed, even if they never touched AI features. CI had to install protoc on every runner. Cross-compilation for Android ARM64 frequently broke due to protoc architecture mismatches.

**Solution:** ML deps live **only** in the sidecar crate (`crates/ml-sidecar/`). The main app depends on `tauri-plugin-shell` (lightweight, zero native deps) instead. Developers run:

```bash
cargo check -p smemaster              # No protoc needed — works everywhere
cargo build -p ml-sidecar             # Requires protoc — CI only
```

The workspace `Cargo.toml` defines the sidecar as a workspace member but the default `cargo build` only compiles `smemaster`. The sidecar is built explicitly in CI and bundled via Tauri's `externalBin`.

### 2. Crash isolation

ML libraries — especially C/C++ bindings via FFI (e.g., `candle` → `ggml`, `lancedb` → `liblance`) — are a leading cause of process crashes:

- **Segfaults** in the underlying C++ tensor library (rare but catastrophic)
- **OOM kills** when a 500 MB model loads alongside a large vector index
- **Panics** in tokenizer or model inference code

With the sidecar architecture, **any crash in ML code kills only the sidecar process**, not the main app. The `MlSidecarService` watchdog detects the crash (via `CommandEvent::Terminated`) and automatically restarts the sidecar within 2 seconds. The main app continues running:

- Email sync continues
- UI remains responsive
- Ongoing IMAP connections are not interrupted
- SQLite transactions are not affected

### 3. Memory isolation

| Component            | Memory (idle) | Memory (ML active)          |
| -------------------- | ------------- | --------------------------- |
| Main app (smemaster) | ~60 MB        | ~60 MB                      |
| Sidecar (ml-sidecar) | ~5 MB         | ~500-800 MB (model + index) |
| **Combined**         | **~65 MB**    | **~560-860 MB**             |

The main app stays lean because:

- BGE-small embedding model (133 MB) lives in the sidecar
- LanceDB vector index (varies, often 200+ MB) lives in the sidecar
- Tokenizer cache, HF Hub cache, document parse buffers all in the sidecar

On Android, this is critical: the main app must stay under ~200 MB to avoid background killing by the OS. The sidecar can be killed and restarted independently.

### 4. Graceful degradation

When the sidecar binary **doesn't exist** (e.g., developer builds without ML deps, or the user declined the ML download), the system degrades gracefully:

1. `MlSidecarService::init()` logs a warning and continues
2. AI commands check `MlSidecarService::is_running()`
3. If the sidecar is not running, AI commands **fall back to in-process `AiState`** (LocalEngine + VectorDb loaded directly in the main process)
4. If even that fails, commands return a clear error: _"AI not available — load a model first"_

This means:

- **Developer builds** without protoc → AI features disabled, no crash
- **Production builds** on desktop → sidecar is bundled, AI works
- **Production builds** on Android → sidecar is bundled, AI works
- **Source builds** with protoc → both sidecar and in-process work

### 5. Multi-window safe

One sidecar instance serves all Tauri windows. `MlSidecarService` is managed as Tauri state (`Arc<MlSidecarService>`) — a singleton shared across all windows. AI commands from any window (main, compose, thread) all go through the same JSON-RPC stdin channel.

No mutex contention: requests are serialized through the sidecar's stdin line-by-line. For the expected workloads (embedding batches, RAG queries at human interaction speed), this is more than adequate.

### 6. Separate update cadence

The sidecar binary can be updated independently of the main app. Tauri's sidecar bundling places `ml-sidecar` alongside the main executable. A future update could:

- Swap the embedding model (BGE-small → BGE-base → multilingual)
- Upgrade LanceDB format
- Add new document parsers

...all without changing the main app binary or the JSON-RPC protocol.

## File Layout

```
src-tauri/
├── Cargo.toml                     # Workspace root: members = ["crates/ml-sidecar"]
├── crates/
│   └── ml-sidecar/
│       ├── Cargo.toml             # ML deps: candle, lancedb, hf-hub, etc.
│       └── src/
│           └── main.rs            # JSON-RPC stdin/stdout dispatcher
├── src/
│   ├── orchestrator/
│   │   └── services.rs            # MlSidecarService (spawn, IPC, watchdog)
│   │   └── init.rs                # Registers MlSidecarService as OnDemand subsystem
│   └── commands/
│       └── ai.rs                  # AI commands with sidecar-first routing
├── binaries/                      # Built sidecar binary (gitignored, built by CI)
│   └── ml-sidecar-*.exe           # Platform-specific binary
└── tauri.conf.json                # bundle.externalBin = ["binaries/ml-sidecar"]
```

## Protocol

### JSON-RPC 2.0 over stdin/stdout + optional HTTP debug API

**Request:**

```
{ "jsonrpc": "2.0", "id": 1, "method": "embed", "params": { "texts": ["Hello world"] } }
```

**Response:**

```
{"jsonrpc":"2.0","id":1,"result":{"embeddings":[[0.001,0.002,...]],"dimension":384,"count":1}}
```

**Error:**

```
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32601, "message": "Method 'unknown' not found" } }
```

**Notification:**

```
{"jsonrpc":"2.0","method":"progress","params":{"step":"generate","done":1,"total":12}}
```

Notifications carry no `id`. The main app reader task forwards them via a broadcast channel so UI consumers can stream progress without affecting request/response matching.

### Methods

| Method                 | Params                  | Returns                     | Description                          |
| ---------------------- | ----------------------- | --------------------------- | ------------------------------------ |
| `init`                 | `{ app_data_dir }`      | `{ status, version }`       | Initialize with app data directory   |
| `ping`                 | `{}`                    | `{ pong, ts, version }`     | Health check                         |
| `shutdown`             | `{}`                    | —                           | Graceful exit (process exits with 0) |
| `load_embedding_model` | `{ repo_id }`           | `{ status, dimension }`     | Download + load embedding model      |
| `unload_model`         | `{}`                    | `{ status }`                | Free model memory                    |
| `list_models`          | `{}`                    | `{ models: [...] }`         | Registry of loaded models            |
| `embed`                | `{ texts: [str] }`      | `{ embeddings, dimension }` | Compute text embeddings              |
| `embed_batch`          | `{ batches: [[str]] }`  | `{ results: [...] }`        | Batch embedding with progress notes  |
| `ensure_vector_db`     | `{ db_path }`           | `{ status }`                | Open/create LanceDB database         |
| `index_vectors`        | `{ vectors, metadata }` | `{ indexed }`               | Insert vectors into index            |
| `query_rag`            | `{ query, top_k }`      | `{ results }`               | Vector search + return context       |
| `parse_document`       | `{ path }`              | `{ text }`                  | Extract text from docx/pdf/xlsx      |
| `load_generation_model`| `{ repo_id }`           | `{ status }`                | Register a generation model handle   |
| `generate`             | `{ prompt, max_tokens }`| `{ text }`                  | Run generation + stream progress     |
| `memory_usage`         | `{}`                    | `{ rss_mb, model_loaded, pid }` | Sidecar self-memory report     |
| `metrics`              | `{}`                    | `{ embed_count, ..., rss_mb }`| Sidecar self-metrics                |

## Lifecycle

```
App startup
  │
  ▼
MlSidecarService::init()
  │  Try spawn_sidecar()
  │    ├── Success → stdin/stdout connected, init sent
  │    └── Failure → log warning, continue without sidecar
  │
  ▼
AI Command received
  │
  ▼
try_sidecar() check
  ├── Sidecar running → Forward JSON-RPC request → Return result
  └── Sidecar dead → Fallback to in-process AiState
                      ├── AiState available → Process locally
                      └── AiState unavailable → Return error
  │
  ▼
Health Monitor (every 15s)
  │
  ▼
health_check()
  ├── Running + healthy → OK
  ├── Running + unhealthy → Degraded (stderr shows errors)
  └── Not running → Attempt restart
                      ├── Success → Healthy
                      └── Failure → Degraded("restart failed")
  │
  ▼
On crash (CommandEvent::Terminated)
  │
  ▼
Watchdog (2s delay)
  │
  ▼
Auto-restart
```

## Building the Sidecar

### Prerequisites

- protoc (Protocol Buffers compiler) — `winget install protobuf` / `brew install protobuf` / `apt install protobuf-compiler`
- Rust nightly (for some candle features)

### Build

```bash
# Build only the sidecar
cargo build -p ml-sidecar --release

# The binary lands at:
#   src-tauri/target/release/ml-sidecar.exe  (Windows)
#   src-tauri/target/release/ml-sidecar      (Linux/macOS)

# Copy to binaries/ for Tauri bundling:
mkdir -p src-tauri/binaries
cp src-tauri/target/release/ml-sidecar* src-tauri/binaries/
# Tauri expects: src-tauri/binaries/ml-sidecar-x86_64-pc-windows-msvc.exe
```

### CI Integration

The sidecar is built as a separate step BEFORE the main Tauri build:

```yaml
- name: Install protoc
  run: |
    choco install protoc
- name: Build ML sidecar
  run: cargo build -p ml-sidecar --release
- name: Copy to binaries/
  run: |
    mkdir -p src-tauri/binaries
    cp target/release/ml-sidecar* src-tauri/binaries/
- name: Build Tauri app
  run: cargo build -p smemaster --release
```

The `externalBin` config in `tauri.conf.json` tells Tauri to bundle `binaries/ml-sidecar*` into the final installer. Tauri automatically appends the target triple so the correct binary is resolved at runtime.

## Cross-Project Reference

- **Simple-Signage AI Sidecar Spec:** `Simple-Signage/docs/specs/AI_SIDECAR.md` (draft v2, aligned with this implementation)
- **Gap Analysis:** `docs/01-ARCHITECTURE/08-sidecar-gap-analysis.md` — improvement opportunities from Simple-Signage's forward-looking design

## Future Work

### Short-term

- **Real candle embedding**: Replace the stub `load_embedding_model` / `embed` handlers with actual `candle-core` + `tokenizers` inference
- **Real LanceDB**: Replace `ensure_vector_db` / `index_vectors` / `query_rag` stubs with actual `lancedb` table operations
- **Real document parsing**: Wire `docx-rs`, `lopdf`, `calamine` into `parse_document`

### Medium-term

- **Batch processing**: Add async batch embedding with progress reporting (sidecar emits events via the `Vec<Vec<f32>>` response)
- **Model warmup**: Pre-warm the embedding model on idle (first interaction gets instant results)
- **Android bundle**: Build the sidecar as a native `.so` via JNI rather than a separate binary
- **Memory limit enforcement**: RSS polling via `sysinfo`, graceful model unload on threshold (see gap analysis)
- **HTTP debugging API**: Optional `/v1/health` and `/v1/metrics` endpoints (behind `http-debug` feature)
- **MlSidecarService tests**: Unit + integration tests for spawn/restart/IPC/degradation (see gap analysis)

### Long-term

- **GPU acceleration**: Offload candle to Vulkan/Metal via `candle-metal` or `candle-cuda` — the sidecar process makes GPU isolation trivial
- **Multi-model**: Run embedding + ranking + LLM in separate sidecar threads
- **Plugin model**: Third-party ML plugins register via JSON-RPC without modifying the main app
- **AiRouter facade**: Unified local/cloud routing (adopted from Simple-Signage's design)
- **Streaming support**: SSE for LLM text generation
- **Independent sidecar updates**: Version-decoupled auto-updater
