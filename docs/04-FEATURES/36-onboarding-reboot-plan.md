# Onboarding Reboot Plan

> **Status:** Spec — the current 4-step modal works; this plan describes the full-screen reboot.
> **Current:** `OnboardingScreen.tsx` + `useOnboarding.ts` (4-step modal wizard)
> **Target:** Full-screen setup wizard (Welcome → Account → Import → PGP → Tour)

## Current State (shipped)

| Area            | Implementation                                                           |
| --------------- | ------------------------------------------------------------------------ |
| **UI**          | `src/features/onboarding/OnboardingScreen.tsx` (4-step modal)            |
| **State**       | `src/features/onboarding/hooks/useOnboarding.ts`                         |
| **Persistence** | `useLocalStorage("smemaster.onboarding.done")` + Rust `onboarding.json`  |
| **Navigation**  | ArrowLeft/ArrowRight keyboard support                                    |
| **Entry**       | `App.tsx` via `showOnboarding` flag; auto-open AddAccount if no accounts |
| **Tests**       | `src/features/onboarding/__tests__/OnboardingScreen.test.tsx`            |

Works. The reboot is polish, not rescue.

## Gap (why reboot)

Per Gate 5: the modal could expand to 5 steps (Welcome → Account → Import → PGP → Tour). The modal constrains rich content (account import scanner, PGP keygen, feature tour). Full-screen gives room.

## Target Flow (5 steps)

| Step           | Screen                 | Content                                                             |
| -------------- | ---------------------- | ------------------------------------------------------------------- |
| **1. Welcome** | Hero + value props     | What SMEMaster does, offline-first promise, privacy note            |
| **2. Account** | AddAccount inline      | Provider picker → OAuth / IMAP (reuse `04-accounts.md` flow)        |
| **3. Import**  | Import scanner         | `AccountImportScanner` — bulk discover + selective import           |
| **4. PGP**     | Keygen / import        | Generate or import PGP key (reuse `26-pgp-encryption.md` flow)      |
| **5. Tour**    | Interactive highlights | Skip-to-content, keyboard shortcuts, smart folders, command palette |

Each step: Back / Continue / Skip. Progress persisted per-step (resume on restart).

## Acceptance

- [ ] Full-screen route (not modal) — `/onboarding` or overlay shell
- [ ] All 5 steps reachable by keyboard
- [ ] Account step creates a working account (same as AddAccount)
- [ ] PGP step generates or imports a key (same as PGP Setup)
- [ ] Tour highlights real UI (not screenshots)
- [ ] `smemaster.onboarding.done` set on completion or explicit skip
- [ ] Existing 4-step modal removed after reboot ships

## Key Files

| Layer            | Path                                              |
| ---------------- | ------------------------------------------------- |
| Current UI       | `src/features/onboarding/OnboardingScreen.tsx`    |
| Current state    | `src/features/onboarding/hooks/useOnboarding.ts`  |
| Entry            | `src/App.tsx` (`showOnboarding`)                  |
| Reuse — accounts | `src/features/accounts/components/AddAccount.tsx` |
| Reuse — PGP      | PGP setup flow (`26-pgp-encryption.md`)           |

## Related Docs

- [Accounts](04-accounts.md) — step 2 reuse
- [PGP Encryption](26-pgp-encryption.md) — step 4 reuse
- [Settings Redesign](37-settings-redesign-spec.md) — IA alignment
- [Navigation & IA Spec](../03-FRONTEND/14-navigation-ia-spec.md) — first-run landing
