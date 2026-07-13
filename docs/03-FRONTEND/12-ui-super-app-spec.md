# UI Super-App Spec (Consolidated)

> **Canonical design/UI/UX source of truth:** `docs/plans/DESIGN_UI_UX_SPEC.md`.
> This file exists to satisfy the `00-INDEX.md` link and redirect readers to the
> active spec. Do not duplicate content here.

## What this is
smeMaster presents as a single "super-app" shell (Desktop / Tablet / Phone) that hosts
CRM, mail, invoicing, ERP, automation, calendar, campaigns, tasks, vault and settings
under one adaptive navigation system. The unified design language is specified in
[`DESIGN_UI_UX_SPEC.md`](../../plans/DESIGN_UI_UX_SPEC.md).

## Direction (2026-07-13)
- **Direction A — Glass surface layer** is the approved visual direction. Glass is a
  selectable surface (`[data-surface="glass"]`) over a calm Flat default; toggle in
  Settings → Appearance → Surface.
- Every primary list page uses `PageScaffold`; bespoke surfaces (Mail, Dashboard, POS,
  Vault, Assistant) are intentionally exempt.
- Forms use `useFormField` + `validators.ts` with inline i18n errors.

See `DESIGN_UI_UX_SPEC.md` for the full page-template contract, component inventory,
mobile/desktop adaptation rules, and the Chunk 1-9 execution roadmap.
