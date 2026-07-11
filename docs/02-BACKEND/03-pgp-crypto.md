# PGP Crypto Module

**Where it lives:** `src-tauri/src/pgp/` (369 lines total) + `src/shared/services/pgp/pgpService.ts` (frontend service)

Built on `sequoia-openpgp` 2.2 with `crypto-rust` feature. Pure Rust, zero C dependencies. No OpenSSL linking nightmares.

## What you need to know

This does PGP key generation, encryption, and decryption using Curve25519 keys. Passphrases are cached in memory for 15 minutes so you don't have to type them on every send. There's an inconsistency in my naming conventions that I should probably fix (see below).

## Module structure

| File         | Lines | What it does                                                                             |
| ------------ | ----- | ---------------------------------------------------------------------------------------- |
| `keyring.rs` | 65    | `generate_key()` — Cv25519 key pair via `CertBuilder`                                    |
| `crypto.rs`  | 191   | `encrypt()` with transport encryption; `decrypt_message()` with PKESK/SKESK + passphrase |
| `cache.rs`   | 84    | In-memory passphrase cache via `HashMap`, 15-minute TTL                                  |
| `mod.rs`     | 29    | Tauri command wrappers (4 commands)                                                      |

## Commands

| Command                      | Params                                            | Returns                                     |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------- |
| `generate_key`               | `user_id, passphrase`                             | `(public_key_armored, private_key_armored)` |
| `get_key_info_cmd`           | `armored_key`                                     | `KeyInfo` (key_id + fingerprint)            |
| `encrypt`                    | `plaintext, public_key_armored`                   | Base64-encoded ciphertext                   |
| `decrypt_message`            | `ciphertext_b64, private_key_armored, passphrase` | Plaintext                                   |
| `pgp_cache_passphrase`       | `account_id, passphrase`                          | Store with 15min TTL                        |
| `pgp_get_cached_passphrase`  | `account_id`                                      | Retrieve cached passphrase                  |
| `pgp_clear_passphrase_cache` | `account_id`                                      | Clear cached passphrase                     |

## ⚠️ The naming inconsistency (I know, I know)

`decrypt_message` doesn't have the `pgp_` prefix that the other commands use. The cache commands (`pgp_cache_passphrase`, etc.) DO have it — they're called directly from Rust or tests.

The frontend `pgpService.ts` calls `decrypt_message`, `generate_key`, `get_key_info_cmd`, and `encrypt` via generic `invoke()`. So in practice there's no mismatch — the frontend matches whatever the Rust side named them. But it still bugs me.

## Frontend PGP Service

`src/shared/services/pgp/pgpService.ts` provides:

- `generatePgpKey(userId, passphrase)` → calls `generate_key`
- `getPgpKeyInfo(armoredKey)` → calls `get_key_info_cmd`
- `encryptMessage(plaintext, publicKeyArmored)` → calls `encrypt`
- `decryptMessage(ciphertextB64, privateKeyArmored, passphrase)` → calls `decrypt_message`
- In-memory passphrase cache (`cachePassphrase`, `getCachedPassphrase`, `clearCachedPassphrase`) — uses a local `Map`, NOT Tauri IPC (avoids the name mismatch entirely)
- `importPgpKey(accountId, publicKeyArmored, privateKeyArmored?, passphraseHint?)` — parses the key and saves to DB
