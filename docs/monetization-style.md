> **Note on tooling:** In this chat session I don’t have live MCP filesystem or shell tools connected, so I can’t literally open/write your `STATUS.md` on disk. Below is the **exact markdown block** you can paste directly into your SMEMaster status document (append at the end, or under a new “Competitive Analysis” section). It analyzes the Wondershare‑style study against your *actual* codebaseInventory and proposes only non‑breaking (or clearly‑superior) adoptions for **backend, frontend, and mobile+desktop parity**.

> **Status as of 2026-07-11 (code-verified):** This analysis remains a **post-v1.0, deferred** plan. None of its recommended backend changes (`EntitlementEngine`, `owned_modules`, `paywall-trigger`) or frontend changes (`gating="execute"`, `usePaywallTrigger`) are implemented in `src-tauri`/`src` (zero matches). Detailed deferred plans: `docs/06-ROADMAP/10-` to `13-monetization-*.md`.

---

```markdown
## Wondershare-Style Monetization & Asset-Delivery — Opportunity Analysis for SMEMaster

> **Source:** Competitive teardown of Wondershare (Filmora / Dr.Fone / Filmstock) modular freemium architecture (2026‑07‑09)
> **Scope:** SME management tool (email, CRM, campaigns, tasks, calendar, automation, vault, deliverability) on **desktop + mobile** (Tauri 2, Rust, React, Tailwind)
> **Constraint:** Do **not** break existing architecture unless the new logic is strictly better. No coding required in this pass — analysis only.

### 0. Current-State Inventory (from this doc + PROD-GATE)

| Existing Capability | Where It Lives | Wondershare Equivalent |
| --- | --- | --- |
| Licensing module (~8 cmds: validation, registration, HWID, activation) | `commands/licensing` | Entitlement source of truth |
| `ToolRegistry` (23 Rust flags mirroring FEATURE_FLAGS, advisory) | `orchestrator/tool_registry.rs` | Capability map |
| `getFeatureAccess("ai",0) === "locked"` hard gate | Frontend hooks | Pro‑tier gating |
| `offline-availability` Pro flag + CRUD cmds | `commands/db.rs` | Cloud‑Pro asset caching |
| Subsystem lifecycle (AlwaysOn / Lazy / OnDemand) | `orchestrator/subsystem_lifecycle.rs` | Plugin/sidecar loader |
| OAuth Custom Tabs (deep‑link + localhost fallback) | `shared/services/oauth/customTabAuth.ts`, `oauth/` | Already matches recommended auth pattern |
| Deliverability Monitoring (P11: blacklist, reputation, alerts) | `commands/deliverability.rs` | Heavy “module” tool |
| Vault (encrypted file store) + SHA‑256 backup hashes | `commands/vault`, `compute_backup_hash` | Asset integrity |
| Assets (~3 cmds) | `commands/assets.rs` | Thin asset manager |
| `EventBus` (15 events) + `emit_domain_event` | `orchestrator` | Paywall‑trigger channel |
| `Modal` w/ focus‑trap, `AdaptiveBottomSheet`, `MobileShell` | `shared/components/ui`, `features/mobile` | Context‑aware window system |
| Bundle: MSI/NSIS/DMG/AppImage/DEB/APK/AAB | `tauri.conf.json` | Sidecar‑ready distribution |

**Conclusion:** SMEMaster already has ~80% of the *plumbing*. The gap is **monetization depth** (individual purchases) and **asset‑delivery UX** (sunk‑cost gating, on‑demand plugin downloads).

---

### 1. Backend Opportunities (Rust / Tauri)

#### 1.1 Three‑Axis Entitlement (Non‑Breaking Extension)
- **Today:** Plan‑based (Free/Pro) via `ToolRegistry` flags.
- **Wondershare pattern:** `plan → capabilities → individually_purchased_modules/assets`.
- **Benefit for SMEMaster:**
  - Sell **Deliverability Monitoring (P11)** as *Pro‑OR‑Individual* (SME on Free can buy just that module; Pro gets it included).
  - Sell **AI Copilot** as *Individual‑only* add‑on even for Pro (Dr.Fone per‑tool model).
- **How to adopt without breaking:**
  - Add `purchase_type: Free | Pro | IndividualPurchase { price_cents, currency } | ProOrIndividual { price_cents }` to `ToolRegistry` enum. Existing `Pro` flags keep working.
  - Add `owned_modules: Vec<String>` + `owned_assets: Vec<String>` to the Licensing state struct (new columns, migrated via `migrations/`).
  - Resolution order: `owned_* ` checked **before** plan capability (mirrors Filmstock single‑purchase persistence).

#### 1.2 Reuse SHA‑256 + Lazy Subsystem for On‑Demand Assets
- Your `compute_backup_hash` (SHA‑256) and `SubsystemRegistry` (OnDemand idle‑shutdown) are directly reusable for a **Wondershare‑style asset downloader**.
- New `AssetManager` (extends existing `commands/assets.rs`):
  - Streams industry template packs / CRM connector plugins from CDN → `~/.smemaster/assets/`.
  - Emits `asset-download-progress` via existing `EventBus`.
  - Verifies hash using the **same** `sha2` crate already in `Cargo.toml`.
- No change to backup/safety gates (Gate 4 remains PASS).

#### 1.3 Sidecar Binaries for Heavy ML/AI Modules
- Wondershare ships AI tools as sidecar processes. SMEMaster can do the same for:
  - Local AI inference (already have `commands/ai.rs` + `aiCache`).
  - Deliverability reputation ML scoring.
- Tauri `externalBin` already partially supported (Android signing hardened). Add `binaries/` dir + `tauri-plugin-shell` sidecar spawn (non‑breaking; only loaded when `purchase_type` resolved).

#### 1.4 Dual Catalog (Subscription vs. One‑Time)
- Add `AssetTier` enum to manifest JSON served from your update endpoint (`api.github.com/repos/.../releases`).
- `IndividualPurchase` assets never appear in `plan_entitlements` — clean separation, no refactor of existing Pro flags.

---

### 2. Frontend Opportunities (React / Tailwind / Zustand)

#### 2.1 Sunk‑Cost Upsell (Gate at Bottleneck, Not Upfront)
- **Today:** `SuggestionBanner` hidden when `getFeatureAccess("ai") === "locked"` (hard gate).
- **Wondershare pattern:** Let user *build* the project with unpaid assets; upsell at **Export / Send / Report** bottleneck.
- **SMEMaster mapping:**
  - Campaign builder: allow AI‑generated copy + Deliverability pre‑check in draft.
  - On **“Send Campaign”** or **“Export PDF Report”**, compute entitlement matrix → show condensed modal.
- **Non‑breaking:** Add new `paywall-trigger` EventBus event (you have 15 events; adding 1 is safe) → `resolveModalContent(ctx)` mapper (GLM‑style inline overlay).

#### 2.2 Context‑Aware Modal Resolver (Reuse P9 + Phase 3)
- You already built `Modal` (focus‑trap), `AdaptiveBottomSheet` (Phase 3), `useInputModality`.
- Add `entitlements/modal-resolver.ts`:
  - Input: `{ window: 'desktop'|'mobile', action, moduleId, currentPlan, isAuthenticated }`
  - Output: `auth | upgrade | purchase_module | purchase_asset | subscription_expired`
  - Desktop → centered `Modal`; Mobile → `AdaptiveBottomSheet` (no new window system needed).

#### 2.3 Consistent Tier Badges
- Extend `PremiumSidebar` concept with universal badges:
  - `F` emerald (Free), `P` amber (Pro), `$` blue (sold separately), `P$` purple (Pro or individual).
- Apply in: TemplateGallery, Automation cards, Deliverability components, Vault add‑ons.

#### 2.4 Asset Browser UI
- New `features/asset-browser/` (mirrors your feature‑folder convention):
  - `AssetGrid`, `AssetCard` (with badge + download progress bar listening to `asset-download-progress`).
  - Reuses `VirtualList` (P9) for large catalogs.

---

### 3. Mobile + Desktop Parity (Critical for SME Field Use)

| Concern | Desktop | Mobile (APK/AAB) | Wondershare Insight |
| --- | --- | --- | --- |
| OAuth | Custom Tab → deep‑link `smemaster-auth://` | Same (P8 done) | ✅ Already aligned |
| Paywall modal | `Modal` overlay | `AdaptiveBottomSheet` (Phase 3) | Condensed, dismissible |
| Heavy asset download | Sidecar + `~/.smemaster/assets` | On‑device cache, respect `< 200MB` RAM gate (Gate 2) | Stream + verify |
| Individual purchase | Same licensing flow | Same (HWID‑bound or account‑bound) | Account‑bound preferred for SME |
| Offline | `offline-availability` flag exists | Mobile offline UX (`MobileOfflineBanner`) | Gate at sync, not at use |

**Rule:** All entitlement logic lives in Rust (single source of truth) → both platforms get identical gating via `invoke()`. No per‑platform fork needed.

---

### 4. Open‑Source Inspirations Mapped to Your Stack

| Project | What SMEMaster Already Has Equivalent Of | What to Borrow |
| --- | --- | --- |
| **Obsidian** (plugin lifecycle) | `SubsystemRegistry`, `ToolRegistry` | Manifest‑driven module cleanup on uninstall |
| **Heroic Games Launcher** (Tauri) | `BackupScheduler`, SHA‑256 | Pause/resume large asset downloads, disk‑space pre‑check |
| **Modulus** (signature verification) | `crypto.rs` AES‑256‑GCM | Sign sidecar binaries before load |
| **sinhong2011/tauri-template** | Your 38 Zustand stores + specta‑style IPC | Event‑driven Rust→React bridge for paywalls |

---

### 5. Recommended Incremental Adoption (No Breaking Changes)

```
Phase A (logic only, no UI):
  → Extend ToolRegistry enum with purchase_type (backward compatible)
  → Add owned_modules / owned_assets to Licensing state + migration
  → Emit paywall-trigger via EventBus on denied feature use

Phase B (frontend, reuse existing components):
  → modal-resolver.ts + ContextModal (desktop Modal / mobile BottomSheet)
  → Tier badges in TemplateGallery + Deliverability UI
  → Sunk-cost gating on Campaign "Send" + Report "Export"

Phase C (asset delivery):
  → AssetManager streaming + SHA-256 (reuse backup hash fn)
  → Asset browser feature folder
  → Sidecar for AI/Deliverability ML (externalBin)

Phase D (mobile validation):
  → Ensure all paywalls render in AdaptiveBottomSheet
  → Offline purchase‑state cache (reuse offline-availability patterns)
```

### 6. What NOT to Change
- `SECURITY-AUDIT.md` posture (652→704 commands all parameterized) — keep.
- WAL / panic‑hook / watchdog (Gate 1) — unaffected.
- Existing Free/Pro flags — remain default `Pro` behavior; new `IndividualPurchase` is additive.
- OAuth P8 — already matches best practice; no touch.
```

---

### Summary of what I did vs. your ask
- ✅ Analyzed the Wondershare docs **against your actual SMEMaster STATUS.md** (command counts, ToolRegistry, Licensing, P8/P9/P11, mobile shell).
- ✅ Specified backend (entitlement axes, asset manager reusing SHA‑256, sidecar) & frontend (sunk‑cost upsell, modal resolver, badges) separately.
- ✅ Explicitly flagged **mobile + desktop** parity using your existing `AdaptiveBottomSheet` + Custom Tabs.
- ✅ Only additive/non‑breaking proposals unless logic is strictly better (e.g., gate‑at‑bottleneck beats hard‑gate).
- ⚠️ I did **not** use MCP/file tools because none are connected in this session — the block above is ready to paste into `STATUS.md` (or your `09-master-plan.md`). If you connect a filesystem/MCP tool later, I can write it directly.