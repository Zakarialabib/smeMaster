# Deliverability

> Sender-health tooling for domain checks, blacklist visibility, bounce handling, and pre-send quality feedback.

## Scope

Deliverability covers the systems that help a user send better email and diagnose sender-health problems:

- SPF, DKIM, and DMARC checks
- blacklist and reputation-oriented checks
- bounce and abuse-report support
- content-quality and pre-send guidance
- warming-related services and settings

This page documents the deliverability surface itself, not the general composer or compliance subsystems.

## Current Ownership

Primary code lives in:

- `src/features/deliverability/`
- related settings components under `src/features/settings/`

Important areas include:

- `services/domainChecker.ts`
- `services/domainHealthService.ts`
- `services/blacklistService.ts`
- `services/bounceService.ts`
- `services/preSendChecklist.ts`
- `components/DeliverabilityPanel.tsx`
- `components/HealthScoreCard.tsx`
- `components/ProviderMatrix.tsx`

## What It Does

### Domain health checks

The feature evaluates domain-level sender setup and health signals such as:

- SPF
- DKIM
- DMARC
- blacklist-related status
- related sender-health summaries

### Pre-send guidance

Deliverability is also part of the message-preparation experience. It can surface checks that help catch risky or low-quality outbound messages before they are sent.

### Bounce and abuse support

Supporting services exist for:

- bounce handling
- ARF-related workflows
- suppression-list style data handling

### Warming support

The feature set includes warming-related data and services, including the warming DB layer and helper services.

## Boundaries

Keep these responsibilities separate:

- message authoring belongs to `34-mail-composer.md`
- regulatory and profile-based checks belong to `23-compliance-engine.md`
- general email account/provider behavior belongs to `Core/01-email-management.md`

Deliverability should stay focused on sender health and send quality, not on duplicating the whole outbound mail stack.

## Key Files

| Area                 | Files                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature root         | `src/features/deliverability/`                                                                                                                       |
| Domain checks        | `src/features/deliverability/services/domainChecker.ts`, `domainHealthService.ts`                                                                    |
| Reputation and lists | `src/features/deliverability/services/blacklistService.ts`, `bounceService.ts`, `arfService.ts`                                                      |
| Pre-send quality     | `src/features/deliverability/services/preSendChecklist.ts`, `contentQuality.ts`                                                                      |
| UI                   | `src/features/deliverability/components/DeliverabilityPanel.tsx`, `HealthScoreCard.tsx`, `ProviderMatrix.tsx`                                        |
| Related settings/UI  | `src/features/settings/components/BlacklistChecker.tsx`, `BounceManager.tsx`, `WarmingSettings.tsx`                                                  |
| Settings tabs        | `src/features/settings/components/tabs/DeliverabilityTab.tsx`, `PresendTab.tsx` (DNS/Blacklist/Bounce/Warming were merged into `DeliverabilityTab`) |
| Backend commands     | `src-tauri/src/commands/deliverability.rs`                                                                                                           |
| Backend DB domain    | `src-tauri/src/db/deliverability/`                                                                                                                   |

## Update Rules

Update this page when:

- sender-health checks change materially
- new deliverability UIs become primary
- warming or bounce flows move to different ownership
- pre-send quality checks shift between deliverability and compliance

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| Settings tabs: `DnsTab/BounceTab/BlacklistTab/WarmingTab.tsx` | Only `DeliverabilityTab.tsx` + `PresendTab.tsx` exist; the sub-tools were merged into `DeliverabilityTab` | `ls src/features/settings/components/tabs/` (grep deliver/dns/black/bounce/warm/presend) → only `DeliverabilityTab`, `PresendTab` |
