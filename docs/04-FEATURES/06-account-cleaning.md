# Account Cleaning

> **Status:** Production — retention rules and cleanup workflows (Settings → Account Cleaning).
> **Stack:** React 19 + Rust + SQLite

## Overview

Account Cleaning keeps inboxes tidy: retention policies define how long emails are kept, and cleanup rules match by sender, subject, age, or unsubscribe status — then delete, archive, or categorize.

## Architecture

```
AccountCleaningTab.tsx → rule CRUD
  → invokeCommand("db_*") → Rust (retention/cleanup domain)
  → SQLite (cleanup_rules table with retention_days)
```

Registered in `SettingsTabRegistry.ts` as `account-cleaning`, adjacent to `backup-restore`.

## Core Capabilities

| Area                   | What it does                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **Retention policies** | Default retention period (days); emails older than the period become cleanup candidates       |
| **Cleanup rules**      | Match by sender, subject, age, or unsubscribe status → action (delete / archive / categorize) |
| **Age rules**          | `retention_days` per rule; null for non-age rules                                             |
| **Compliance link**    | Retention-notice checks in the compliance engine (`retention_notice` rule)                    |

## Rule Model

```ts
{
  rule_type: 'age' | 'sender' | 'subject' | 'unsubscribe',
  retention_days: number | null,  // only for 'age'
  condition: string,               // sender/subject match
  action: 'delete' | 'archive' | 'categorize'
}
```

Schema: `src/shared/services/db/schema.ts` (`retention_days: number | null`).

## Key Files

| Layer      | Path                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| UI         | `src/features/settings/components/tabs/AccountCleaningTab.tsx`                 |
| Registry   | `src/features/settings/components/SettingsTabRegistry.ts` (`account-cleaning`) |
| Compliance | `src/features/mail/services/compliance/ruleEngine.ts` (`retention_notice`)     |
| i18n       | `settings.tabs.accountCleaning` in all 5 locales                               |

## Related Docs

- [Email Management](01-email-management.md) — inbox source
- [Filters](28-filters.md) — rule-based filtering
- [Compliance Engine](23-compliance-engine.md) — retention notices
- [Backup & Restore](../user-guide/backup-restore.md) — data safety
