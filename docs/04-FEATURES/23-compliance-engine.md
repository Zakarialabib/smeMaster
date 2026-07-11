# Compliance Engine

> Policy-aware sending checks and compliance profile tooling for outbound communication.

## Scope

The compliance engine focuses on outbound message review against configurable or profile-driven rules.

This includes:

- compliance profile management
- draft evaluation against rule sets
- pre-send warnings and guidance
- compliance-related settings and profile UI

This page should not duplicate the full composer flow or general deliverability checks.

## Current Ownership

Compliance logic is spread across:

- mail-side compliance services
- settings-side compliance management UI
- backend command and data layers where applicable

Relevant code areas include:

- `src/features/mail/services/compliance/`
- `src/features/settings/components/ComplianceProfileManager.tsx`
- `src/features/settings/components/tabs/ComplianceTab.tsx`
- `src/features/mail/db/complianceProfiles.*`

## What It Does

### Profile-based review

The compliance layer evaluates a draft against selected or inferred rule profiles. The exact profile list may evolve, so this page should describe the capability rather than hardcode a stale catalog unless the code guarantees it.

### Pre-send feedback

Users can receive:

- score-like evaluations
- warnings or violations
- actionable guidance before sending

### Settings and governance

The feature includes management surfaces for compliance profiles and related configuration so the user can tune policy behavior rather than relying only on fixed defaults.

## Boundaries

Keep the split clear:

- composer UX belongs to `34-mail-composer.md`
- sender-health and DNS/reputation checks belong to `21-deliverability.md`
- AI-assisted suggestions belong to `22-ai-integration.md`

Compliance is the policy and rule-evaluation layer for outbound content.

## Key Files

| Area                       | Files                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Mail-side compliance logic | `src/features/mail/services/compliance/`                                                                                   |
| Compliance settings UI     | `src/features/settings/components/ComplianceProfileManager.tsx`, `src/features/settings/components/tabs/ComplianceTab.tsx` |
| Related DB layer           | `src/features/mail/db/complianceProfiles.test.ts` and related compliance storage/query files                               |
| Backend support            | `src-tauri/src/commands/compliance.rs`, `src-tauri/src/db/compliance/`                                                     |

## Update Rules

Update this page when:

- compliance profiles or their ownership change
- rule evaluation moves between frontend and backend layers
- the composer/compliance handoff changes materially
- compliance becomes a broader feature beyond outbound messaging
