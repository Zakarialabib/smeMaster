# Dashboard

> **Status:** Production — 10 widgets, cross-feature overview, quick actions.
> **Stack:** React 19 + Zustand + d3-force (network graph) + SQLite aggregates

## Overview

Dashboard is the cross-feature overview: stats, activity, health, and quick actions. Ten widget components pull from email, contacts, tasks, campaigns, automation, and ERP.

## Architecture

```
DashboardPage.tsx → dashboardStore.ts → per-widget data hooks
  → invokeCommand("db_*") → Rust aggregates
  → SQLite (threads, contacts, tasks, campaigns, ledger)
```

Widgets are independent — each fetches its own slice. `SectionCard` + `SectionConsole` provide the shell.

## Widgets (10)

| Widget               | What it shows                    | File                                               |
| -------------------- | -------------------------------- | -------------------------------------------------- |
| **Email stats**      | Volume + growth                  | `EmailVolumeWidget.tsx`, `ContactGrowthWidget.tsx` |
| **Email heatmap**    | Activity calendar                | `EmailHeatmapWidget.tsx`                           |
| **Entity network**   | Contact/company graph (d3-force) | `EntityNetworkGraph.tsx`                           |
| **Contact stats**    | Totals + growth                  | `ContactsStatsWidget.tsx`                          |
| **Campaign stats**   | Sent, open, click                | `CampaignsStatsWidget.tsx`                         |
| **Task summary**     | Open, overdue, done              | `TaskSummaryWidget.tsx`                            |
| **Automation rules** | Rule health                      | `AutomationRulesWidget.tsx`                        |
| **Business health**  | ERP + cash snapshot              | `BusinessHealthWidget.tsx`                         |
| **Recent activity**  | Cross-feature timeline           | `RecentActivityWidget.tsx`                         |
| **Quick actions**    | Compose, add contact/task/event  | `QuickActionsWidget.tsx`                           |

## Layout

- **Desktop:** grid of `SectionCard` widgets (`DashboardPage.tsx`)
- **Mobile:** stacked + `MobileDashboardPage.tsx`
- **Section config:** `data/sectionCards.ts` defines order and visibility

## Key Files

| Layer      | Path                                                         |
| ---------- | ------------------------------------------------------------ |
| Pages      | `src/features/dashboard/pages/` (Dashboard, MobileDashboard) |
| Store      | `src/features/dashboard/stores/dashboardStore.ts`            |
| Components | `src/features/dashboard/components/` (10 widgets + shell)    |
| Config     | `src/features/dashboard/data/sectionCards.ts`                |

## Related Docs

- [Email Management](01-email-management.md) — email stats source
- [CRM & Contacts](03-crm-contacts.md) — contact stats source
- [Tasks](08-tasks.md) — task stats source
- [Campaigns](02-campaigns-mail-merge.md) — campaign stats source
