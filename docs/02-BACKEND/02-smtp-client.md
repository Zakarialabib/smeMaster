# SMTP Client

**Where it lives:** `src-tauri/src/smtp/client.rs` (459 lines including tests) + `src-tauri/src/smtp/types.rs` (config structs)

Built on `lettre` 0.11. Because I don't want to hand-write SMTP.

## What you need to know

This is the outgoing mail pipeline. It takes raw emails (base64url-encoded), connects to the right SMTP server, and sends them. Connection pooling, retry with backoff, the usual stuff. Nothing fancy, but it works.

## Features

- **Pooling:** `HashMap<u64, AsyncSmtpTransport>` keyed by config hash — global pool via `OnceLock`. Same config? Same connection. No redundant auth handshakes.
- **Auth:** Password + XOAUTH2 (OAuth 2.0). Configurable auth mechanisms.
- **Encryption:** TLS (port 465), STARTTLS (port 587), plain (port 25).
- **Timeout:** Configurable per-send, defaults to 30s. Up to 3 retries with exponential backoff.
- **Connection test:** 30s timeout via `smtp_test_connection`. Good for setup wizards.
- **Retry:** Exponential backoff (1s → 2s → 4s). If the server returns a permanent 5xx, I skip retry — no point in beating a dead server.

## Commands

| Command                | Params                           | What it does                              |
| ---------------------- | -------------------------------- | ----------------------------------------- |
| `smtp_send_email`      | SmtpConfig + `raw_email: String` | Sends a base64url-encoded raw email       |
| `smtp_test_connection` | SmtpConfig                       | Connects + authenticates with 30s timeout |

## Testing

8 unit tests covering:

- Base64url decode (valid, invalid, empty)
- Envelope extraction (valid, from, recipients, bcc)
- Config hash determinism (same config → same hash, different host/port/auth → different hash)

It's not exhaustive, but it catches the common footguns.
