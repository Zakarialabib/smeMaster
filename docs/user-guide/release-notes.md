# SMEMaster Release Notes

## v1.0.0 — Initial Release

**Release Date**: 2026-07-11
**Platforms**: Windows 10/11 (MSI, NSIS) · Android (APK)

### What's Included

- **Email** — multi-account inbox (Gmail API, IMAP/SMTP, OAuth for Gmail/Outlook/Yahoo), labels, search, drafts, offline-safe actions
- **CRM** — contacts, groups, tags, dynamic segments, activity context, scoring
- **Campaigns** — campaign builder, mail merge, A/B, analytics
- **Calendar** — views and sync-oriented event management
- **Tasks** — priorities, due dates, recurrence, multiple views, linked workflows
- **Automation** — trigger/action rules and builder flows
- **Composer** — signatures, aliases, undo-send, scheduled send
- **PGP** — Sequoia OpenPGP encrypt/decrypt with local keys
- **Vault** — attachment vault and file workflows
- **Deliverability** — DNS, blacklist, bounce, and sender-health tooling
- **AI** — provider-based assistants (categorization, writing, summaries, inbox queries) plus local RAG semantic search
- **i18n** — English, French, Arabic (RTL), Japanese, Italian
- **Local-first** — all data on your machine; auto backup/restore with SHA-256 integrity; full offline support

### Recent Highlights (since 0.9)

- **Invoicing Module** — Morocco DGI-compliant billing/ERP: 7-table schema (i64 money), PEPPOL/UBL 2.1 XML, lopdf A4 PDF, 24 Tauri commands, company ICE/IF/RC/CNSS identifiers
- **POS Hardware Integration** — ESC/POS thermal printer, barcode scanner, hardware settings, 36 new commands
- AI RAG UI complete — local semantic search & RAG feature shipped
- `account_id` → `company_id` full-stack rename (30+ files, zero TS/Rust errors)
- Docs consolidated (9 roadmaps → 1 canonical) and 4 orphaned components repurposed
- Mobile UX Overhaul 100% implemented
- Data layer evolution — dead-code eliminated, optimistic email actions, offline availability

### System Requirements

- **Windows**: Windows 10 or later, 4 GB RAM, 500 MB disk
- **Android**: Android 8.0+ (ARM64), sideload APK

### Known Limitations

- Windows installers are **unsigned** in this build — SmartScreen may warn on install
- Android APK is side-load only (Play Store submission pending)
- Auto-updater is **disabled** in this build (no signing keys configured)
- PGP key generation may take a few minutes on slower machines
- IMAP IDLE connections may drop after ~29 min on Gmail (auto-reconnect implemented)

### Upgrade Path

Initial release — no upgrade needed.

### Feedback

Report issues on [GitHub](https://github.com/Zakarialabib/smeMaster/issues).

---

## Release Notes Template

```markdown
## v{X}.{Y}.{Z} — {Release Name}

**Release Date**: YYYY-MM-DD

### What's New

-

### Improvements

-

### Bug Fixes

-

### Breaking Changes

-

### Upgrade Notes

-
```
