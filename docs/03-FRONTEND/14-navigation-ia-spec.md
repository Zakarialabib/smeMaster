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

Order reflects the owner's priority. Icon rail holds 8 main groups + Settings/Help pinned
bottom (matches `NavRail` bottomIds pattern). **Reference implementation (tsc-clean, 37/37
nav tests pass): `docs/navigation-redesign/proposed-navConfig.ts`** — drop-in replacement
for `navConfig.ts`. This section mirrors it.

| # | Group | Icon (FIX) | Flyout / sub-items | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Mail** (landing `/mail/inbox`) | Mail | inbox, starred, snoozed, sent, drafts, trash, spam, all, attachments, smart-folders, labels, splits | Hub; Compose FAB; unread badge |
| 2 | **CRM** (`/crm`) | Users | contacts, companies, **deals**, timeline | `deals` addresses the #1 CRM gap (pipeline, §4.3); `timeline` = Customer 360 |
| 3 | **Marketing** (`/marketing`) | Megaphone | campaigns, segments, templates, analytics, deliverability | Formerly orphaned `/campaigns`; now first-class |
| 4 | **Automation** (`/automation`) | **GitBranch** (FIX: was `Bot`) | workflows, triggers, **rules (moved from Settings)**, webhooks | Co-locates mail-rules with automation (research pattern #4) |
| 5 | **Plan** (`/calendar`) | CalendarDays | calendar, tasks | Folds orphaned Tasks+Calendar into one rail slot (calm rail ≤8) |
| 6 | **Finance** (`/finance`, was "Dashboard") | Calculator | invoicing, erp, reports | Rebrand: SME owners think "Finance" not "Dashboard"; demoted from #1 |
| 7 | **Vault** (`/vault`) | FolderLock | files, shared, recovery | Keep |
| 8 | **AI** (`/ai-assistant`) | **Sparkles** (FIX: was `Bot`) | chat, knowledge, index | Local RAG |
| — | **Settings** (bottom) | Settings | → settings registry | Fix drift (§5 of 37-spec) |
| — | **Help** (bottom) | HelpCircle | help-center, about | Keep |

**Why this order:** an SME owner opens the app to DO EMAIL, then acts on the people in
it (CRM), launches a campaign (Marketing), automates the repeatable (Automation), schedules
follow-ups (Plan), and manages money (Finance). Vault/AI are utilities → lowest.

> **Route-mapping dependency (IMPORTANT):** the proposed config routes to
> `/marketing/*`, `/finance`, `/automation/*`, `/crm?view=`, `/vault?view=` — these are
> ASPIRATIONAL and do NOT yet match the live router (`/campaigns`, `/erp`, `/invoicing`,
> `/dashboard`, `/workflows`, `/crm`, `/people`). Adopting the config requires either
> (a) adding the new routes to `src/router/routeTree.tsx` + `App.tsx`/`MobileShell.tsx`, or
> (b) re-pointing the config's `path`/`handleNavSelect` to the EXISTING routes. **Lowest-risk
> path for N1–N2:** keep existing routes, only reorder `NAV_GROUPS` + fix icons + set landing
> to `/mail/inbox`. Route renames (Dashboard→Finance, Campaigns→Marketing) are a follow-up
> N-chunk, not required for the email-first win.

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

### 4.1 The architectural spine (from cross-wiring research, 2026-07-15)

The unifying insight from HubSpot/ActiveCampaign/Pipedrive/Front/Missive: **there is no
"email module" — email is one activity type on a shared contact/deal timeline; every module
reads/writes that same stream.** Build this FIRST — it dissolves the silos. Concretely: a
single **`activities` event stream keyed by `contact_id` + polymorphic source** (email,
call, note, task, invoice, campaign send/open/click, calendar event, deal-stage change).
`ContactSidebar` already shows Relations (company/invoices/campaigns); extend it to render
the full timeline.

### 4.2 Prioritized cross-wiring (P0/P1/P2) — complexity + source

**P0 — the spine (nothing feels unified without these)**
- **Email↔Contact auto-resolve + auto-create** (Low-Med) — match every message to a
  contact by address; one-tap/silent create if unknown. CRM populates itself from the inbox.
  *(Pipedrive auto-mirrors pitches/replies to deal timeline; HubSpot auto-logs.)*
- **Unified activity timeline** (Med) — the `activities` spine above. #1 "feels like one
  system" driver. *(HubSpot record activities; Pipedrive deal timeline.)*
- **Email thread ↔ CRM contact/deal, bidirectional, from inside the inbox** (Med) — in-inbox
  360 side panel (open deals, last invoice, recent activity, notes); reply from CRM, read CRM
  from inbox. *(Front/Missive; Superhuman enrichment panel.)*
- **Email engagement events → contact/deal score** (Med) — opens/clicks/replies raise a
  score; inactivity decays it; score is a first-class field usable in segments+automations.
  *(ActiveCampaign deal+lead scoring; Keap.)*

**P1 — connective tissue**
- **Automation triggers from email events** (Med) — wire email events into the existing rule
  engine: no-reply N days → follow-up task; link clicked → raise score+notify; reply →
  advance deal stage. *(HubSpot workflows.)*
- **Campaign segment ↔ CRM saved filter (one query language)** (Med) — a segment and a CRM
  list are the SAME object (saved filter over contacts); build in Campaigns, use as CRM view.
  *(ActiveCampaign; Brevo.)*
- **Email compose ↔ invoice/quote insert** (Med) — UNIQUE smeMaster edge (native DGI
  invoicing, no cloud competitor has it): "Attach quote/invoice" pulls from Invoicing, logs
  to timeline, payment flows back, deal↔invoice total sync.
- **Calendar event ↔ email follow-up loop** (Low-Med) — book from thread; post-meeting
  auto-draft follow-up + task; no-show → re-engage automation. *(HubSpot Meetings+workflows.)*

**P2 — intelligence (AI/RAG differentiator)**
- **AI summarize contact from full email + activity history** (Med) — local RAG over the
  timeline → "state of this relationship" paragraph + grounded draft-reply. Offline/private =
  genuine edge over cloud tools.
- **Deal auto-progression from email semantics** (High) — AI reads reply intent ("send quote"
  / "not interested") → suggests stage move. *(ActiveCampaign/HubSpot AI; do it locally.)*

### 4.3 Two CRITICAL CRM gaps vs best-in-class (currently MISSING in smeMaster)
1. **Deal / pipeline stages** (kanban, drag-drop, per-deal value+probability) — Pipedrive/
   HubSpot. "CRM without a pipeline isn't a sales CRM." **Biggest gap.**
2. **Lead/contact scoring** as a first-class field — ActiveCampaign/Keap.
> Both must ship before smeMaster can claim "perfect management system for SME." The
> engagement-score cross-wire (4.2 P0 #4) is the natural home for scoring.

### 4.4 "Wow" cohesion features (award-winning bar)
- **Customer 360 reachable from anywhere** — click any email address / contact / invoice /
  attendee → same panel (timeline+deals+money+AI summary). One component, invoked everywhere.
  The screenshot reviewers will love.
- **Smart nudges / "attention inbox"** — daily digest IN email: "Haven't heard from Acme in
  14d (open deal 40k MAD)", "3 invoices overdue", "Karim opened your quote 4× — call him."
  From timeline+scores. *(HubSpot digest + Boomerang follow-up.)*
- **One search across everything** — single ⌘K over emails+contacts+deals+invoices+notes+
  files; jumps to any object. *(Superhuman/Missive speed + cross-module reach.)*
- **Email-driven deal progression** — replies advance stages, silence stalls them; live
  pipeline that "breathes" from inbox activity.
- **Headline edge:** native DGI invoicing wired into email/deals + offline local-RAG AI
  summarization — no cloud incumbent can match these. Lead with them.

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

Reference drop-in: `docs/navigation-redesign/proposed-navConfig.ts` (tsc-clean, 37/37 tests).
Adopt in two passes — **Pass A is low-risk and delivers the email-first win without any
route changes**; Pass B is the route-rename polish.

**Pass A — nav-only (no route changes; reuses existing paths)**
- **N1** — Reorder `NAV_GROUPS` to email-first (Mail→CRM→Marketing→Automation→Plan→Finance→
  Vault→AI); set landing to `/mail/inbox` in `routeTree.tsx:150`.
- **N2** — Add `Plan` group (tasks+calendar) + `Marketing` group (campaigns/segments/
  templates/analytics/deliverability) + fix `Automation` items (GitBranch icon, items from
  proposed config); fix the `Bot`/`Bot` duplicate (automation→GitBranch, ai→Sparkles).
- **N3** — Kill `navConfig` Settings drift: rail Settings flyout reads `SettingsTabRegistry`
  (single source of truth) instead of the stale 18-item list.
- **N4** — Align mobile Hub sheet labels to new grouping (Plan=Tasks+Calendar; Marketing
  separate from Automation). Mobile thumb bar already email-first.
- **N5** — Fix DESIGN spec §4.2 false claim (done in f0d7c5b); ensure STATUS/INDEX reflect.

**Pass B — route renames (follow-up; optional for the email-first win)**
- **N6** — Rename routes to match the proposed config: `/dashboard`→`/finance`,
  `/campaigns`→`/marketing`, add `/automation/{workflows,triggers,rules,webhooks}`,
  `/crm?view=`, `/vault?view=`. Requires `routeTree.tsx` + `App.tsx`/`MobileShell.tsx` +
  `getActiveNavFromPath`/`handleNavSelect` updates. (The proposed config already has these
  mappers; wire them once routes exist.)

**Cross-wiring chunks (separate from nav; see §4)**
- **X1** — `activities` spine table keyed by `contact_id` + polymorphic source.
- **X2** — Customer 360 panel (timeline+deals+money+AI) reachable from any email/contact.
- **X3** — Email-engagement → contact/deal score (first-class field; feeds segments+automations).
- **X4** — Automation triggers from email events (wire into existing rule engine).
- **X5** — CRM **Deals/Pipeline** + **Lead scoring** (the two #1 gaps, §4.3).

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
