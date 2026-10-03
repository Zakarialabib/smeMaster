# Accounts

> **Status:** Production — multi-provider account setup, auth, and switching.
> **Stack:** React 19 + Zustand + Rust (OAuth PKCE, credential encryption) + SQLite

## Overview

Accounts are the identity layer. Each account holds credentials, provider config, and sync state. The app supports multiple simultaneous accounts across Gmail, Microsoft 365, and generic IMAP/SMTP + CalDAV.

## Architecture

```
AddAccount.tsx → providerDetection.ts → OAuth (PKCE) or IMAP form
  → Rust: token exchange + encrypt_value (AES-256-GCM)
  → SQLite: accounts table
  → accountStore.ts (active account, switcher)
```

Credentials never touch disk unencrypted. OAuth tokens are encrypted via `db::crypto::encrypt_value`.

## Core Capabilities

| Area                   | What it does                                     | Key files                                                  |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| **Add account wizard** | Provider picker → OAuth or manual IMAP/SMTP      | `components/AddAccount.tsx`                                |
| **Provider detection** | Email → provider guess (Gmail/Outlook/custom)    | `utils/providerDetection.ts`                               |
| **OAuth flow**         | PKCE + localhost callback server + token refresh | `services/` (gmail/microsoft auth)                         |
| **IMAP/SMTP setup**    | Manual host/port/TLS + auto-discovery            | `components/AddImapAccount.tsx`                            |
| **CalDAV setup**       | Calendar account wiring                          | `components/AddCalDavAccount.tsx`                          |
| **Account switcher**   | Active account + per-account isolation           | `components/AccountSwitcher.tsx`, `stores/accountStore.ts` |
| **Token management**   | Refresh + re-auth banner on expiry               | `hooks/useAccountToken.ts`, `hooks/useAccounts.ts`         |
| **Import scanner**     | Bulk account import                              | `components/AccountImportScanner.tsx`                      |
| **Biometric lock**     | Mobile biometric gate                            | `components/mobile/BiometricLockScreen.tsx`                |
| **Client ID setup**    | Custom OAuth app credentials                     | `components/SetupClientId.tsx`                             |

## Supported Providers

| Provider           | Email           | Calendar                    | Auth              |
| ------------------ | --------------- | --------------------------- | ----------------- |
| **Gmail**          | ✅ Gmail API    | ✅ Google Calendar          | OAuth2 PKCE       |
| **Microsoft 365**  | ✅ Graph API    | 🔶 Graph calendar (partial) | OAuth2 PKCE       |
| **Generic IMAP**   | ✅ `async-imap` | —                           | Password / OAuth2 |
| **Generic CalDAV** | —               | ✅ CalDAV driver            | Basic / OAuth2    |

## Security

- OAuth tokens encrypted (AES-256-GCM), key derived at runtime
- IMAP/SMTP passwords encrypted, never plaintext
- No credentials in logs (grep-verified)
- `db_wipe_all_data` removes key file + all account rows

## Key Files

| Layer      | Path                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| Store      | `src/features/accounts/stores/accountStore.ts`                             |
| Hooks      | `src/features/accounts/hooks/` (`useAccounts`, `useAccountToken`)          |
| DB wrapper | `src/features/accounts/db/accounts.ts`                                     |
| Components | `src/features/accounts/components/` (Add, Switcher, Import, Biometric)     |
| Utils      | `src/features/accounts/utils/providerDetection.ts`                         |
| Rust       | `src-tauri/src/commands/` (accounts domain) + `src-tauri/src/db/crypto.rs` |

## Related Docs

- [Email Management](01-email-management.md) — inbox and sync
- [Calendar](07-calendar.md) — calendar providers
- [PGP Encryption](26-pgp-encryption.md) — key management
- [User Guide — Account Setup](../user-guide/account-setup.md) — end-user walkthrough
