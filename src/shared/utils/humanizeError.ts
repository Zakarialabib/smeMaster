/**
 * Maps structured error codes from Rust's SerializedError to user-friendly messages.
 * Used by all notification toasts and error dialogs so users never see raw error codes.
 */

export interface HumanizedError {
  title: string;
  body: string;
  canRetry: boolean;
  severity: "error" | "warning" | "info";
  /** Original error code, useful for support/debug */
  code?: string;
}

export type ErrorCode =
  | "ERR_NETWORK"
  | "ERR_TIMEOUT"
  | "ERR_AUTH"
  | "ERR_NOT_FOUND"
  | "ERR_VALIDATION"
  | "ERR_RATE_LIMIT"
  | "ERR_CONFIG"
  | "ERR_DATABASE"
  | "ERR_DB_CORRUPT"
  | "ERR_FILE_IO"
  | "ERR_INVALID_INPUT"
  | "ERR_PERMISSION"
  | "ERR_CRYPTO"
  | "ERR_OAUTH"
  | "ERR_IMAP"
  | "ERR_SMTP"
  | "ERR_UNKNOWN";

const ERROR_MESSAGES: Record<
  ErrorCode,
  { title: string; body: string; canRetry: boolean; severity: HumanizedError["severity"] }
> = {
  ERR_NETWORK: {
    title: "Network error",
    body: "Couldn't connect to the server. Check your internet connection and try again.",
    canRetry: true,
    severity: "error",
  },
  ERR_TIMEOUT: {
    title: "Request timed out",
    body: "The server took too long to respond. Please try again.",
    canRetry: true,
    severity: "warning",
  },
  ERR_AUTH: {
    title: "Authentication failed",
    body: "Your username or password is incorrect, or your session has expired. Please sign in again.",
    canRetry: false,
    severity: "error",
  },
  ERR_NOT_FOUND: {
    title: "Not found",
    body: "The item you're looking for doesn't exist or has been deleted.",
    canRetry: false,
    severity: "info",
  },
  ERR_VALIDATION: {
    title: "Invalid input",
    body: "Some of the information you provided isn't valid. Please check your entries and try again.",
    canRetry: false,
    severity: "warning",
  },
  ERR_RATE_LIMIT: {
    title: "Too many requests",
    body: "You're going a bit too fast. Please wait a moment and try again.",
    canRetry: true,
    severity: "warning",
  },
  ERR_CONFIG: {
    title: "Configuration needed",
    body: "Some settings are missing. Please check your account configuration in Settings.",
    canRetry: false,
    severity: "warning",
  },
  ERR_DATABASE: {
    title: "Database error",
    body: "Something went wrong with the local database. Please try again.",
    canRetry: true,
    severity: "error",
  },
  ERR_DB_CORRUPT: {
    title: "Database corrupted",
    body: "The local database appears to be corrupted. You may need to restore from a backup.",
    canRetry: false,
    severity: "error",
  },
  ERR_FILE_IO: {
    title: "File error",
    body: "We couldn't read or write a file. Please check permissions and try again.",
    canRetry: true,
    severity: "error",
  },
  ERR_INVALID_INPUT: {
    title: "Invalid input",
    body: "The values you entered are not valid. Please check and try again.",
    canRetry: false,
    severity: "warning",
  },
  ERR_PERMISSION: {
    title: "Permission denied",
    body: "You don't have permission to perform this action.",
    canRetry: false,
    severity: "error",
  },
  ERR_CRYPTO: {
    title: "Encryption error",
    body: "Something went wrong while encrypting or decrypting. Please check your encryption keys.",
    canRetry: false,
    severity: "error",
  },
  ERR_OAUTH: {
    title: "Sign-in failed",
    body: "We couldn't sign you in with your account. Please try again or use a different sign-in method.",
    canRetry: true,
    severity: "error",
  },
  ERR_IMAP: {
    title: "Email server error",
    body: "The email server returned an error. Please check your account settings or try again later.",
    canRetry: true,
    severity: "error",
  },
  ERR_SMTP: {
    title: "Send failed",
    body: "Your email couldn't be sent. Please check your outgoing mail settings.",
    canRetry: true,
    severity: "error",
  },
  ERR_UNKNOWN: {
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again, and if the problem persists, restart the app.",
    canRetry: true,
    severity: "error",
  },
};

export function humanizeError(
  error: unknown,
  fallback: ErrorCode = "ERR_UNKNOWN",
): HumanizedError {
  // Extract code from a SerializedError-like object
  let code: string | undefined;
  let rawMessage: string | undefined;

  if (typeof error === "object" && error !== null) {
    const e = error as { code?: unknown; message?: unknown; error?: unknown };
    if (typeof e.code === "string") code = e.code;
    if (typeof e.message === "string") rawMessage = e.message;
    else if (typeof e.error === "string") rawMessage = e.error;
  } else if (typeof error === "string") {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  }

  const known = ERROR_MESSAGES[code as ErrorCode] ?? ERROR_MESSAGES[fallback];
  return {
    ...known,
    code,
    body: rawMessage && code && !ERROR_MESSAGES[code as ErrorCode] ? rawMessage : known.body,
  };
}
