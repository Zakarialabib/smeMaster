# SMEMaster — Post-v1.0 Monetization: Frontend Paywall & Tier UX

> **Status:** 💤 Deferred (post-v1.0)
> **Source analysis:** [`docs/analysis.md`](../analysis.md#83-frontend-what-smemaster-could-benefit-from) §8.3, [`docs/monetization-style.md`](../monetization-style.md) §2
> **Last updated:** 2026-07-09
> **Constraint:** Zero breaking changes to existing components, stores, or styles. All additions are new components/hooks/props.
>
> **Code-verified 2026-07-11:** No `FeatureGate gating="execute"`, `usePaywallTrigger`, or `$`/`P$` badge variants exist in `src`. This plan is **unstarted** (deferred to post-v1.0).

---

## Summary

Implement the three Wondershare-inspired UX patterns that directly drive conversion: **(1)** sunk-cost bottleneck gating (let users compose/preview → gate at execute), **(2)** a consistent tier badge taxonomy ([F]/[P]/[$]/[P$]), and **(3)** event-driven context paywalls triggered from Rust. All three build on existing SMEMaster infrastructure (FeatureGate, UpgradeBadge, Modal, AdaptiveBottomSheet, EventBus) without replacing anything.

---

## Current State

| UX Pattern | Current SMEMaster Behavior | Wondershare Pattern | Gap |
|------------|--------------------------|---------------------|-----|
| **Feature gating** | Locked features hidden or show `UpgradeBadge` upfront (`getFeatureAccess() === "locked"`) | Let user *use* the feature in preview, gate at the bottleneck action | Need `gating="execute"` mode in FeatureGate + "preview" access level |
| **Tier badges** | `UpgradeBadge` with 2 variants (`pro-only`, `limit`) | 4-tier badge taxonomy: `F`/`P`/`$`/`P$` | Need `$` (sold separately) and `P$` (Pro-or-Individual) variants |
| **Paywall trigger** | Synchronous render-time check from Zustand store | Rust emits `paywall-trigger` → React renders context modal | Need event-driven flow with auto-retry |
| **Individual purchase** | All gating is tier-binary (Basic vs Pro) | "Buy individual even within Pro" (Filmstock dual-catalog) | No `ownedFeatures` store slice; no badge for individually-owned items |
| **Onboarding** | 4-step wizard (Welcome → Account → Import → PGP → Tour) | Add asset selection step | Add Step 5: "Choose starter assets" |

---

## Target UX

### 1. Sunk-Cost Bottleneck Pattern

**Current behavior:** `.feature-flags.ts` returns `"locked"` → `UpgradeBadge` replaces the feature button.

**Target behavior:** A fourth `"preview"` access level is added:

```typescript
// In FeatureGate component — new `gating` prop
type GatingMode = "use" | "execute";
//  "use" (default): current behavior — show locked badge if not entitled
//  "execute": allow compose/preview UI, gate at the action button
```

**Bottleneck mapping** (as selected from analysis):

| Bottleneck Area | What User Can Do in Preview | Where Gating Happens |
|----------------|---------------------------|---------------------|
| **Exports/Reports** | Configure report, preview PDF, design layout | "Generate Report" / "Schedule Export" button click |
| **Automation/Sync** | Build rule, set triggers/actions in UI | "Activate Rule" / "Enable Sync" toggle |
| **Campaigns** | Compose with premium template, set audience | "Send Campaign" button |
| **AI Features** | Type prompt, see preview | "Generate" / "Apply" button |

**UX flow:**
1. User composes/configure in full (sunk cost)
2. Clicks execute action → `invoke('attempt_feature_use')`
3. Rust `EntitlementEngine` denies → emits `paywall-trigger`
4. Frontend shows `ContextModal` anchored to the button
5. User upgrades/buys → Rust emits `entitlements-updated`
6. Zustand cache refreshes → execute action auto-retries (no second click)

### 2. Tier Badge Taxonomy

Extend `UpgradeBadge.tsx` with new variants (additive — existing `pro-only` and `limit` variants unchanged):

| Badge | Visual | Meaning | When to Show |
|-------|--------|---------|-------------|
| `F` emerald | `bg-emerald-500 text-white` dot + "F" | Free / included in Basic | Templates, features, tools that are available on Free tier |
| `P` amber | `bg-amber-400 text-amber-950` diamond + "PRO" (existing) | Pro-only feature | Already implemented |
| `$` blue | `bg-blue-500 text-white` "$" | Sold separately (individual purchase) | Modules not in any plan — user must buy outright |
| `P$` purple | `bg-purple-500 text-white` "P$" | Pro gets it free; others can buy | Features included in Pro but available as individual purchase for Basic users |

**New component:** `AssetTierBadge.tsx` in `shared/components/ui/` — renders the appropriate badge based on feature flag's `tier` + `purchase_type` fields.

**Placement:** TemplateGallery cards, Campaign AudienceStep, Vault toolbar items, AI sidebar tools, Settings plan badge (replacing plain "Free/Pro" text).

### 3. Event-Driven Paywall Overlay

**Current Rust → Frontend flow:**
```
User clicks → invoke('feature') → Rust does work → returns result
```

**Target flow** (from `monetization-style.md` §2.2 and `analysis.md` §8.3.3):

```
User clicks Pro feature
  → invoke('attempt_feature_use')
  → Rust check_entitlement() → Denied
  → emit('paywall-trigger', {feature_id, result, context})
  → React listen → resolveModalContent(ctx) → render ContextModal
  → User upgrades → invoke checkout
  → Rust emit('entitlements-updated')
  → Zustand refreshes → original feature auto-retries
```

**New frontend pieces:**

| Piece | Type | Purpose |
|-------|------|---------|
| `usePaywallTrigger` | Hook | Listens for `paywall-trigger` event, opens `ContextModal` with resolved content |
| `resolveModalContent(ctx)` | Pure function | Maps `{action, feature_id, plan, isAuthenticated}` → `auth \| upgrade \| purchase_module \| subscription_expired` |
| `ContextModal` | Component | Condensed 360–400px overlay anchored near trigger; desktop uses `Modal` wrapper, mobile uses `AdaptiveBottomSheet` |
| `entitlementStore` | Zustand slice | Caches `EntitlementSnapshot` from Rust, refreshed on `entitlements-updated` event |

**Existing components reused:**
- `Modal` (focus trap, a11y) — unchanged
- `AdaptiveBottomSheet` (Phase 3 mobile) — unchanged
- `navigateToLicense()` — used as CTA action
- `EventBus` — new events registered alongside existing 15

### 4. Individual Purchase UX

**New store slice:** `ownedFeatures` in a new `entitlementStore.ts`:

```typescript
interface EntitlementState {
  tier: "trial" | "basic" | "pro" | "enterprise";
  ownedFeatures: Set<string>;  // individually purchased module IDs
  // ... existing license fields
}
```

**FeatureGate enhancement:** When checking access, if the feature flag has `purchase_type: "individual"`, `FeatureGate` also checks `entitlementStore.ownedFeatures`. If owned → allowed regardless of tier.

**UX:** If not owned and not in current plan → show `$` badge with "Buy $4.99" CTA instead of "Upgrade to Pro".

### 5. Onboarding Step 5 — Asset Selection

Add a non-breaking 5th step to `OnboardingWizard.tsx`:

- **Step 5:** "Choose starter assets" — grid of free templates + Pro templates with `[P]` badge
- Free assets download immediately (Rust streams small files)
- Pro assets show inline auth/paywall on click
- Skippable (default "skip for now" button)
- Reuses existing `close_splashscreen` flow

---

## Implementation Phases

### Phase A — Tier Badges (~3h)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| A1 | Implement `AssetTierBadge.tsx` with all 4 badge variants | 1.5h | Extends `UpgradeBadge` concepts |
| A2 | Add `purchase_type` to `FEATURE_FLAGS` flag interface (frontend) | 0.5h | New optional field |
| A3 | Integrate badges in TemplateGallery + Vault toolbar | 1h | Drop-in replacement for plain text |

### Phase B — Sunk-Cost Gating (~6h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| B1 | Add `"preview"` access level to `FeatureAccess` type | 0.5h | A2 | New value in existing union type |
| B2 | Add `gating: "use" | "execute"` prop to `FeatureGate` | 1h | B1 | Defaults to "use" (current behavior) |
| B3 | Wire bottleneck: Campaign "Send" button | 1.5h | B2 | Calls `attempt_feature_use` before send |
| B4 | Wire bottleneck: Export "Generate Report" | 1.5h | B2 | Checks entitlement before export execution |
| B5 | Wire bottleneck: Automation "Activate Rule" | 1.5h | B2 | Gates rule activation toggle |

### Phase C — Event-Driven Paywall (~5h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| C1 | Create `entitlementStore.ts` Zustand slice | 1h | — | Listens for `entitlements-updated`, caches snapshot |
| C2 | Create `resolveModalContent.ts` pure mapper | 1h | — | Maps trigger context to modal variant |
| C3 | Create `ContextModal.tsx` component | 1.5h | C2 | Desktop → Modal wrapper; Mobile → AdaptiveBottomSheet |
| C4 | Create `usePaywallTrigger` hook | 1h | C1, C3 | Listens for `paywall-trigger`, opens ContextModal |
| C5 | Wire `paywall-trigger` and `entitlements-updated` into EventBus | 0.5h | C4 | Register alongside existing 15 events |

### Phase D — Individual Purchase UX (~4h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| D1 | Add `ownedFeatures` to `entitlementStore` | 1h | C1 | Set<string> — checked before tier |
| D2 | Enhance `FeatureGate` to check `ownedFeatures` | 1h | D1 | Non-breaking — tier check still runs |
| D3 | Add `$` / `P$` badge rendering for individually-purchasable features | 1h | A1, D2 | Inline "Buy" CTA vs "Upgrade" CTA |
| D4 | Onboarding Step 5 — asset selection | 1h | — | Skippable, non-breaking |

---

## Backward Compatibility

| Existing Feature | Impact | Mitigation |
|-----------------|--------|------------|
| `UpgradeBadge` — 2 existing variants | None — new variants added alongside | Old code that imports `UpgradeBadge` sees no change |
| `FeatureGate` component | None — new `gating` prop defaults to `"use"` (current behavior) | All 20+ existing usages continue working |
| `Modal` (focus trap) | None — `ContextModal` wraps it | No a11y regression |
| `AdaptiveBottomSheet` | None — reused as-is | Already built (Phase 3) |
| `EventBus` (15 events) | None — 2 new events added | No existing events modified |
| `OnboardingWizard` — 4 steps | None — Step 5 appended | Existing flow unchanged |
| `navigateToLicense()` | None — reused as CTA | Already works |

---

## Cross-References

- **Backend entitlement engine:** [`10-monetization-entitlement-engine.md`](10-monetization-entitlement-engine.md)
- **Asset delivery UI (download progress, asset browser):** [`12-monetization-asset-delivery.md`](12-monetization-asset-delivery.md)
- **Mobile-specific rendering:** [`13-monetization-mobile-strategy.md`](13-monetization-mobile-strategy.md)
- **Source analysis:** [`../analysis.md`](../analysis.md#83-frontend-what-smemaster-could-benefit-from) §8.3, [`../monetization-style.md`](../monetization-style.md) §2
- **Existing UpgradeBadge:** [`../03-FRONTEND/12-ui-super-app-spec.md`](../03-FRONTEND/12-ui-super-app-spec.md)
- **Existing Modal a11y:** [`../05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md`](../05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md)
