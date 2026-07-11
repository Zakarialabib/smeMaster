# IMAP Engine

**Where it lives:** `src-tauri/src/imap/` — 7 files (after I finally split up the 1,958-line monster) + `src/features/mail/services/imap/tauriCommands.ts` (frontend wrappers)

## What you need to know

This was originally one massive `client.rs`. Nearly 2,000 lines. I split it into 7 focused files so I could actually read what was going on. It's built on `async-imap` 0.10 with a raw TCP fallback for when Exchange or DavMail decide to be special.

## How it's organized

| File         | What it does                                                                      |
| ------------ | --------------------------------------------------------------------------------- |
| `mod.rs`     | Module root, re-exports the public API                                            |
| `connect.rs` | TCP/TLS connection, `with_session()` helper, auth (password + XOAuth2)            |
| `fetch.rs`   | Batch UID FETCH, message body, raw message, attachment extraction by MIME part ID |
| `flags.rs`   | UID STORE +/-FLAGS operations                                                     |
| `folder.rs`  | Folder listing with special-use detection (RFC 6154 + name heuristics)            |
| `sync.rs`    | Delta sync via UIDVALIDITY + UIDNEXT tracking, search                             |
| `types.rs`   | Config, folder, and message types                                                 |

## What it can do

- **Auth:** Password + XOAuth2
- **Encryption:** TLS, STARTTLS, plain (no encryption), rustls (default)
- **Folder ops:** Listing with special-use detection
- **Fetching:** Batch UID FETCH with `BODY[]`, configurable batch size (default 50)
- **MIME:** Parsing via `mail-parser` crate, attachment extraction by MIME part ID
- **Sync:** Delta sync tracking UIDVALIDITY + UIDNEXT
- **Diagnostics:** Raw TCP fetch for Exchange variants that break `async-imap`'s parser
- **Date parsing:** Custom INTERNALDATE handling for Java/Golang date formats
- **Pattern:** `with_session()` helper manages the whole lifecycle — open, auth, execute, close

## Frontend wrappers

All in `src/features/mail/services/imap/tauriCommands.ts` — 19 thin wrappers using generic `imapCmd`/`smtpCmd` helpers:

| Wrapper                    | Rust Command                |
| -------------------------- | --------------------------- |
| `imapTestConnection()`     | `imap_test_connection`      |
| `imapListFolders()`        | `imap_list_folders`         |
| `imapFetchMessages()`      | `imap_fetch_messages`       |
| `imapFetchNewUids()`       | `imap_fetch_new_uids`       |
| `imapSearchAllUids()`      | `imap_search_all_uids`      |
| `imapFetchMessageBody()`   | `imap_fetch_message_body`   |
| `imapFetchRawMessage()`    | `imap_fetch_raw_message`    |
| `imapSetFlags()`           | `imap_set_flags`            |
| `imapMoveMessages()`       | `imap_move_messages`        |
| `imapDeleteMessages()`     | `imap_delete_messages`      |
| `imapGetFolderStatus()`    | `imap_get_folder_status`    |
| `imapFetchAttachment()`    | `imap_fetch_attachment`     |
| `imapAppendMessage()`      | `imap_append_message`       |
| `imapSearchFolder()`       | `imap_search_folder`        |
| `imapSyncFolder()`         | `imap_sync_folder`          |
| `imapDeltaCheck()`         | `imap_delta_check`          |
| `imapRawFetchDiagnostic()` | `imap_raw_fetch_diagnostic` |

## Message ID format

`imap-{accountId}-{folder}-{uid}` — I don't use the RFC Message-ID field for this. If UIDVALIDITY changes, the whole folder gets a full resync. Simple and predictable.

## Honest notes

- **Zero unit tests** on the IMAP module. That's a P1 priority and I know it.
- Several files are missing inline docs. The refactor made things better but I haven't finished the cleanup.
- The raw TCP diagnostic endpoint exists because some Exchange servers send malformed responses that `async-imap` can't parse. It's a debugging tool and I don't love having it, but it's saved me more than once.
