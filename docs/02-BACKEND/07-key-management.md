# Key Management

> Current encryption and sensitive-data handling model used by SMEMaster.

## Scope

This page documents what is actually implemented today for credential encryption and sensitive-value handling.

It covers:

- which values are encrypted
- where the active application key comes from
- how frontend and backend participate
- how PGP fits into the broader security model

## Current Model

Sensitive app values are protected with AES-256-GCM-style encryption using an application key stored separately from the main database.

The active key flow is implemented around:

- `src/shared/utils/crypto.ts`
- backend helpers under OAuth and related Rust modules

Important reality:

- the current key is generated randomly on first run
- it is stored as `smemaster.key` in the app-data directory
- this is not the same as a machine-derived or master-password-derived key model

This page intentionally avoids repeating older aspirational designs that are no longer the source of truth.

## What Is Protected

Typical encrypted values include:

- IMAP and SMTP credentials
- OAuth access and refresh tokens
- AI provider secrets or similar sensitive settings

PGP passphrases follow a different model and should not be described as normal persisted app secrets.

## Frontend And Backend Roles

The current implementation spans both sides of the app:

- frontend utility code handles encryption/decryption for some application-level stored values
- backend Rust code handles OAuth and other secure workflows close to the native/runtime layer

This means contributors must treat the boundary carefully instead of assuming encryption is purely frontend or purely backend owned.

## PGP

PGP is its own subsystem:

- key management and crypto operations live in dedicated PGP modules
- passphrases are not documented here as long-term persisted secrets
- user-facing PGP workflows are covered by the feature docs and the backend crypto docs

## Security Trade-Offs

Current trade-offs are practical rather than perfect:

- credentials are not stored as plaintext
- the app key is local to the device's app-data area
- the database itself is not documented here as fully encrypted at rest
- the current model favors offline usability and local ownership over frequent unlock prompts

## Contributor Rules

When working with sensitive data:

1. do not log decrypted secrets
2. reuse the existing encryption helpers
3. document the implemented model, not the ideal future model
4. treat new sensitive fields as an explicit security decision, not a casual schema change

## Related Docs

- `03-pgp-crypto.md`
- `04-oauth-flow.md`
- `../04-FEATURES/04-accounts.md`
- `../04-FEATURES/26-pgp-encryption.md`
