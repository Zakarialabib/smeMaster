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
| 1   | Runtime Feature Flags      | ⚠️ Medium   | Compile-time only; runtime flag is dead code | 3-flag system with env overrides       |
| 2   | Memory Limit Enforcement   | ❌ High     | ✅ Implemented — `memory_usage` RPC + graceful unload | Configurable limit + OOM protection    |
| 3   | Streaming/SSE Support      | ❌ High     | Sync request-response only                   | SSE for long-running inference         |
| 4   | AiRouter Facade            | ❌ High     | Binary sidecar-or-fallback; no cloud routing | tryLocal→trySidecar→tryCloud           |
| 5   | Independent Sidecar Update | ⚠️ Medium   | Documented as future; not implemented        | Version-decoupled auto-updater         |
| 6   | HTTP Debugging API         | ❌ High     | stdin/stdout only; no external interface     | Axum HTTP on localhost:9876            |
| 7   | Multi-Model Support        | ⚠️ Medium   | Embedding-only; no generation/detection      | Embedding + detection + classification |
| 8   | GPU Acceleration           | ⚠️ Medium   | Detection exists; no actual GPU deps         | Not yet (shared gap)                   |
| 9   | Structured Metrics         | ⚠️ Medium   | ✅ Implemented — `metrics` RPC + SidecarMetrics   | `/v1/metrics` endpoint                 |
| 10  | MlSidecarService Tests     | ❌ Critical | Zero test coverage for sidecar service       | Not yet (shared gap)                   |

---

## Detailed Gap Analysis

### 1. Runtime Feature Flags — ⚠️ Medium

**Current state:** smeMaster uses `local-ai` Cargo feature (compile-time only). The `feature_flag` parameter in `SubsystemEntry` (subsystem_lifecycle.rs:45) is advisory but not enforced — the `_feature_flag` parameter in `require_subsystem_active()` (gating.rs:33) is dead code.

**What's needed:** Runtime toggle to enable/disable the sidecar without recompilation. Simple-Signage proposes 3 flags: `enable_ai_sidecar`, `enable_ai_local_first`, `enable_ai_cloud`.

**Impact:** Users cannot enable/disable local AI at runtime. Every build either has or doesn't have ML support.

**Files affected:**

- `src-tauri/src/orchestrator/gating.rs` (line 33) — `_feature_flag` parameter is ignored
- `src-tauri/src/orchestrator/subsystem_lifecycle.rs` (line 45) — `feature_flag` field is advisory only

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

### 3. Streaming/SSE Support — ❌ High

**Current state:** All JSON-RPC methods are synchronous: write request → wait for full response (30s timeout). No support for token-by-token LLM generation or progressive inference results.

**What's needed:** Either:

- Streaming JSON-RPC (partial results sent as notifications with matching ID)
- SSE endpoint for real-time token streaming
- Both for different use cases (JSON-RPC for embeddings, SSE for generation)

**Impact:** LLM text generation feels slow because the entire response must complete before any tokens appear.

**Files affected:**

- `src-tauri/crates/ml-sidecar/src/main.rs` (line 760) — main loop reads line-by-line, one request/response
- `src-tauri/src/orchestrator/services.rs` (line 650) — `send_request()` uses 30s timeout, blocks until complete

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

### 5. Independent Sidecar Update — ⚠️ Medium

**Current state:** Documented as a future benefit (07-sidecar-architecture.md:118-126) but not implemented. The sidecar binary is bundled at build time. The `ping` response includes a `version` field but it's not checked by the main app.

**What's needed:** Version negotiation protocol, auto-updater for sidecar releases, seamless hot-swap (new sidecar spawns, old one drains).

**Impact:** Every sidecar improvement requires a full app update. Users on slow release cycles miss critical ML fixes.

**Files affected:**

- `src-tauri/crates/ml-sidecar/src/main.rs` (line 327) — version in ping response but unchecked
- `src-tauri/Cargo.toml` (line 40) — `tauri-plugin-updater` exists but not used for sidecar

---

### 6. HTTP Debugging API — ❌ High

**Current state:** stdin/stdout only. No way to inspect sidecar state from browser devtools, curl, or monitoring tools. The sidecar is a black box.

**What's needed:** Optional HTTP API (behind `http-debug` feature) with:

- `GET /v1/health` — status, loaded models, memory usage
- `GET /v1/metrics` — request counts, latencies, error rates
- `GET /v1/models` — model registry status

**Impact:** Debugging sidecar issues requires adding logging statements. No external observability.

**Files affected:**

- `src-tauri/crates/ml-sidecar/src/main.rs` — no HTTP server
- `src-tauri/crates/ml-sidecar/Cargo.toml` — no axum/tower-http dependency

---

### 7. Multi-Model Support — ⚠️ Medium

**Current state:** Embedding-only (`BertModel` via candle). No generation model, no detection model, no classification model. The sidecar architecture doc (line 288) lists "Multi-model: Run embedding + ranking + LLM" as long-term future.

**What's needed:** Model registry that supports concurrent models:

- BGE-small (embedding)
- YOLOv8n (detection)
- T5/GPT-2 (text generation — optional)
- Content guard classifier

**Impact:** Sidecar can only do one thing (embed). Cannot serve multiple AI workloads simultaneously.

**Files affected:**

- `src-tauri/crates/ml-sidecar/src/main.rs` (line 83) — `MlResources` holds single model

---

### 8. GPU Acceleration — ⚠️ Medium

**Current state:** Runtime detection exists (`Device::cuda_if_available(0).unwrap_or_else(|_| Device::new_metal(0).unwrap_or(Device::Cpu))`) but no actual GPU dependencies (`candle-metal`, `candle-cuda`) in Cargo.toml.

**What's needed:** Optional GPU backends with graceful fallback. Documented performance characteristics (GPU vs. CPU benchmarks).

**Impact:** YOLO detection on CPU is 5-10x slower than GPU. Embedding throughput is limited.

**Files affected:**

- `src-tauri/crates/ml-sidecar/Cargo.toml` — no `candle-metal` or `candle-cuda` dependencies
- `src-tauri/crates/ml-sidecar/src/main.rs` (line 167) — GPU detection exists but always falls back to CPU

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

5. **Implement AiRouter facade** — unified local/cloud routing with task-type awareness
6. **Add runtime feature flags** — database-stored toggle for sidecar enable/disable
7. **Add streaming support** — SSE endpoint for LLM text generation
8. **Add multi-model support** — model registry with concurrent model loading

### Phase 3: Distribution & Performance (Lower Priority)

9. **Independent sidecar updates** — version negotiation, auto-updater, hot-swap
10. **GPU acceleration** — optional `candle-metal`/`candle-cuda` backends with benchmarks

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
