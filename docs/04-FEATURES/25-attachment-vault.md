# Vault

> Attachment and file workflows for stored business documents and related search/navigation surfaces.

## Scope

The vault feature covers the file-oriented side of SMEMaster:

- stored attachment workflows
- vault browsing and search
- vault-related categorization and storage
- related page and store behavior

## Current Ownership

Primary code lives in:

- `src/features/vault/`
- attachment/vault helpers in `src/features/mail/services/attachments/`
- related backend export and vault modules in `src-tauri/src/vault/`

Representative files:

- `src/features/vault/pages/VaultPage.tsx`
- `src/features/vault/stores/vaultStore.ts`
- `src/shared/services/vault/vaultService.ts`
- `src/features/mail/services/attachments/vaultCategorizer.ts`

## What It Does

The vault gives users a place to work with files connected to their business data, especially attachments that need to be found again later.

Typical responsibilities include:

- listing and browsing stored files
- searching or filtering vault content
- categorizing or organizing files
- connecting vault items back to business context where appropriate

## Boundaries

Keep these responsibilities separate:

- compose-time attachment handling belongs to `34-mail-composer.md`
- contact intelligence belongs to `30-contact-intelligence.md`
- encryption/key management belongs to `26-pgp-encryption.md`

## Key Files

| Area                       | Files                                                                             |
| -------------------------- | --------------------------------------------------------------------------------- |
| Vault UI                   | `src/features/vault/pages/VaultPage.tsx`                                          |
| Vault state                | `src/features/vault/stores/vaultStore.ts`                                         |
| Vault service layer        | `src/shared/services/vault/vaultService.ts`                                       |
| Attachment categorization  | `src/features/mail/services/attachments/vaultCategorizer.ts`                      |
| Backend/native vault layer | `src-tauri/src/vault/`, `src-tauri/src/commands/db.rs`, `src-tauri/src/db/vault/` |

## Update Rules

Update this page when:

- vault ownership moves
- stored-file workflows change materially
- search/indexing behavior changes enough to affect user expectations
