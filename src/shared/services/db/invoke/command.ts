import { invoke } from '@shared/services/ipc';

/**
 * Typed Tauri command caller.
 * Replaces the per-function `dbInvoke('cmd', args)` boilerplate used
 * throughout the data layer.
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    // Cast to a permissive type to allow any string command. The IPC wrapper
    // provides automatic error logging for any command (registered or not).
    const fn = invoke as unknown as (
      c: string,
      p: Record<string, unknown> | undefined,
      o?: { log?: boolean; silent?: boolean },
    ) => Promise<unknown>;
    const result = await fn(command, args ?? {}, { log: false, silent: true });
    return result as T;
  } catch (err) {
    // err is already a SerializedError from Rust: { code, message, details? }
    // or a plain string/Error from the Tauri IPC layer.
    // Re-throw as-is — callers can check err.code or err.message.
    throw err;
  }
}
