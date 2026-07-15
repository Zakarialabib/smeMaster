# i18n And Localization

> Language support, locale management, and RTL-aware behavior.

## Scope

This page covers the localization system:

- supported locales
- locale switching
- direction handling, including RTL
- translation resource ownership

## Current Ownership

Representative code areas:

- `src/locales/i18n.ts`
- `src/locales/*/translation.json`
- `src/shared/hooks/init/useI18nLocale.ts`
- locale-related UI and settings flows

## Current Locales

The current codebase registers:

- English (`en`)
- French (`fr`)
- Arabic (`ar`)
- Japanese (`ja`)
- Italian (`it`)

Arabic is the RTL locale in the current locale-direction map.

## What It Does

The i18n layer provides:

- app language registration
- locale detection/fallback
- runtime language switching
- direction metadata so the app can support RTL-aware layouts

## Boundaries

Keep these responsibilities separate:

- copywriting decisions in README/marketing docs are not owned here
- feature-specific help text remains owned by the features that use it

## Key Files

| Area                  | Files                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| i18n setup            | `src/locales/i18n.ts`                                                                                                         |
| Translation resources | `src/locales/en/translation.json`, `fr/translation.json`, `ar/translation.json`, `ja/translation.json`, `it/translation.json` |
| Locale init hooks     | `src/shared/hooks/init/useI18nLocale.ts`                                                                                      |

### Italian Translation Status (updated 2026-07-15)

> ⚠️ **Not complete.** Despite the date-stamped "Complete" claim below, `it/translation.json` still contains **211 `[TODO]`** placeholder strings (verified 2026-07-15). The per-section table that follows reflects *target* coverage, not verified completion. Work the TODO queue with `npm run translate:sync` before marking Italian done.

| Section                                                               | Status      |
| --------------------------------------------------------------------- | ----------- |
| Navigation, email, action bar, composer                               | ✅ Complete |
| Settings (all tabs, presend, content quality, DNS, templates)         | ✅ Complete |
| Accounts, contacts, search, empty states                              | ✅ Complete |
| Contact detail, calendar, tasks, campaigns                            | ✅ Complete |
| Filters, PGP keys, snooze, compliance, vault, dashboard               | ✅ Complete |
| Modals (CalDAV, merge, CSV import, export, raw message, AI signature) | ✅ Complete |
| Common, title bar, keyboard shortcuts                                 | ✅ Complete |

JSON validated; structurally consistent with the English locale. No remaining untranslated keys.

## Update Rules

Update this page when:

- supported locales change
- locale detection or persistence changes
- RTL handling moves or expands materially
- a locale's translation completeness status changes materially
