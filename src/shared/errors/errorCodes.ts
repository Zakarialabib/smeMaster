// Machine-readable error codes matching Rust SerializedError codes
export const ErrorCodes = {
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  AUTH_FAILED: "AUTH_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_IO_ERROR: "FILE_IO_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  NOT_FOUND: "NOT_FOUND",
  TIMEOUT: "TIMEOUT",
  RESOURCE_BUSY: "RESOURCE_BUSY",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface SerializedError {
  code: ErrorCode;
  message: string;
  details?: string;
  // Runtime-only: the original error for fallback (when error is still a plain string)
  original?: unknown;
}

/**
 * Normalize any caught error into a SerializedError.
 * Handles both new SerializedError format and legacy string errors.
 */
export function normalizeError(err: unknown): SerializedError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    // Already a structured error
    return err as SerializedError;
  }

  // Legacy string error — try to parse into structured form
  const msg = String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return { code: ErrorCodes.TIMEOUT, message: msg };
  }
  if (lower.includes("connection") || lower.includes("tcp") || lower.includes("econnrefused")) {
    return { code: ErrorCodes.CONNECTION_TIMEOUT, message: msg };
  }
  if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("credentials")) {
    return { code: ErrorCodes.AUTH_FAILED, message: msg };
  }
  if (lower.includes("dns") || lower.includes("network") || lower.includes("socket")) {
    return { code: ErrorCodes.NETWORK_ERROR, message: msg };
  }
  if (lower.includes("not found") || lower.includes("no such")) {
    return { code: ErrorCodes.NOT_FOUND, message: msg };
  }
  if (lower.includes("parse") || lower.includes("invalid")) {
    return { code: ErrorCodes.PARSE_ERROR, message: msg };
  }
  if (lower.includes("busy") || lower.includes("locked")) {
    return { code: ErrorCodes.RESOURCE_BUSY, message: msg };
  }

  return { code: ErrorCodes.INTERNAL_ERROR, message: msg, original: err };
}

/**
 * Check if an error indicates a connection failure.
 * Uses structured error codes instead of string matching.
 */
export function isConnectionError(err: unknown): boolean {
  const normalized = normalizeError(err);
  return (
    normalized.code === ErrorCodes.CONNECTION_TIMEOUT ||
    normalized.code === ErrorCodes.NETWORK_ERROR ||
    normalized.code === ErrorCodes.TIMEOUT
  );
}

/**
 * Check if an error indicates a database busy/locked condition.
 */
export function isBusyError(err: unknown): boolean {
  const normalized = normalizeError(err);
  return normalized.code === ErrorCodes.RESOURCE_BUSY;
}
