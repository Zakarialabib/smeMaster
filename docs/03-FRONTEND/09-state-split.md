# uiStore Split: Domain Stores

## Why I Did This

The monolithic `useUIStore` was a beast. 24 state fields, 29 actions, 42 consumer files. One store handling theme, layout, settings, and sync status meant every component subscribed to the whole thing — even if it only needed one slice. A component that wanted dark mode would re-render when the sync status changed. That's just wasteful.

So I broke it up.

## The Split

One monster store became 3 domain-specific stores:

| Store            | File             | Fields                                                                                | Consumers |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------- | --------- |
| `useThemeStore`  | `themeStore.ts`  | theme, colorTheme, fontScale, reduceMotion                                            | 8 files   |
| `useLayoutStore` | `layoutStore.ts` | sidebar, readingPane, inboxView, emailDensity, locale, textDirection, composing prefs | 16 files  |
| `useSyncStore`   | `syncStore.ts`   | isOnline, pendingOpsCount, isSyncingFolder, unreadCounts + handleEvent                | 12 files  |

**`uiStore.ts`** still exists unchanged — all 24 fields + 29 actions. (Note: the canonical
store lives at `src/stores/core/uiStore.ts`, **not** `@shared/stores/uiStore` — there is no
`src/shared/stores/uiStore.ts`. The sub-stores `themeStore`/`layoutStore`/`syncStore` live in
`src/shared/stores/` and are imported directly; `uiStore.ts` does **not** re-export them.)

## Design Principles

Three things I tried to get right:

1. **Store setters own their domain** — `themeStore` setters update `themeStore` AND sync to `configStore` (via `_syncConfig()`) so `useThemeManager` can apply visual changes. Yes, this violates "pure store" semantics. It's a pragmatic tradeoff because `useThemeManager` reads from `configStore` for backward compatibility with `useSettingsRestorer`.
2. **Backward compatible** — `useUIStore` continues to work. Zero breaking changes.
3. **Incremental migration** — files can switch from `useUIStore` to sub-stores one at a time. No big-bang refactors.

### Why themeStore Has Side Effects

The `themeStore._syncConfig()` call is the glue between two concerns:

| Concern                  | Store         | Consumer                                                                       |
| ------------------------ | ------------- | ------------------------------------------------------------------------------ |
| Theme value authority    | `themeStore`  | `persistToBackend()` writes structured JSON to SQLite                          |
| Theme visual application | `configStore` | `useThemeManager` reads `configStore.theme` to toggle `dark` class on `<html>` |

Without `_syncConfig()`, clicking "Dark" in GeneralTab updates `themeStore` but `useThemeManager` (watching `configStore`) never applies the CSS class change. Ask me how I know.

## Migration Guide

```typescript
// BEFORE (still works)
import { useUIStore } from '@stores/core/uiStore';
const theme = useUIStore((s) => s.theme);
const isOnline = useUIStore((s) => s.isOnline);
const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

// AFTER (preferred for new code)
import { useThemeStore, useLayoutStore, useSyncStore } from '@shared/stores';
const theme = useThemeStore((s) => s.theme);
const isOnline = useSyncStore((s) => s.isOnline);
const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
```

Why bother migrating?

- **Components re-render only when their slice changes**. No more wasted renders from unrelated state.
- **Clearer imports** — you can tell at a glance what domain a component touches.
- **Easier testing** — mock only the relevant store instead of the entire monolith.

## Source reconciliation (2026-07-19)

Verified against `src/stores/core/uiStore.ts` and `src/shared/stores/`.

- **`@shared/stores/uiStore` path — WRONG.** There is no `src/shared/stores/uiStore.ts`.
  The canonical monolithic store is `src/stores/core/uiStore.ts` (confirmed via
  `13-deprecations.md`). Reworded the split note and corrected the migration example:
  `useUIStore` is imported from `@stores/core/uiStore`, and the sub-stores
  (`themeStore`/`layoutStore`/`syncStore`) live in `src/shared/stores/` and are imported
  directly from `@shared/stores` — `uiStore.ts` does **not** re-export them (no re-export
  block exists in the file).
