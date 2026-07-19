# PGP Encryption

> OpenPGP key management and encrypted-message workflows.

## Scope

This page covers the PGP-specific security surface:

- key management
- passphrase-aware encrypted operations
- message encryption and decryption flows
- related settings and service wrappers

## Current Ownership

PGP spans frontend services, settings UI, and backend cryptographic operations.

Representative code areas:

- `src/shared/services/pgp/pgpService.ts`
- `src/shared/services/pgp/passphraseCache.ts`
- `src/features/settings/components/PgpKeyManager.tsx`
- `src/features/settings/components/tabs/PgpTab.tsx`
- `src-tauri/src/pgp/`

## What It Does

The PGP layer allows users to:

- manage keys
- encrypt content for recipients
- decrypt protected content locally
- work with passphrase-protected private keys

Cryptographic heavy lifting is backend-owned and should stay documented as a security feature, not a casual mail convenience.

## Boundaries

Keep these responsibilities separate:

- general message composition belongs to `34-mail-composer.md`
- account credential storage belongs to `Core/04-accounts.md`
- vault/file workflows belong to `25-attachment-vault.md`

## Key Files

| Area                     | Files                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Frontend service wrapper | `src/shared/services/pgp/pgpService.ts`                                                                  |
| Passphrase cache         | `src/shared/services/pgp/passphraseCache.ts`                                                             |
| Settings UI              | `src/features/settings/components/PgpKeyManager.tsx`, `src/features/settings/components/tabs/PgpTab.tsx` |
| Backend crypto           | `src-tauri/src/pgp/`                                                                                     |
| Backend commands         | `src-tauri/src/commands/security.rs`, related PGP command modules                                        |
| Backend DB domain        | `src-tauri/src/db/security/`                                                                             |

### PGP user_id Tracking (2026-07-07)

Each stored PGP key now tracks the `user_id` extracted from the key's self-signed identity:

| Layer                   | Change                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **DB migration**        | `006_security.sql` (`pgp_keys` table DDL) defines `user_id TEXT NOT NULL DEFAULT ''` on `pgp_keys` (no standalone `021_pgp_user_id.sql` migration exists)                                                            |
| **Rust schema**         | `PgpKey` struct includes `user_id: String` field                                                                                             |
| **Rust command**        | `db_upsert_pgp_key` accepts optional `userId` parameter                                                                                      |
| **Frontend PgpKeyInfo** | `user_id` field added; `getPgpKeyInfo()` returns it after parsing the armored key                                                            |
| **Frontend savePgpKey** | Accepts optional `userId` param, defaults to `info.user_id` on import                                                                        |
| **PgpKeyManager**       | Displays user ID in key details row; search/filter includes `user_id`; on generate calls `getPgpKeyInfo` to extract `user_id` before storing |

## Update Rules

Update this page when:

- key-management UX changes
- the backend cryptography ownership changes
- passphrase or key lifecycle behavior changes materially

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| "`021_pgp_user_id.sql` adds `user_id` to `pgp_keys`" | No such migration; `pgp_keys` (with `user_id TEXT NOT NULL DEFAULT ''`) is defined in `006_security.sql` | `grep -rln 'pgp_keys' src-tauri/src/db/migrations/` → only `006_security.sql` |
