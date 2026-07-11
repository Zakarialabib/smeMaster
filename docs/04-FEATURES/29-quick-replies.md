# Quick Replies

> Saved short-form replies for fast insertion during email workflows.

## Scope

Quick replies are lightweight reusable snippets for responding faster inside email flows.

This page covers:

- stored quick-reply snippets
- insertion points in reply/compose flows
- management UI

## Current Ownership

Representative code areas:

- `src/features/mail/db/quickReplies.ts`
- `src/features/settings/components/QuickReplyEditor.tsx`
- relevant compose and inline-reply components under `src/features/mail/components/`

## What It Does

Quick replies give users a fast way to reuse short-form responses without opening the full template-management workflow.

Typical behavior includes:

- listing saved snippets
- inserting content into reply/editor surfaces
- maintaining simple snippet metadata and ordering

## Boundaries

Keep these responsibilities separate:

- full reusable content management belongs to `24-templates.md`
- full compose/send flow belongs to `34-mail-composer.md`

Quick replies are the lightweight snippet layer, not the full template system.

## Key Files

| Area            | Files                                                   |
| --------------- | ------------------------------------------------------- |
| Data layer      | `src/features/mail/db/quickReplies.ts`                  |
| Settings UI     | `src/features/settings/components/QuickReplyEditor.tsx` |
| Related mail UI | `src/features/mail/components/`                         |

## Update Rules

Update this page when:

- quick replies gain richer semantics than snippets
- insertion ownership moves
- quick replies merge with or split further from the template system
