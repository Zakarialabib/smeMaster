import { invokeCommand } from "@shared/services/db/invoke/command";
import type { OAuthProviderConfig } from "./providers";
import type { TokenResponse, ProviderUserInfo } from "./oauthFlow";

/**
 * Deep-link redirect URI for the custom-tab OAuth flow.
 *
 * This scheme is registered in tauri.conf.json under `plugins.deep-link.desktop.schemes`.
 * The OS will route `smemaster-auth://...` URLs back to the application, and the
 * `tauri-plugin-deep-link` plugin will emit a `deep-link://new-url` event that the
 * Rust `start_oauth_browser` command is listening for.
 */
const DEEP_LINK_REDIRECT_URI = "smemaster-auth://callback";

interface BrowserOAuthResult {
  code: string;
  state: string;
}

// ── PKCE helpers (shared with oauthFlow.ts) ─────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateState(): string {
  const stateArray = new Uint8Array(32);
  crypto.getRandomValues(stateArray);
  return base64UrlEncode(stateArray);
}

// ── Types ───────────────────────────────────────────────────────────────

export interface CustomTabOAuthConfig {
  /** Provider configuration (authUrl, tokenUrl, scopes, etc.) */
  provider: OAuthProviderConfig;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret (optional for PKCE-only providers) */
  clientSecret?: string;
}

export interface CustomTabOAuthResult {
  tokens: TokenResponse;
  userInfo: ProviderUserInfo;
}

// ── Core flow ───────────────────────────────────────────────────────────

/**
 * Build the OAuth authorization URL that redirects to our deep-link scheme
 * instead of localhost.
 *
 * @param provider  Provider configuration
 * @param clientId  OAuth client ID
 * @param state     CSRF state parameter
 * @param codeChallenge  PKCE code challenge (if provider uses PKCE)
 * @returns The fully constructed authorization URL
 */
function buildAuthUrl(
  provider: OAuthProviderConfig,
  clientId: string,
  state: string,
  codeChallenge?: string,
): string {
  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: DEEP_LINK_REDIRECT_URI,
    response_type: "code",
    scope: provider.scopes.join(" "),
    state,
  };

  if (codeChallenge) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = "S256";
  }

  // Provider-specific auth params
  if (provider.id === "microsoft") {
    params.prompt = "consent";
    params.response_mode = "query";
  }

  return `${provider.authUrl}?${new URLSearchParams(params).toString()}`;
}

/**
 * Exchange an authorization code for tokens using the Rust backend
 * (avoids CORS issues, especially for Microsoft).
 */
async function exchangeCode(
  provider: OAuthProviderConfig,
  code: string,
  clientId: string,
  codeVerifier: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  return invokeCommand<TokenResponse>("oauth_exchange_token", {
    tokenUrl: provider.tokenUrl,
    code,
    clientId,
    redirectUri: DEEP_LINK_REDIRECT_URI,
    codeVerifier: provider.usePkce ? codeVerifier : null,
    clientSecret: clientSecret || null,
    scope: provider.id === "microsoft" ? provider.scopes.join(" ") : null,
  });
}

/**
 * Fetch user profile information from the provider.
 */
async function fetchUserInfo(
  provider: OAuthProviderConfig,
  tokens: TokenResponse,
): Promise<ProviderUserInfo> {
  // Microsoft: extract user info from ID token (Graph API not usable with Outlook scopes)
  if (provider.id === "microsoft") {
    if (tokens.id_token) {
      const claims = parseIdToken(tokens.id_token);
      return {
        email: (claims.email as string) || (claims.preferred_username as string) || "",
        name: (claims.name as string) || "",
        picture: undefined,
      };
    }
    return { email: "", name: "", picture: undefined };
  }

  if (!provider.userInfoUrl) {
    throw new Error(`Provider ${provider.id} has no user info endpoint`);
  }

  const response = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${await response.text()}`);
  }

  const data = await response.json();

  // Normalize response across providers
  if (provider.id === "yahoo") {
    return {
      email: data.email || "",
      name: data.name || data.nickname || "",
      picture: data.picture || undefined,
    };
  }

  return {
    email: data.email || "",
    name: data.name || "",
    picture: data.picture || undefined,
  };
}

function parseIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Invalid ID token format");
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

/**
 * Full OAuth2 + PKCE flow using the system browser (Custom Tabs pattern).
 *
 * Flow:
 * 1. Generate PKCE code verifier/challenge and CSRF state
 * 2. Build auth URL with `smemaster-auth://callback` redirect
 * 3. Invoke Rust `start_oauth_browser` which opens the browser and
 *    waits for the deep-link callback event
 * 4. Exchange the authorization code for tokens (via Rust, avoids CORS)
 * 5. Fetch user profile information
 *
 * This is the preferred OAuth method. It avoids port-binding issues
 * and works reliably across platforms.
 *
 * @returns Token response and user info
 */
export async function startCustomTabOAuth(
  config: CustomTabOAuthConfig,
): Promise<CustomTabOAuthResult> {
  const { provider, clientId, clientSecret } = config;

  // 1. Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = provider.usePkce
    ? await generateCodeChallenge(codeVerifier)
    : undefined;

  // 2. Generate CSRF state
  const oauthState = generateState();

  // 3. Build auth URL (deep-link redirect)
  const authUrl = buildAuthUrl(provider, clientId, oauthState, codeChallenge);

  // 4. Open browser and wait for deep-link callback (Rust handles both)
  const result = await invokeCommand<BrowserOAuthResult>("start_oauth_browser", {
    authUrl,
    state: oauthState,
  });

  // 5. Validate state (CSRF protection — Rust also validates, but double-check)
  if (result.state !== oauthState) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Please try again.");
  }

  // 6. Exchange authorization code for tokens
  const tokens = await exchangeCode(
    provider,
    result.code,
    clientId,
    codeVerifier,
    clientSecret,
  );

  // 7. Fetch user profile
  const userInfo = await fetchUserInfo(provider, tokens);

  return { tokens, userInfo };
}
