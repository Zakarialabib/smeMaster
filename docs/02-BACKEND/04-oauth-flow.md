# OAuth Flow

**Where it lives:** `src-tauri/src/oauth.rs` (token exchange + refresh), `src/shared/services/oauth/customTabAuth.ts` (frontend orchestration), `src-tauri/src/oauth/monitor.rs` (token refresh monitor)

## What you need to know

I support two OAuth providers: **Gmail** (fully working) and **Microsoft Graph** (backend done, frontend pending). The flow uses PKCE so there's no client secret to manage. All token exchange happens in Rust via `reqwest` — no CORS nonsense to deal with. Tokens get encrypted with AES-256-GCM before hitting SQLite.

## Supported providers

| Provider        | Auth URL                                                         | Token URL                                                    | Scopes                                          | Status                             |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------- |
| Gmail API       | `https://accounts.google.com/o/oauth2/v2/auth`                   | `https://oauth2.googleapis.com/token`                        | Gmail + Calendar + User                         | ✅ Complete                        |
| Microsoft Graph | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | `https://login.microsoftonline.com/common/oauth2/v2.0/token` | Mail.Read, Mail.Send, User.Read, Calendars.Read | ⚠️ Backend ready, frontend pending |

## How the flow works

### Desktop (localhost server) flow

1. **`start_oauth_server`** — binds localhost on ports 17248–17251, returns a redirect URL
2. **User authorizes in browser** — localhost server captures `?code=` from the redirect
3. **`oauth_exchange_token`** — POSTs the code + PKCE verifier to the token endpoint via `reqwest` (Rust HTTP, so no CORS)
4. **`oauth_refresh_token`** — POSTs the refresh token to get a new access token

### Desktop + Mobile (custom tab) flow

1. **`start_oauth_browser`** — launches system browser (desktop: `tauri-plugin-opener`, mobile: native Custom Tab via `tauri-plugin-deep-link`)
2. **`start_custom_tab_auth()`** (frontend, `customTabAuth.ts`) — tries custom-tab flow first, falls back to localhost listener
3. Deep-link callback: `smemaster-auth://` scheme handled by Rust OAuth module
4. Token exchange + encryption same as desktop flow

## Key design decisions

- **Rust HTTP for token exchange**, not browser redirect. This completely avoids CORS issues. No proxy, no workaround, just direct POSTs.
- **PKCE flow** — no client secret required. One less thing to leak.
- **Desktop app OAuth 2.0 credentials** from Google Cloud Console.
- **Tokens encrypted** with AES-256-GCM in local SQLite via `db::crypto::{encrypt_value, decrypt_value}`.
- **Token refresh monitor:** `OAuthTokenMonitor` checks and auto-refreshes at startup via `check_and_refresh`.

## Commands

| Command                | Params                                         | Returns                 |
| ---------------------- | ---------------------------------------------- | ----------------------- |
| `start_oauth_server`   | —                                              | `String` (redirect URL) |
| `start_oauth_browser`  | `url: String`                                  | `()`                    |
| `oauth_exchange_token` | `client_id, code, code_verifier, redirect_uri` | `OAuthTokenResponse`    |
| `oauth_refresh_token`  | `client_id, refresh_token`                     | `OAuthTokenResponse`    |
