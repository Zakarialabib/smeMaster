# Plan — Deal/Pipeline + Lead Scoring (email-first SME suite)

> **Status:** APPROVED plan, executing on `dev` (2026-07-15).
> **Goal (owner):** "the perfect management system for SME — email first, CRM second,
> then marketing and automation." Two missing pillars identified by cross-wiring research
> as the #1 CRM gaps vs HubSpot/ActiveCampaign: **Deal/Pipeline** and **Lead Scoring**.
> This plan builds both, end-to-end, offline-first, Tauri v2 + React 19 + SQLite.
>
> **Verified ground truth (2026-07-15):**
> - `contacts` table HAS `engagement_score f64`, `health_status TEXT`, `frequency i64`,
>   `last_contacted_at`, `company_id`. → scoring storage EXISTS.
> - `engagement_log` table + DAL (`log_engagement`, `get_engagement_trend`,
>   `get_engagement_for_entity`) EXISTS — this is the "activities spine."
> - `contacts::update_score(pool, contact_id, score, last_engaged_at, health_status)` is a
>   **dumb setter** — there is NO computation function. → scoring math is the gap.
> - Frontend already renders scoring: `EngagementScoreBar.tsx`, `EngagementSparkline.tsx`,
>   `ContactHeroCard` (score+health). → UI primitives exist; need list/segment/automation surfacing.
> - **NO `deals`/`pipeline`/`stage` table, command, store, or page exists anywhere.**
>   `companies` exists (`company_id` on contacts). → Deals = greenfield.
> - Command convention: `#[tauri::command] pub async fn db_x(pool: State<'_,SqlitePool>,
>   company_id: String, ...)`. DAL: `crate::db::tables::crm::deals::create(...)`.
> - Single-writer files (orchestrator-only, NOT delegated to leaves): Rust DAL, Rust
>   commands, `commands/mod.rs` registration, `src/shared/services/db/invoke/*.ts`,
>   `src/features/*/stores/*.ts`. Disjoint UI (pages/components) MAY be delegated.

---

## 0. Scope (MVP that is shippable + verifiable)

**A. Deal / Pipeline (greenfield)**
1. Schema: `pipelines`, `deal_stages`, `deals` (minor-unit money, stage FK, contact+company).
2. Default pipeline + stages seeded on bootstrap.
3. Rust DAL CRUD + stage move + pipeline/stage CRUD.
4. ~10 IPC commands, registered in `commands/mod.rs`.
5. TS wrappers + Zustand `dealStore`.
6. UI: `DealsPage` (kanban by stage), `DealCard`, `DealDetailDrawer`, CRM "Deals" tab,
   rail `deals` sub-item (per `14-navigation-ia-spec.md` §1).
7. Tests: Rust DAL + TS store + component.

**B. Lead Scoring (complete + expose)**
1. `crm::scoring::compute_score(contact, engagement_log)` — decay model (recency +
   frequency + direction: replies>opens>clicks; inactivity decay). Pure, unit-tested.
2. `recompute_scores(pool, company_id)` — walks contacts, recomputes, calls `update_score`.
3. `db_recompute_scores` command (triggered on demand + after engagement events).
4. Surface: Contacts list score column + sort; Segment builder `score` filter; Automation
   trigger "score crosses threshold"; Customer-360 panel already shows it (keep).
5. Tests: scoring math + recompute.

**Out of scope (deferred):** AI deal auto-progression (P2 in IA spec), drip sequences,
forms/landing pages, shared inbox. Note in STATUS.

---

## 1. Schema — `src-tauri/src/db/migrations/032_deals_pipeline.sql`

```sql
CREATE TABLE pipelines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE deal_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 0,   -- 0..100
  color TEXT NOT NULL DEFAULT '#0b57d0',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES deal_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL DEFAULT 0,   -- i64 minor units (centimes)
  currency TEXT NOT NULL DEFAULT 'MAD',
  expected_close_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',        -- open | won | lost
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
```

Seed (idempotent, in Rust bootstrap or seed loader): one default pipeline "Sales" with
stages: Lead (10%), Qualified (30%), Proposal (60%), Negotiation (80%), Won (100%),
Lost (0%).

---

## 2. Rust DAL — `src-tauri/src/db/tables/crm/deals.rs` (NEW)

Structs: `Pipeline`, `DealStage`, `Deal` (snake_case, `#[derive(sqlx::FromRow, Serialize,
Deserialize)]`). Functions (all `pub async fn`, `Result<_, AppDbError>`):
- `create_pipeline`, `list_pipelines(company_id)`, `get_default_pipeline(company_id)`,
  `create_stage`, `list_stages(pipeline_id)`, `update_stage`, `delete_stage`.
- `create_deal(req)`, `get_deal(id)`, `update_deal(id, fields)`, `delete_deal(id)`,
  `list_deals(company_id, pipeline_id?, stage_id?, status?)`, `move_deal_stage(id, stage_id)`.
- `seed_default_pipeline(company_id)` (idempotent: skip if any pipeline exists).
- Register module in `crm/mod.rs` (`pub mod deals;`).

## 3. Rust Scoring — `src-tauri/src/db/tables/crm/scoring.rs` (NEW) + wire

- `pub fn compute_score(engagement: &[EngagementLog], now: i64) -> (f64, &str)` —
  recency-weighted: sum of `score_delta` from `engagement_log` within 90d, decayed by age
  (half-life ~30d), clamped 0..100; `health_status` = Cold(<25)/Warm(25-60)/Hot(>60)
  with inactivity (>60d no event) → "Dormant". Pure, no DB.
- `pub async fn recompute_scores(pool, company_id) -> Result<usize>` — for each contact,
  load `engagement_log` by `contact_id`, compute, `update_score`. Returns count.
- Wire: call `recompute_scores` after `log_engagement` (non-fatal) so scores stay fresh;
  also expose on-demand.

## 4. Rust Commands — `src-tauri/src/commands/deals.rs` (NEW) + register

Commands (snake_case args, `CmdResult<_>`):
`db_create_deal`, `db_update_deal`, `db_delete_deal`, `db_get_deal`, `db_list_deals`,
`db_move_deal_stage`, `db_create_pipeline`, `db_list_pipelines`,
`db_create_deal_stage`, `db_list_deal_stages`, `db_recompute_scores`.
Register all in `commands/mod.rs` `generate_handler!`. Keep `#[command]` attributes counted
in the 802 metric (verify grep after).

## 5. TS Service Layer — `src/shared/services/db/invoke/deals.ts` (NEW)

Typed `invokeCommand` wrappers (camelCase DTOs → snake_case args), one per command,
matching the 504-wrapper convention. Types: `Deal`, `DealStage`, `Pipeline`,
`CreateDealInput`, `MoveDealStageInput`, `RecomputeScoresInput`.

## 6. Store — `src/features/crm/stores/dealStore.ts` (NEW)

Zustand: `deals`, `pipelines`, `stages`, `activePipelineId`, `loading`,
`fetchPipelines`, `fetchDeals`, `createDeal`, `moveDeal`, `updateDeal`, `deleteDeal`,
`recomputeScores`. Standard pattern (mirror `contactStore.ts`).

## 7. UI (delegate to leaf agents — disjoint files)

- `src/features/crm/pages/DealsPage.tsx` — kanban: columns = stages, cards = deals,
  drag-drop between columns → `moveDeal` (use existing dnd-kit or HTML5 DnD; match
  campaign editor's `@dnd-kit` usage). Header: pipeline switcher + "New Deal" + total value.
- `src/features/crm/components/deals/DealCard.tsx`, `DealColumn.tsx`,
  `DealDetailDrawer.tsx` (title, amount, contact picker, stage, expected close, notes).
- `src/features/crm/pages/CrmPage.tsx` — add "Deals" tab (contacts | companies | deals |
  timeline) per nav spec §1.
- `src/shared/components/layout/shell/navConfig.ts` — add `deals` sub-item to `crm` group
  (coordinated; navConfig is frontend but NOT a single-writer store — leaf may edit, but
  to avoid conflict orchestrator applies the one-line addition after UI lands).
- `src/features/contacts/components/ContactList* `/`ContactsPage.tsx` — add score column +
  sort-by-score (reuse `EngagementScoreBar`). Segment builder: add `score` filter.
- Automation: add "score crosses threshold" trigger option (wire to existing rule engine).

## 8. Tests

- Rust: `deals.rs` `#[cfg(test)]` — create pipeline, seed stages, create/move/delete deal,
  `recompute_scores` changes `engagement_score`. `scoring.rs` unit tests for compute (known
  inputs → expected score/health).
- TS: `dealStore.test.ts` (create/move/delete/fetch), `deals.test.ts` wrappers,
  `DealCard.test.tsx` / `DealsPage.test.tsx` (render + drag mock).
- Use `--pool=threads` for vitest (forks pool times out in sandbox, per STATUS).

## 9. Verification Gate (before commit)

- `npx tsc --noEmit` → 0 errors (touched files).
- `npx vitest run --pool=threads` → target tests green.
- `cd src-tauri && cargo check` → 0 errors (full compile; `cargo test` EXE is env-blocked
  per STATUS — compile is the gate).
- `npx eslint src src-tauri` → 0 warnings (frontend; Rust via cargo check).
- Re-grep IPC command count (should rise by ~11) to keep the 802 metric honest.

## 10. Execution Order (chunks)

1. Migration 032 + `crm/mod.rs` + `deals.rs` DAL + `scoring.rs`.
2. `commands/deals.rs` + register in `mod.rs`.
3. `deals.ts` wrappers + `dealStore.ts`.
4. Delegate UI (DealsPage, DealCard, DealDetailDrawer, CrmPage tab, navConfig `deals`,
   ContactsPage score column, segment score filter, automation trigger).
5. Tests (Rust + TS) + verification gate.
6. Commit + update STATUS.md (mark Deals + Lead Scoring shipped; note deferred P2 items).

---

## 11. Inspiration (from cross-wiring research, cited)

- Pipeline stages: Pipedrive (drag-drop kanban, per-deal value+probability), HubSpot.
- Lead scoring: ActiveCampaign (score triggers automation), Keap (data-driven).
- Engagement timeline = `engagement_log` (already built) — reuse as the spine.
- Headline edge: native DGI invoicing + offline scoring (no cloud competitor matches).
