# Error System: SerializedError

**Where it lives:** `src-tauri/src/error.rs`, `src/shared/errors/errorCodes.ts`, `src/shared/errors/index.ts`

**What you need to know:** Every Tauri command originally returned `Result<T, String>` — just opaque error strings with no structure. The frontend had to do brittle `string.includes()` checks to figure out what went wrong. I built `SerializedError` to give every error a machine-readable code, a human-readable message, and optional debug details. It's not perfect yet, but it's way better than what we had.

## Why I built it

The old way looked like this:

```typescript
// BEFORE — brittle string matching
if (msg.includes("timed out") || msg.includes("connection")) { ... }
if (msg.includes("sqlite_busy") || msg.includes("locked")) { ... }
```

Hard to read. Hard to maintain. Easy to miss edge cases. I needed something structured.

## What I built instead

### Rust side (`error.rs`)

```rust
#[derive(Debug, Clone, Serialize)]
pub struct SerializedError {
    pub code: String,                // Machine-readable code
    pub message: String,             // Human-readable message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,     // Optional debug details (never localized)
}
```

**Traits:** `fmt::Display`, `std::error::Error`, `Serialize`

**Factory methods:**

- `SerializedError::new(code, message)` — basic constructor
- `.with_details(details)` — builder for attaching debug info

### `bail!()` macro

Defined in `error.rs` for ergonomic early returns:

```rust
bail!("AUTH_FAILED", "Invalid credentials");
bail!("AUTH_FAILED", "Invalid credentials: {}", extra_info);
```

Expands to `return Err(SerializedError::new(code, format!(msg, ...)))`.

Used across 17+ call sites in IMAP, SMTP, OAuth, vault, export, and background modules.

### `From` impls

| Source Type         | Behavior                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| `String`            | Wraps with `ERR_INTERNAL` code                                              |
| `&str`              | Delegates to `String` impl                                                  |
| `std::io::Error`    | Maps `ErrorKind` to best-fit code (`NotFound` → `ERR_FILE_NOT_FOUND`, etc.) |
| `serde_json::Error` | Maps to `ERR_PARSE`                                                         |

### Error code constants

12 constants, all defined as `&str`:

| Constant                 | Value                | Used For                              |
| ------------------------ | -------------------- | ------------------------------------- |
| `ERR_CONNECTION_TIMEOUT` | `CONNECTION_TIMEOUT` | IMAP/SMTP connection failures         |
| `ERR_AUTH_FAILED`        | `AUTH_FAILED`        | OAuth/token/credential errors         |
| `ERR_NETWORK`            | `NETWORK_ERROR`      | DNS/TCP/TLS failures                  |
| `ERR_FILE_NOT_FOUND`     | `FILE_NOT_FOUND`     | Missing files in vault/export         |
| `ERR_FILE_IO`            | `FILE_IO_ERROR`      | Read/write failures                   |
| `ERR_PARSE`              | `PARSE_ERROR`        | MIME/JSON/serialization failures      |
| `ERR_INVALID_INPUT`      | `INVALID_INPUT`      | Bad user input                        |
| `ERR_INTERNAL`           | `INTERNAL_ERROR`     | Unexpected errors (catch-all)         |
| `ERR_DB`                 | `DATABASE_ERROR`     | SQLite errors                         |
| `ERR_NOT_FOUND`          | `NOT_FOUND`          | Resource not found                    |
| `ERR_TIMEOUT`            | `TIMEOUT`            | Operation timeout                     |
| `ERR_BUSY`               | `RESOURCE_BUSY`      | Database locked / resource contention |

### Frontend side (`errorCodes.ts`)

```typescript
import { normalizeError, isConnectionError, isBusyError } from '@shared/errors';

const err = normalizeError(caughtError);
if (err.code === 'CONNECTION_TIMEOUT') {
  /* retry logic */
}
if (isConnectionError(err)) {
  /* circuit breaker */
}
if (isBusyError(err)) {
  /* exponential backoff */
}
```

**`normalizeError()`** handles both `SerializedError` and legacy string errors — backward compatible. Falls back to heuristic string matching when the caught value is a plain string.

**Exported from `@shared/errors`:**

- `ErrorCodes` — const object mapping names to code values
- `normalizeError(err)` — normalise any caught error to `SerializedError`
- `isConnectionError(err)` — true for `CONNECTION_TIMEOUT`, `NETWORK_ERROR`, `TIMEOUT`
- `isBusyError(err)` — true for `RESOURCE_BUSY`
- Types: `ErrorCode` (union of code strings), `SerializedError` (interface)

## Current status

- **Type system:** Created (Rust + TypeScript) — actively used
- **Migration:** Substantially complete — 170+ function signatures return `Result<T, SerializedError>` across IMAP, SMTP, OAuth, vault, PGP, DNS, assets, orchestrator, and subsystems
- **AppError enum:** Partially implemented. `AppError` added to `src-tauri/src/errors.rs` with `SubsystemInactive`, `SubsystemUnavailable`, and `SubsystemNotFound` variants for subsystem gating. The rest is still on the deferred list.

## Database `NotFound` standardization (`AppDbError`)

The DB layer uses its own error type, `AppDbError` (`src-tauri/src/db/error.rs`), distinct from the IPC `SerializedError`. DB operations return `Result<T, AppDbError>`; the command layer converts it to `SerializedError` before crossing the Tauri bridge (`AppDbError::NotFound(msg) => SerializedError::new(ERR_NOT_FOUND, msg)`).

`AppDbError::NotFound(String)` is the standardized "resource missing" error. Two helpers in `src-tauri/src/db/common.rs` produce it consistently so every table module emits the same message shape:

- `fetch_or_not_found(opt, id, entity)` — wraps `Option<T>` from a `get_by_id` lookup. Emits `"{entity} with id '{id}' not found"`.
- `delete_or_not_found(pool, sql, id, entity)` — maps a `DELETE` with zero `rows_affected` to `NotFound` with the same message.

**Message contract:** `"{Entity} with id '{id}' not found"` (e.g. `"Contact with id 'c1' not found"`). Table modules that need a different message (e.g. `"No primary alias for account 42"`, or composite-key lookups) keep their inline `AppDbError::NotFound(format!(...))` — they are intentionally not routed through the helper.

**Frontend handling:** because `NotFound` crosses the bridge as `SerializedError` with code `ERR_NOT_FOUND` (`NOT_FOUND`), callers check `err.code === 'NOT_FOUND'` (via `normalizeError`) rather than matching on message text.

## What comes next

I want a proper `AppError` enum that covers every domain:

```rust
// src-tauri/src/error.rs (planned — subsystem variants already implemented)
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    // ---- Already implemented ----
    #[error("Subsystem not enabled: {tool} ({0})")]
    SubsystemInactive { tool: Option<&'static str>, reason: String },

    #[error("Subsystem unavailable: {0}")]
    SubsystemUnavailable { name: &'static str, status: String, message: String },

    #[error("Subsystem not registered: {0}")]
    SubsystemNotFound { name: String },

    // ---- Planned ----
    #[error("Connection timeout: {0}")]
    ConnectionTimeout(String),
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("File I/O error: {0}")]
    FileIo(#[source] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Database error: {0}")]
    Db(#[source] rusqlite::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Resource busy: {0}")]
    Busy(String),
}
```

**Design principles:**

- `AppError` uses `thiserror` for `Display` + `Error` derive — proper matchable Rust variants with compile-time exhaustiveness
- Each variant carries domain-appropriate payloads
- `AppError` implements `From` for external error types (`std::io::Error`, `serde_json::Error`, `rusqlite::Error`)
- A single `From<AppError> for SerializedError` impl converts all variants to the IPC-safe flat struct before crossing the Tauri bridge
- Internal modules return `Result<_, AppError>`; only Tauri command handlers deal with `SerializedError`

**Migration plan:**

1. Define `AppError` enum in `error.rs` alongside `SerializedError`
2. Implement `From<AppError> for SerializedError` — maps variant to `code`, `message`, optional `details`
3. Add `From` impls from external error types to `AppError` (not directly to `SerializedError`)
4. Convert internal functions to return `Result<_, AppError>`; command wrappers convert with `err.map_err(Into::into)`
5. The `bail!()` macro gains an `AppError` variant or gets replaced by `thiserror`'s `?` operator

## Architecture

```
┌──────────────┐    Result<T, AppError>    ┌──────────────────┐
│  Core Module  │ ────────────────────────▶│  Command Handler  │
│  (imap,       │                          │  (Tauri command)  │
│   vault, ...) │                          │                   │
└──────────────┘                          │  .map_err(|e|     │
                                           │    SerializedError│
                                           │      ::from(e))   │
                                           └───────┬───────────┘
                                                   │
                                           Result<T, SerializedError>
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │   Frontend        │
                                          │  normalizeError() │
                                          │  isConnection...  │
                                          └──────────────────┘
```

**Honest note:** The current implementation skips `AppError` — internal functions return `Result<_, SerializedError>` directly. The `AppError` layer is the next step. I built the subsystem variants first because that's what I needed at the time. The rest will come when I have a quiet weekend.
