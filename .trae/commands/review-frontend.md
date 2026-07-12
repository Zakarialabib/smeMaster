---
description: Review React/TypeScript code — typecheck, lint, tests, accessibility, RTL
argument-hint: <file-pattern>
---

## Frontend Code Review

Focus on: `$ARGUMENTS`

### Steps

1. **Read the target files** specified (or last modified `.tsx`/`.ts` files if no arguments)
2. **Run `npx tsc --noEmit`** — report any type errors
3. **Run `npx eslint src --max-warnings=0`** — report any lint warnings
4. **Run `npx vitest run --exclude integration`** — report any failing tests (do not fix)
5. **Quality checklist**:
   - No `any` types — use proper TypeScript generics; respect `noUncheckedIndexedAccess`
   - Tailwind design tokens used — no hardcoded colors (`#fff`, `rgb(...)`)
   - **RTL:** logical properties (`ms-*`/`me-*`, `text-start/end`, `inset-inline-*`) — no physical `left`/`right`
   - **i18n:** user-facing strings via `t()` from react-i18next — no hardcoded text
   - Accessibility: semantic HTML, keyboard nav, ARIA labels on icon buttons, focus management
   - Error/loading/empty states handled for all async operations
   - `useEffect` cleanup + Tauri `listen()` unsubscribes present
   - No unused imports (respect `noUnusedLocals`)
6. **Pattern check**: Naming matches 3 nearest sibling files; components live in `src/features/*` or `src/shared/components`

### Output format
```
## Frontend Review: <pattern>
- TypeScript: ✅ / ❌ N errors
- Lint: ✅ / ❌ N warnings
- Tests: ✅ / ❌ N failures
- Quality: ✅ / ⚠️ N issues
- Accessibility/RTL/i18n: ✅ / ⚠️ N issues

### Issues found:
1. [SEVERITY] file:line — description
```

Do NOT auto-fix. This is a review command.
