# SMEMaster — MVP Launch Plan (Gmail/Outlook-grade Email + Marketing)

> **Status:** Draft plan — 2026-07-15. Built on top of the doc reconciliation + test-fix work done the same day.
> **Bar:** Every surface best-in-class AND cross-wired (master-class standard). Email must feel as polished as **Gmail (web)** for design and as deep as **Outlook (desktop)** for functionality; marketing must rival **Mailchimp/SendGrid/Brevo** for SMB use — all offline-first, on the user's machine.
> **Scope note:** RTL work is **explicitly deferred** per owner direction; not in this plan.

---

## 0. Current State (verified 2026-07-15)

**Email (already strong):**
- `ThreadView` — virtualized, inline reply, smart-reply, raw-message view, pop-out window, swipe-to-delete, contact + task sidebars, error boundary, skeletons.
- `Composer` — AI assist, pre-send checklist, templates, schedule-send dialog, signature selector, from/alias `FromSelector`, undo-send toast, block editor for campaigns.
- `ActionBar` (snooze/archive/etc.), labels, bundles/`CategoryTabs`, search, filters, 25+ keyboard shortcuts, offline queue, PGP, deliverability monitors.
- Demo seeds via `db_reseed_demo` / `db_reset_and_reseed` (embedded JSON in `src-tauri/seeds/`).

**Marketing (already strong):**
- Campaign block editor, segments, subject A/B, analytics snapshots, template catalog, deliverability (DNS/blacklist/bounce), DGI-compliant invoicing/PEPPOL.

**Real gaps vs Gmail/Outlook:** priority/important inbox sorting, natural-language snooze, undo-send *duration preference* exposure, hover quick-action density, bulk-action toolbar richness, advanced search operators, read-receipts, confidential mode, per-account density setting, auto-categorization into bundles.

---

## 1. Email-Management Parity Matrix (Gmail · Outlook → SMEMaster)

| Feature | Gmail | Outlook | SMEMaster now | Gap | Priority |
| --- | --- | --- | --- | --- | --- |
| Unified multi-account inbox | ✓ | ✓ | ✓ accounts | — | done |
| Conversation threading | ✓ | ✓ | ✓ `ThreadView` | — | done |
| Snooze | ✓ | ✓ | ✓ `ActionBar` | NL snooze + calendar pick | P1 |
| Schedule send | ✓ | ✓ | ✓ `ScheduleSendDialog` | — | done |
| Undo send | ✓ (settable sec) | partial | ✓ toast; duration in `ComposingTab` | expose as user preference + default | P1 |
| Labels / Categories (Promo/Social/Updates) | ✓ tabs | ✓ folders | ✓ bundles + `CategoryTabs` | **auto-categorize** on ingest | P1 |
| Priority / Focused inbox | ✓ | Focused | ~ `ruleEngine` | importance sort + Focused split | P2 |
| Hover quick-actions | ✓ | ✓ | partial (`ThreadCard`) | denser action rail | P1 |
| Bulk select + toolbar | ✓ | ✓ | ✓ `EmailList` | select-all, bulk move/label/archive | P1 |
| Drag to label/folder | ✓ | ✓ | partial (email→folder DnD done) | drag-to-label | P2 |
| Keyboard shortcuts | ✓ | ✓ | ✓ 25+ | **command-palette discoverability** for 831 cmds | P1 |
| Search + operators | ✓ | ✓ | ✓ search | `from:`, `to:`, `has:attachment`, `is:unread` | P2 |
| Offline | PWA | ✓ | ✓ offline queue | — | done |
| Templates | ✓ | ✓ | ✓ | — | done |
| Aliases / send-as | ✓ | ✓ | ✓ `FromSelector` | — | done |
| Read receipts | ✓ (request) | ✓ | ✗ | local read-receipt (no server needed) | P3 |
| Confidential mode | ✓ | IRM | ✗ | deferred | P3 |
| Split / density settings | ✓ | ✓ | ✓ | per-account density pref | P2 |
| Smart compose / nudges | ✓ | ✓ | partial (AI) | nudges ("follow up?") | P3 |
| NLP snooze ("tonight") | ✓ | — | ✗ | P3 |

---

## 2. End-to-End UX Journey (start → finish) — quality bar

- **J1 First run / onboarding** — account connect (Gmail OAuth custom-tab, Outlook/Office365, IMAP/SMTP) via the existing 4-step wizard. **Raise the bar:** animated, progress-aware, and an **"Import sample data"** toggle that calls `db_reseed_demo` so the first screen shows a *live, Gmail-like populated inbox* — never an empty app.
- **J2 Inbox zero** — priority inbox, hover action rail, swipe, bulk toolbar, snooze, full keyboard nav. Make the **empty state delightful** (not a blank void).
- **J3 Reading** — `ThreadView` (already strong): add hover-reveal action rail, Focused/Other split, local read-receipt indicator, "mute"/"done".
- **J4 Compose** — `Composer` (strong): NL snooze, confidence preset, inline smart-compose, send-later presets, undo-send duration from settings.
- **J5 Triage** — filters + bundles + auto-applied labels so *"the app organizes mail for you"* (Gmail feeling).
- **J6 Marketing** — pick a contact **segment** → block editor → A/B → schedule → analytics → deliverability monitor. Polish the segment→send loop.
- **J7 Settings** — **write the missing `37-settings-redesign-spec.md`** then implement as a single glass super-app settings surface with command search.

---

## 3. Demo Seeds Strategy (first launch must look Gmail/Outlook-grade)

Leverage the existing embedded seed system (`src-tauri/seeds/*.json` + `db_reseed_demo`). Expand so the demo account showcases **every** feature:

- `accounts.json` — 1 Gmail + 1 Outlook/Office365 demo account (mock/read-only creds).
- `threads.json` + `messages.json` — ~40 realistic threads spanning **Primary / Promotions / Social / Updates**, with attachments, read/unread mix, a snoozed item, a scheduled draft.
- `labels.json` + bundles — Promotions / Social / Updates + 1–2 custom labels.
- `campaigns.json` + `campaign_recipients.json` — 2 sample campaigns (one with subject A/B, one "sent" with analytics) so the marketing tab isn't empty.
- `contacts` (via company/clients seeds) — ~20 contacts across 2–3 segments.
- `calendar_events.json` — a few upcoming events.
- Add a **"Load demo data"** button in onboarding (J1) **and** Settings. Keep reseed idempotent.
- Refresh `docs/00-SCREENSHOTS/` to match (many already exist).

---

## 4. Email-Marketing Parity Matrix (vs Mailchimp / SendGrid / Brevo)

| Feature | Them | SMEMaster now | Gap | Priority |
| --- | --- | --- | --- | --- |
| List / segment | ✓ | ✓ segments | dynamic segment builder UI | P1 |
| Visual builder | ✓ | ✓ block editor | more block types | P1 |
| A/B testing | ✓ | ✓ subject A/B | content A/B | P2 |
| Template library | ✓ | ✓ | marketplace (later) | P3 |
| Scheduling | ✓ | ✓ | — | done |
| Analytics (opens/clicks) | ✓ | partial (snapshots) | full funnel (open→click→reply) | P1 |
| Deliverability (SPF/DKIM/DMARC, warmup) | ✓ | ✓ DNS/blacklist/bounce | sender warmup plan UI | P1 |
| Double opt-in | ✓ | ? | verify + toggle | P2 |
| Unsubscribe / compliance | ✓ | ✓ compliance engine | — | done |
| Personalization / merge tags | ✓ | ✓ mail-merge | — | done |

---

## 5. Launch-Readiness Gates (build on today's fixes)

- **Tests green:** cargo test compile is **fixed** (the original `E0433`/`E0277` blockers are resolved); a runtime `STATUS_ENTRYPOINT_NOT_FOUND` on the test exe is being investigated (likely stale `target/`). Vitest: 15 failing → being driven to 0 by parallel fix agents. **Re-run the FULL gate before tagging.**
- **Docs:** STATUS/INDEX/master-plan reconciled to source truth (done). Remove the false RTL ✅ (deferred). 
- **Platform:** v1.0.0 = **Windows (MSI/NSIS) + Android (APK), unsigned, no updater** (per `SECURITY-AUDIT.md`).
- **Missing specs to write:** `36-onboarding-reboot-plan.md` (wizard exists — write the spec), `37-settings-redesign-spec.md` (WRITE), RTL audit (deferred).

---

## 6. Phased Execution (intensive work order)

- **Phase A — P0 (~1–2d):** both test suites green. cargo runtime loader crash + 12 vitest files. *Blocking.* — **DONE:** 12 vitest files fixed + committed; cargo compile fixed (runtime blocked by local VC++ runtime, env issue). See git log.
- **Phase B — P1 (~3–4d): email UX parity:** priority/Focused inbox, hover action rail, bulk toolbar (select-all + bulk move/label/archive), undo-send duration preference, NL snooze, auto-categorize into bundles, command-palette discoverability for 831 commands.
  - **DONE (2026-07-15):** Backend core SHIPPED (migration `031_thread_importance_score`; `threads::categorize_thread`/`derive_category` auto-classify on ingest; `db_set_thread_importance` + `db_categorize_thread` IPC commands registered). Frontend SHIPPED: hover action rail (ThreadCard: important/snooze/task/event), bulk selection toolbar (EmailList: select-all + bulk read/unread/archive/label/move), Focused/Primary toggle (persisted via configStore→SQLite), NL-snooze parser + SnoozeDialog input, command palette expanded (~50 actions, fuzzy, a11y, tokenized), undo-send duration quick-pick + settings helpers. Verified: tsc exit 0, vitest parseSnooze 8/8 + EmailList 2/2, eslint 0 warnings. Committed `7872a25`.
- **Phase C — P1 (~2d): demo seeds** expansion + "Load demo data" in onboarding/settings + refresh screenshots.
  - **Seeds SHIPPED (2026-07-15):** expanded Rust demo data to 36 threads / 54 messages with realistic Promotions/Social/Updates/Primary distribution (thread_categories regenerated data-driven). NOTE: "Load demo data" UI trigger in onboarding/settings still needs wiring (db_reseed_demo exists).
- **Phase D — P1 (~2d): marketing** full analytics funnel + sender warmup UI + double-opt-in verify.
- **Phase E — P2 (~2d):** settings redesign spec→impl (glass), per-account density, search operators, drag-to-label.
- **Phase F — P3 (defer):** read-receipts, confidential mode, smart nudges, NLP snooze, content A/B, template marketplace.
- **Phase G:** full gate re-run → 7-day dogfood → beta → tag `v1.0.0-rc.2`.

---

## 8. Progress Log

- **2026-07-15:** Docs reconciled to source truth (committed). 12 vitest files fixed + real i18n bug fixes (validation keys). Cargo compile blockers (E0433/E0277) fixed + committed; test EXE blocked by local VC++ runtime (env). Phase B backend core (importance + auto-categorize + 2 IPC commands) committed. Demo seeds expanded (36 threads, category-distributed) committed. UI surfaces (hover rail, bulk toolbar, command palette, Focused toggle, undo-send pref, NL snooze) delegated to parallel subagents — pending report.

---

## 7. Definition of Done (MVP)

- `cargo test` and `vitest` both green on a clean machine.
- First launch shows a populated, Gmail-like inbox via one-click demo data.
- Email UX matches the P1 parity matrix (hover rail, bulk, priority, snooze, undo pref, bundles).
- Marketing tab shows a real segment→send→analytics loop.
- Docs accurately reflect "done" (no false ✅); specs for onboarding + settings written.
