# SMEMaster — Documentation Index

> **Last updated:** 2026-10-04 — voice call system dropped, pivoted to agentic AI automation.
> **Single source of truth:** This index + `docs/STATUS.md` + `docs/PRODUCTION-READINESS.md`.
> **Stack:** Tauri v2 + React 19 + Rust + SQLite (offline-first)
> **Version:** 1.0.0-rc · **DB:** 33 migrations (001–033, re-verified 2026-10-23) · **Tests:** ~3,529 TS + 969 Rust (via `npm run test` / `cargo test`)
> **Locales:** en, fr, ar, ja, it (RTL for ar) · **Commands:** 859 (795 `#[tauri::command]` + 64 `#[command]`, re-verified 2026-10-23) · **Stores:** 44 Zustand store modules (non-test, checker-verified 2026-10-23 via `scripts/check-ground-truth.mjs`)
> **Features Added:** Invoicing (Morocco DGI-compliant) ✅ · POS Hardware Integration ✅
> **Platforms:** Desktop (Windows · Linux · macOS) ✅ · Mobile (Android) ✅ · iOS (requires Mac) ⚠️
> **Master Plan:** `docs/06-ROADMAP/09-master-plan.md` — remaining work phases
---

## Quick Start

| I want to... | Go to |
| --- | --- |
| Understand the architecture | [01-ARCHITECTURE/01-overview.md](01-ARCHITECTURE/01-overview.md) |
| See the Rust backend structure | [01-ARCHITECTURE/02-backend-structure.md](01-ARCHITECTURE/02-backend-structure.md) |
| Understand agentic AI automation | [01-ARCHITECTURE/08-agentic-ai-automation.md](01-ARCHITECTURE/08-agentic-ai-automation.md) |
| See the roadmap | [06-ROADMAP/09-master-plan.md](06-ROADMAP/09-master-plan.md) |
| Check production readiness | [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) |

---

## 01 — Architecture

| Doc | Status | What |
| --- | --- | --- |
| [01-overview.md](01-ARCHITECTURE/01-overview.md) | ✅ | Three layers, IPC, conventions |
| [02-backend-structure.md](01-ARCHITECTURE/02-backend-structure.md) | ✅ | Rust backend layout, agent module |
| [03-data-model.md](01-ARCHITECTURE/03-data-model.md) | ✅ | Schema ownership, domains |
| [05-mobile-architecture.md](01-ARCHITECTURE/05-mobile-architecture.md) | ✅ | Android/iOS bridge |
| [06-schema-relationships.md](01-ARCHITECTURE/06-schema-relationships.md) | ✅ | Table relationships |
| [07-sidecar-architecture.md](01-ARCHITECTURE/07-sidecar-architecture.md) | ✅ | ml-sidecar process model |
| [08-agentic-ai-automation.md](01-ARCHITECTURE/08-agentic-ai-automation.md) | 🆕 | Agent module: config, providers, ops, automation |

---

## 02 — Backend

| Doc | Status | What |
| --- | --- | --- |
| [01-imap-engine.md](02-BACKEND/01-imap-engine.md) | ✅ | IMAP sync engine |
| [02-smtp-client.md](02-BACKEND/02-smtp-client.md) | ✅ | SMTP client |
| [03-pgp-crypto.md](02-BACKEND/03-pgp-crypto.md) | ✅ | PGP encryption |
| [04-oauth-flow.md](02-BACKEND/04-oauth-flow.md) | ✅ | OAuth PKCE |
| [05-plugins-inventory.md](02-BACKEND/05-plugins-inventory.md) | ✅ | Plugin system |
| [06-commands-reference.md](02-BACKEND/06-commands-reference.md) | ✅ | 868 IPC commands reference |
| [07-key-management.md](02-BACKEND/07-key-management.md) | ✅ | Key management |
| [10-error-system.md](02-BACKEND/10-error-system.md) | ✅ | Error types |
| [11-event-system.md](02-BACKEND/11-event-system.md) | ✅ | Event bus |
| [12-diagnostics.md](02-BACKEND/12-diagnostics.md) | ✅ | Diagnostics |
| [13-ai-capability-architecture.md](02-BACKEND/13-ai-capability-architecture.md) | ✅ | Provider capability system |
| [14-ai-task-router.md](02-BACKEND/14-ai-task-router.md) | ✅ | Task routing |
| [15-ai-model-registry.md](02-BACKEND/15-ai-model-registry.md) | ✅ | Model definitions |
| [16-ai-rag-dimensions.md](02-BACKEND/16-ai-rag-dimensions.md) | ✅ | RAG embedding dimensions |
| [19-document-and-email-extraction.md](02-BACKEND/19-document-and-email-extraction.md) | ✅ | Doc/email extraction |
| [20-tts-stt-email.md](02-BACKEND/20-tts-stt-email.md) | ✅ | TTS/STT for email (sherpa-onnx, ElevenLabs, browser) |
| [ai-rag.md](02-BACKEND/ai-rag.md) | ✅ | RAG system |

---

## 03 — Frontend

| Doc | Status | What |
| --- | --- | --- |
| [02-state-management.md](03-FRONTEND/02-state-management.md) | ✅ | Zustand stores |
| [03-service-layer.md](03-FRONTEND/03-service-layer.md) | ✅ | Service layer patterns |
| [04-dependencies.md](03-FRONTEND/04-dependencies.md) | ✅ | Dependencies |
| [06-mobile-ui-strategy.md](03-FRONTEND/06-mobile-ui-strategy.md) | ✅ | Mobile UI |
| [07-event-bus.md](03-FRONTEND/07-event-bus.md) | ✅ | Event bus |
| [08-ui-ux-roadmap.md](03-FRONTEND/08-ui-ux-roadmap.md) | ✅ | UI/UX roadmap |
| [09-state-split.md](03-FRONTEND/09-state-split.md) | ✅ | State split rules |
| [10-rtl-audit.md](03-FRONTEND/10-rtl-audit.md) | ✅ | RTL audit (0 violations) |
| [11-typed-ipc.md](03-FRONTEND/11-typed-ipc.md) | ✅ | Typed IPC |
| [13-deprecations.md](03-FRONTEND/13-deprecations.md) | ✅ | Deprecation log |
| [14-navigation-ia-spec.md](03-FRONTEND/14-navigation-ia-spec.md) | ✅ | Navigation/IA spec |
| [15-shared-components.md](03-FRONTEND/15-shared-components.md) | ✅ | Shared components |
| [ai-context-engineering.md](03-FRONTEND/ai-context-engineering.md) | ✅ | AI context engineering |
| [ai-prompt-engineering.md](03-FRONTEND/ai-prompt-engineering.md) | ✅ | AI prompt engineering |
| [ai-rag.md](03-FRONTEND/ai-rag.md) | ✅ | RAG frontend |

---

## 04 — Features

| Doc | Status | What |
| --- | --- | --- |
| [01-email-management.md](04-FEATURES/01-email-management.md) | ✅ | Email management |
| [02-campaigns-mail-merge.md](04-FEATURES/02-campaigns-mail-merge.md) | ✅ | Campaigns |
| [03-crm-contacts.md](04-FEATURES/03-crm-contacts.md) | ✅ | CRM contacts |
| [05-automation.md](04-FEATURES/05-automation.md) | ✅ | Automation rules |
| [34-mail-composer.md](04-FEATURES/34-mail-composer.md) | ✅ | Mail composer |
| [37-settings-redesign-spec.md](04-FEATURES/37-settings-redesign-spec.md) | ✅ | Settings redesign |
| [38-tts-stt-settings.md](04-FEATURES/38-tts-stt-settings.md) | ✅ | TTS/STT settings UI |

---

## 05 — Development

| Doc | Status | What |
| --- | --- | --- |
| [02-testing.md](05-DEVELOPMENT/02-testing.md) | ✅ | Testing strategy |
| [03-manual-tests.md](05-DEVELOPMENT/03-manual-tests.md) | ✅ | Manual test procedures |
| [04-wal-deletion.md](05-DEVELOPMENT/04-wal-deletion.md) | ✅ | WAL deletion |
| [05-reuse-patterns.md](05-DEVELOPMENT/05-reuse-patterns.md) | ✅ | Reuse patterns |
| [DESIGN_SYSTEM_GUIDE.md](05-DEVELOPMENT/DESIGN_SYSTEM_GUIDE.md) | ✅ | Design system |

---

## 06 — Roadmap

| Doc | Status | What |
| --- | --- | --- |
| [09-master-plan.md](06-ROADMAP/09-master-plan.md) | ✅ | Master roadmap (all phases) |
| [10-monetization-entitlement-engine.md](06-ROADMAP/10-monetization-entitlement-engine.md) | 🔲 design | Entitlement engine |
| [11-monetization-frontend-paywall.md](06-ROADMAP/11-monetization-frontend-paywall.md) | 🔲 design | Frontend paywall |
| [12-monetization-asset-delivery.md](06-ROADMAP/12-monetization-asset-delivery.md) | 🔲 design | Asset delivery |
| [13-monetization-mobile-strategy.md](06-ROADMAP/13-monetization-mobile-strategy.md) | 🔲 design | Mobile monetization |
| [14-ai-stack-cross-pollination.md](06-ROADMAP/14-ai-stack-cross-pollination.md) | ✅ | AI stack cross-pollination |

---

---

## Ground Truth (2026-10-04)

| Metric | Value |
| --- | --- |
| Rust IPC commands | 868 |
| SQL migrations | 36 |
| Zustand stores | 47 |
| Rust tests | 999 |
| TS test files | 314 |
| RTL violations | 0 |
| ja/it TODO tags | 0 |
