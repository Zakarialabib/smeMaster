# Dependency Upgrade Analysis & Plan

**Date:** 2026-09-30  
**Tool:** bun 1.3.13  
**Phases:** 3 (Safe Cleanup → Major Upgrades → Tauri)

---

## Phase 1: Safe Cleanup ✅ COMPLETED

### Removed (12 unused packages)
| Package | Reason |
|---|---|
| `@google/generative-ai` | Replaced by `@google/genai` |
| `date-fns` | 0 files import it |
| `tailwindcss-animate` | 0 files import it |
| `@tailwindcss/forms` | 0 files import it |
| `@tailwindcss/typography` | 0 files import it |
| `@tiptap/extension-color` | 0 files import it |
| `@tiptap/extension-highlight` | 0 files import it |
| `@tiptap/extension-link` | 0 files import it |
| `@tiptap/extension-text-style` | 0 files import it |
| `@tiptap/extension-underline` | 0 files import it |
| `@tiptap/pm` | Peer dep, never directly imported |
| `@types/d3-force` | d3-force is JS, types not needed |

### Safe Bumps (51 packages)
All minor/patch version bumps applied. TypeScript 5.9.3 → clean. Tests running.

### Mistral Provider Fix
- `content` field now `string | ContentChunk[]` — added type guard
- `embeddings.create` uses `inputs` not `input` — fixed
- `embedding` field now `number[] | undefined` — added nullish coalescing

---

## Phase 2: Major Upgrades 🔄 IN PROGRESS

### Batch 1: Build Tooling
| Package | From | To | Risk | Status |
|---|---|---|---|---|
| `vite` | 7.3.2 | 8.3.1 | 🔴🔴🔴 | Installing |
| `@vitejs/plugin-react` | 5.1.3 | 6.1.1 | 🔴🔴 | Installing |
| `vitest` | 4.0.18 | 5.0.3 | 🔴🔴 | Installing |
| `eslint` | 9.39.0 | 10.11.0 | 🔴🔴 | Installing |

**Vite 8 Changes:**
- Rolldown-based (Rust bundler) — faster builds
- `manualChunks` API unchanged
- Plugin ecosystem: `@vitejs/plugin-react` v6 supports it
- `server.hmr` config unchanged

**ESLint 10 Changes:**
- Some rules deprecated/removed
- Config format mostly compatible
- May need `eslint.config.mjs` migration

### Batch 2: UI Libraries (pending)
| Package | From | To | Risk |
|---|---|---|---|
| `recharts` | 2.15.4 | 3.10.1 | 🔴🔴 |
| `lucide-react` | 0.563.0 | 1.49.0 | 🔴🔴 |
| `react-intersection-observer` | 10.0.3 | 11.0.1 | 🔴 |
| `jsdom` | 28.0.0 | 30.1.1 | 🔴 |
| `lint-staged` | 15.5.2 | 17.6.0 | 🔴 |
| `@testing-library/jest-dom` | 6.9.1 | 7.0.1 | 🟡 |

### Batch 3: AI SDKs (pending)
| Package | From | To | Risk |
|---|---|---|---|
| `openai` | 6.38.0 | 7.25.0 | 🔴🔴 |
| `@anthropic-ai/sdk` | 0.129.0 | — | Already bumped |

### Deferred (stay on current)
| Package | Current | Latest | Reason |
|---|---|---|---|
| `typescript` | 5.9.3 | 7.0.2 | TS 7 is native Go port — too new, revisit in 6 months |

---

## Phase 3: Tauri (pending)

### Rust Crates
| Crate | Current | Action |
|---|---|---|
| `tauri` | 2.11 | Bump to latest 2.x |
| `tauri-build` | 2.6.2 | Bump to match |
| `tauri-plugin-*` | various | Bump all to match JS |

### JS Packages
Already bumped in Phase 1 (all `@tauri-apps/*` to 2.12.0)

---

## Verification Checklist

Each batch must pass:
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run --exclude integration` — all pass
- [ ] `npm run build` — clean build
- [ ] `npx eslint src --max-warnings=0` — zero warnings

---

## Risk Mitigation

1. **Vite 8 + Rolldown:** If build fails, pin back to `vite@7.3.2` + `@vitejs/plugin-react@5.2.0`
2. **ESLint 10:** If config breaks, use `ESlint-config-prettier` or migrate to flat config
3. **Recharts 3:** If charts break, check tooltip/legend API changes
4. **lucide-react 1.x:** If icons break, grep for renamed exports
5. **OpenAI 7:** If AI calls break, check SDK migration guide

---

## Innovation Opportunities

1. **Vite 8 Rolldown:** Faster HMR, smaller bundles — benchmark before/after
2. **ESLint 10:** New rules for React 19 patterns
3. **Recharts 3:** New chart types, better performance
4. **lucide-react 1.x:** Tree-shaking improvements, smaller bundle
