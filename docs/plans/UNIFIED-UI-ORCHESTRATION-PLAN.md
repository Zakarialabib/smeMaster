# SMEMaster — Unified UI Orchestration Plan (Stitch-aligned)

> Goal: make **every page** in SMEMaster follow ONE unified design language and user
> philosophy — the same one the Stitch-generated Unified Inbox demonstrated (icon rail +
> contextual sidebar + AI callout at top + card/list rows with gradient avatars). This plan
> is the blueprint for an orchestrated agent loop that (a) generates Stitch screens from the
> real project, and (b) ports the result into the app's locked Frosted Glass tokens.
>
> Status: BLOCKED on live Stitch generation — no `STITCH_API_KEY` is present in env or on
> disk (the key pasted earlier was redacted and is not retrievable; rotate it). The plan
> below is real and grounded in the actual app (routes + components verified this session).
> Once a key exists, the "Generation pass" below executes against `generate_screen_from_text`.

## 1. Unified philosophy (one rule for all pages)
Every destination shares the SAME shell and the SAME component grammar:
- **Rail** (72px): flat, priority-ordered top destinations. Active = soft accent pill.
- **Sidebar** (232px): contextual to the page (folders / pipelines / boards). Advanced hidden behind "More".
- **Top bar**: page title · universal search · one primary action.
- **AI callout** (purple, frosted): the ONE recurring cross-page pattern — appears wherever the assistant extracts something. This is the signature of the Stitch inbox you liked.
- **Rows/cards**: avatar · primary text · secondary text · trailing meta · hover actions. Identical on Mail, CRM, Tasks, Vault.

Priority order (condensed from 24 modules → 11 user journeys):
`Mail > Today > CRM > Tasks > Calendar > Campaigns > Automation > Vault > AI > Business > Settings`
("Today" = new unified "what needs me now"; "Business" = invoicing+pos+erp.)

## 2. Core reusable components (build once, use everywhere)
These already exist or are introduced; all must use the app's Frosted Glass tokens
(`--color-accent:#0b57d0`, `--glass-blur`, frost borders), NOT Stitch's `#2563EB`.

| Component | Source | Used by |
|---|---|---|
| `Avatar` (gradient circle) | NEW `src/shared/components/ui/Avatar.tsx` (shipped this session) | Mail rows, Reading pane, **CRM contacts**, Tasks, Vault, AI |
| `ContactAvatar` | `src/features/contacts/components/ContactAvatar.tsx` | CRM — must be restyled to match `Avatar` |
| `AiSuggestionBanner` (frosted) | `src/shared/components/ui/AiSuggestionBanner.tsx` (shipped, now lists items + Review/Dismiss) | Mail, **CRM (deal/lead suggestions)**, Tasks, Campaigns, Automation |
| `Card`, `ListRow`, `Tag`, `Chip`, `Tabs`, `ToggleGroup`, `PrimaryButton`, `IconButton`, `Search`, `Dropdown`, `EmptyState` | `src/shared/components/ui` | all pages |
| `FilterBar`, `ViewModeToggle`, `SavedViews` | mail + shared | reused as-is on CRM/Tasks |

**Rule:** no page invents its own avatar/button/card styling. If it needs one, it comes from
the shared set. This is what makes the product "unified" instead of 24 one-off screens.

## 3. User flow / experience (the unified journey)
1. **Entry** → Dashboard or Mail. The first thing the user sees is the AI callout
   ("AI Task Detection" on Mail; "AI prioritized your day" on Today).
2. **Scan** → list/card rows with gradient avatars; unread/active = accent, read/done = muted.
3. **Act** → hover actions on every row (archive/delete/star/snooze/task on Mail;
   edit/email/deal on CRM; complete on Tasks). Buttons are NEVER dropped for style.
4. **Convert** → AI callout's primary button ("Review & convert to tasks") turns extracted
   items into real objects in one tap. Same pattern on CRM ("Create deal from lead"),
   Tasks ("Create task from email"), Campaigns ("Generate sequence").
5. **Context** → sidebar stays scoped to the current page's primary objects.

## 4. Page orchestration (what each destination becomes)
- **Mail** (DONE as reference): `EmailList` = SavedViews + FilterBar + ViewModeToggle +
  AiSuggestionBanner(items) + ThreadCard(Avatar). ✓ shipped this session.
- **CRM (unified)**: `CrmPage` tabs (Contacts/Deals) → reuse `Avatar`/`ContactAvatar`
  restyle; add `AiSuggestionBanner` "AI found 2 hot leads"; ContactGridCard + DealCard use
  the shared Card grammar + gradient avatars; hover actions (email/deal/delete).
- **Tasks**: Kanban/list reuse Card/ListRow + Avatar; AI callout "AI turned 3 emails into tasks".
- **Calendar / Campaigns / Automation / Vault / AI / Business / Settings**: same shell,
  same AI-callout placement, same row grammar.

## 5. Generation + implementation pass (orchestrated agent loop)
Prereq: `STITCH_API_KEY` available. Then:
1. **Create/reuse Stitch project** + design system (accent = app's `#0b57d0` to stay on-brand,
   AI purple `#9333EA`, Inter, roundness 12px).
2. **Generate** `generate_screen_from_text` for: Email (reference), CRM unified, Tasks,
   Calendar, Campaigns, Automation, Vault, AI, Business, Settings — each prompt references
   "same shell as the unified inbox: rail + sidebar + AI callout + gradient-avatar rows".
3. **Download** screenshot + HTML for each via `list_screens` (URLs usually immediate).
4. **Port**: treat Stitch output as UX/layout/copy reference ONLY. Re-implement in the app's
   Frosted Glass tokens, reusing the core components in §2. Preserve ALL existing buttons.
5. **Verify**: typecheck + eslint + component tests green; render via Playwright; vision-check
   consistency against the other pages (not against docs screenshots).

## 6. Immediate next step (needs you)
Supply `STITCH_API_KEY` (env, not chat — the pasted one should be rotated). With it, step 5.2
runs and produces the real Stitch screens you trust, for all pages, unified.
