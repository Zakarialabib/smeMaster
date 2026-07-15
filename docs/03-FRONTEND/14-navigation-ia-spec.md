# SMEMaster — Navigation & Information Architecture Spec

> **Status:** DRAFT (2026-07-15). APPROVAL document, not yet execution.
> Companion to `docs/04-FEATURES/37-settings-redesign-spec.md`.
>
> **Owner priority (from brief):** "the perfect management system for SME — **email first,
> CRM second, then marketing and automation**." This spec reorganizes navigation,
> sections, tabs, settings pages and in-page content around that order.
>
> **Verified source (2026-07-15):** `src/shared/components/layout/shell/navConfig.ts`
> (`NAV_GROUPS`), `src/shared/components/layout/shell/NavRail.tsx`,
> `src/features/mail/components/layout/BottomTabBar.tsx`, `src/router/routeTree.tsx`,
> `src/features/settings/components/SettingsTabRegistry.ts`.

---

## 0. The Problem (verified drift)

1. **Rail order ignores the owner priority.** `NAV_GROUPS` = `dashboard, mail, crm,
   automation, vault, ai-assistant, settings, help`. Email is #2 behind Dashboard; the
   owner wants Email #1 / landing.
2. **Desktop rail orphans 3 sections.** Tasks, Calendar, Campaigns have NO rail group.
   They are only reachable via the `CommandPalette` or deep links. `getActiveNavFromPath`
   maps `/tasks`/`/calendar`/`/campaigns`/`/pos` but no group renders them.
3. **`navConfig.ts` lies about coverage.** DESIGN spec §4.2 claims the rail "already
   covers Tasks, Calendar, Campaigns, Invoicing, ERP" — it does NOT. Only Invoicing/ERP
   hide under the Dashboard group.
4. **`navConfig` Settings group (18 items) diverges from `SettingsTabRegistry` (24 tabs/
   8 groups).** Two sources of truth → users see a stale settings list in the rail flyout.
5. **Automation group is empty** in the rail (`items: []`) yet Automation/Campaigns/
   Workflows are real pages → dead/odd nav.
6. **No "customer 360" cross-wiring affordance** from email → CRM/deal/task/campaign.

---

## 1. Target Desktop NavRail (icon rail + hover flyout) — EMAIL-FIRST

Order reflects the owner's priority. Icon rail holds ~9 main groups + Settings/Help pinned
bottom (matches `NavRail` bottomIds pattern).

| # | Group | Flyout / sub-items | Notes |
| --- | --- | --- | --- |
| 1 | **Mail** (landing `/`) | inbox, starred, snoozed, sent, drafts, trash, spam, all, attachments, smart-folders, labels | Keep as hub; add "Compose" FAB |
| 2 | **CRM** (`/crm`) | contacts, companies, (deals — see §4) | Promote from #3 to #2 |
| 3 | **Plan** (`/tasks`) | tasks, calendar | **NEW group** — merges orphaned Tasks+Calendar (Thumb-reachable "what's next") |
| 4 | **Campaigns** (`/campaigns`) | campaigns list, segments, templates, analytics | **NEW rail group** — Marketing, formerly orphaned |
| 5 | **Automation** (`/automation`) | workflows, mail-rules, ai-automations | Fix empty group; add real items |
| 6 | **Dashboard** (`/dashboard`) | overview, invoicing, erp | Finance/overview — demoted from #1 to #6 (email-first) |
| 7 | **Vault** (`/vault`) | files, categories | Keep |
| 8 | **AI** (`/ai-assistant`) | assistant, local RAG | Keep |
| — | **Settings** (bottom) | → settings registry | Fix drift (§5 of 37-spec) |
| — | **Help** (bottom) | help-center, about | Keep |

**Why this order:** an SME owner opens the app to DO EMAIL, then acts on the people in
it (CRM), schedules follow-ups (Plan), launches a campaign (Marketing), and automates the
repeatable (Automation). Finance (Dashboard/Invoicing/ERP) is vital but not the daily
entry point → lower. Vault/AI are utilities → lowest.

---

## 2. Mobile BottomTabBar (max 5 + Hub) — already correct, align labels

The mobile bar (`BottomTabBar.tsx`) already implements the Hub-sheet pattern:
`Dashboard / Mail / CRM / [Hub] / Settings` + Hub = Tasks, Calendar, Invoicing, ERP,
Automation, Campaigns. **This is DONE and matches the email-first order.** Only align the
Hub to the new desktop grouping (Plan = Tasks+Calendar; Campaigns separate from Automation).

Keep: 4 thumb tabs + center Hub FAB. Do NOT add a 5th thumb tab for Campaigns — Hub is
the right home for secondary destinations (per DESIGN §4.2 / G6 fix, already shipped).

---

## 3. Landing / First-Run

- **Landing route = `/mail/inbox`** (was `/dashboard` or `/`). Email-first means the app
  opens in email. Dashboard becomes a deliberate destination, not the default.
- **First-run:** onboarding "Load demo data" → populated Gmail-like inbox (MVP plan Phase C,
  seeds shipped). Never an empty app on first paint.

---

## 4. Cross-Wiring: make Email the HUB (the "perfect management system" glue)

These are the cohesion features that turn siloed modules into ONE system. Priority from
the cross-wiring research delegate (to be integrated). Baseline already in code:
`ContactSidebar` (Relations tab: company/invoices/campaigns), email→task DnD, composer
company badge, `db_list_campaigns_by_contact`.

Proposed hub affordances (each reachable from a thread/contact):
- **From any email →** "Add to CRM" (if unknown sender), "Create task", "Create deal",
  "Add to segment", "Start automation". (Hover rail + context menu.)
- **Customer 360 panel:** open a contact → unified timeline (emails, tasks, deals,
  campaigns received, invoices). Reuse `ContactSidebar` + new timeline tab.
- **Email event → CRM:** open/click/reply updates contact engagement score (Campaigns
  already tracks; surface in CRM).
- **Automation triggers from email:** no-reply in 14d → create task / nudge (workflows
  engine exists).
- **Search across everything:** `CommandPalette` already does nav; extend to global search
  (contacts + mail + tasks + campaigns) — already partially present via unifiedSearch.

---

## 5. In-Page Content Organization (per the DESIGN page-template contract)

Every primary page follows `PageScaffold` (header + toolbar + content + EmptyState).
Owner priority implies content emphasis:
- **Mail:** prioritize Focused/Primary, hover action rail, bulk toolbar (Phase B shipped).
- **CRM:** prioritize the contact→timeline→deal path; de-emphasize raw table dumps.
- **Campaigns:** prioritize segment→block-editor→A/B→schedule→analytics loop.
- **Settings:** see `37-settings-redesign-spec.md`.

---

## 6. Implementation Chunks (after approval)

- **N1** — Reorder `NAV_GROUPS` to email-first; set landing to `/mail/inbox`.
- **N2** — Add `Plan` group (tasks+calendar) + `Campaigns` group + fix `Automation`
  items in `navConfig.ts`; update `getActiveNavFromPath` / `getActiveSubItem` /
  `handleNavSelect` / `handleSubItemSelect` to match.
- **N3** — Kill `navConfig` Settings drift: rail Settings flyout reads `SettingsTabRegistry`
  (single source of truth).
- **N4** — Add Customer 360 timeline tab to `ContactSidebar`; wire email→deal/task/
  segment/automation affordances.
- **N5** — Align mobile Hub sheet labels to new grouping.
- **N6** — Fix DESIGN spec §4.2 false claim; update STATUS/INDEX.

---

## 7. Prior Art & Consolidation (VERIFIED 2026-07-15)

Two strong pre-existing proposals already cover this ground and are the canonical
references — this spec CONSOLIDATES and grounds them in source, not duplicates them:

- `docs/navigation-redesign/IA-RECOMMENDATION.md` — email-first rail order (Mail→CRM→
  Marketing→Automation→Finance→Plan→Vault→AI), desktop rail model, mobile 5-tab+Hub,
  8 cross-wiring "steal this" patterns, 10 pitfalls. **Adopt its ordering.**
- `docs/plans/SETTINGS-IA-PROPOSAL.md` — settings group tree, search/palette, tiering,
  global-vs-per-account, mobile renderer. Mirrors `37-settings-redesign-spec.md`.

### 7.1 Three source-verified facts folded in (not in prior docs)
1. **Landing route is `/dashboard`, NOT email.** `src/router/routeTree.tsx:150` does
   `redirect({ to: "/dashboard" })`. This contradicts the owner's email-first priority AND
   the DESIGN spec intent. **Fix (N1):** change to `redirect({ to: "/mail/inbox" })`.
2. **Duplicate `Bot` icon bug.** `navConfig.ts:125` (automation) and `:137` (ai-assistant)
   both use `Bot` — two destinations, one glyph → rail scannability destroyed. **Fix (N2):**
   give Automation `GitBranch`/`Workflow` and AI `Sparkles` (the registry already uses
   `Sparkles` for AI).
3. **`navConfig.ts` Settings group diverges from `SettingsTabRegistry`** (18 stale vs 24
   real tabs; `workflows` orphaned; Appearance missing). **Fix (N3):** rail Settings flyout
   must read the registry (single source of truth).

### 7.2 "Steal this" — top cross-wiring patterns (from prior art, cited)
1. Unified inbox → CRM contact timeline (Front / HubSpot). 2. One-click email→contact
( Superhuman). 3. Campaign→Segment→Contact hierarchy, bidirectional (Mailchimp/Brevo).
4. Automation triggers FROM email events (Zapier/HubSpot/Missive) — co-locate mail-rules
with Automation, not Settings. 5. Inline compose-from-record + reverse (HubSpot/Pipedrive).
6. Split inboxes/views (Superhuman/Gmail/Outlook). 7. Universal Cmd+K palette over 800+
actions w/ contextual commands (Linear/Superhuman). 8. Deal/email → invoice (HubSpot/
QuickBooks). 9. Snooze→Calendar (HEY).

### 7.3 Pitfalls (from prior art)
Fake back-button (HEY); burying daily tools in menus; duplicate/ambiguous icons (Bot/Bot);
rail bloat >8; palette-as-graveyard; siloed Contacts vs Mail; mail-rules hidden in Settings;
11 mobile tabs (use Hub); no density control; forgetting keyboard parity on mobile.
