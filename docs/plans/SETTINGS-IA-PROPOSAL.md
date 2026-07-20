# smeMaster Settings — Information Architecture Proposal

> Audience: owner + frontend agents. Status: **proposal** (not yet implemented).
> Grounded in the actual repo code at `src/features/settings/` (read July 2025) and in
> observed patterns from Raycast, Linear, GitHub, iOS/macOS Settings, Slack, Stripe, Vercel,
> Notion, Superhuman.

---

## 0. Current state (what actually exists today)

The settings surface is **already mature** — better than most apps ship. From `SettingsTabRegistry.ts`:

- **8 groups, 22 tab IDs** (more than the owner's "18 items" — the list in the brief is a subset).
  Groups: Workspace, Accounts & Sync, Notifications, AI & Automation, Deliverability,
  Security & Compliance, Developer, About & Help.
- The sidebar (`SettingsSidebar.tsx`) already has:
  - an **Overview** card grid,
  - a **Recent** (last 3) section driven by a zustand store,
  - a **live filter** input,
  - icon-only collapse (48px).
- `SettingsTabRegistry.ts` already exports `TAB_KEYWORDS` — a per-tab synonym map (theme,
  dark, dns, spf, gdpr, …) that is the seed for settings search.
- A fuzzy-search `CommandPalette` exists in `features/mail/components/search/CommandPalette.tsx`
  with a real `fuzzyScore` engine (substring + subsequence scoring). It is currently
  **mail-scoped**, not global.
- `useSetting(key, default)` is a SQLite-backed KV auto-save hook. It is **flat — no scope
  dimension**. Per-account settings (signature, send-as) live in Accounts-tab components and
  are stored per-account; global visual state (theme, density, fontScale) lives in `themeStore`.

### The real gaps (not "create from scratch")

1. **Appearance is not a first-class group.** It exists as a *sub-tab inside `GeneralTab`*
   (`appearance | language | privacy | advanced`). It is also invisible from the sidebar nav —
   that is the "known gap." A new SME owner looking for theme/density/font-scale cannot find it.
2. **Search is local to the sidebar filter only**, and matches tab *labels*, not keywords,
   not individual *settings rows*, and does not run from the global command palette.
3. **No global command-palette reach into settings.** `CommandPalette` doesn't index
   `TAB_KEYWORDS` or settings rows.
4. **No explicit global-vs-per-account model.** Scope is implicit in store choice.
5. **No progressive-disclosure / tiering.** All 22 tabs are visible to everyone, including an
   SME owner who only needs ~6.

Everything below is therefore a **target IA + patterns to layer onto the existing registry**,
not a rewrite.

---

## 1. Recommended settings group tree (deliverable a)

### Principles applied
- **Group by *job*, not by *implementation*.** "Accounts & Sync" not "IMAP/SMTP/CalDAV".
- **Separate "me" (identity, appearance, notifications) from "the business" (compliance,
  deliverability, invoicing).** An SME owner thinks in those terms.
- **Power-user surface (Developer/Hardware/Queue/Feature Flags) collapses under one group**
  and is hidden from the default view (see §3).
- **Appearance gets its own top-level group** — it is global, high-frequency, and currently
  undiscoverable.

### Proposed tree (top-level groups → existing items mapped)

```
smeMaster Settings
├─ Overview                      (card grid — existing, keep)
│
├─ 1. Appearance  🎨  [NEW top-level, was sub-tab of General]
│     ├─ Theme: Flat / Glass toggle        (today: GeneralTab Appearance)
│     ├─ Color theme (indigo/rose/…/frost) (today: themeStore)
│     ├─ Light / Dark / System             (today: themeStore)
│     ├─ Density (compact/comfortable)     (today: themeStore.density + layoutStore.emailDensity)
│     └─ Font scale                        (today: themeStore.fontScale)
│
├─ 2. General  ⚙️  (scoped down — appearance pulled out)
│     ├─ Language / locale (en,fr,ar,RTL,it,ja)
│     ├─ Timezone & date/time format
│     ├─ Startup / launch-at-login  (desktop)
│     ├─ Window mode (compact/expanded — steal from Raycast)
│     ├─ Privacy & data (local-only toggle, analytics off by default)
│     ├─ Storage & cache  →  Data wipe (was merged into General; keep here)
│     └─ Advanced  (last sub-tab of General)
│
├─ 3. Accounts & Sync  👥
│     ├─ Accounts  (add/remove, IMAP/SMTP/OAuth/CalDAV)
│     ├─ Send-as aliases  (SendAsAliasesSection)
│     ├─ Signatures  (per-account — SignatureEditor)
│     ├─ Pairing  (Device Pairing — QR multi-device, CRDT sync)
│     ├─ Backup & Restore  (desktop)
│     └─ Account Cleaning / retention  (desktop)
│
├─ 4. Compose & Mail  ✍️
│     ├─ Composing  (editor, templates, quick reply, content-quality)
│     ├─ Mail Rules / Filters  (label, smart label, smart folder, quick step)
│     ├─ Pre-send checklist  (desktop)
│     └─ Snooze presets  (lives in Notifications today — MOVE here; it's a mail action)
│
├─ 5. Calendar & Tasks  📅
│     └─ Calendar  (CalDAV, events, scheduling, sync)
│
├─ 6. Notifications  🔔  (trimmed — snooze moved to Compose & Mail)
│     └─ Notifications  (alerts, VIP, category filters, push/desktop)
│
├─ 7. AI & Automation  ✨
│     ├─ AI  (providers, RAG, smart reply/draft/summarize)
│     └─ Workflows  (was "Workflows" in brief; today under AI & Automation as automation)
│
├─ 8. Marketing & Deliverability  📈  (desktop)
│     ├─ Deliverability  (DNS/SPF/DKIM/DMARC, blacklist, bounce, warming)
│     └─ (campaigns live in their own feature surface; settings deep-link here)
│
├─ 9. Security & Compliance  🔒
│     ├─ PGP Encryption
│     ├─ Compliance  (GDPR / CAN-SPAM / unsubscribe / disclaimer footers)
│     └─ Business Profile  (Morocco DGI / ICE / tax / RC / CNSS — legal identity)
│
├─ 10. Developer  🛠️  (power-user tier — hidden by default, see §3)
│     ├─ Developer  (logs, demo data, system info)
│     ├─ Hardware  (desktop)
│     ├─ Queue  (sync outbox/retry inspector)
│     └─ Feature Flags
│
└─ 11. About & Help  ❓
      ├─ About & License  (version, license, updates, credits)
      └─ Help Center  (existing help sidebar + articles)
```

### Mapping table (brief's 18 items → group)

| Original item (brief)        | New group                | Notes |
|------------------------------|--------------------------|-------|
| General                      | General (trimmed)        | appearance split out |
| Composing                    | Compose & Mail           | |
| Calendar                     | Calendar & Tasks         | |
| Shortcuts                    | **General** (or its own) | See debate ↓ |
| Accounts                     | Accounts & Sync          | |
| Device Pairing               | Accounts & Sync          | renamed "Pairing" |
| Backup                       | Accounts & Sync          | |
| Notifications                | Notifications            | snooze moved out |
| AI                           | AI & Automation          | |
| Mail Rules                   | Compose & Mail           | co-located with filters |
| Workflows                    | AI & Automation          | |
| Deliverability Dashboard     | Marketing & Deliverability | desktop |
| Pre-send                     | Compose & Mail           | |
| PGP                          | Security & Compliance    | |
| Compliance                   | Security & Compliance    | |
| Developer                    | Developer (power tier)   | |
| Hardware                     | Developer                | |
| About                        | About & Help             | + License + Help |
| **Appearance (missing)**     | **Appearance (new #1)**  | **fixes the gap** |

**Shortcuts debate (opinionated):** keep Shortcuts as a **first-class top-level group**, not
buried in General. Rationale: it's a primary discovery surface for an SME owner moving from
Gmail/Outlook, and Raycast promotes "Shortcuts" to its own top-level tab with a bird's-eye
"every shortcut across the app" view. Put it right after Appearance/General so power users find
it immediately, but it's harmless for normals.

---

## 2. Settings search & command palette (deliverable b)

### What to build
Layer a **settings index** on top of the existing `CommandPalette` so one `⌘K` reaches both
commands *and* settings — exactly Raycast's model ("Type Settings in Root Search… press
`⌘⌃F` to search settings").

**Concrete plan (reuses existing code — minimal new work):**
1. Reuse `CommandPalette`'s `fuzzyScore` engine.
2. Expand the index from `TAB_KEYWORDS` (already in `SettingsTabRegistry.ts`) to a **per-row
   index**: each settings control gets `{ id, label, group, tab, keywords[], action }`.
   Seed from `TAB_KEYWORDS` now; enrich per tab as tabs are touched.
3. Add a `"Settings"` category to the command palette. Selecting a result navigates to
   `navigateToSettings(tabId, optionalRowId)` and scrolls/highlights the row.
4. Add an **in-settings `⌘⌃F` search** (Raycast does this) that, unlike the current label-only
   sidebar filter, matches *keywords + row labels* and jumps to the row.

### Tiering of search results (steal from Raycast + Linear)
- Common settings (theme, signature, notifications) rank first.
- Power-user rows (feature flags, queue) only surface when the query is specific.

### Why this beats the current sidebar filter
Current filter matches **tab labels only** (`label.includes(q)`). A user searching "spf" or
"unsubscribe" or "font" (when Appearance is hidden) gets nothing. Keyword + row search closes
that gap and makes the entire 831-command surface reachable without scrolling.

---

## 3. Progressive disclosure & contextual settings (deliverable c)

### A. Tiering — hide power-user groups by default
- **Default view** for a new SME owner shows groups 1–9 + 11 (the "normal" surface):
  Appearance, General, Accounts & Sync, Compose & Mail, Calendar & Tasks, Notifications,
  AI & Automation, Marketing & Deliverability, Security & Compliance, About & Help.
- **Developer group (10)** is collapsed behind an "Advanced / Developer" disclosure at the
  bottom of the sidebar — visible only when expanded (or when `feature-flags`/dev mode is on).
  Steal from **Raycast "Advanced" tab** and **macOS "Developer" footer**.
- Delivery mechanism: a `settingsTier` value (`normal | power`) in the config store, default
  `normal`. Flipping it reveals group 10. No separate screen needed.

### B. Overview grid as the "safe landing"
Keep the card-grid Overview (already built). It is the **progressive-disclosure front door**:
- Shows the 6–8 most common settings as direct-toggle cards (theme toggle, signature,
  notifications, AI on/off, backup now, language).
- Steal **Stripe's dashboard "popular actions"** pattern: surface the 20% of settings that
  serve 80% of users at the top; everything else is one click down.

### C. Contextual settings — settings that live inside the feature
Don't force users into the settings tree. Steal from **Superhuman** (zero settings menu —
everything is inline/keyboard) and **Slack** (channel settings live in the channel header):
- **Signature** → edit inline in the composer ("✎ edit signature") and in Accounts.
- **Send-as / From address** → choose per-message in the composer; manage in Accounts.
- **Snooze presets** → set where you use snooze (mail list action), not buried in a tab.
- **Filter/rule creation** → launched from the email list "⋯ → Create rule from this message"
  (steal Gmail "Filter messages like these").
- **Pre-send checklist** → configured from the composer's pre-send panel, not a separate tab.
- **Theme Flat/Glass** → quick-toggle in the title-bar / command palette (it's the #1 thing
  people hunt for; make it a one-keystroke palette action).

### D. Sub-group pages, not 22 flat tabs
Within big groups (Accounts & Sync, Compose & Mail), keep the **sub-nav** pattern already used
by `GeneralTab` (`appearance | language | privacy | advanced`). One group page, several
sub-sections — avoids a 22-row sidebar while keeping everything 1 click deep.

---

## 4. "Steal this" patterns (deliverable d) — 5–8, cited

1. **Settings search that reaches individual rows — Raycast (`⌘⌃F`) + GitHub.**
   Raycast: "Press ⌘/Ctrl F while Settings is open and search for anything… Select a result to
   jump straight to the right place." Build the per-row index on `TAB_KEYWORDS`.

2. **Single global command palette that includes settings — Raycast Root Search.**
   "Type Settings in Root Search… press ⌘⌃⇧, to jump directly to the selected item's settings."
   Reuse the existing `CommandPalette.fuzzyScore`; add a Settings category. One hotkey, whole
   app + settings reachable.

3. **Appearance as a first-class, top-level group — Raycast (top-level "Appearance" tab) +
   macOS System Settings ("Appearance" is a top-level pane).**
   Raycast literally has Appearance as its own tab with "Follow System Appearance," themes,
   and Interface Size. smeMaster should do the same — pull it out of General.

4. **"Advanced / Developer" disclosure hiding power-user settings — Raycast "Advanced" tab +
   iOS/macOS footer pattern.**
   Raycast's Advanced "provides additional configuration for power users." Hide group 10 by
   default so an SME owner never sees Queue/Feature Flags/Hardware unless they opt in.

5. **Bird's-eye Shortcuts tab — Raycast "Shortcuts" tab.**
   "A bird's-eye view of every shortcut assigned across Raycast… rather than navigating into
   individual extension tabs." Make Shortcuts top-level and show all bindings + conflicts in
   one place.

6. **Contextual, inline settings over a settings menu — Superhuman (near-zero settings UI) +
   Slack (channel settings in the channel header) + Gmail ("Filter messages like these").**
   Move signature/send-as/snooze/filters/pre-send into the feature surface. Settings tree
   becomes "manage all," not "the only place."

7. **Export/Import full config — Raycast "Export & Import Settings."**
   "Export your full configuration to a file and import it on another machine… transfers your
   extensions, hotkeys, aliases, and preferences." Critical for an offline-first multi-device
   SME app: one file moves theme + accounts (tokens aside) + rules + shortcuts between the
   Windows desktop and the Android phone. Wire to existing Backup.

8. **Overview/popular-actions front door — Stripe dashboard + Linear (clean grouped nav).**
   Stripe surfaces the common actions; Linear groups workspace settings cleanly by job. Use the
   existing Overview grid as the 80% landing; everything else is one click down.

(Honorable mention: **Notion's search-first empty-state** and **Vercel's project-vs-
account scope switch** — see §5 global-vs-per-account.)

---

## 5. Global vs per-account (deliverable e / brief Q5)

### Rule of thumb
- **Global** = "how the app looks and behaves on this device for this person."
- **Per-account** = "how I present *as this identity* when sending/receiving through it."

### Classification

| Setting                    | Scope        | Where today / where it should live |
|----------------------------|--------------|------------------------------------|
| Theme Flat/Glass           | **Global**   | themeStore — keep global |
| Color theme                | **Global**   | themeStore |
| Light/Dark/System          | **Global**   | themeStore |
| Density (UI)               | **Global**   | themeStore (device-level) |
| Email list density         | **Global** (or per-device) | layoutStore — keep |
| Font scale                 | **Global**   | themeStore |
| Language/locale            | **Global**   | General (device/person) |
| Timezone                   | **Global** (or per-account for travel) | General |
| Shortcuts                  | **Global**   | Shortcuts tab (device) |
| Notifications              | **Global** (per-account override optional) | Notifications |
| Signature                  | **Per-account** | Accounts → SignatureEditor (correct today) |
| Send-as / From aliases     | **Per-account** | Accounts → SendAsAliases (correct today) |
| Default From / send-as     | **Per-account** | Accounts |
| PGP keys                   | **Per-account** (key per identity) | PGP |
| Mail rules / filters       | **Per-account** (mostly) | Compose & Mail (scope by account) |
| AI provider/key           | **Global** (workspace) — but per-account routing possible | AI |
| Compliance profile (GDPR/CAN-SPAM) | **Per-account/business** | Security & Compliance |
| Business Profile (DGI/ICE) | **Per-business (workspace)** | Security & Compliance |
| Backup/Restore             | **Global/device** | Accounts & Sync |
| Pairing/sync               | **Global/device** | Accounts & Sync |

### Implementation recommendation
Today scope is *implicit* (theme in themeStore, signature in account row). Make it **explicit**
by extending `useSetting` to support a scope dimension:

```ts
// proposed extension — non-breaking
useSetting(key, default, { scope?: "global" | { accountId: string } })
// persists as `setting:<scope>:<key>` so global and per-account never collide
```

This lets a single "Signature" row component render the *active account's* signature when an
account is selected, and fall back to global otherwise — the **Vercel project-vs-account
switch** pattern, applied to settings.

**Mobile nuance:** on Android, theme/density are naturally device-global (one user, one device),
so global vs per-account matters less there; the per-account distinction is mainly a desktop
multi-account scenario. Keep the scope model uniform; the UI just hides the account switcher on
mobile when only one account exists.

---

## 6. Mobile IA vs desktop IA (brief Q4)

### Desktop (Windows/Linux/macOS) — sidebar groups (KEEP, refine)
- The existing `SettingsSidebar` (200px groups + Overview + Recent + filter + collapse) is the
  right shape. Refinements:
  - Promote **Appearance** to its own group.
  - Collapse **Developer** group by default (tiering, §3A).
  - Wire the sidebar filter to **keyword + row search** (§2), not label-only.
  - Keep icon-only 48px collapse for narrow windows.

### Mobile (Android) — grouped list / bottom-sheet (CHANGE)
- **Do not** port a 200px sidebar. Use an **iOS Settings-style grouped, scrollable list**:
  grouped sections with section headers, each row a disclosure arrow → pushes a sub-page
  (steal iOS Settings + Gmail app). One group per screen, back-button nav.
- **High-frequency toggles** (theme Flat/Glass, notifications, signature) should also be
  reachable from a **bottom sheet** triggered by a gear in the title bar — steal **Slack/Notion
  mobile quick settings**. The bottom sheet shows 4–6 common toggles; "All settings" opens the
  full grouped list.
- Reuse the **same `tabGroups` data structure** for both — only the *renderer* differs
  (sidebar vs grouped list). This is the key architectural win: one registry, two views. The
  existing `SettingsTabRegistry.tabGroups` is already platform-agnostic and carries a
  `platform: "desktop" | "mobile" | "all"` flag on each tab — use it to hide Deliverability/
  PGP/Hardware/Developer on mobile by default (they're desktop-flagged already).

### Shared
- Both platforms share the **command palette / settings search** (§2) — on mobile it's the
  search field at the top of the grouped list + the global palette via hardware/search key.

---

## 7. Pitfalls (brief Qe)

1. **Don't over-flatten into one giant list.** The brief's 18 items are really ~30 controls.
   A single scroll list (old iOS mistake) buries things. Keep groups; iOS itself admits its
   top-level is "grouped sometimes by type, sometimes by app" and is hard to search — which is
   exactly why iOS added Settings search. Groups + search is the answer, not flattening.

2. **Don't ship settings search that only matches labels.** The current sidebar filter does
   this and fails on "spf," "unsubscribe," "font." Index keywords + rows (§2) or users will
   say "search is broken."

3. **Don't make Appearance a sub-tab forever.** It's the #1 hunted setting for a "glass
   super-app." First-class it (§1, pattern #3).

4. **Don't show power-user settings to SME owners by default.** Queue, Feature Flags, Hardware,
   Developer scare normals and bloat the nav. Tier them (§3A). But **don't hide them so well
   that power users can't find them** — Raycast keeps Advanced one click away, not behind a
   secret.

5. **Don't conflate global and per-account.** A signature set globally that overwrites a
   per-account signature (or vice-versa) is a top support ticket generator. Make scope explicit
   (§5) and show the active scope in the row label ("Signature · Acme <you@acme.com>").

6. **Don't build a separate mobile settings codebase.** Reuse `tabGroups`; swap the renderer.
   Two sources of truth for settings IA = drift.

7. **Don't let contextual/inline settings become undiscoverable.** Superhuman's "no settings"
   works because every action is a keyboard shortcut; smeMaster is broader. Inline editors must
   still deep-link back to the full settings row (so "manage all signatures" is one click from
   the inline editor).

8. **Don't forget offline-first export/import.** An SME owner on a flaky connection needs to
   move config between Windows + Android without a server. Wire Export/Import to Backup
   (pattern #7). Cloud-only sync of settings is a trap for an offline-first app.

---

## 8. Suggested implementation order (for the parent agent)

1. **Promote Appearance** to a top-level group in `SettingsTabRegistry.tabGroups` (move the
   `appearance` sub-tab out of `GeneralTab` into its own `AppearanceTab`). Closes the headline gap.
2. **Extend `useSetting`** with an optional scope param (non-breaking) — enables global vs
   per-account without a migration.
3. **Build the per-row settings index** from `TAB_KEYWORDS` + add a Settings category to the
   existing `CommandPalette` (reuses `fuzzyScore`).
4. **Tier the Developer group** behind `settingsTier` in the config store.
5. **Ship the mobile grouped-list renderer** off the same `tabGroups` (platform flag already
   exists).
6. **Add Export/Import** wired to Backup.

All six are additive on the existing, well-structured registry — no rewrite required.
