# 10 — RTL & i18n Readiness Audit

> Status: **living audit — NOT yet executed.** This document tracks the work
> needed to make the SME Master frontend RTL- and i18n-ready (notably the `ar`
> locale, which renders right-to-left). It is intentionally conservative: it
> records the *known* problem space and does **not** claim any violations are
> fixed. Update it as the audit progresses.

## Goal

Bring the frontend to RTL + i18n readiness so layouts, components, and
utilities render correctly under a right-to-left `ar` locale. This is the
north-star objective cited in `AGENTS.md` (RTL & i18n — see §2 of that file).

The companion UI/UX plan is tracked in
[`docs/03-FRONTEND/08-ui-ux-roadmap.md`](08-ui-ux-roadmap.md); that roadmap is
the authoritative execution plan. This audit is the working checklist against it.

## Known Violation Classes

`AGENTS.md` cites **400+ physical-direction violations** remaining in `src`.
The classes (and their logical-property replacements) are:

| Physical (wrong)        | Logical (correct)               | Notes                                  |
| ----------------------- | ------------------------------- | -------------------------------------- |
| `text-left` / `text-right` | `text-start` / `text-end`     | Text alignment                         |
| `ml-*` / `mr-*`         | `ms-*` / `me-*`                 | Margin inline-start / inline-end       |
| `pl-*` / `pr-*`         | `ps-*` / `pe-*`                 | Padding inline-start / inline-end      |
| `left` / `right` (CSS)  | `inset-inline-start` / `end`    | Absolute/inset positioning             |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*`  | Logical borders                        |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` | Logical corner radii                  |

Additional related work (per `AGENTS.md` §2):

- Clear `[TODO]`-prefixed auto-translated `ja`/`it` keys via `npm run translate:sync`.
- Never hardcode UI strings — use `t()` from `react-i18next`.
- Locale keys live in `src/locales/{en,fr,ar,ja,it}/translation.json`.

## How to Audit (when executed)

1. Grep `src` for each physical-direction token above (e.g. `text-left`,
   `ml-`, `mr-`, `border-l`, `border-r`, `left:`, `right:`).
2. Count and categorize by class / file.
3. Replace each with its logical-property equivalent and re-run typecheck +
   lint + visual RTL check.
4. Record per-class counts here as they are cleared.

## Open Questions

- Exact current per-class counts (pending first grep pass).
- Whether any third-party components emit physical-direction inline styles
  that also need wrapping.
