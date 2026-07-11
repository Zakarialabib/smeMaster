/**
 * Type-Safe Tauri IPC Invoke Wrapper
 *
 * Wraps Tauri's invoke with:
 *   - Type-safe command names, params, and return values via CommandRegistry
 *   - Automatic logging of all IPC requests, responses, and errors
 *   - Configurable timeouts to prevent infinite hangs
 *   - Sensitive payload redaction
 *
 * Usage:
 *   import { invoke } from "@shared/services/ipc";
 *   const tasks = await invoke("db_list_tasks", { accountId: null });
 *   // ^-- compile error if command name is wrong
 *   // ^-- type-checked params and result
 *   // ^-- automatically logged to backend buffer
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { logger } from "@shared/services/logger";
import { TauriCommands, type CommandName, type CommandParams, type CommandResult, type SubsystemStatusResponse } from "./CommandRegistry";

// Re-export types for convenience
export type { CommandName, CommandParams, CommandResult };
export { TauriCommands };

/**
 * Default timeout for IPC operations (30s).
 * Prevents infinite hangs in production.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Commands whose payloads contain sensitive data (PII, secrets, etc.)
 * These will be redacted in logs.
 */
const SENSITIVE_COMMANDS: ReadonlySet<string> = new Set([
  "store_secure_data",
  "get_secure_data",
  "activate_license",
  "validate_license",
]);

/**
 * Redact sensitive fields from a payload before logging.
 */
function redactPayload(command: string, payload: unknown): unknown {
  if (!SENSITIVE_COMMANDS.has(command) || !payload || typeof payload !== "object") {
    return payload;
  }

  const p = payload as Record<string, unknown>;
  const redacted = { ...p };

  for (const key of ["data", "value", "key", "license_key", "password"]) {
    if (key in redacted) {
      redacted[key] = "<redacted>";
    }
  }

  return redacted;
}

/**
 * Options for invoke calls.
 */
export interface InvokeOptions {
  /** Enable automatic logging to backend log buffer. Defaults to true. */
  log?: boolean;
  /** Disable console output for this call. Defaults to false. */
  silent?: boolean;
  /** Custom timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

/**
 * Extract a human-readable message from an unknown error value.
 * Handles Tauri v2 serialized errors (plain objects with `message`),
 * standard Error instances, and fallback string coercion.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    // Tauri v2 sends serialized errors as objects with `message`, `code`, etc.
    if ('message' in err) {
      const msg = (err as Record<string, unknown>).message;
      return typeof msg === 'string' ? msg : JSON.stringify(msg);
    }
    // If it's a plain object, stringify it
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * Type-safe wrapper around Tauri's invoke.
 *
 * Provides:
 *   - Compile-time validation of command names, params, and return types
 *   - Automatic logging via the shared logger (in-memory ring buffer)
 *   - 30s default timeout to prevent hangs
 *   - Sensitive payload redaction
 *
 * @example
 *   const tasks = await invoke("db_list_tasks", { accountId: null, isCompleted: false });
 *   // tasks is unknown[] (per registry) - cast or narrow as needed
 *
 * @example
 *   // Disable logging for noisy polling
 *   const tasks = await invoke("db_list_tasks", { accountId: null }, { log: false });
 */
export async function invoke<C extends CommandName>(
  command: C,
  params: CommandParams<C>,
  options: InvokeOptions = {},
): Promise<CommandResult<C>> {
  const {
    log: shouldLog = true,
    silent = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const startTime = performance.now();
  const redactedParams = redactPayload(command, params);

  if (shouldLog) {
    logger.debug(`IPC → ${command}`, "ipc", redactedParams);
  }

  try {
    if (typeof tauriInvoke !== "function") {
      throw new Error(`Tauri invoke is not available in this environment. Attempted: ${command}`);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`IPC timeout after ${timeoutMs}ms: ${command}`)),
        timeoutMs,
      );
    });

    const result = (await Promise.race([
      tauriInvoke(command, params as Record<string, unknown>),
      timeoutPromise,
    ])) as CommandResult<C>;

    const elapsed = Math.round(performance.now() - startTime);

    if (shouldLog) {
      logger.debug(`IPC ← ${command} (${elapsed}ms)`, "ipc", { elapsed });
    }

    return result;
  } catch (err) {
    const elapsed = Math.round(performance.now() - startTime);
    const errorMessage = extractErrorMessage(err);

    // Always log errors to the backend (even when shouldLog=false for other levels)
    // This is critical for the Logs tab in Developer settings.
    logger.error(
      `IPC ✗ ${command} (${elapsed}ms): ${errorMessage}`,
      "ipc",
      {
        command,
        params: redactedParams,
        elapsed,
        error: err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : typeof err === 'object' && err !== null
            ? Object.fromEntries(Object.entries(err as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
            : { value: String(err) },
      },
    );

    if (!silent) {
      console.error(`[IPC] ${command} failed:`, err);
    }

    throw err;
  }
}

/**
 * Fetch the status of all subsystems.
 * Returns an array of SubsystemStatusResponse objects.
 */
export async function getSubsystemStatus(): Promise<SubsystemStatusResponse[]> {
  return invoke("get_subsystem_status", {});
}

/**
 * Complete onboarding and transition system to Ready state.
 * Called when the frontend onboarding wizard completes.
 */
export async function completeOnboarding(): Promise<void> {
  return invoke("complete_onboarding", {});
}

/**
 * Get all tool states from the ToolRegistry.
 * Returns a list of (tool_id, enabled) tuples.
 */
export async function getToolState(): Promise<[string, boolean][]> {
  return invoke("get_tool_state", {});
}

/**
 * Apply tool state changes.
 * Takes a list of (tool_id, enabled) tuples and updates the registry.
 */
export async function applyToolState(updates: [string, boolean][]): Promise<void> {
  return invoke("apply_tool_state", { updates });
}

/**
 * Check if a command is registered in the registry.
 * Useful for feature-detection or graceful degradation.
 */
export function hasCommand(command: string): command is CommandName {
  return command in TauriCommands;
}

/**
 * Get the list of all registered command names.
 * Useful for debugging and developer tooling.
 */
export function listCommands(): CommandName[] {
  return Object.keys(TauriCommands) as CommandName[];
}

