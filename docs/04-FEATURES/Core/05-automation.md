# Automation — Visual Workflow Builder

> Part of **Core Workflows**. Lets you automate repetitive email and task work
> with trigger → condition → action rules, edited either as a simple form, a
> step list, or a **drag-and-drop visual flow builder**.

---

## WHAT is it?

Automation turns "when X happens, do Y" intentions into persistent rules that
the app evaluates on email events. Each rule is a `workflow_rule` row scoped to
a company (`company_id`), so rules never leak across tenants.

A rule has three parts:

| Part | Field | Notes |
| ---- | ----- | ----- |
| **Trigger** | `trigger_event` + `trigger_conditions` (JSON) | The event that starts the rule. |
| **Condition** (optional) | part of `trigger_conditions` | Filters the trigger (e.g. only from a domain). |
| **Actions** | `actions` (JSON array) | One or more operations to run. |

Rules are persisted in SQLite via the `workflow_rules` table and surfaced to the
frontend through `useAutomationStore`.

## WHY does it exist?

SMEMaster is offline-first and email-heavy. Users repeat the same triage loops
("emails from @supplier → label + make a task", "no reply in 3 days → remind
me"). Automation codifies those loops once, then runs them locally — no server,
no per-run cost, no data leaving the device.

## WHERE is it?

- **UI entry:** `Automation` nav item → `AutomationPage`
  (`src/features/automation/pages/AutomationPage.tsx`).
- **State:** `useAutomationStore` (`src/features/automation/stores/automationStore.ts`).
- **Persistence (TS):** `src/features/settings/db/workflowRules.ts`.
- **Persistence (Rust):** `src-tauri/src/db/tables/workflows/workflow_rules.rs`
  + commands in `src-tauri/src/commands/workflows.rs`.
- **Execution:** `src-tauri/src/events/automation.rs` evaluates active rules
  via `list_by_trigger(company_id, trigger_event)` when an event fires.

## WHEN does it run?

Rules are evaluated **when the matching trigger event occurs** on an email in the
active account — e.g. on inbound mail, on a label being applied, on a star, or on
a timer (cron / "no reply after N days"). Only rules with `is_active = 1` are
evaluated.

---

## The Visual Builder (HOW it works)

The builder is a **node-and-edge canvas** powered by
[React Flow](https://reactflow.dev) (`@xyflow/react`). It is the third of three
editor modes and is **lazy-loaded** so it stays out of the initial automation
chunk (see `AutomationPage` — `const AutomationBuilder = lazy(...)`).

### Node types

| Node | Component | Represents | Default position |
| ---- | --------- | --------- | ---------------- |
| `trigger` | `TriggerNode` | The single start event | top (y≈25) |
| `condition` | `ConditionNode` | Optional filter (only rendered when conditions exist) | middle (y≈200) |
| `action` | `ActionNode` | One executable step (one per action) | lower (y≈375, +175 each) |

Edges are drawn automatically: `trigger → condition` (if present) `→ action-0 →
action-1 → …`, with an arrow marker. The graph is **read-visualised**, not fully
free-form: the builder reconstructs a clean top-to-bottom flow from the rule's
data (`buildInitialNodes` / `buildEdges` in `AutomationBuilder.tsx`), so the
canvas always reflects the saved rule rather than arbitrary node placement.

### Three editor modes

`useAutomationStore.editorMode: "simple" | "steps" | "builder"`

| Mode | Component | Best for |
| ---- | --------- | -------- |
| **simple** | `AutomationRuleEditor` + `AutomationTriggerPicker` + `AutomationActionPicker` | First rule, single action, fast. |
| **steps** | step list (`WorkflowStep[]`) | Ordered multi-step sequences. |
| **builder** | `AutomationBuilder` (React Flow) | Visualising / presenting the flow, condition branch. |

The **visual builder is launched** from the rules list ("Visual Builder" button →
`openBuilder()`), and an existing rule can be opened directly into it
(`openBuilderForRule(rule)`). While open it takes over the page area.

### AI generation

A **Sparkles** button opens `AiWorkflowGenerateModal` (`showAiModal`) — describe a
rule in plain language and the AI drafts the trigger + actions. The modal is also
lazy-loaded.

---

## Trigger catalog

Defined in `AutomationTriggerPicker.tsx` (`TRIGGER_EVENTS`):

| `trigger_event` | Label | Condition fields |
| --------------- | ----- | ---------------- |
| `email_received` | Email Received | `from_domain`, `subject_contains` |
| `no_reply_after_days` | No Reply After Days | `days` (1–365, default 3) |
| `time_based` | Time Based | `cron` (e.g. `0 9 * * 1` = Mon 09:00) |
| `label_applied` | Label Applied | — (fires on any email) |
| `starred` | Email Starred | — (fires on any email) |

Conditions are stored as a single JSON blob (`trigger_conditions`) and parsed on
load; the condition node only appears when at least one condition value is
non-empty.

## Action catalog

Defined in `AutomationActionPicker.tsx` (`ACTION_TYPES`). Each action is
`{ type, ...params }`:

| `type` | Label | Params |
| ------ | ----- | ------ |
| `apply_label` | Apply Label | `labelId` |
| `send_template` | Send Template | `templateId` |
| `create_task` | Create Task | `title`, `dueDays` |
| `mark_read` | Mark Read | — |
| `archive` | Archive | — |
| `star` | Star | — |
| `forward_to` | Forward To | `email` |
| `send_notification` | Send Notification | — |

The picker only offers **unused** action types ("+ Add Action"), preventing
duplicates in the same rule.

---

## Rust command surface

Workflow commands live in `src-tauri/src/commands/workflows.rs`:

| Command | Purpose |
| ------- | ------- |
| `db_list_workflow_rules(company_id)` | All rules for a company (newest first). |
| `db_list_workflow_rules_paginated(...)` | Paged variant for large rule sets. |
| `db_count_workflow_rules(company_id)` | Count for dashboard widgets. |
| `db_list_active_workflow_rules(company_id, trigger_event)` | Active rules for a trigger (engine uses this). |
| `db_get_workflow_rule(id)` | Single rule. |
| `db_upsert_workflow_rule(...)` | Create / update. |
| `db_update_workflow_rule_active(id, is_active)` | Toggle on/off. |
| `db_delete_workflow_rule(id)` | Hard delete. |

Related (follow-up / retry machinery, same file): `db_*_follow_up_reminder`,
`db_*_pending_operation`, `db_retry_failed_operations`, etc.

## Frontend data flow

1. `AutomationPage` mounts → `loadRules(activeAccountId)` → `db_list_workflow_rules`.
2. User edits in `simple` / `steps` / `builder`; store holds a draft
   (`AutomationEditorState`).
3. `saveRule(companyId)` serialises actions→JSON, calls `upsertWorkflowRule`,
   then refreshes the list.
4. At runtime, the Rust event layer calls `list_by_trigger` and runs each
   matched rule's actions against the email.

---

## UX / design notes
- **Consistent with the rest of the app:** the rules list uses the shared
  `PageScaffold` shell, `EmptyState` for "no rules", and the same glass/flat
  tokens as Contacts and Tasks.
- **Progressive disclosure:** most users stay in *simple* mode; *builder* is for
  visualising and for rules with a condition branch.
- **Performance:** the heavy React Flow canvas and the AI modal are code-split
  and only mounted on demand.
- **Safety:** every rule has an active toggle and a delete confirmation
  (`createDeleteConfirmation` slice); nothing runs while inactive.
- **Platform gating:** mobile and desktop share the same rule surface. Trigger/action
  availability differences are handled at the service layer; automation UI does not
  assume desktop-only channels. In-app alert surfaces and the notification bridge are
  the first-class delivery path; no Slack/webhook dependency is required for mobile.

## Testing

- `automationStore.test.ts` — editor state, save/load round-trips.
- `AutomationActionPicker.test.tsx` — add/update/remove, param defaults,
  no-duplicate enforcement.
- `companyStore.test.ts` — company switching logic (see Company & ERP doc).
