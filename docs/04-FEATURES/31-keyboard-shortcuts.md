# Keyboard Shortcuts

> Keyboard-driven navigation and action surfaces across the app.

## Scope

This page documents the shortcut system as a product capability:

- navigation shortcuts
- action shortcuts
- customizable shortcut settings
- shortcut-help surfaces

## Current Ownership

Representative code areas:

- `src/constants/shortcuts.ts`
- `src/shared/hooks/useKeyboardShortcuts.ts`
- `src/features/settings/components/tabs/ShortcutsTab.tsx`
- shortcut-related help surfaces under settings and UI layers

## What It Does

The shortcut system supports a keyboard-first workflow across the app, especially in email-heavy usage.

The exact shortcut set can evolve, so this page should focus on the system and its ownership rather than becoming a stale dump of every key combination unless those bindings are generated from a maintained source.

## Boundaries

Keep these responsibilities separate:

- command-palette behavior belongs to the frontend/navigation docs
- compose-specific send actions belong to `34-mail-composer.md`

## Key Files

| Area                 | Files                                                    |
| -------------------- | -------------------------------------------------------- |
| Shortcut definitions | `src/constants/shortcuts.ts`                             |
| Runtime handling     | `src/shared/hooks/useKeyboardShortcuts.ts`               |
| Settings UI          | `src/features/settings/components/tabs/ShortcutsTab.tsx` |

## Update Rules

Update this page when:

- shortcut definitions change substantially
- customization ownership changes
- shortcut help becomes a larger standalone subsystem
