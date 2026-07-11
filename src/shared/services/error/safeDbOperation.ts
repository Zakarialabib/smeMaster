/**
 * Shared safe DB operation utility.
 *
 * Provides:
 * - `safeDbOperation` — wraps any DB operation with try-catch, returning a structured result
 * - `DbResult<T>` — typed result with success/error state and user-friendly messages
 * - `getUserFriendlyErrorMessage` — maps raw errors to actionable strings
 * - `extractTechnicalError` — converts any thrown value to a string
 *
 * Every create/update/delete operation in any feature should use `safeDbOperation`
 * to guarantee consistent error surfacing.
 */

/**
 * Structured result from a safe DB operation.
 */
export type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; technical?: string };

/**
 * Options for safeDbOperation.
 */
export interface SafeDbOptions {
  /** Label for the operation (e.g. "create campaign", "update task") — used in error messages. */
  operationLabel: string;
  /** If true, re-throws the error after logging (for callers that want to handle it). */
  rethrow?: boolean;
}

/**
 * Wraps an async DB operation with consistent try-catch.
 *
 * Returns a typed DbResult so callers can pattern-match or use .success / .error.
 * Every error is logged to console and mapped to a user-friendly message.
 *
 * @example
 * ```ts
 * const result = await safeDbOperation(() => insertTask({ title: "Foo" }), {
 *   operationLabel: "create task",
 * });
 * if (!result.success) {
 *   notify("Failed to create task", result.error);
 *   return;
 * }
 * // result.data is the created task ID
 * ```
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  options: SafeDbOptions,
): Promise<DbResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (err) {
    const technical = extractTechnicalError(err);
    const userMessage = getUserFriendlyErrorMessage(err, options.operationLabel);
    console.error(`[safeDb] ${options.operationLabel} failed:`, technical);

    if (options.rethrow) {
      throw err;
    }

    return {
      success: false,
      error: userMessage,
      technical,
    };
  }
}

/**
 * Extract a technical error string from any thrown value — handles
 * Error instances, literal objects, strings, and non-serializable values.
 * NEVER returns "[object Object]" — always a meaningful string.
 */
export function extractTechnicalError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (err && typeof err === "object") {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? "Unknown error");
}

/**
 * Maps a raw thrown value to a user-friendly message for a given operation.
 *
 * Handles common patterns:
 * - Tauri IPC errors ("invoke", "backend", "database")
 * - Validation errors ("required", "invalid", "too long")
 * - Network/connection errors ("fetch", "network", "timeout")
 * - Permission errors
 * - Generic fallback with truncated technical detail
 */
export function getUserFriendlyErrorMessage(
  err: unknown,
  operationLabel: string,
): string {
  const technical = extractTechnicalError(err);
  const lower = technical.toLowerCase();

  // Tauri / IPC / backend errors
  if (
    lower.includes("invoke") ||
    lower.includes("backend") ||
    lower.includes("ipc") ||
    lower.includes("nnerror") ||
    lower.includes("rust") ||
    lower.includes("command")
  ) {
    return `Could not ${operationLabel} because the database is unavailable. Please check your connection and try again.`;
  }

  // Constraint / validation errors
  if (
    lower.includes("unique") ||
    lower.includes("duplicate") ||
    lower.includes("already exists")
  ) {
    return `Cannot ${operationLabel}: a record with this information already exists.`;
  }

  if (
    lower.includes("required") ||
    lower.includes("cannot be null") ||
    lower.includes("not null")
  ) {
    return `Cannot ${operationLabel}: some required fields are missing.`;
  }

  if (
    lower.includes("foreign key") ||
    lower.includes("not found") ||
    lower.includes("no such record")
  ) {
    return `Cannot ${operationLabel}: the referenced item no longer exists. It may have been deleted.`;
  }

  if (
    lower.includes("too long") ||
    lower.includes("max length") ||
    lower.includes("character varying")
  ) {
    return `Cannot ${operationLabel}: one of the fields exceeds the maximum allowed length.`;
  }

  // Network / connection
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("econn") ||
    lower.includes("enotfound")
  ) {
    return `Could not ${operationLabel} due to a network error. Please check your connection.`;
  }

  // Permission
  if (
    lower.includes("permission") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("not allowed")
  ) {
    return `Cannot ${operationLabel}: you don't have permission to perform this action.`;
  }

  // Fallback: include the first portion of the technical message
  const truncated = technical.length > 120 ? technical.slice(0, 120) + "…" : technical;
  return `Failed to ${operationLabel}. ${truncated}`;
}
