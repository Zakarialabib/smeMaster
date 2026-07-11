# Workflow Engine

> Compatibility note for a legacy documentation surface. The current product source of truth is `Core/05-automation.md`.

## Current Status

The product no longer treats "Workflow Engine" as a separate active feature with its own primary user model.

Current reality:

- the user-facing workflow/rule experience is documented under `Core/05-automation.md`
- the codebase still contains legacy `src/features/workflows/` modules
- those legacy modules are marked deprecated and are being folded into automation-oriented ownership
- route behavior and product language should prefer "Automation" over "Workflow Engine"

## Use This Doc For

Use this page only to explain the transition:

- where older workflow-specific modules still exist
- why older references may still mention workflows
- where to make current documentation or product updates

## Source Of Truth

For current behavior, use:

- `docs/04-FEATURES/Core/05-automation.md`

For remaining legacy code references, inspect:

- `src/features/workflows/`
- `src/features/automation/`

## Editing Guidance

If you are updating product docs, feature descriptions, or routing language:

- document the feature as automation
- keep trigger/action behavior in `Core/05-automation.md`
- avoid duplicating trigger catalogs and preset lists here

If the old workflows surface is fully removed later, this page can be deleted and the index can point directly to automation only.
