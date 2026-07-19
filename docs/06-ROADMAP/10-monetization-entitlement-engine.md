# SMEMaster — Post-v1.0 Monetization: Backend Entitlement Engine

> **Status:** 💤 Deferred (post-v1.0)
> **Source analysis:** [`docs/analysis.md`](../analysis.md#82-backend-what-smemaster-could-benefit-from) §8.2, [`docs/monetization-style.md`](../monetization-style.md) §1
> **Last updated:** 2026-07-09
> **Constraint:** Zero breaking changes to existing 831 IPC commands (768 `#[tauri::command]` + 63 `#[command]` shorthand, per `docs/STATUS.md`), 542 db functions (`grep -rE 'pub fn |pub async fn ' src-tauri/src/db`), or 43 Zustand stores (`grep -rEo 'create<' src` → 43). All additions are additive.
>
> **Code-verified 2026-07-11:** No `EntitlementEngine`, `check_entitlement`, `paywall-trigger`, `owned_modules`, or `entitlement_overrides` exist in `src-tauri` or `src`. This plan is **unstarted** (deferred to post-v1.0).

---

## Summary

Build a **Rust-authoritative entitlement engine** that unifies SMEMaster's three currently disconnected gating systems (`LicenseState`, `SubsystemRegistry`, `ToolRegistry`) into a single resolution point. This enables the "three-axis" monetization model from the Wondershare analysis: **plan → capabilities → individually purchased modules/assets**, with a clear resolution order that checks individual ownership before plan grants.

---

## Current State

| System | Location | Role | Enforcement |
|--------|----------|------|-------------|
| `LicenseState` | `licensing/license.rs` | Ed25519-signed keys, HW binding, tier resolution | Persisted but not wired to gating pipeline (`has_feature_access()` is defined but never called) |
| `SubsystemRegistry` | `orchestrator/subsystem_lifecycle.rs` | CAS state machine for background services; each entry has advisory `feature_flag` field | Enforced — commands cannot use inactive subsystems |
| `ToolRegistry` | `orchestrator/tool_registry.rs` | `DashMap<String, bool>` mirror of frontend FEATURE_FLAGS | Advisory (MVP stance — "enforcement deferred to post-MVP") |
| `FEATURE_FLAGS` | `src/constants/featureFlags.ts` | 28 frontend flags with `basic`/`pro` tier + usage limits | Client-side only (advisory) |

**Key gap:** No single `check_entitlement()` call that a command can use to say "does this user have access to this feature?" The three Rust layers don't talk to each other.

---

## Target Architecture

### 1. EntitlementEngine (new Rust struct)

```rust
// src-tauri/src/entitlements/engine.rs
pub struct EntitlementEngine {
    license: Arc<LicenseState>,       // existing
    subsystems: Arc<SubsystemRegistry>, // existing
    tools: Arc<ToolRegistry>,          // existing
    owned_modules: Arc<RwLock<HashMap<String, Vec<OwnedModule>>>>, // new
    db_pool: SqlitePool,               // existing
}
```

**Resolution order** (mirrors §2 of `analysis.md` and §1.1 of `monetization-style.md`):

```rust
impl EntitlementEngine {
    /// Returns the access level for a feature/module.
    /// 1. Owned individually? → Allowed (persists even if subscription lapses)
    /// 2. Active trial/override? → Allowed
    /// 3. License tier grants it? → Allowed
    /// 4. Otherwise → Denied (with reason + suggested action)
    pub async fn check_access(&self, feature_id: &str) -> AccessResult { ... }
}
```

### 2. SQLite Additions (new migration, non-destructive)

| Table | Columns | Purpose |
|-------|---------|---------|
| `owned_modules` | `module_id TEXT PK, account_id TEXT, purchase_timestamp TEXT, expires_at TEXT?, source TEXT` | Tracks individual purchases — checked **before** plan in resolution order |
| `entitlement_overrides` | `feature_id TEXT PK, reason TEXT, expires_at TEXT?, max_uses INT?` | Trials, promotional grants, manual overrides |

Both tables are additive — existing `licenses`, `plans`, and `capabilities` tables remain untouched.

### 3. New IPC Commands

| Command | Args | Returns | Purpose |
|---------|------|---------|---------|
| `check_entitlement` | `feature_id: String` | `AccessResult` enum | Single source-of-truth for "can user do this?" |
| `attempt_feature_use` | `feature_id: String, context: Value` | `Granted \| Denied { reason, suggested_action }` | Gating entry point for commands; emits `paywall-trigger` on deny |
| `buy_module` | `module_id: String, price_cents: u32, currency: String` | `PurchaseResult` | Records individual module purchase in `owned_modules` |
| `get_entitlements` | — | `EntitlementSnapshot` | Full state for frontend store sync |
| `list_owned_modules` | — | `Vec<OwnedModule>` | What user has bought a-la-carte |
| `get_feature_access` | `feature_id: String` | `"enabled" \| "limited" \| "locked"` | Return type matches frontend `FeatureAccess` type |

**All new** — existing `get_tool_state`, `apply_tool_state`, `validate_license`, `activate_license`, `check_feature_access` continue working unchanged.

### 4. Event Emission

When `attempt_feature_use` denies access:

```rust
app_handle.emit("paywall-trigger", PaywallTriggerPayload {
    feature_id,
    action: "send_campaign" | "export_report" | "enable_automation" | "use_ai" | "download_asset",
    result: AccessResult::RequiresUpgrade { tier: "pro", price_cents: 999 },
    context: { /* trigger location, previous state */ },
});
```

After successful purchase/upgrade:

```rust
app_handle.emit("entitlements-updated", EntitlementSnapshot { ... });
```

Both events reuse the existing `EventBus` infrastructure (15 events already mapped).

---

## Implementation Phases

### Phase A — Engine Core (~8h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| A1 | Create `src-tauri/src/entitlements/` module with `engine.rs` + `schema.rs` + `mod.rs` | 2h | — | Wraps existing `LicenseState` + `SubsystemRegistry` + `ToolRegistry` |
| A2 | Add `owned_modules` + `entitlement_overrides` SQLite migrations | 1h | — | Two new .sql files; existing migrations untouched |
| A3 | Implement `check_access()` resolution order | 2h | A1, A2 | owned → trial → plan → denied |
| A4 | Add `attempt_feature_use()` with `paywall-trigger` emission | 1.5h | A3 | Emits via existing `AppHandle` |
| A5 | Wire `EntitlementEngine` as managed Tauri state in `lib.rs` | 0.5h | A1 | One `manage()` call |
| A6 | Register all 6 new IPC commands | 1h | A4, A5 | `commands/mod.rs` + `generate_handler!` |

### Phase B — Subsystem Enforcement (~4h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| B1 | Wire `EntitlementEngine` into `require_subsystem_active()` | 2h | A5 | Currently `feature_flag` is advisory; make it enforced when engine is present |
| B2 | Add AccessResult → AppError conversion for gating | 1h | B1 | Map `Denied` → user-friendly `SerializedError` |
| B3 | Update `get_subsystem_status` to include entitlement info | 1h | B2 | Frontend can display "locked" vs "inactive" differently |

### Phase C — Purchase Flow (~6h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| C1 | Implement `buy_module` with license key generation or third-party billing hook | 3h | A2 | Can start with self-signed module keys (reuse Ed25519 from licensing) |
| C2 | `entitlements-updated` event → Zustand refresh cycle | 1.5h | A5 | See frontend doc `11-monetization-frontend-paywall.md` |
| C3 | Add owned_modules to `get_entitlements` snapshot | 0.5h | A2 | Full state for frontend |
| C4 | Individual-purchase expiry handling (grace period, re-activation) | 1h | C1 | Reuse existing license expiry patterns |

---

## Backward Compatibility

| Existing System | Impact | Mitigation |
|----------------|--------|------------|
| `LicenseState` + `activate_license`/`validate_license` | None — wrapped, not replaced | `EntitlementEngine.license` delegates to same struct |
| `SubsystemRegistry.require_active()` | Enhanced — `feature_flag` becomes enforced | Only enforced when engine is present; without engine, reverts to advisory (safe deploy rollback) |
| `ToolRegistry.get_tool_state`/`set_enabled` | None — tools remain as view into engine | Old commands still work; state is read from engine resolution |
| `getFeatureAccess()` on frontend | Unchanged — still works synchronously | New frontend `entitlementStore` layer is additive |
| 831 IPC commands | Zero modified | Only 6 new commands added |

---

## Cross-References

- **Frontend counterpart:** [`11-monetization-frontend-paywall.md`](11-monetization-frontend-paywall.md)
- **Asset delivery (uses same SHA-256 + EventBus):** [`12-monetization-asset-delivery.md`](12-monetization-asset-delivery.md)
- **Mobile (same engine, bottom-sheet UI):** [`13-monetization-mobile-strategy.md`](13-monetization-mobile-strategy.md)
- **Source analysis:** [`../analysis.md`](../analysis.md#82-backend-what-smemaster-could-benefit-from) §8.2, [`../monetization-style.md`](../monetization-style.md) §1
- **Existing licensing:** [`../02-BACKEND/07-key-management.md`](../02-BACKEND/07-key-management.md)
- **Existing subsystem lifecycle:** [`../01-ARCHITECTURE/02-backend-structure.md`](../01-ARCHITECTURE/02-backend-structure.md)

## Source reconciliation (2026-07-19)

Metric figures corrected to match `docs/STATUS.md` (grepped from source): the constraint header and impact table cited **704 IPC commands / 586 db functions / 38 Zustand stores**; the verified values are **831 commands** (768 + 63), **542 db `pub fn`** (`grep -rE 'pub fn |pub async fn ' src-tauri/src/db`), and **43 Zustand stores** (`grep -rEo 'create<' src`). The plan's deferred/unstarted status is unaffected.
