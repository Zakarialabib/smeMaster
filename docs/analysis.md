Below is a synthesized, high‑level blueprint that combines the strongest points from the panel analysis. Where the two reference models disagreed (OAuth callback mechanism and how context‑aware paywalls render), I present **both options** and a recommended default so your team can decide based on platform constraints.

---

## 1. Comparison & User Story: Asset & Plugin Management

### How Wondershare‑style products monetize (the pattern to mirror)
| Product | Model | Asset / Plugin Delivery | Key Pattern |
|---|---|---|---|
| **Filmora** | Freemium + “Creative Assets” subscription (Free / Standard / Premium) | Effects/transitions/titles pulled from Filmstock; pink‑diamond markers on paid assets; downloaded assets stop working if subscription lapses | Subscription‑gated library with visual tier indicators |
| **Dr.Fone** | Modular toolkit — each tool sold individually *or* as “Full Toolkit” bundle | Each tool is a standalone module with its own download/install; free trial per tool | Per‑module purchase that can **coexist with Pro** |
| **Filmstock** | 3‑tier subscription **+** a “Single Purchase” library that does *not* overlap | Auto‑installs into editor; download credits that don’t roll over | **Dual catalog**: subscription‑only vs. one‑time‑purchase‑only |

### The core user story (Alex, a Free‑tier creator)
1. **Discovery** – Alex opens the app. The library shows transitions with a gold `P` (Pro) or purple `$` (add‑on) badge.
2. **Sunk‑cost usage** – Alex drags a “Pro” transition into the timeline. It streams from the CDN instantly. The editor lets Alex perfect the sequence (Wondershare relies on the *sunk‑cost fallacy*: the user has now invested time).
3. **The upsell bottleneck** – Alex hits **Export**. The app computes the entitlement matrix of the timeline and shows a condensed modal: *“Your project uses Cinematic Transition Pack. Upgrade to Pro to export without watermark, or buy this pack for $4.99.”*
4. **Frictionless auth** – Alex clicks “Sign in with Google.” The OS browser opens, OAuth completes, the token is stored securely, and the export begins — no app restart.

This “enable‑then‑gate‑at‑bottleneck” UX is the single most important behavioral pattern to copy.

---

## 2. High‑Level Architecture

**Principle:** *Rust is the single source of truth.* The WebView(s) are thin clients that pull snapshots via `invoke()` and receive updates via `emit()`. This follows Tauri’s recommended multi‑window state‑sync pattern.

```
┌──────────────────────────────────────────────────────────────┐
│                      TAURI APPLICATION SHELL                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              FRONTEND (React + Tailwind + Zustand)       │  │
│  │  Splash/Onboard │ Editor │ Asset Browser │ Auth/Paywall   │  │
│  │  └─ Zustand cache (entitlements, downloads, UI state) ─┘  │  │
│  └───────────────────────────┬──────────────────────────────┘  │
│                              │ IPC (invoke / emit)              │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │                   BACKEND (Rust)                          │  │
│  │  Entitlement Engine │ Asset Manager │ Auth/OAuth │ Plugin │  │
│  │  Registry (sidecar loader)                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ SQLite   │ │ Tauri    │ │ Sidecar  │ │ OS Keychain  │  │  │
│  │  │ manifest │ │ Store    │ │ Manager  │ │ (keyring)    │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘ │
│  Plugins: fs | http | shell | dialog | notification | updater | │
│           deep-link | store | upload | single-instance          │
└───────────────┬───────────────────────────┬─────────────────────┘
                ▼                           ▼
        Cloud Backend (Auth,      CDN (Effects, models,
        Billing, Entitlement API) presets, sidecar binaries)
```

### Three‑axis entitlement model (the heart of the system)
Separate **plans** (billing) from **capabilities** (what the app checks) from **modules/assets** (individually purchasable). This cleanly supports “buy individual even within Pro.”

```rust
pub struct EntitlementState {
    pub plan: Plan,                       // free | pro_monthly | pro_annual
    pub owned_modules: Vec<ModuleId>,     // persists even with Pro
    pub owned_assets: Vec<AssetId>,       // one-time buys
    pub capabilities: CapabilityMap,      // resolved from plan + modules
    pub subscription_expires_at: Option<DateTime<Utc>>,
}
```

Resolution order (Rust authoritative check):
1. Is the module/asset individually owned? → **Allowed**
2. Does the plan grant this capability (and not expired)? → **Allowed**
3. Is there an active trial/override? → **Allowed**
4. Else → **RequiresUpgrade / RequiresModulePurchase / RequiresAssetPurchase**

SQLite tables: `plans`, `capabilities`, `plan_entitlements`, `owned_modules`, `owned_assets`, `entitlement_overrides`.

---

## 3. User Journey & Key Stages

### Stage 1 — Onboarding (Splash / Installer Window)
* **Window:** 380×520, `decorations: false`, `center: true`, route `#/splash`.
* **Logic:** Rust loads an embedded manifest of presets. Free presets download immediately; Pro presets show a `[P]` badge.
* **Trigger behavior:** Tapping a Pro preset opens an **inline paywall** inside the splash (not a browser). If unauthenticated → Google/Facebook OAuth buttons; if Free → “Upgrade to Pro” pricing; if Pro → auto‑download.
* **Background:** Proxy/thumbnail assets download so the editor feels instant; heavy 4K elements stay in the cloud.
* **Exit:** “Enter Editor” closes splash, opens main window via `WebviewWindowBuilder`.

### Stage 2 — The Editor Workspace & Authentication
* **Layout:** 3‑panel Tailwind grid (Tool Panel / Preview Canvas / Effects Panel) + Timeline.
* **Gating:** Every effect/tool node carries a `required_tier`. Clicking a gated node checks the Zustand cache, then calls `attempt_feature_use` in Rust.
* **Auth modal (context‑aware):** Condensed card with “Continue with Google / Facebook.” After OAuth:
  1. Rust receives token (via deep‑link *or* localhost listener — see §5),
  2. exchanges with cloud backend → entitlement blob,
  3. updates `EntitlementState`,
  4. emits `entitlements-updated` to all windows,
  5. **original feature auto‑retries** (no second click).

### Stage 3 — Asset Handling (Heavy vs. Core)
Assets fall into three buckets via a Rust enum:

```rust
pub enum AssetType {
    Core,                          // bundled, <5MB, always available
    Downloadable { tier, cdn_url, sha256, size_bytes },  // streamed on demand
    Module { sidecar_binary, purchase_type, version },   // heavy individual tools
}

pub enum AssetTier {
    Free,
    Pro,
    IndividualPurchase { price_cents, currency, purchase_url }, // never in any plan
    ProOrIndividual { price_cents, currency },                  // Pro gets it; others buy
}
```

* **Download:** Rust `reqwest` streams chunks to `~/.appname/assets/`, emits `asset-download-progress` events, verifies SHA‑256, registers in SQLite.
* **Buy‑individual‑even‑within‑Pro:** `IndividualPurchase` assets are **never** in `plan_entitlements`. Because `owned_assets` is checked *before* plan capabilities, a user who bought an asset à‑la‑carte keeps it even if they later cancel Pro (mirrors Filmstock’s single‑purchase library).
* **Expiry:** Downloaded Pro assets stay cached but are gated at *apply/export* time — never deleted.

---

## 4. UI/UX Logic: Context‑Aware Condensed Windows

**Recommended default: inline overlay divs** within the current WebView (avoids focus‑stealing, keeps user oriented). **Optional:** spawn a detached `WebviewWindow` for a “mini‑store” anchored to the cursor when right‑clicking an empty plugin slot.

### Design rules
| Rule | Implementation |
|---|---|
| **One modal at a time** | If a trigger fires while one is open, update content instead of stacking |
| **Anchor near trigger** | Popover on the effects‑panel item, not screen‑centered |
| **Condensed width** | 360–400px, dismissible, never a trap |
| **Consistent tier badges** | `F` emerald (Free) · `P` amber (Pro) · `$` blue (sold separately) · `P$` purple (Pro or individual) |
| **Event‑driven** | Rust emits `paywall-trigger` → React `resolveModalContent(ctx)` maps to the right variant |

```typescript
// resolveModalContent(ctx) returns one of:
// auth | upgrade | purchase_module | purchase_asset | subscription_expired | trial_offer
// based on: window, action, assetId/moduleId, currentPlan, isAuthenticated
```

---

## 5. Two Divergent Design Decisions (with recommendation)

### A. OAuth Callback Mechanism
| Approach | Pros | Cons |
|---|---|---|
| **Deep‑link plugin** (`appname://auth/callback`) | No localhost server; clean; works on macOS/Windows/Linux | Requires scheme registration; slightly more setup |
| **Ephemeral localhost TCP listener** (axum/hyper) | Simple redirect capture; familiar web pattern | Firewall prompts; port conflicts; less “desktop‑native” |

**Recommendation:** Use **`tauri-plugin-deep-link`** as primary; fall back to localhost only if deep‑link registration is blocked in your build pipeline.

### B. Context‑Aware Paywall Rendering
| Approach | Pros | Cons |
|---|---|---|
| **Inline overlay div** (GLM) | No focus loss; single‑process state; simpler | Less “separate window” feel |
| **Separate `WebviewWindow`** (Gemini) | True OS‑level modal; can anchor to cursor | Focus‑steal risk; more window‑sync code |

**Recommendation:** Default to **inline overlay** for auth/upgrade/purchase; use a **detached window** only for the browse‑the‑store use case.

---

## 6. Technical Specification for Your AI Agent

### Project Structure (scaffold this)
```
src/                         # React
  app/ (router, providers)
  features/
    onboarding/  editor/  entitlements/  auth/
    asset-browser/  plugin-registry/
  stores/  (entitlementStore, assetStore, authStore, uiStore)
  lib/  (bindings.ts from specta, tauri-events.ts)
src-tauri/
  src/
    commands/ (entitlements, assets, auth, modules, billing)
    entitlements/ (engine.rs, schema.rs)
    asset_manager/ (downloader, verifier, manifest)
    plugin_registry/ (loader, sidecar)
    auth/ (oauth, token_store)
    state.rs  main.rs  lib.rs
  migrations/  (SQLx)
  binaries/  (sidecar exes)
  Cargo.toml  tauri.conf.json
```

### Key Tauri IPC Commands (annotate with `#[specta::specta]`)
1. `check_entitlement(request)` → `Allowed | RequiresUpgrade | RequiresModulePurchase | RequiresAssetPurchase | SubscriptionExpired`
2. `attempt_feature_use(feature_id)` → emits `paywall-trigger` on deny, else `Granted`
3. `download_asset(asset_id)` → streams + emits `asset-download-progress`
4. `oauth_google()` / `oauth_facebook()` → deep‑link or localhost flow, stores in keychain
5. `start_checkout(plan)` / `verify_purchase(license_key)`
6. `install_module` / `launch_module` (sidecar via `tauri-plugin-shell`)

### tauri.conf.json essentials
```json
{
  "app": {
    "windows": [{
      "label": "splash", "width": 380, "height": 520,
      "decorations": false, "center": true, "url": "index.html#/splash"
    }]
  },
  "bundle": { "externalBin": ["binaries/ai-tool-sidecar"] },
  "plugins": { "deep-link": { "desktop": { "schemes": ["appname"] } } }
}
```

### Dependencies
*Rust:* `tauri 2`, `tauri-plugin-{shell,fs,http,dialog,notification,updater,deep-link,store,upload,single-instance}`, `specta`+`tauri-specta`, `rusqlite(bundled)`, `sha2`, `reqwest(stream)`, `tokio`, `oauth2`, `keyring`, `chrono`.
*Frontend:* `@tauri-apps/api` + plugins, `react`, `@tanstack/react-router`, `@tanstack/react-query`, `zustand`, `tailwindcss`, `lucide-react`, `class-variance-authority`.

### Event Flow (teach this to the agent)
```
User clicks Pro feature
  → invoke('attempt_feature_use')
  → Rust check_entitlement()
      ├─ Allowed → feature executes
      └─ Denied → emit('paywall-trigger', {feature_id, result, context})
            → React listen → resolveModalContent(ctx) → render ContextModal
            → User auth/upgrades/buys → invoke oauth/checkout
            → Rust updates SQLite + emit('entitlements-updated')
            → Zustand refreshes → original feature auto-retries
```

---

## 7. Open‑Source Architectural Inspirations

**Direct modular‑desktop patterns**
* **Obsidian** (`obsidianmd/obsidian-api`) — `App` hub, `Plugin` lifecycle (`onload`/`onunload`), manifest‑driven resource cleanup.
* **Modulus** (`AGIBuild/Modulus`) — hot‑reloadable extensions, signature verification, versioned plugins.
* **Nedrysoft component‑system / Pingnoo** — minimal core app that only loads components; dependency‑resolved loading order.
* **PlugFrame** — service registry for inter‑module communication.

**Tauri‑specific templates**
* `sinhong2011/tauri-template` — three‑layer state (useState/Zustand/TanStack Query), tauri‑specta type safety, event‑driven bridge.
* `MrLightful/create-tauri-react` — Bulletproof‑React feature folders.
* `robosushie/tauri-global-state-management` — Zustand multi‑window sync.

**Heavy‑download / asset‑delivery references**
* **Heroic Games Launcher** (Tauri/React) — pause/resume large downloads, disk‑space checks, progress UI.
* **LM Studio / AnythingLLM** — browse remote “models” (act like VFX presets), download in background, load into core on activation.
* **OBS Studio** — plugin decoupling gold standard (non‑Rust but conceptually identical).
* **Lapce / Zed** — Rust apps safely managing dynamic WASM/modules and file I/O.

---

### TL;DR for the AI agent
Build a **Rust‑authoritative entitlement engine** (plan → capabilities → individual purchases) that gates features at *use/export time* using the sunk‑cost pattern. Deliver heavy assets via **on‑demand streamed downloads with SHA‑256 verification** and **sidecar binaries for individual modules**. Render **inline, context‑aware paywalls** driven by Rust‑emitted `paywall-trigger` events, and use **deep‑link OAuth** (with localhost fallback) for Google/Facebook login. Mirror the dual‑catalog (subscription vs. one‑time‑purchase) so “buy individual even within Pro” works natively.

---

## 8. Applicability to SMEMaster (Desktop + Mobile)

> **Status as of 2026-07-09.** SMEMaster is a production‑ready SME management suite (mail, contacts, campaigns, tasks, calendar, vault, automation, deliverability). It ships as a **Tauri v2 desktop + mobile** application. This section maps the Wondershare‑style blueprint above to SMEMaster's existing architecture — identifying what already exists, what can be adopted without breaking changes, and what should be avoided.

> **Status as of 2026-07-11 (code-verified).** The §8 recommendations remain **deferred to post-v1.0** and are **not yet implemented in code**. A grep of `src-tauri` and `src` returns **zero matches** for `EntitlementEngine`, `check_entitlement`, `paywall-trigger`, `owned_modules`, `entitlement_overrides`, `FeatureGate gating="execute"`, and `usePaywallTrigger`. The only directly-built side-feature inspired by this analysis is the **AI RAG UI** (feature doc now at `docs/04-FEATURES/ai-rag.md`). The deferred plan lives in `docs/06-ROADMAP/10-` through `13-monetization-*.md`.

### 8.1 Concept Mapping

| Wondershare Concept | SMEMaster Equivalent | Current SMEMaster State |
|---|---|---|
| **Assets** (effects, transitions, presets) | Templates (email, campaign, workflow), export formats (PDF, CSV, ICS), report dashboards | ✅ Templates exist. Exports implemented (RFC 4180 CSV, RFC 2426 vCard, RFC 5545 ICS, MBOX, PDF). No "tiered template library" with purchase gating. |
| **Modules** (sidecar tools) | Feature areas gated by ToolRegistry + SubsystemRegistry: AI, Deliverability, Vault, Workflows, Campaigns, Offline Sync | ✅ 23 feature flags in Rust `ToolRegistry`. 8 subsystems with `feature_flag` binding. Licensing exists but is not wired to subsystem activation. |
| **Subscription plans** | Basic / Pro / Enterprise (3‑tier) | ✅ `LicenseTier` enum in Rust (`Free=0, Professional=1, Enterprise=2`). Frontend `Tier` type (`basic \| pro`). Naming mismatch between Rust and frontend. |
| **Individual purchases** (buy‑within‑Pro) | Per‑feature add‑ons (e.g., AI credits, deliverability monitoring) | ❌ **Not modeled.** `owned_modules` / `owned_assets` do not exist in any schema. All gating is tier‑based only. |
| **Sunk‑cost bottleneck** (compose → gate at export) | **Exports/Reports**: gating premium PDF templates, scheduled report generation, branded exports at "generate" time. **Automation/Sync**: gating advanced automation rules, continuous sync, webhook delivery at "activate" time. | 🔶 Partial. Features show locked upfront (`UpgradeBadge` / `FeatureGate`). The "compose freely → gate at execute" pattern is not implemented. |
| **CDN asset streaming** | Template downloads, AI model caching | ❌ **Not needed.** SMEMaster assets are lightweight (templates < 100 KB, no 4K media). Downloads use `reqwest` where needed. |
| **Deep‑link OAuth** | `smemaster://` deep‑link for Google / Outlook OAuth | ✅ Already implemented via `tauri-plugin-deep-link`. Fallback to localhost listener for restricted environments. |

### 8.2 Backend: What SMEMaster Could Benefit From

The following recommendations are **evolutionary, not revolutionary** — they build on existing systems without requiring rewrites.

#### 8.2.1 Unified Entitlement Engine (Bridge Licensing → SubsystemRegistry)

**Current state:** Three disconnected layers exist in Rust:
1. `LicenseState` — validates Ed25519 keys, resolves tier, has `has_feature_access()` (unused by gating pipeline)
2. `SubsystemRegistry` — CAS state machine, each entry has a `feature_flag` field (advisory)
3. `ToolRegistry` — `DashMap<String, bool>` (advisory, MVP stance)

**Recommended evolution** (no‑break, incremental):

```rust
// New: single resolution point, builds on existing systems
pub struct EntitlementEngine {
    license: Arc<LicenseState>,
    subsystems: Arc<SubsystemRegistry>,
    tools: Arc<ToolRegistry>,
}

impl EntitlementEngine {
    /// Resolution order (mirrors §2 of this analysis):
    /// 1. Is the module/feature individually owned? → Allowed
    /// 2. Does the license tier grant this capability? → Allowed
    /// 3. Is there an active trial/override? → Allowed
    /// 4. Else → Locked
    pub async fn check_access(&self, feature_id: &str) -> AccessResult { ... }
}
```

**SQLite additions** (new migration, non‑destructive):
- `owned_modules` table: `(account_id, module_id, purchase_timestamp, expires_at?)` — mirrors the analysis `owned_modules` concept
- `entitlement_overrides` table: `(feature_id, reason, expires_at)` — for trial/override gating

**Wiring path** (safe, can land after v1.0):
1. Add `EntitlementEngine` as managed Tauri state (wraps existing `LicenseState` + `SubsystemRegistry`)
2. Add `check_entitlement(feature_id)` IPC command (mirrors the analysis `attempt_feature_use`)
3. Wire `has_feature_access()` into `require_subsystem_active()` — currently `feature_flag` is advisory; make it enforced when `EntitlementEngine` is present
4. Existing `get_tool_state` / `apply_tool_state` commands remain unchanged — `ToolRegistry` becomes a view into `EntitlementEngine` rather than the source of truth

#### 8.2.2 Sunk‑Cost Bottleneck Commands

The most impactful behavioral pattern from this analysis is **"let them compose, gate at execute"**. Two SMEMaster bottleneck areas were identified:

**Export/Reports bottleneck:**
- Let Basic users compose reports, preview PDFs, configure export settings
- Gate at the "Generate Report" / "Schedule Export" / "Branded PDF" action
- Existing export commands (`export_contacts_csv`, `export_tasks_csv`, `export_calendar_ics`) are free‑tier. Add a `require_entitlement("premium-exports")` check to premium export variants (branded templates, scheduled CSVs, PDF watermark removal).

**Automation/Sync bottleneck:**
- Let users build automation rules, configure triggers and actions in the UI
- Gate at the "Activate Rule" / "Enable Sync" / "Deploy Webhook" action
- The existing `workflows_executor` subsystem is OnDemand — gate its activation on entitlement

```rust
// Example: gating a premium export command
#[tauri::command]
async fn export_scheduled_report(
    engine: tauri::State<'_, EntitlementEngine>,
    config: ReportConfig,
) -> CmdResult<String> {
    engine.check_access("premium-exports").await?;
    // ... existing generation logic ...
}
```

**Frontend counterpart:** The frontend already has `getFeatureAccess()` returning `"enabled" | "limited" | "locked"`. The sunk‑cost pattern adds a fourth state: `"preview"` — feature is available for composition but not execution. This maps to:
- `FeatureGate` accepts a new `gating: "use" | "execute"` prop
- `"use"` (default): current behavior — show locked badge if not entitled
- `"execute"`: allow the user to use the UI (compose, configure) but gate at the action button

### 8.3 Frontend: What SMEMaster Could Benefit From

#### 8.3.1 Consistent Tier Badge Taxonomy

**Current state:** SMEMaster has `UpgradeBadge` with 2 variants (`pro-only`, `limit`) and 3 sizes. The analysis proposes a richer taxonomy:

| Analysis Badge | SMEMaster Equivalent | Benefit | Effort |
|---|---|---|---|
| `F` emerald (Free) | No badge (default) | Clarifies what's included in Basic | Low — add `tier="free"` variant |
| `P` amber (Pro) | Existing `UpgradeBadge variant="pro-only"` | Already exists | None |
| `$` blue (sold separately) | ❌ Does not exist | Enables individual‑purchase UX (see §8.3.2) | Medium — new `IndividualPurchaseBadge` component |
| `P$` purple (Pro or individual) | ❌ Does not exist | Shows "Pro gets it free; others can buy" | Medium — needs both plans and individual purchases |

**Recommendation:** Add the `$` and `P$` badge variants to `UpgradeBadge.tsx` when individual‑purchase support is added. The existing `F`/`P` badges are already covered by current UX (no badge for Free, `PRO` pill for Pro-only). Do not add badges for capabilities that don't exist yet (individual purchases).

#### 8.3.2 Individual Purchase UX (Post‑v1.0)

**Current state:** All gating is tier‑binary (Basic vs Pro). If a user's license expires from Pro to Basic, they lose access to all Pro features simultaneously. There is no "keep what you bought" safety net.

**Recommended pattern** (from §1 of this analysis, Filmstock dual‑catalog model):
- An `owned_modules` SQLite table + frontend `ownedFeatures` Zustand slice
- Feature gate checks: "Do you own this module individually?" → yes → allowed, regardless of tier
- Frontend: `FeatureGate` checks both `tier` and `ownedFeatures` before showing upgrade prompt

**This is explicitly post‑v1.0.** The schema migration and store changes are backwards‑compatible.

#### 8.3.3 Event‑Driven Paywall Overlay

**Current state:** The frontend checks `getFeatureAccess()` synchronously at render time from the Zustand store. If locked, it renders `UpgradeBadge` or `UpgradeBanner` inline. The Rust backend does not emit events to trigger paywalls.

**Analysis pattern** (§6 Event Flow):
```
User clicks Pro feature
  → invoke('attempt_feature_use')
  → Rust check_entitlement() → Denied
  → emit('paywall-trigger', {feature_id, result, context})
  → React listen → resolveModalContent(ctx) → render ContextModal
  → User upgrades → invoke checkout
  → Rust emit('entitlements-updated')
  → Zustand refreshes → feature auto-retries
```

**SMEMaster adaptation** (incremental):
1. Add `emit('paywall-trigger', ...)` to Rust's `check_entitlement` IPC when denied
2. Create a `usePaywallTrigger` hook that listens for the event and shows an `AdaptiveBottomSheet` (mobile) or `SlidePanel` (desktop) with the upgrade context
3. The existing `navigateToLicense()` is used as the CTA action
4. After license activation/upgrade, the Rust backend emits `entitlements-updated` → frontend store refreshes → the original feature automatically becomes available

**Mobile difference:** On phone UI, the paywall trigger opens a bottom sheet (uses existing `AdaptiveBottomSheet` component) instead of an inline overlay. Desktop uses the existing `SlidePanel` or an inline overlay anchored near the trigger. The Rust‑emitted event is platform‑agnostic — only the frontend rendering differs.

### 8.4 Mobile: What Stays the Same

The Wondershare analysis is desktop‑video‑editor‑centric. For SMEMaster's mobile shell:

- **No splash window needed.** SMEMaster already has `OnboardingWizard` as an inline modal (4 steps), shared across desktop and mobile. The analysis §3.1 "splash window" is inapplicable.
- **No separate paywall window needed.** The analysis §4 recommends inline overlays — SMEMaster already uses `AdaptiveBottomSheet` on mobile and `SlidePanel` on desktop. The event‑driven paywall (§8.3.3) uses these existing components.
- **No asset CDN.** SMEMaster mobile does not stream heavy media. Template downloads use the same `reqwest`‑based downloader as desktop.
- **OAuth deep‑link** already works on mobile via `tauri-plugin-deep-link` + `smemaster://` scheme (§3.2 Stage 2 recommendation).
- **LicenseBanner** is already wired into both `MobileShell` and `DesktopShell` via the `licenseBanner` prop (currently not passed from `App.tsx` — a minor wiring gap, not an architecture gap).

### 8.5 What to Explicitly NOT Adopt

| Analysis Feature | Reason to Skip |
|---|---|
| **Sidecar binaries** (`externalBin`, `launch_module`) | SMEMaster has no plugin binaries. All features are compiled into the main Tauri binary or are network services. |
| **Asset CDN streaming with SHA‑256 chunk verification** | SMEMaster assets are templates (< 100 KB) and configuration. `reqwest` download with integrity check is sufficient; chunked streaming adds complexity with zero benefit. |
| **Splash window** (`380×520`, `decorations: false`) | SMEMaster onboarding is modal‑based, not window‑based. Changing to a separate window would break the existing 4‑step wizard UX and require new multi‑window state sync. |
| **3‑panel editor + timeline** | SMEMaster is a management tool, not a creative editor. The analysis's layout (Tool Panel / Preview Canvas / Effects Panel / Timeline) has no analogue. |
| **Download credits** (Filmstock model) | Subscription usage caps already exist (`basicLimit.max`). Credits add billing complexity without clear SME need. |
| **`#[specta::specta]` annotation on all commands** | SMEMaster has 704 IPC commands. Adding specta retroactively is a large‑scale annotation effort with marginal benefit when the TS wrappers in `db-invoke.ts` are already hand‑typed and tested. |

### 8.6 Summary: Priority Order for SMEMaster

```
NOW (no‑code, conceptual alignment):
  → Align naming: unify frontend `Tier` (basic/pro) ↔ Rust `LicenseTier` (Free/Professional/Enterprise)
  → Document the existing 4‑layer gating system (FEATURE_FLAGS → ToolRegistry → SubsystemRegistry → Licensing)
  → Identify which IPC commands are bottleneck candidates for sunk‑cost gating

POST‑v1.0 (backend evolution):
  → Add `EntitlementEngine` wrapper that unifies LicenseState + SubsystemRegistry + ToolRegistry
  → Add `check_entitlement` IPC command + `paywall-trigger` event emission
  → Add `owned_modules` SQLite table for individual‑purchase tracking
  → Wire `has_feature_access()` into `require_subsystem_active()` enforcement

POST‑v1.0 (frontend evolution):
  → Add `gating="execute"` prop to `FeatureGate` for sunk‑cost bottleneck UX
  → Build `usePaywallTrigger` hook → `AdaptiveBottomSheet` / `SlidePanel` paywall flow
  → Add `$` / `P$` badge variants to `UpgradeBadge` when individual purchases land
  → Wire `licenseBanner` prop in `App.tsx` to both `MobileShell` and `DesktopShell`
```

### 8.7 Key Principle Applied

**"Rust is the single source of truth."** (from §2 of this analysis)

SMEMaster already follows this principle: the frontend is a thin Zustand‑cached client, all data mutation goes through Rust IPC, and `Invoke` failures revert optimistic state. The recommended evolution preserves this — `EntitlementEngine` would be Rust‑authoritative, with Zustand as a caching layer that refreshes on `entitlements-updated` events. No entitlement decision would be made in the frontend alone.