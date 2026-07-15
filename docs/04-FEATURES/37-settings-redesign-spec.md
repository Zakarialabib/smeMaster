# SMEMaster — Settings Redesign Specification

> **Status:** DRAFT (2026-07-15). This file CLOSES the ⚠️ MISSING gap tracked in
> `docs/00-INDEX.md` line 150 and the MVP Launch Plan (`docs/plans/MVP_LAUNCH_PLAN.md`
> Phase E / J7: "write the missing `37-settings-redesign-spec.md`").
> It is an APPROVAL document, not yet an execution plan.
>
> **Owner priority (from brief):** smeMaster must become "the perfect management system
> for SME — email first, CRM second, then marketing and automation." Settings is the
> control surface for all of it; it must feel like ONE coherent glass super-app, not a
> dumping ground of 24 tabs.
>
> **RTL is explicitly deferred per owner direction** — logical properties only, no new
> physical-direction assumptions baked in.

---

## 0. Current State (VERIFIED against source 2026-07-15)

The real source of truth for settings is **`src/features/settings/components/SettingsTabRegistry.ts`**
— NOT `src/shared/components/layout/shell/navConfig.ts` (whose Settings group is a
stale 18-item list and DIVERGES from the registry — see §5 drift).

Actual registry today = **24 tabs across 8 groups**, with a searchable sidebar
(`SettingsSidebar.tsx`) that already does keyword filtering + recents + overview grid.
This is more mature than the docs claim. The real problems are: **grouping logic,
orphaned tabs, missing Appearance, and the navConfig drift** — not a lack of structure.

| Group (i18n label) | Tabs |
| --- | --- |
| `workspace` | general, composing, calendar, shortcuts |
| `accountsSync` | accounts, account-cleaning, pairing, backup |
| `notifications` | notifications |
| `aiAutomation` | ai, mail-rules |
| `deliverability` | deliverability-dashboard, presend |
| `securityCompliance` | pgp, compliance, business-profile |
| `developer` | developer, hardware, queue, feature-flags |
| `aboutHelp` | about |

**Global vs per-account reality (verified):**
- `GeneralTab` already embeds `AppearanceSection` (theme/surface/density/font-scale/
  high-contrast/reduce-motion/reading-pane/email-density) as sub-tabs. So Appearance
  EXISTS but is NOT a top-level group and is NOT in `navConfig.ts` Settings group → gap.
- Signature / send-as / per-account density live inside `AccountsTab` (per-account).
- Theme, surface (flat/glass), density, font-scale, shortcuts, language = **global**.
- Signature, aliases, per-account folder defaults, account-specific delivery = **per-account**.

---

## 1. Target Settings Information Architecture

Regroup the 24 tabs (plus the missing **Workflows** and the embedded **Appearance**)
into 9 logical groups aligned to the owner's mental model (email → CRM → marketing →
automation → the rest). Goal: an SME owner finds "email stuff" together, "money stuff"
together, "power-user stuff" at the bottom.

### Group 1 — Workspace (personalization, GLOBAL)
`general` (Appearance sub-tabs: theme, surface Flat/Glass, density, font-scale,
high-contrast, reduce-motion, reading-pane, email-density), `shortcuts`,
`language-region` (split out of general), `calendar`.
> **Why:** These are "me" settings. Theme/surface/density already wired in `GeneralTab`;
> promote Appearance to a first-class group label so it's discoverable (currently buried).

### Group 2 — Accounts & Sync (per-account + device)
`accounts` (IMAP/SMTP/OAuth/CalDAV + per-account signature/aliases/density),
`account-cleaning`, `pairing` (device sync), `backup`.
> **Move from Workspace:** `business-profile` (DGI tax) does NOT belong here — it's
> company/finance config, not personal. See Group 7.

### Group 3 — Compose & Mail (email-first control)
`composing` (editor, templates, quick-reply, snooze defaults, follow-up),
`mail-rules` (filters/labels/quick-steps), `presend` (pre-flight checklist).
> This is the EMAIL control center — sits high because email is the product's heart.

### Group 4 — Notifications
`notifications` (+ snooze presets, VIP, category filters — already merged).

### Group 5 — AI & Automation
`ai` (local RAG providers, models, writing style), `workflows` (**ADD** — currently
orphaned: `navConfig.ts` references a `workflows` settings item but the registry has no
tab; the Workflows page exists at `/workflows`), `mail-rules` could stay in Compose OR
here. **Decision:** keep `mail-rules` in Group 3 (it's email filtering) and put
`workflows` here (cross-module automation).

### Group 6 — Marketing & Deliverability
`deliverability-dashboard` (DNS/blacklist/bounce/warming), `campaign-defaults`
(**ADD** — contextual campaign settings: default from-name, unsubscribe footer,
double-opt-in default; currently lives ad-hoc in the Campaigns page — pull the global
defaults here for discoverability).

### Group 7 — Business & Compliance (finance + legal)
`business-profile` (MOVE here from Workspace — Morocco DGI ICE/IF/RC/CNSS, company
legal IDs), `compliance` (GDPR/CAN-SPAM/disclaimer/footer/unsubscribe), `pgp`
(encryption).
> **Why:** an SME owner thinks "my business, my legal, my encryption" as one cluster.

### Group 8 — Developer (power users only)
`developer`, `hardware` (POS/printer), `queue` (offline/sync inspector),
`feature-flags`.

### Group 9 — About & Help
`about` (version/license/credits), `help-center`.

### Resulting tab inventory (26 tabs / 9 groups)
general, language-region, calendar, shortcuts, accounts, account-cleaning, pairing,
backup, composing, mail-rules, presend, notifications, ai, workflows,
deliverability-dashboard, campaign-defaults, business-profile, compliance, pgp,
developer, hardware, queue, feature-flags, about, help-center.
(+ Appearance promoted to group label in Group 1).

---

## 2. Search-First Settings (steal from Raycast / Linear / macOS)

The sidebar already filters by label. Extend it:
- **Unified command palette reach:** the existing `CommandPalette` (`Cmd/Ctrl+K`) already
  navigates to settings tabs (`go-settings-inbox`, `go-settings-composing`, …). Make
  settings search ALSO openable from inside the palette as `settings: <query>` so power
  users never touch the sidebar.
- **TAB_KEYWORDS** already exist per tab — keep, and feed them into the palette index.
- **Recent** (already in sidebar) + **pinned** favorites (new): let an SME owner pin
  "Signature" and "Business Profile" to the top.

---

## 3. Progressive Disclosure & Contextual Settings

Not everything belongs in the global settings tree:
- **Per-feature contextual settings** live inside the feature (e.g. Campaigns composer
  settings, Mail view toggles in the toolbar, Calendar per-account CalDAV). Global
  settings holds ONLY cross-cutting defaults.
- **Advanced mode toggle** (`settingsUiStore.advancedMode` already exists) gates
  Developer / Hardware / Queue / Feature Flags / Account Cleaning behind a single switch
  so the default view is calm.
- **Auto-save** (debounce 500ms) — already partially wired via `setSetting`; make every
  tab auto-save and drop explicit "Save" buttons (Linear/Raycast pattern).

---

## 4. Global vs Per-Account Matrix (canonical)

| Setting | Scope | Lives in |
| --- | --- | --- |
| Theme (light/dark/system) | Global | GeneralTab |
| Surface (Flat/Glass) | Global | GeneralTab → Appearance |
| Density (compact/normal/relaxed) | Global (desktop) | GeneralTab → Appearance |
| Font scale | Global | GeneralTab → Appearance |
| Accent color | Global | GeneralTab |
| Shortcuts | Global | Shortcuts tab |
| Language/Region/Timezone | Global | Language & Region tab |
| Signature | **Per-account** | AccountsTab → account |
| Send-as / aliases | **Per-account** | AccountsTab → account |
| Per-account email density | **Per-account** | AccountsTab → account |
| Compliance footer / unsubscribe | Global default + per-campaign override | Compliance tab / Campaign |
| Business legal IDs (DGI) | **Per-company** | Business Profile tab |

---

## 5. Doc-vs-Source Drift Found (MUST FIX alongside this spec)

1. **`navConfig.ts` Settings group is stale** (18 items) and diverges from
   `SettingsTabRegistry` (24 tabs/8 groups). The rail's Settings flyout is built from
   `navConfig.ts` → users see a DIFFERENT, older settings list than the real registry.
   **Fix:** `handleSubItemSelect` for `settings` should read from `SettingsTabRegistry`
   (single source of truth), not the hardcoded `navConfig` list.
2. **`workflows` settings item** exists in `navConfig.ts` but NO tab in the registry →
   dead link / orphan. Add `workflows` tab (Group 5) or remove the navConfig reference.
3. **Appearance missing from navConfig** Settings group entirely (it lives embedded in
   GeneralTab). Reconcile.
4. **`business-profile` mis-grouped** under "Workspace" — move to Business & Compliance.
5. **DESIGN spec §4.2 false claim** — it asserts the desktop NavRail "already covers
   Tasks, Calendar, Campaigns, Invoicing, ERP." It does NOT (see `NAV_GROUPS`):
   only Dashboard(Mail sub-items), Mail, CRM, Automation(empty), Vault, AI, Settings,
   Help. Tasks/Calendar/Campaigns are unreachable from the rail. Mark this claim fixed.

---

## 6. Implementation Chunks (after approval)

- **C1** — Regroup `SettingsTabRegistry` to the 9-group model; add `workflows` +
  `campaign-defaults` tabs; move `business-profile`; split `language-region`.
- **C2** — Promote Appearance to a group label in GeneralTab; keep sub-tabs.
- **C3** — Fix `navConfig.ts` Settings group to mirror the registry (or have the rail
  read the registry directly). Kill the drift.
- **C4** — Advanced-mode gating of Developer/Hardware/Queue/FeatureFlags/AccountCleaning.
- **C5** — Auto-save (debounce 500ms) across all tabs; remove redundant Save buttons.
- **C6** — Wire `settings: <query>` into `CommandPalette`; add pinned favorites.
- **C7** — i18n: wrap all `getTabLabel` hard-coded fallbacks in `t()`; add new group
  labels to en/ar/fr/it (ja deferred).
- **C8** — Update `00-INDEX.md` (remove ⚠️ MISSING), `STATUS.md`, `DESIGN_UI_UX_SPEC.md`
  §4.2 (fix false rail claim).

---

## 7. Prior Art & Consolidation (VERIFIED 2026-07-15)

A strong pre-existing proposal already covers the settings IA in depth:
`docs/plans/SETTINGS-IA-PROPOSAL.md` (11-group tree, search/palette layering on the
existing `CommandPalette.fuzzyScore`, Developer-tier disclosure, explicit global-vs-
per-account via `useSetting` scope, mobile grouped-list renderer reusing `tabGroups`,
export/import wired to Backup, 8 cited "steal this" patterns). **This spec adopts it;**
the target group tree in §1 is a tighter 9-group variant of it (Appearance promoted,
Business Profile moved out of Workspace, Workflows + Campaign-defaults added).

### Verified source facts folded in
- `SettingsTabRegistry.ts` already exports `TAB_KEYWORDS` + the `CommandPalette` already
  has a real `fuzzyScore` — settings search is an EXTENSION, not a build-from-scratch.
- `GeneralTab` already embeds `AppearanceSection` (theme/surface/density/font-scale/
  high-contrast/reduce-motion) as sub-tabs → Appearance promotion is a registry move, not
  new UI.
- `useSetting(key, default)` is a flat SQLite KV; per-account settings (signature, send-as)
  live in `AccountsTab` — scope is implicit today (matches SETTINGS-IA-PROPOSAL §5).

### "Steal this" settings patterns (cited)
Raycast settings-row search (`⌘⌃F`); Raycast root search reaching settings; Appearance as
top-level (Raycast/macOS); Advanced/Developer disclosure (Raycast/iOS); bird's-eye Shortcuts
tab (Raycast); inline/contextual settings (Superhuman/Slack/Gmail "filter like these");
config export/import (Raycast); Overview popular-actions front door (Stripe/Linear).
