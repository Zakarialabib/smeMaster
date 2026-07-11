# Filters

> Rule-based email filtering, matching, and filter-testing workflows.

## Scope

Filters cover the structured matching system used to evaluate email against conditions and operators.

This page covers:

- filter rule behavior
- condition/operator-based matching
- filter editing and testing UI
- related mail-rule ownership

## Current Ownership

Representative code areas:

- `src/features/mail/services/filters/filterEngine.ts`
- `src/features/mail/services/filters/filterTester.ts`
- `src/features/mail/db/filters.ts`
- `src/features/settings/components/FilterEditor.tsx`
- `src/features/settings/components/FilterTestDialog.tsx`
- `src/features/settings/components/tabs/MailRulesTab.tsx`

## What It Does

The filter subsystem lets users define structured rules that evaluate messages using condition groups and supported operators. It also includes testing/debugging support so users can validate a rule against real data.

## Boundaries

Keep these responsibilities separate:

- automation trigger/action orchestration belongs to `Core/05-automation.md`
- quick snippets belong to `29-quick-replies.md`
- general inbox behavior belongs to `Core/01-email-management.md`

Filters are about message matching and routing logic, not the full automation model.

## Key Files

| Area            | Files                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Matching engine | `src/features/mail/services/filters/filterEngine.ts`                        |
| Rule testing    | `src/features/mail/services/filters/filterTester.ts`                        |
| DB layer        | `src/features/mail/db/filters.ts`                                           |
| UI              | `src/features/settings/components/FilterEditor.tsx`, `FilterTestDialog.tsx` |
| Settings entry  | `src/features/settings/components/tabs/MailRulesTab.tsx`                    |

## Update Rules

Update this page when:

- operators or condition semantics change
- filter ownership moves between mail and automation
- the testing/debugging surface changes materially
