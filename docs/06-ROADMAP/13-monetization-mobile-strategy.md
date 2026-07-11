# SMEMaster — Post-v1.0 Monetization: Mobile Strategy

> **Status:** 💤 Deferred (post-v1.0)
> **Source analysis:** [`docs/analysis.md`](../analysis.md#84-mobile-what-stays-the-same) §8.4, [`docs/monetization-style.md`](../monetization-style.md) §3, §5
> **Last updated:** 2026-07-09
> **Constraint:** All entitlement logic stays in Rust (single source of truth). No platform-specific gating fork. Mobile uses the same IPC commands as desktop.
>
> **Code-verified 2026-07-11:** No `usePaywallTrigger` bottom-sheet flow or offline purchase-state cache exists in `src`. This plan is **unstarted** (deferred to post-v1.0). It reuses the same deferred backend engine from `10-monetization-entitlement-engine.md`.

---

## Summary

SMEMaster's mobile architecture (Android APK/AAB via Tauri) already aligns closely with the Wondershare analysis recommendations. The primary mobile-specific work is **rendering paywalls as bottom sheets** (using existing `AdaptiveBottomSheet`) instead of desktop overlays — and ensuring the offline purchase-state cache works alongside the existing `offline-availability` feature flag.

---

## Current State

| Mobile Capability | Status | Location |
|-------------------|--------|----------|
| `MobileShell` with adaptive layout (phone/tablet/desktop) | ✅ Done | `shared/components/layout/shell/MobileShell.tsx` |
| `AdaptiveBottomSheet` for mobile modals | ✅ Done | Phase 3 of Mobile UX Overhaul |
| OAuth Custom Tabs with deep-link (`smemaster-auth://`) | ✅ Done | P8 — `oauth/customTabAuth.ts` |
| `OfflineBanner` + `offline-availability` feature flag | ✅ Done | Gates 4, 5 |
| Touch targets at 44×48dp minimum | ✅ Done | Phase 5 — mobile-animations.css |
| `useInputModality` (touch vs mouse vs keyboard) | ✅ Done | Phase 5 |
| `MobileOfflineBanner` | ✅ Done | Mobile-specific offline UX |
| `licenseBanner` prop in shell layout | ✅ Defined, ⚠️ Not wired from `App.tsx` | Minor wiring gap |

**Wondershare analysis alignment:** The analysis §4 recommends inline overlays — SMEMaster already uses `AdaptiveBottomSheet`. The analysis §3.2 recommends deep-link OAuth — SMEMaster already has P8. The analysis §5 says "all entitlement logic lives in Rust" — SMEMaster already follows this principle.

---

## Mobile-Specific Requirements

### 1. Paywall Rendering: Bottom Sheet (Not Overlay)

| Platform | Container | Component | Existing? |
|----------|-----------|-----------|-----------|
| Desktop | Inline overlay or `SlidePanel` | `ContextModal` wrapping `Modal` | ✅ Modal exists; ContextModal is new |
| Mobile (phone) | Bottom sheet | `ContextModal` wrapping `AdaptiveBottomSheet` | ✅ AdaptiveBottomSheet exists (Phase 3) |
| Mobile (tablet) | Centered modal | `ContextModal` wrapping `Modal` | ✅ Same as desktop |

**Rule:** The `ContextModal` component (from frontend doc) accepts a `container` prop — `"modal"` on desktop/tablet, `"bottom-sheet"` on phone. Detection uses existing `useBreakpoint()` hook (`<768px` = bottom sheet).

**No new components needed on mobile.** The existing `AdaptiveBottomSheet` is reused directly.

### 2. Offline Purchase-State Cache

Mobile users may be offline when they trigger a gated feature. The entitlement check must handle this gracefully:

```typescript
// entitlementStore.ts — mobile offline handling
interface EntitlementState {
  // ... tier, ownedFeatures
  lastSyncedAt: number | null;
  offlineCache: {
    entitlements: EntitlementSnapshot;
    cachedAt: number;
    ttlMs: number;  // 24h default
  };
}
```

**Flow:**
1. Online: `check_entitlement` IPC call → Rust → returns result → caches in store
2. Offline: Use cached `EntitlementSnapshot` (with `cachedAt` + `ttlMs` validity check)
3. Cache expired and offline: Show "Check connection to verify access" fallback
4. On reconnect: Refresh cache via `get_entitlements` IPC

Reuses existing `offline-availability` feature flag patterns and `MobileOfflineBanner` component.

### 3. Shared Badge System (No Mobile Fork)

The `AssetTierBadge` component (from frontend doc) is **platform-agnostic**:

- Desktop: 16px badges (default) with tooltip on hover
- Mobile: 20px badges (larger touch target) with tooltip on tap (existing `UpgradeBadge` already handles mobile tooltips via click-toggle + backdrop dismiss)

**No separate mobile badge component needed.** The existing responsive tooltip pattern in `UpgradeBadge.tsx` already distinguishes mobile vs desktop interaction.

### 4. What Changes on Mobile

| Capability | Desktop | Mobile | Difference |
|-----------|---------|--------|------------|
| Entitlement check | `invoke('check_entitlement')` | Same IPC | None — Rust is source of truth |
| Paywall UI | `Modal` overlay | `AdaptiveBottomSheet` | Container only (detected via `useBreakpoint`) |
| Asset download | `reqwest` stream → `app_data_dir` | Same path | None — paths rooted at `app_data_dir()` |
| Individual purchase | Same IPC + store flow | Same flow | None — HWID or account-bound |
| OAuth for purchase | Deep-link `smemaster-auth://` | Same deep-link | None — P8 already unified |
| License validation | Ed25519 + HWID | Same | None — licensing module is cross-platform |
| Offline entitlement | Cached in store | Same | Same `offlineCache` logic |

**The only platform-specific code is the paywall container choice** — one ternary in `ContextModal.tsx`.

---

## Implementation Phases

### Phase A — Mobile Paywall Container (~3h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| A1 | Add `container` prop to `ContextModal` that switches between `Modal` and `AdaptiveBottomSheet` | 1h | Frontend doc Phase C3 | Detects via `useBreakpoint()` |
| A2 | Verify all paywall trigger flows render correctly on phone (768px breakpoint) | 1h | A1 | Test with each bottleneck action |
| A3 | Ensure keyboard-avoidance on mobile paywall (composer keyboard overlap) | 1h | A2 | Reuse `mobile-keyboard-aware` CSS class |

### Phase B — Offline Entitlement Cache (~3h)

| # | Task | Effort | Depends On | Notes |
|---|------|--------|------------|-------|
| B1 | Add `offlineCache` + `lastSyncedAt` to `entitlementStore` | 1h | Frontend doc C1 | Follows existing `offline-availability` pattern |
| B2 | Implement offline fallback in `usePaywallTrigger` hook | 1h | B1 | Check cache → expired → show "check connection" |
| B3 | Wire `MobileOfflineBanner` to show entitlement cache status | 1h | B2 | "Offline — access verified 3h ago" |

### Phase C — Wiring LicenseBanner (~1h)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| C1 | Pass `licenseBanner` prop from `App.tsx` to `MobileShell` and `DesktopShell` | 0.5h | Minor wiring gap — prop exists but isn't passed |
| C2 | Verify trial countdown + Basic upgrade banner renders in mobile bottom tab layout | 0.5h | Visual check on phone breakpoint |

---

## Backward Compatibility

| Existing Mobile Feature | Impact | Mitigation |
|------------------------|--------|------------|
| `MobileShell` layout | None — `licenseBanner` prop already defined, just not passed | Adding the prop doesn't change existing behavior |
| `AdaptiveBottomSheet` | None — reused as paywall container | Same component, new caller |
| `MobileOfflineBanner` | None — extended with entitlement status | Additive — existing offline banner still shows |
| `useBreakpoint()` | None — already used for shell layout | Paywall detection reuses same hook |
| Touch target audit (44×48dp) | None — badges already meet minimum | `AssetTierBadge` inherits same CSS |

---

## Cross-References

- **Backend entitlement (shared):** [`10-monetization-entitlement-engine.md`](10-monetization-entitlement-engine.md)
- **Frontend paywall + badges:** [`11-monetization-frontend-paywall.md`](11-monetization-frontend-paywall.md)
- **Asset delivery (shared download pipeline):** [`12-monetization-asset-delivery.md`](12-monetization-asset-delivery.md)
- **Source analysis:** [`../analysis.md`](../analysis.md#84-mobile-what-stays-the-same) §8.4, [`../monetization-style.md`](../monetization-style.md) §3
- **Existing mobile architecture:** [`../01-ARCHITECTURE/05-mobile-architecture.md`](../01-ARCHITECTURE/05-mobile-architecture.md)
- **Existing mobile UI strategy:** [`../03-FRONTEND/06-mobile-ui-strategy.md`](../03-FRONTEND/06-mobile-ui-strategy.md)
- **Existing AdaptiveBottomSheet (Phase 3):** [`../03-FRONTEND/08-ui-ux-roadmap.md`](../03-FRONTEND/08-ui-ux-roadmap.md)
