# smeMaster Navigation / Information Architecture — Master-Class Recommendation

**Goal:** Email-first, CRM-second, then Marketing + Automation. "The perfect management system for SME."
**Platforms:** Tauri desktop (Win/Linux/macOS) + Android (offline-first, React 19).
**Current state (audited):** `src/shared/components/layout/shell/navConfig.ts` drives a collapsible icon rail (`NavRail.tsx`) that expands to a 260px panel, plus a `BottomTabBar` mobile nav (`MobileShell.tsx`). Current rail order: Dashboard(invoicing,erp) → Mail → CRM → Automation → Vault → AI → Settings → Help.

> ⚠️ Bug found in current `navConfig.ts`: `automation` **and** `ai-assistant` both use the `Bot` icon. Two different destinations share one glyph → destroys rail scannability. Fix in the proposed config below.

---

## (a) Recommended TOP-LEVEL SECTIONS — ordering & rationale

| # | Section | Why here | Sub-items (panel) |
|---|---------|----------|-------------------|
| 1 | **Mail** *(home/landing)* | Owner lives in email. Landing route = `/mail/inbox`. First icon, persistent. | Inbox, Starred, Snoozed, Sent, Drafts, Spam, Trash, All, Attachments, Smart Folders, Labels, **Splits** |
| 2 | **CRM** | Explicit #2 priority. Single shared contact model feeds Mail, Marketing, Automation. | Contacts, Companies, Deals/Pipeline, **Timeline** (email+deal+invoice log) |
| 3 | **Marketing** | Top-4 priority. Campaigns/Segments/Templates/Analytics/Deliverability. | Campaigns, Segments, Templates, Analytics, Deliverability |
| 4 | **Automation** | Top-4 priority. Workflows + email-event triggers + rules. | Workflows, Triggers, Rules/Filters, Webhooks |
| 5 | **Finance** *(was "Dashboard")* | Rebrand: SME owners think "Finance," not "Dashboard." Bundles Invoicing + ERP. | Invoicing, ERP (Stock/Journal/Financials/Wallet), Reports |
| 6 | **Plan** *(Calendar + Tasks)* | Fold the two daily "operations" tools into one rail slot to keep the rail calm (≤8 main icons). Mirrors Google Workspace / Outlook grouping. *Tradeoff noted below.* | Calendar, Tasks |
| 7 | **Vault** | Encrypted files — low daily frequency, high trust weight. | Files, Shared, Recovery |
| 8 | **AI** | Local RAG assistant — a mode, not a daily destination. | Chat, Knowledge, Index |
| — | **Settings** *(bottom-pinned)* | System; never scrolls away. | (existing tree) |
| — | **Help** *(bottom-pinned)* | System; never scrolls away. | Help Center, About |

**Rationale for the order:** the owner's literal ranking (Mail → CRM → Marketing → Automation) is preserved as slots 1–4, so the daily quartet is always one tap. Finance is promoted out of a buried "Dashboard" into a named, top-half slot because invoicing is core SME activity. Calendar/Tasks fold into **Plan** to respect the "calm rail" rule (Notion/Linear keep top-level to ~6–8). Vault/AI are demoted to low-frequency slots but stay visible.

> **Alternative if Tasks volume is very high:** split `Plan` back into `Calendar` + `Tasks` as two rail icons and move `Vault`/`AI` into the desktop "More" overflow. Decide by telemetry, not aesthetics.

**Is email the home?** Yes — unconditionally. `/` and empty path → Mail inbox. The rail never auto-collapses Mail; its panel defaults open.

---

## (b) DESKTOP RAIL MODEL (icon rail + expandable panel)

Keep the **existing pattern** (it's sound — equivalent to VS Code's activity bar + Outlook's new nav): a 64px icon rail that hover-expands and click-opens a 260px contextual panel. Refinements:

1. **Default-open the Mail panel** on launch (it's home).
2. **Badges on rail icons** (not just inside panels):
   - Mail → unread count (danger dot, "99+").
   - CRM → open deals.
   - Marketing → campaigns in "sending" state.
   - Plan → overdue tasks / today's meetings.
   - Finance → overdue/unpaid invoices.
3. **Fix the duplicate `Bot` icon** — give Automation a `Workflow`/`GitBranch` glyph and AI its own `Sparkles`.
4. **Keyboard parity on the rail** (already partially built in `NavRail.tsx`): ArrowUp/Down cycles groups, Enter opens panel, Esc closes. Extend with **`g` goto prefixes** (GitHub-style): `g m` Mail, `g c` CRM, `g k` Marketing, `g a` Automation, `g f` Finance, `g p` Plan.
5. **Density**: keep `useDensity()` (comfortable/compact). Email list = compact; CRM/Finance = comfortable. Steal from Superhuman/Outlook + Notion "small text."

```
┌────┬──────────────────────────────┐
│ ✉  │ MAIL                         │   ← home, panel open by default
│    │  Inbox (12)  ★ Starred  ⏱ Snoozed
│ 👥 │  Sent  ✎ Drafts  🚫 Spam  🗑 Trash
│    │  ──  📎 Attachments  🔍 Smart Folders  🏷 Labels  ▥ Splits
│ 📣 │ CRM  → Contacts / Companies / Deals / Timeline
│ 🤖 │ Marketing → Campaigns / Segments / Templates / Analytics / Deliverability
│ ⚡ │ Automation → Workflows / Triggers / Rules / Webhooks
│ 💰 │ Finance → Invoicing / ERP / Reports
│ 🗓 │ Plan → Calendar / Tasks
│ 🔒 │ Vault → Files / Shared / Recovery
│ ✨ │ AI → Chat / Knowledge / Index
├────┴──────────────────────────────┤
│ ⚙ Settings   ❓ Help   (pinned)   │
└───────────────────────────────────┘
```

---

## (c) MOBILE BOTTOM-TAB MODEL + HUB SHEET

**Rule:** max 5 bottom tabs. Thumb-zone the owner's literal daily quartet + a Hub.

**Fixed bottom tabs (5):**
1. **Mail** — inbox + quick filters.
2. **CRM** — contacts/deals (phone-first capture).
3. **Marketing** — monitoring campaigns on the go (top-4 priority honored).
4. **Automation** — check/trigger workflows (top-4 priority honored).
5. **More** — opens the **Hub sheet** (bottom sheet, grouped grid).

**Center FAB** above the tab bar: context-aware "New" (compose email / new contact / new task / new invoice) — like a universal quick-capture.

**Hub sheet contents (grouped, reachable in 1 tap):**
- **Plan:** Calendar, Tasks
- **Finance:** Invoicing, ERP
- **Workspace:** Vault, AI Assistant
- **System:** Settings, Help

> Rationale: the 4 visible tabs = the owner's exact stated priority, so the phone bar *is* the strategy. Everything else is one tap via Hub — we do **not** cram 9 sections into the bar (pitfall). Phone is for *monitoring* campaigns/automation, not building them, so Hub placement is correct.

---

## (d) "STEAL THIS" — 8 cross-wiring IA patterns (with source product)

1. **Unified inbox → CRM contact timeline** *(Front / HubSpot Conversations)*. Every inbound/outbound email auto-logs to the contact; the contact panel shows email history + deals + invoices in one chronological timeline. No copy-paste between modules.
2. **One-click email→contact creation** *(Superhuman "Add to Contact" / Front "Create contact from conversation")*. Unknown sender shows an inline "Add to CRM" chip; the new contact inherits the email thread as its first timeline entry.
3. **Campaign → Segment → Contact hierarchy, bidirectional** *(Mailchimp / Brevo / HubSpot)*. A segment is a saved filter over Contacts; a campaign targets segments. Contact page lists *which* segments/campaigns they belong to; campaign page drills into segment membership + engagement. Never silo these three.
4. **Automation triggers FROM email events** *(Zapier / HubSpot Workflows / Missive rules)*. Trigger palette: "On email received / link clicked / replied / marked spam." **Co-locate email rules/filters with Automation — not buried in Settings** (current `navConfig` puts mail-rules under Settings; that's a discoverability killer).
5. **Inline compose-from-record (and the reverse)** *(HubSpot / Pipedrive)*. From any contact/deal/invoice → one click "Email" opens a pre-addressed composer. Reciprocal: from any email → "View in CRM" jumps to that contact. The two modules are the same object viewed two ways.
6. **Split Inboxes / Views** *(Superhuman / Gmail tabs / Outlook Focused)*. Mail sub-items include saved Splits (by account, by client, by deal stage), navigable via `Tab`/`Shift+Tab` (Superhuman). Lets an SME owner "live" in just their client's inbox.
7. **Universal command palette + contextual actions** *(Linear / Superhuman / Spotlight)*. `⌘K`/`Ctrl+K` launches a fuzzy, grouped palette over **800+ actions** (see §5). When a record is open, the palette surfaces contextual commands ("Email this contact", "Create deal", "Add to segment").
8. **Deal/Email → Invoice generation** *(HubSpot / QuickBooks)*. "Create invoice from thread/deal" is one action; an automation can draft an invoice on deal-close. Finance is never more than one hop from the conversation.

*(Bonus, fits offline-first):* **Set Aside / Snooze → Calendar** *(HEY)*. Snooze an email to a date; it re-surfaces in Mail + Plan. Great for an owner who processes email in bursts.

---

## (e) PITFALLS TO AVOID (several cite real product post-mortems)

1. **The fake-back-button trap** *(37signals' own HEY retrospective, dev.37signals.com/better-navigation-in-hey)*. HEY's "Imbox" looked like Back but acted like Home — users got "thrown all the way back to the Imbox" and lost context. **Fix:** always provide a *true* history Back **and** a persistent Home; never let the home icon silently override where the user came from.
2. **Burying daily tools in expandable menus.** Mail/CRM must be 1 tap/keystroke, always. Don't require opening a panel to reach the inbox.
3. **Duplicate/ambiguous icons** (the current `Bot`/`Bot` bug). Each destination needs a distinct, memorable glyph; icon rail is scanned, not read.
4. **Rail bloat (>8 main icons).** Cognitive overload. Group (Plan, Finance) or overflow to a desktop "More."
5. **Command palette as a hidden graveyard** *(uxpatterns.dev "Command Palette" pattern warns: "designing only the happy path" and "treating accessibility as a final pass")*. Surface `⌘K` with a visible hint in the search bar; ship keyboard-only + screen-reader support; maintain the action registry as features ship.
6. **Siloed Contacts vs Mail.** A single `Contact` entity must back Mail autocomplete, CRM, segments, and automation. Separate address books = the #1 reason SME suites feel broken.
7. **Email rules/filters hidden in Settings.** They are automation; co-locate with Automation (pattern #4).
8. **11 sections in a mobile bottom bar.** Use the Hub sheet (max 5 + More); thumb-zone the priority quartet.
9. **Forgetting keyboard parity on mobile.** Provide an in-app Spotlight-style search (pattern #7) reachable without the rail.
10. **No density control.** SME owners on laptops want compact; on tablets, comfortable. Keep the `useDensity()` toggle and default per-device.

---

## Implementation notes (concrete)

- The proposed structure is delivered as `proposed-navConfig.ts` (drop-in replacement for `src/shared/components/layout/shell/navConfig.ts`) and `proposed-mobile-nav.ts` (bottom tabs + Hub config). Diff against current; only ordering, labels, icons, and the `Plan`/`Finance` regroup changed — the `NavRail` component needs **no** behavioral change beyond the icon fix and default-open Mail.
- Add a `splits` sub-item to Mail and move `mail-rules`/`workflows` from Settings → Automation (`rules`, `triggers`).
- Add `g`-prefix goto handler to the existing keyboard layer in `NavRail.tsx`.
- Mobile: pass `MOBILE_BOTTOM_TABS` + `HUB_SHEET_GROUPS` to `BottomTabBar`; FAB wired to a context-aware "New" action sheet.
