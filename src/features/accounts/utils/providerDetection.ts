// ── Provider Detection Utility ──────────────────────────────────────────────
//
// Detects the email provider from a user's email domain and returns the
// appropriate provider type, label, letter badge, and color.
//
// Used by AddAccount.tsx to auto-suggest the best connection method
// (Gmail API, Microsoft Graph, JMAP, or IMAP/SMTP).
// ────────────────────────────────────────────────────────────────────────────

/**
 * The four provider types supported by the app.
 * Matches the `provider` field used in accountStore and the DB schema.
 */
export type ProviderType = "gmail_api" | "microsoft_graph" | "jmap" | "imap";

export interface ProviderInfo {
  /** Internal provider type string */
  type: ProviderType;
  /** Human-readable label for UI display */
  label: string;
  /** Single-letter badge (G / O / I / J) */
  letter: "G" | "O" | "I" | "J";
  /** Tailwind background color class for the badge */
  color: string;
  /** Tailwind text color class for the badge */
  textColor: string;
  /** Optional default IMAP/SMTP settings for known providers */
  imapDefaults?: {
    host: string;
    port: number;
    security: "ssl" | "starttls" | "none";
    smtpHost: string;
    smtpPort: number;
    smtpSecurity: "ssl" | "starttls" | "none";
  };
}

/**
 * Domain-to-provider mapping.
 * Keys are lowercase domain names, values are provider types.
 */
export const PROVIDER_MAP: Record<string, ProviderType> = {
  "gmail.com": "gmail_api",
  "googlemail.com": "gmail_api",
  "outlook.com": "microsoft_graph",
  "hotmail.com": "microsoft_graph",
  "live.com": "microsoft_graph",
  "outlook.fr": "microsoft_graph",
  "outlook.de": "microsoft_graph",
  "office365.com": "microsoft_graph",
  "microsoft.com": "microsoft_graph",
  "yahoo.com": "jmap",
  "ymail.com": "jmap",
  "aol.com": "imap",
};

/**
 * Metadata for each provider type.
 * Colors match the existing TokenStatusBar/AccountSwitcher convention:
 * - Gmail → blue
 * - Microsoft → orange
 * - JMAP → teal
 * - IMAP → purple
 */
export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
  gmail_api: {
    type: "gmail_api",
    label: "Google (Gmail API)",
    letter: "G",
    color: "bg-blue-500/15",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  microsoft_graph: {
    type: "microsoft_graph",
    label: "Microsoft (Graph API)",
    letter: "O",
    color: "bg-orange-500/15",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  jmap: {
    type: "jmap",
    label: "JMAP (FastMail/Yahoo)",
    letter: "J",
    color: "bg-teal-500/15",
    textColor: "text-teal-600 dark:text-teal-400",
  },
  imap: {
    type: "imap",
    label: "IMAP/SMTP",
    letter: "I",
    color: "bg-purple-500/15",
    textColor: "text-purple-600 dark:text-purple-400",
    imapDefaults: {
      host: "imap.example.com",
      port: 993,
      security: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSecurity: "ssl",
    },
  },
};

/**
 * Common provider IMAP defaults for well-known providers.
 * Used when a domain matches a known IMAP provider.
 */
export const PROVIDER_IMAP_DEFAULTS: Partial<
  Record<ProviderType, ProviderInfo["imapDefaults"]>
> = {
  imap: undefined, // generic — no defaults
};

/**
 * Detect the email provider from an email address.
 *
 * @param email - The email address to analyze (e.g. "user@gmail.com")
 * @returns ProviderInfo with the detected provider type, label, letter, and color
 *
 * @example
 * detectProvider("user@gmail.com")    // → { type: "gmail_api", letter: "G", ... }
 * detectProvider("user@outlook.com")  // → { type: "microsoft_graph", letter: "O", ... }
 * detectProvider("user@custom.com")   // → { type: "imap", letter: "I", ... }
 * detectProvider("invalid")           // → { type: "imap", letter: "I", ... }
 */
export function detectProvider(email: string): ProviderInfo {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return PROVIDER_INFO.imap;
  }

  const domain = email.slice(atIndex + 1).toLowerCase().trim();
  if (!domain) {
    return PROVIDER_INFO.imap;
  }

  // Check known domains (exact match)
  const exactMatch = PROVIDER_MAP[domain];
  if (exactMatch) {
    return PROVIDER_INFO[exactMatch];
  }

  // Check for subdomains of known domains (e.g. "mail.custom.com" not matched,
  // but "user@gmail.com" is matched above). For subdomains of known providers
  // like "mail.outlook.com", check if it ends with a known domain.
  for (const [key, type] of Object.entries(PROVIDER_MAP)) {
    if (domain.endsWith("." + key)) {
      return PROVIDER_INFO[type];
    }
  }

  // Unknown or custom domain — default to IMAP/SMTP
  return PROVIDER_INFO.imap;
}
