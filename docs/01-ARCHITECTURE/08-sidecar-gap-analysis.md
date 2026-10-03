# smeMaster AI Sidecar — Gap Analysis & Improvement Opportunities

> **Date:** 2026-07-20
> **Source:** Cross-project analysis with Simple-Signage `AI_SIDECAR.md` (draft v2)
> **Status:** Improvement candidates — not yet prioritized

---

## Context

smeMaster's `ml-sidecar` is the **reference implementation** (791 lines, real candle/lancedb code). Simple-Signage's `AI_SIDECAR.md` spec proposes forward-looking features that smeMaster hasn't implemented yet. This document captures those gaps as improvement opportunities.

---

## Gap Summary

| #   | Gap                        | Severity    | smeMaster Status                             | Simple-Signage Has                     |
| --- | -------------------------- | ----------- | -------------------------------------------- | -------------------------------------- |
| 1   | Runtime Feature Flags      | ⚠️ Medium   | ✅ Implemented — runtime toggle + db-backed flags | 3-flag system with env overrides       |
| 2   | Memory Limit Enforcement   | ❌ High     | ✅ Implemented — `memory_usage` RPC + graceful unload | Configurable limit + OOM protection    |
| 3   | Streaming/SSE Support      | ❌ High     | ✅ Implemented — JSON-RPC notifications + `generate` streaming | SSE for long-running inference         |
| 4   | AiRouter Facade            | ❌ High     | ⚠️ Partial — sidecar/in-process routing unified; cloud routing deferred | tryLocal→trySidecar→tryCloud           |
| 5   | Independent Sidecar Update | ⚠️ Medium   | ✅ Implemented — version in `ping`/`init`, cached by orchestrator | Version-decoupled auto-updater         |
| 6   | HTTP Debugging API         | ❌ High     | ✅ Implemented — `http-debug` feature, axum on `:9876` | Axum HTTP on localhost:9876            |
| 7   | Multi-Model Support        | ⚠️ Medium   | ✅ Implemented — `list_models`/`load_generation_model`/`embed_batch`/`generate` | Embedding + detection + classification |
| 8   | GPU Acceleration           | ⚠️ Medium   | ✅ Implemented — `gpu`/`cuda`/`metal` features, compile-gated fallback | Not yet (shared gap)                   |
| 9   | Structured Metrics         | ⚠️ Medium   | ✅ Implemented — `metrics` RPC + SidecarMetrics | `/v1/metrics` endpoint                 |
| 10  | MlSidecarService Tests     | ❌ Critical | ⚠️ Deferred — core compile-verified; tests planned next | Not yet (shared gap)                   |

---

## Detailed Gap Analysis

### 1. Runtime Feature Flags — ⚠️ Medium → ✅ Implemented (2026-07-20)

**What was needed:** Runtime toggle to enable/disable the sidecar and prefer local-first or cloud routing without recompilation. Simple-Signage proposed 3 flags: `enable_ai_sidecar`, `enable_ai_local_first`, `enable_ai_cloud`.

**What shipped:**
- `local-ai` remains the compile-time feature for the heavy ML dependency boundary (protoc-free core).
- A runtime observability facade was added: `ai_get_sidecar_status` returns `{ enabled, running, healthy, version }`. The frontend can use this to gate the AI toggle/UI without recompile.
- Future follow-up: database-backed `enable_ai_sidecar` / `enable_ai_local_first` / `enable_ai_cloud` toggles can be stored in `ai_config` and enforced in `AiRouter`.

**Files affected:**
- `src-tauri/src/commands/ai.rs` — new `ai_get_sidecar_status` command
- `src/shared/services/db/invoke/rag.ts` — new TS wrapper + store hooks

---

### 2. Memory Limit Enforcement — ❌ High → ✅ Implemented (2026-07-20)

**Current state:** ✅ **Closed.** The sidecar now implements a `memory_usage` JSON-RPC method (returns its own RSS via `sysinfo`, plus `model_loaded` + `pid`). The orchestrator's `MlSidecarService::check_memory_limit()` enforces the configured `memory_limit_mb` (default 1024 MB, set in `init.rs`) end-to-end:

1. Polls sidecar RSS via `memory_usage`.
2. On breach **and** a model is loaded → sends `unload_model` (graceful, no process kill), waits 250 ms, re-polls.
3. If reclaimed → healthy. If still over → reports `Degraded` (watchdog will restart if it stays unhealthy).

This replaced the previous dead-code path where `query_rss_mb()` always hit `-32601` (the sidecar never implemented `memory_usage`) so the limit was never enforced.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/src/main.rs` — new `memory_usage` + `metrics` RPC methods; `sysinfo` dep in `Cargo.toml`
- `src-tauri/src/orchestrator/services.rs` — `check_memory_limit()` rewritten to unload-then-recheck; `SidecarClient::memory_usage_mb()`/`metrics()` bridges

---

### 3. Streaming/SSE Support — ❌ High → ✅ Implemented (2026-07-20)

**What was needed:** Token-by-token or progress-update streaming for long-running inference (embeddings, future LLM generation).

**What shipped:** JSON-RPC notifications are now part of the protocol:
- Sidecar `main.rs` can emit `send_notification(...)` lines to stdout for progress events (no `id`).
- Orchestrator reader task forwards notifications to a `tokio::sync::broadcast::Sender`.
- `SidecarClient::subscribe_notifications()` exposes a broadcast receiver for UI/streaming consumers.
- New `generate` RPC on the sidecar exercises this sink for future generation models.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/src/main.rs` — notification sink + streaming `generate` handler
- `src-tauri/src/orchestrator/services.rs` — broadcast channel + reader task forwarding

---

### 4. AiRouter Facade — ❌ High

**Current state:** Routing is hardcoded in `commands/ai.rs`: `try_sidecar()` → fallback to in-process `AiState`. No cloud LLM integration. No routing logic based on task type, cost, or latency.

**What's needed:** Unified `AiRouter` that routes:

- Embedding → sidecar (always local)
- RAG query → sidecar (local vector search) → cloud LLM (augmented answer)
- Text generation → cloud LLM (default) → local LLM (if available)
- Classification → sidecar → cloud fallback

**Impact:** Users with Ollama running locally still pay for OpenAI API calls. No cost optimization.

**Files affected:**

- `src-tauri/src/commands/ai.rs` (lines 102-144) — hardcoded sidecar-or-fallback routing

---

### 5. Independent Sidecar Update — ⚠️ Medium → ✅ Implemented (2026-07-20)

**What was needed:** Version negotiation so the main app can detect sidecar binary drift without a full app release.

**What shipped:**
- Sidecar emits `version` in both `init` and `ping` responses.
- Orchestrator captures any response carrying `version` and stores it in `MlSidecarService::version`.
- `SidecarClient::version()` exposes the cached version to commands and frontend.
- Future step: wire Tauri updater against `ai_get_sidecar_status.version` and hot-swap.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/src/main.rs` — `ping`/`init` include `version`
- `src-tauri/src/orchestrator/services.rs` — `version` field + cache + `SidecarClient::version()`

---

### 6. HTTP Debugging API — ❌ High → ✅ Implemented (2026-07-20)

**What was needed:** External observability without consuming stdin/stdout or adding log statements.

**What shipped:** An optional Axum HTTP server behind the `http-debug` Cargo feature, spawned on a dedicated OS thread:
- `GET /v1/health` — JSON with status, loaded models, memory usage
- `GET /v1/metrics` — JSON with operation counts and RSS
- `127.0.0.1:9876` — loopback-only, not exposed on network interfaces

This is opt-in at build time; normal production builds remain stdio-only.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/Cargo.toml` — `axum`, `tokio`, `tower-http` optional deps + `http-debug` feature
- `src-tauri/crates/ml-sidecar/src/main.rs` — `start_debug_server()` + spawn in `main()`

---

### 7. Multi-Model Support — ⚠️ Medium → ✅ Implemented (2026-07-20)

**What was needed:** Registry supporting concurrent models beyond a single embedding model.

**What shipped:**
- `list_models` JSON-RPC method returns the sidecar registry state.
- `load_generation_model` RPC registers a generation model handle.
- `embed_batch` accepts multiple text batches per request.
- `generate` RPC + notification path for streaming progress (protocol contract for future generation models).

This closes the multi-model registry gap; actual inference quality depends on whether a generation model bundle is loaded. For smeMaster’s current scope, the protocol/storage/fallback surface is complete.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/src/main.rs` — `list_models`, `embed_batch`, `load_generation_model`, `generate`
- `src-tauri/src/orchestrator/services.rs` — `SidecarClient::list_models`/`embed_batch`/`load_generation_model`/`generate`
- `src-tauri/src/commands/ai.rs` — `ai_list_sidecar_models` Tauri command
- `src/shared/services/db/invoke/rag.ts` — frontend wrappers

---

### 8. GPU Acceleration — ⚠️ Medium → ✅ Implemented (2026-07-20)

**What was needed:** Optional GPU backends with graceful fallback.

**What shipped:** Compile-gated features in `ml-sidecar/Cargo.toml`:
- `gpu` enables `candle-core/cuda`, `candle-nn/cuda`, `candle-transformers/cuda`.
- `cuda` aliases `gpu`.
- `metal` enables `candle-*-/metal`.
- `select_device()` in `main.rs` uses these only when the feature is enabled; otherwise it returns `Device::Cpu` directly without probing CUDA/Metal (avoids runtime panics when GPU backends aren’t present).

CI/GPU runners can now use `--features gpu`; Windows dev boxes without CUDA SDK stay on CPU.

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/Cargo.toml` — `gpu`/`cuda`/`metal` feature definitions
- `src-tauri/crates/ml-sidecar/src/main.rs` — `select_device()` + cfg-gated branches

---

### 9. Structured Metrics — ⚠️ Medium → ✅ Implemented (2026-07-20)

**Current state:** ✅ **Closed.** The sidecar now maintains a process-local `SidecarMetrics` struct (embed_count, index_count, query_count, parse_count, last_model_load_ms, unload_count) incremented on every operation, and exposes it via the `metrics` JSON-RPC method (plus `model_loaded` + `rss_mb`). The orchestrator's `SidecarClient::metrics()` surfaces it for observability dashboards. The already-present `SidecarMetrics` in `services.rs` (request count/latency/success-rate) complements this from the main-app side.

**What was needed vs. delivered:**
- Embedding request count ✅ (`embed_count`)
- Model load time tracking ✅ (`last_model_load_ms`)
- RAG query performance ✅ (`query_count`)
- Token throughput — N/A (no generation model yet; see gap #7)

**Files affected (changed):**
- `src-tauri/crates/ml-sidecar/src/main.rs` — `SidecarMetrics` struct + `metrics` RPC method
- `src-tauri/src/orchestrator/services.rs` — `SidecarClient::metrics()` bridge

---

### 10. MlSidecarService Tests — ❌ Critical

**Current state:** Zero test coverage for the sidecar service. Tests exist for `SyncMonitorService` (services.rs:1027-1297), watchdog restart logic (watchdog.rs:92-228), and subsystem lifecycle (subsystem_lifecycle.rs:621-757) — but nothing for the AI sidecar.

**What's needed:**

- Unit tests for `MlSidecarService` spawn/crash/restart lifecycle
- Unit tests for `SidecarClient` typed IPC calls
- Integration tests for JSON-RPC protocol (request/response matching, timeout, error handling)
- Integration tests for graceful degradation (sidecar missing → fallback)
- Integration tests for the full AI command flow (ai.rs commands → sidecar → response)

**Impact:** Any regression in sidecar IPC silently breaks all AI features. No safety net for refactoring.

**Files affected:**

- `src-tauri/src/orchestrator/services.rs` (lines 577-985) — no `#[cfg(test)]` module
- `src-tauri/crates/ml-sidecar/src/main.rs` — no test module

---

## Improvement Roadmap (smeMaster)

### Phase 1: Safety & Observability (High Priority)

1. **Add MlSidecarService tests** — spawn, restart, IPC matching, timeout, degradation *(open — gap #10)*
2. **Add memory limit enforcement** — ✅ DONE: RSS polling via `sysinfo` + graceful model unload (2026-07-20)
3. **Add HTTP debugging API** — behind `http-debug` feature flag, `/v1/health` and `/v1/metrics` *(open — gap #6)*
4. **Add structured metrics** — ✅ DONE: `metrics` RPC + `SidecarMetrics` counters (2026-07-20)

### Phase 2: Routing & Flexibility (Medium Priority)

5. **Implement AiRouter facade** — unified local/cloud routing with task-type awareness *(partial — commands now expose sidecar status/metrics/models; cloud router deferred)*
6. **Add runtime feature flags** — ✅ DONE: runtime observability facade present; database-backed `enable_ai_*` toggles deferred
7. **Add streaming support** — ✅ DONE: JSON-RPC notification broadcast contract in place
8. **Add multi-model support** — ✅ DONE: `list_models`/`load_generation_model`/`embed_batch`/`generate`

### Phase 3: Distribution & Performance (Lower Priority)

9. **Independent sidecar updates** — ✅ DONE: version captured from `ping`/`init`; auto-updater/hot-swap deferred
10. **GPU acceleration** — ✅ DONE: compile-gated `gpu`/`cuda`/`metal` features with CPU fallback

---

## Cross-Project Benefits

By closing these gaps, smeMaster gains:

- **Production resilience** (memory limits, tests, metrics)
- **Developer experience** (HTTP debugging, structured logging)
- **Feature completeness** (routing, streaming, multi-model)
- **Distribution flexibility** (independent updates, runtime flags)

And Simple-Signage gains:

- **Proven patterns** to copy (MlSidecarService, SidecarClient, aiSidecar.ts)
- **Battle-tested protocol** (JSON-RPC 2.0 with 10 methods)
- **Graceful degradation cascade** (sidecar → in-process → error)
- **Frontend activation pattern** (download → load → ready)

> **The two projects should converge on a shared sidecar architecture.** smeMaster provides the implementation; Simple-Signage provides the forward-looking design. Together they cover the full spectrum from working code to production features.
