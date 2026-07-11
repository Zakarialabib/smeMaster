import { invokeCommand } from "@shared/services/db/invoke/command";
import { openUrl } from "@tauri-apps/plugin-opener";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_CALLBACK_PORT = 17248;

/** Deep-link redirect URI for the custom-tab OAuth flow */
const DEEP_LINK_REDIRECT_URI = "smemaster-auth://callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

interface OAuthServerResult {
  code: string;
  state: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

/** Matches Rust `TokenExchangeResult` from src-tauri/src/oauth/mod.rs */
interface TokenExchangeResult {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  token_type: string;
  scope: string | null;
  id_token?: string | null;
  expires_at?: number | null;
}

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

/**
 * Full OAuth2 + PKCE flow for Gmail.
 *
 * Uses the system browser (Custom Tabs pattern) with deep-link callback
 * as the primary method. Falls back to localhost TCP listener if the
 * deep-link flow fails.
 *
 * Flow:
 * 1. Try custom-tab flow (system browser + deep-link)
 * 2. On failure, fall back to localhost callback server
 * 3. Exchange code for tokens
 * 4. Fetch user profile
 */
export async function startOAuthFlow(
  clientId: string,
  clientSecret?: string,
): Promise<{ tokens: TokenResponse; userInfo: UserInfo }> {
  if (!clientSecret) {
    throw new Error(
      "Client Secret is not configured. Go to Settings → Google API to add it.",
    );
  }

  // Primary: custom-tab flow (system browser + deep-link)
  try {
    return await startOAuthFlowCustomTab(clientId, clientSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("deep-link") ||
      msg.includes("scheme") ||
      msg.includes("Failed to open browser")
    ) {
      console.warn("[gmail-auth] Custom-tab flow failed, falling back to localhost:", msg);
    } else {
      throw err;
    }
  }

  // Fallback: localhost TCP listener
  return startOAuthFlowLocalhost(clientId, clientSecret);
}

/**
 * Custom-tab OAuth flow: system browser + deep-link callback.
 * Uses `smemaster-auth://callback` as redirect URI.
 */
async function startOAuthFlowCustomTab(
  clientId: string,
  clientSecret: string,
): Promise<{ tokens: TokenResponse; userInfo: UserInfo }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const stateArray = new Uint8Array(32);
  crypto.getRandomValues(stateArray);
  const oauthState = base64UrlEncode(stateArray);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: DEEP_LINK_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    state: oauthState,
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  // Open browser and wait for deep-link callback (Rust handles both)
  const result = await invokeCommand<OAuthServerResult>("start_oauth_browser", {
    authUrl,
    state: oauthState,
  });

  // Validate state (CSRF protection)
  if (result.state !== oauthState) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Please try again.");
  }

  // Exchange auth code for tokens
  const tokens = await exchangeCodeForTokens(
    result.code,
    clientId,
    DEEP_LINK_REDIRECT_URI,
    codeVerifier,
    clientSecret,
  );

  // Fetch user info
  const userInfo = await fetchUserInfo(tokens.access_token);

  return { tokens, userInfo };
}

/**
 * Localhost fallback OAuth flow: TCP server on localhost.
 * This is the original flow, kept for compatibility.
 */
async function startOAuthFlowLocalhost(
  clientId: string,
  clientSecret: string,
): Promise<{ tokens: TokenResponse; userInfo: UserInfo }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Generate random state for CSRF protection
  const stateArray = new Uint8Array(32);
  crypto.getRandomValues(stateArray);
  const oauthState = base64UrlEncode(stateArray);

  const redirectUri = `http://127.0.0.1:${OAUTH_CALLBACK_PORT}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    state: oauthState,
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  // Start the server (it blocks until redirect arrives) and open browser concurrently
  const serverPromise = invokeCommand<OAuthServerResult>("start_oauth_server", {
    port: OAUTH_CALLBACK_PORT,
    state: oauthState,
  });

  // Small delay to let the server bind before opening the browser
  await new Promise((r) => setTimeout(r, 100));
  await openUrl(authUrl);

  // Wait for the redirect
  const result = await serverPromise;

  // Validate state parameter (CSRF protection)
  if (result.state !== oauthState) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Please try again.");
  }

  // Exchange auth code for tokens
  const tokens = await exchangeCodeForTokens(
    result.code,
    clientId,
    redirectUri,
    codeVerifier,
    clientSecret,
  );

  // Fetch user info
  const userInfo = await fetchUserInfo(tokens.access_token);

  return { tokens, userInfo };
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  const result = await invokeCommand<TokenExchangeResult>("oauth_exchange_token", {
    tokenUrl: GOOGLE_TOKEN_URL,
    code,
    clientId,
    redirectUri,
    codeVerifier,
    clientSecret: clientSecret || null,
    scope: SCOPES,
  });

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token ?? undefined,
    expires_in: result.expires_in,
    token_type: result.token_type,
    scope: result.scope || SCOPES,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  const result = await invokeCommand<TokenExchangeResult>("oauth_refresh_token", {
    tokenUrl: GOOGLE_TOKEN_URL,
    refreshToken,
    clientId,
    clientSecret: clientSecret || null,
    scope: null,
  });

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token ?? undefined,
    expires_in: result.expires_in,
    token_type: result.token_type,
    scope: result.scope || SCOPES,
  };
}

async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}
