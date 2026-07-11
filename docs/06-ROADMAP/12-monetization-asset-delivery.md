# SMEMaster — Post-v1.0 Monetization: Asset & Plugin Delivery

> **Status:** 💤 Deferred (post-v1.0)
> **Source analysis:** [`docs/analysis.md`](../analysis.md#80-concept-mapping) §8.1, [`docs/monetization-style.md`](../monetization-style.md) §1.2–1.4, §4
> **Last updated:** 2026-07-09
> **Constraint:** Zero breaking changes. Builds on existing `commands/assets.rs`, `compute_backup_hash` (SHA-256), `EventBus`, and `SubsystemRegistry`.
>
> **Code-verified 2026-07-11:** No new CDN asset-delivery commands or SHA-256 streamed-download pipeline beyond the existing `commands/assets.rs` exist in `src-tauri`. This plan is **unstarted** (deferred to post-v1.0).

---

## Summary

Implement an **on-demand asset and plugin delivery system** inspired by Wondershare's Filmstock/Dr.Fone model: download premium templates, AI models, and optional sidecar binaries from a CDN on demand, with SHA-256 verification, progress events, and tier-based gating. SMEMaster's assets are lightweight (< 100 KB for templates), so the system is simpler than Wondershare's 4K media streaming but follows the same architectural pattern.

---

## Current State

| Existing System | Location | Relevance |
|----------------|----------|-----------|
| `commands/assets.rs` | `src-tauri/src/commands/assets.rs` | 3 thin asset commands — minimal, extensible |
| `compute_backup_hash` + `store_backup_hash` + `verify_backup_integrity` | Backup module | SHA-256 verification logic directly reusable |
| `sha2` crate | `Cargo.toml` | Already a dependency (used for backup integrity) |
| `reqwest` (streaming) | `Cargo.toml` | Already a dependency; used for OAuth HTTP calls |
| `EventBus` (15 events) | `orchestrator/` | Event infrastructure for `asset-download-progress` |
| `SubsystemRegistry` | `orchestrator/subsystem_lifecycle.rs` | OnDemand service pattern for sidecar lifecycle |
| Application data directory | `app_data_dir()` | Downloads land in `~/.smemaster/assets/` |
| `@tanstack/react-virtual` | Frontend | For large asset catalogs (already used in 5 lists) |

**Gap:** SMEMaster has all the infrastructure pieces but no unified asset download, verify, and gate pipeline. Templates are compiled in or loaded from DB; no CDN-based tiered delivery exists.

---

## Target Architecture

### 1. Asset Types

```rust
// Extension of existing asset model in commands/assets.rs
pub enum AssetType {
    Core,                                   // bundled, always available
    Downloadable {
        tier: AssetTier,
        cdn_url: String,
        sha256: String,
        size_bytes: u64,
    },
    SidecarBinary {
        tier: AssetTier,
        binary_name: String,
        version: String,
        purchase_type: PurchaseType,
    },
}

pub enum AssetTier {
    Free,
    Pro,
    IndividualPurchase { price_cents: u32, currency: String },
    ProOrIndividual { price_cents: u32, currency: String },
}
```

### 2. Download Pipeline

```
User requests premium template/asset
  → Rust check_entitlement(feature_id) → Denied/Freetier → paywall-trigger (see frontend doc)
  → Rust check_entitlement → Allowed
  → AssetManager::download(asset_id)
      → reqwest GET cdn_url (streaming, chunked)
      → writes to ~/.smemaster/assets/{asset_id}.tmp
      → emits 'asset-download-progress' every 5 chunks
      → SHA-256 verify using compute_backup_hash pattern
      → atomic rename .tmp → .smemaster/assets/{asset_id}
      → registers in SQLite assets table
  → Returns success → UI enables the feature
```

### 3. Reuse of Existing Infrastructure

| Existing Component | How It's Reused |
|--------------------|-----------------|
| `sha2` crate + `compute_backup_hash` fn | Direct reuse — SHA-256 verified asset integrity |
| `reqwest` streaming client | Already used; extend for chunked GET with progress callback |
| `EventBus.emit()` | New `asset-download-progress` event (key: `{asset_id, bytes_downloaded, total_bytes, speed}`) |
| `SubsystemRegistry` OnDemand | Sidecar binaries launched as OnDemand subsystems with idle shutdown |
| `app_data_dir()` | Cache directory: `{app_data_dir}/assets/` |
| `@tanstack/react-virtual` | Asset browser catalog (reuse existing VirtualList pattern) |
| `@tanstack/react-query` | Download status polling, cache invalidation |

### 4. Sidecar Binaries (Post-v1.0 stretch)

For heavy AI/ML modules where bundling into the main binary is impractical:

- Register in `tauri.conf.json` `externalBin` (already supports `binaries/` dir)
- Launch via `tauri-plugin-shell` sidecar spawn
- Lifecycle managed by `SubsystemRegistry` (OnDemand — starts on first use, idle shutdown)
- Sign sidecar binaries before load (verification — defer from `monetization-style.md` §4, borrowing from Modulus pattern)

**Applicability to SMEMaster:**
- Local AI inference engine (if offloading from cloud API)
- Deliverability ML reputation scorer (batch processing)
- Not needed for templates (< 100 KB, no sidecar required)

### 5. Dual Catalog

Wondershare's Filmstock model: subscription catalog and individual-purchase catalog are **mutually exclusive**. In SMEMaster:

- `owned_modules` table tracks individual purchases (see backend doc)
- `IndividualPurchase` assets never appear in `plan_entitlements`
- Asset manifests served from update endpoint (`api.github.com/repos/.../releases`) with `AssetTier` metadata
- Frontend `AssetCard` shows appropriate badge + CTA

---

## Implementation Phases

### Phase A — Asset Manager Core (~6h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| A1 | Create `AssetManager` struct wrapping download + verify + register | 2h | — | Extends `commands/assets.rs` |
| A2 | Implement chunked streaming download with progress callback | 2h | A1 | Reuse `reqwest`; emit `asset-download-progress` via EventBus |
| A3 | Wire SHA-256 verification using existing `compute_backup_hash` fn | 1h | A1, backend | Same `sha2` crate, same hash/verify pattern |
| A4 | Register `download_asset(asset_id)` + `verify_asset(asset_id)` IPC commands | 1h | A2, A3 | New commands alongside existing 3 asset commands |

### Phase B — Asset Manifest & CDN (~4h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| B1 | Create asset manifest JSON format (served from releases endpoint) | 1h | — | Maps `asset_id` → `{tier, cdn_url, sha256, size_bytes}` |
| B2 | Add `get_asset_manifest()` IPC command | 1h | B1 | Fetches and caches manifest |
| B3 | Integrate entitlement check into `download_asset` pipeline | 1h | A4, backend | Calls `check_entitlement` before download |
| B4 | Squash staging directory: temp → atomic commit on hash match | 1h | A4 | Error recovery — delete .tmp on failure |

### Phase C — Frontend Asset Browser (~5h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| C1 | Create `features/asset-browser/` feature folder | 0.5h | — | Follows SMEMaster feature-folder convention |
| C2 | `AssetGrid` + `AssetCard` components with download progress bar | 2h | B2 | Reuses `VirtualList` for large catalogs |
| C3 | Wire download progress to UI (`asset-download-progress` listener) | 1h | C2 | Progress events → progress bar animation |
| C4 | Integrate tier badges (Free/Pro/Individual) on asset cards | 1h | C3 | Uses `AssetTierBadge` from frontend doc Phase A |
| C5 | Add asset browser entry point (Settings → Templates & Assets, or Vault tab) | 0.5h | C4 | Non-breaking — new tab |

### Phase D — Sidecar Support (~6h, stretch)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| D1 | Define sidecar binary manifest + signature format | 1h | — | Borrow from Modulus pattern |
| D2 | Register sidecars as OnDemand subsystems | 2h | A4 | Uses `SubsystemRegistry` — start on first use, idle shutdown |
| D3 | Implement binary signature verification before launch | 2h | D1 | Ed25519 verify (reuse licensing public key) |
| D4 | Add `install_module` / `launch_module` / `remove_module` IPC commands | 1h | D2, D3 | Sidecar lifecycle |

---

## Backward Compatibility

| Existing System | Impact | Mitigation |
|----------------|--------|------------|
| `commands/assets.rs` (3 commands) | None — extended, not replaced | Old commands still work; new commands are additive |
| `compute_backup_hash` / backup module | None — SHA-256 fn is a shared utility, backup flow unchanged | Backup integrity unaffected |
| `EventBus` (15 events) | None — 1 new event added | No existing events modified |
| `SubsystemRegistry` | None — sidecars add new entries | No existing subsystems modified |
| `tauri.conf.json` bundle | None — `externalBin` can be added without changing existing entries | Existing MSI/NSIS/DMG/DEB unchanged |
| 704 IPC commands | None — only ~6 new commands added | Zero existing commands modified |

---

## Cross-References

- **Backend entitlement (gates asset downloads):** [`10-monetization-entitlement-engine.md`](10-monetization-entitlement-engine.md)
- **Frontend asset browser + tier badges:** [`11-monetization-frontend-paywall.md`](11-monetization-frontend-paywall.md)
- **Mobile (same download pipeline):** [`13-monetization-mobile-strategy.md`](13-monetization-mobile-strategy.md)
- **Source analysis:** [`../analysis.md`](../analysis.md#81-concept-mapping), [`../monetization-style.md`](../monetization-style.md) §1.2–1.4
- **Existing backup/SHA-256:** [`../02-BACKEND/07-key-management.md`](../02-BACKEND/07-key-management.md)
- **Existing asset commands:** [`../02-BACKEND/06-commands-reference.md`](../02-BACKEND/06-commands-reference.md)
