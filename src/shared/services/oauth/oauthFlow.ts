import { invokeCommand } from "@shared/services/db/invoke/command";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { OAuthProviderConfig } from "./providers";
import { startCustomTabOAuth } from "./customTabAuth";

const OAUTH_CALLBACK_PORT = 17248;

interface OAuthServerResult {
  code: string;
  state: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
}

export interface ProviderUserInfo {
  email: string;
  name: string;
  picture?: string;
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
 * Start the OAuth2 + PKCE flow for a non-Gmail provider.
 *
 * Uses the system browser (Custom Tabs pattern) with deep-link callback
 * as the primary method. Falls back to localhost TCP listener if the
 * deep-link flow fails (e.g., custom scheme not registered).
 *
 * Flow:
 * 1. Try custom-tab flow (system browser + deep-link callback)
 * 2. On failure, fall back to localhost callback server
 * 3. Exchange code for tokens
 * 4. Fetch user profile info
 */
export async function startProviderOAuthFlow(
  provider: OAuthProviderConfig,
  clientId: string,
  clientSecret?: string,
): Promise<{ tokens: TokenResponse; userInfo: ProviderUserInfo }> {
  // Primary: custom-tab flow (system browser + deep-link)
  try {
    return await startCustomTabOAuth({ provider, clientId, clientSecret });
  } catch (err) {
    // If the error is a deep-link registration issue, fall back to localhost.
    // Other errors (CSRF, timeout, auth denied) should propagate.
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("deep-link") ||
      msg.includes("scheme") ||
      msg.includes("Failed to open browser")
    ) {
      console.warn("[oauth] Custom-tab flow failed, falling back to localhost:", msg);
    } else {
      throw err;
    }
  }

  // Fallback: localhost TCP listener
  return startProviderOAuthFlowLocalhost(provider, clientId, clientSecret);
}

/**
 * Localhost fallback: starts a TCP server on localhost for the OAuth callback.
 * This is the original flow, kept for compatibility.
 */
async function startProviderOAuthFlowLocalhost(
  provider: OAuthProviderConfig,
  clientId: string,
  clientSecret?: string,
): Promise<{ tokens: TokenResponse; userInfo: ProviderUserInfo }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const stateArray = new Uint8Array(32);
  crypto.getRandomValues(stateArray);
  const oauthState = base64UrlEncode(stateArray);

  const redirectUri = `http://localhost:${OAUTH_CALLBACK_PORT}`;

  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider.scopes.join(" "),
    state: oauthState,
  };

  if (provider.usePkce) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = "S256";
  }

  // Provider-specific auth params
  if (provider.id === "microsoft") {
    params.prompt = "consent";
    params.response_mode = "query";
  }

  const authUrl = `${provider.authUrl}?${new URLSearchParams(params).toString()}`;

  const serverPromise = invokeCommand<OAuthServerResult>("start_oauth_server", {
    port: OAUTH_CALLBACK_PORT,
    state: oauthState,
  });

  await new Promise((r) => setTimeout(r, 100));
  await openUrl(authUrl);

  const result = await serverPromise;

  if (result.state !== oauthState) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Please try again.");
  }

  const tokens = await exchangeCode(
    provider,
    result.code,
    clientId,
    redirectUri,
    codeVerifier,
    clientSecret,
  );

  const userInfo = await fetchUserInfo(provider, tokens);

  return { tokens, userInfo };
}

async function exchangeCode(
  provider: OAuthProviderConfig,
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  // Use Rust backend for token exchange to avoid CORS issues (required for Microsoft native client)
  return invokeCommand<TokenResponse>("oauth_exchange_token", {
    tokenUrl: provider.tokenUrl,
    code,
    clientId,
    redirectUri,
    codeVerifier: provider.usePkce ? codeVerifier : null,
    clientSecret: clientSecret || null,
    scope: provider.id === "microsoft" ? provider.scopes.join(" ") : null,
  });
}

/**
 * Refresh an expired access token for a non-Gmail provider.
 */
export async function refreshProviderToken(
  provider: OAuthProviderConfig,
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  // Use Rust backend for token refresh to avoid CORS issues
  return invokeCommand<TokenResponse>("oauth_refresh_token", {
    tokenUrl: provider.tokenUrl,
    refreshToken,
    clientId,
    clientSecret: clientSecret || null,
    scope: provider.id === "microsoft" ? provider.scopes.join(" ") : null,
  });
}

function parseIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Invalid ID token format");
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

async function fetchUserInfo(
  provider: OAuthProviderConfig,
  tokens: TokenResponse,
): Promise<ProviderUserInfo> {
  // Microsoft: extract user info from ID token (can't use Graph API with Outlook scopes)
  if (provider.id === "microsoft") {
    if (tokens.id_token) {
      const claims = parseIdToken(tokens.id_token);
      return {
        email: (claims.email as string) || (claims.preferred_username as string) || "",
        name: (claims.name as string) || "",
        picture: undefined,
      };
    }
    // Fallback if no ID token
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
