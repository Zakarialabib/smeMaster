# AI Stack — Cross-Pollination with SignSync (Simple-Signage)

> **Status:** findings + proposals. Nothing implemented. Audited 2026-09-28 against both working trees.
> **Companion:** `Simple-Signage/docs/06-ROADMAP/27-AI-STACK-INNOVATION-PLAN.md` (the plan this came from)
> **Related here:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> [`docs/voice/dev/SELF-HOSTING.md`](../voice/dev/SELF-HOSTING.md) ·
> [`docs/voice/dev/RAG-FORK.md`](../voice/dev/RAG-FORK.md) ·
> [`13-deprecations.md`](../03-FRONTEND/13-deprecations.md) · [`12-diagnostics.md`](../02-BACKEND/12-diagnostics.md)

## 0. Why this document exists

An audit of SignSync's local-AI tier produced a verified diagnosis and a set of innovations. Auditing
SignSync also meant auditing **the same problem class here**, and the honest result is that the exchange
runs **both ways**:

**SMEMaster's AI stack is architecturally ahead of SignSync's on the axis that actually breaks.** The
sidecar lifecycle is more mature, the feature defaults are correct, and the IPC surface never lies.
SignSync is ahead on *diagnosability and model provisioning*. This document records both directions so
neither side re-derives the other's lessons.

**Contrast established by evidence, not by assumption:**

| Axis | SMEMaster | SignSync |
|---|---|---|
| Is the AI tier in the default build? | ✅ `default = ["rustls-tls", "local-ai"]` — `src-tauri/Cargo.toml:112` | ❌ `ai_sidecar = []` is **empty and absent from `desktop`** → 12 commands cfg'd out, sidecar never spawned |
| When the feature is off, what happens to the commands? | ✅ Commands stay registered with honest `#[cfg(not(feature = "local-ai"))]` stubs returning `{enabled:false, running:false}` — `commands/ai.rs:522-573` | ❌ Commands are **cfg'd out entirely** → the frontend gets "command not found" |
| Runtime dependency | ✅ **candle + lancedb — pure Rust from crates.io. No ONNX Runtime, no CDN, no dylib** | ❌ requires ONNX Runtime: `cdn.pyke.io` at build time or `ORT_DYLIB_PATH` at run time; **neither is available** |
| Sidecar lifecycle | ✅ Real `Subsystem`: spawn, health check, watchdog restart, **RSS polling + graceful model unload on over-limit** (`orchestrator/services.rs:944-993`), registered OnDemand (`orchestrator/init.rs:109-127`) | ⚠️ `plugin-ai-stack/src/sidecar/process.rs` has spawn/call/health/restart but **no memory ceiling or model unload** |
| Readiness gating | ✅ `registry.require_active("ml_sidecar")` before subsystem work | ⚠️ binary name resolved by hand; no gating vocabulary |
| Diagnostics | ❌ no single command reporting build/process/runtime/model/capability | ⚠️ `backend_available` exists but answers the wrong axis |
| Model identity | ❌ `BAAI/bge-small-en-v1.5` hard-coded in **6 sites**; dimension is config-dependent and unvalidated | ⚠️ substring fragment matching (a `style` fragment matches a directory name) |

---

## 1. What SMEMaster should take from SignSync

### 1.1 `ai_stack_doctor` — one command, the whole ladder
Today, answering "why can't on-device AI run?" means reading `orchestrator/services.rs`,
`ai/models.rs`, `commands/ai.rs` and the feature list. Replace that with one command returning:

```
ai_stack_doctor() -> {
  build:   { local_ai, candle, gpu, metal },           // cfg!() — free, compile-time
  process: { registered, spawned, pid, uptimeSecs, restarts, binaryName, binaryFound, binaryBytes },
  runtime: { backend, device, threads },                // from the sidecar's own status reply
  models:  { dir, count, slots: [{ slot, path, bytes, sha256ok }] },
  tools:   [ { toolId, status, rung, servingPath, fix } ]
}
```

Why it matters more here than there: **SMEMaster already has three honest signals that no one surface
composes** — the stubbed `enabled/running/healthy` shape, the subsystem registry's health status, and the
sidecar's own `memory_usage` reply. The doctor is a composition, not new machinery. Pair it with the
`Capabilities` type already proposed in
[`docs/voice/design/FRONTEND.md`](../voice/design/FRONTEND.md) §3.2 — they are the same idea at two
layers, and should be one type.

### 1.2 A slot registry to replace the 6 hard-coded embedder sites
[`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) D2 established that
`BAAI/bge-small-en-v1.5` appears in 6 places and that **the desktop index dimension is not a constant**
(`rust_bge` = 384 vs `provider` = N). SignSync's substring-presence bug is the same shape: identity and
*resolution* are separate concerns that were fused.

```ts
interface ModelSlot {
  slot: 'embedding' | 'rerank' | 'stt' | 'tts';
  defaultModel: string;      // exact repo/stem the runtime resolves
  dims?: number;             // for embeddings — the thing that must never be assumed
  bytes: number; sha256: string; licence: string;
  runtimes: RuntimeId[];     // which runtime can serve it (candle | provider | server)
}
```

Presence becomes "the slot resolved to a file whose hash matches", and **the dimension travels with the
slot** instead of being a literal. That closes the deprecation entry in
[`13-deprecations.md`](../03-FRONTEND/13-deprecations.md) (2026-09-28) at the root rather than by a guard.

### 1.3 The embedding-source toggle needs a truth table
`embeddingSource: rust_bge | provider | auto` (`src/features/assistant/stores/ragStore.ts:36`) is the
same class as SignSync's engine toggle: **a selector that can report a mode the runtime cannot honour**.
The docs already concede that `auto` "can resolve either way". Make it a tri-state derived from
observation, not from the stored preference:

| State | Meaning | UI |
|---|---|---|
| `off` | user chose off | toggle is meaningful |
| `selected-but-inert` | a source is selected; it cannot serve (no provider endpoint, model not downloaded, dims mismatch) | toggle **disabled**, blocking reason shown |
| `serving` | a source is live and its dimension is known | normal |

### 1.4 A command-parity manifest
TypeScript cannot see a Rust `#[cfg]`. SMEMaster is currently **safe from the failure SignSync has**
because its stubs keep commands registered — but that safety is a convention, **not a check**. There are
~802 commands and ~504 typed `db-invoke` wrappers; a manifest generated from `generate_handler![]`
resolved against the active feature set, diffed against the TS registry in CI, turns the convention into
a gate. (This also directly serves the `ADR-001` D4 IPC-surface work.)

### 1.5 Licence gate as code, not prose
[`RAG-FORK.md`](../voice/dev/RAG-FORK.md) correctly rejects `jina-embeddings-v3` (CC-BY-NC-4.0) in its
model table, and SignSync's plan proposes the same idea as an **L4-model-licence** gate sitting alongside
the existing L1/L3 vocabulary in that repo. A licence column that nothing enforces is a comment. Make
fetch/load refuse a non-commercial model.

---

## 2. What SignSync should take from SMEMaster

### 2.1 Candle-only. No ONNX Runtime. This is the whole lesson.
SignSync's **rung 5** — no ONNX Runtime on disk, `load-dynamic` needing an unset `ORT_DYLIB_PATH`, and
`download-binaries` needing an intercepted CDN — is *entirely* a consequence of choosing ONNX Runtime.
`ml-sidecar` avoids it by construction: **candle + lancedb are pure Rust from crates.io.** There is no
build-time CDN, no runtime dylib to supply, and nothing to vendor. For a product whose premise is
offline-first, that is not a detail — it is the deciding property.

### 2.2 No-op stubs beat cfg'd-out commands
`#[cfg(not(feature = "local-ai"))]` returning `{enabled:false, running:false, healthy:false}` keeps the
IPC surface **stable and self-describing**. SignSync cfg's the commands out, so the frontend compiles
against commands that do not exist and discovers it at runtime. Copy the stub pattern.

### 2.3 `local-ai` in `default`
"A tier that is present unless explicitly excluded" is the correct default for a feature the product
advertises. SignSync ships the opposite and then asks the user to rebuild with a feature flag.

### 2.4 Watchdog + memory ceiling + graceful model unload
`orchestrator/services.rs:944-993` polls RSS, and on breach asks the sidecar to unload a model, then
re-checks — recovering or escalating to a restart. SignSync's sidecar manager has restart logic but **no
memory ceiling**, and it loads 170 MB+ vision models. A model-load OOM with no graceful unload is a crash
the user cannot recover from without restarting the app.

### 2.5 `require_active` as a readiness vocabulary
`registry.require_active("ml_sidecar")` gives one typed answer for "is this subsystem usable right now",
used at `subsystem_lifecycle.rs:846-906`. SignSync's equivalent check is a binary-name string in a spawn
call. Adopt the vocabulary, not just the check.

---

## 3. A finding on this side, flagged not asserted

`src-tauri/tauri.conf.json:39-40` declares `externalBin: ["binaries/ml-sidecar"]`, but
**`src-tauri/binaries/` does not exist.** Tauri resolves an `externalBin` entry to
`binaries/ml-sidecar-<target-triple>{.exe}` at **bundle** time. In dev, `tauri_plugin_shell`'s
`.sidecar("ml-sidecar")` resolves from the build output, so dev is expected to work — which is presumably
why this has not surfaced.

**So the risk is specifically: a packaged desktop build may ship without the ml-sidecar binary**, and
on-device RAG would be absent in the installer while working in `tauri dev`.

**Not asserted** — this was read from the manifest, not reproduced. The verification is a real build:

```bash
npx tauri build            # or: npm run build && cargo tauri build
# then inspect the bundled resources for ml-sidecar-<triple>.exe
find src-tauri/target/release/bundle -iname "*ml-sidecar*"
```

If it is absent, the fix is the same as SignSync's T3: a build step that produces
`src-tauri/binaries/ml-sidecar-$TARGET.exe` before bundling. **Do not "fix" it by deleting the
`externalBin` entry** — that would silently drop the sidecar from the package instead of shipping it.

---

## 4. Suggested sequencing here

| # | Item | Effort | Where |
|---|---|---|---|
| 1 | Verify the `externalBin` / bundling gap with a real `tauri build` (§3) | 1h | — |
| 2 | `ai_stack_doctor`, sharing one type with the voice design's `Capabilities` (§1.1) | 1d | `src-tauri/src/commands/ai.rs`, `orchestrator/services.rs` |
| 3 | `ModelSlot` registry replacing the 6 hard-coded sites (§1.2) — this is the fix the deprecation entry is waiting for | 1d | `src-tauri/src/ai/models.rs`, `src/features/assistant/**`, `crates/ml-sidecar/**` |
| 4 | Tri-state embedding-source (§1.3) | 0.5d | `ragStore.ts`, `embeddingService.ts` |
| 5 | Command-parity manifest (§1.4) | 1d | `scripts/`, CI |
| 6 | Licence gate as code (§1.5) | 0.5d | model fetch/load path |

Items 2–4 also unblock the voice agent's Gate 1 `EmbeddingProvider` seam
([`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) D3) — the server
seam and the desktop slot registry should share the dimension contract, or the three embedding spaces
get harder to keep apart than they already are.
