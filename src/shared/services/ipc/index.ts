/**
 * IPC Module - Type-safe Tauri command invocation
 *
 * Public API for IPC operations. Centralizes all Tauri invoke calls
 * with type safety and automatic logging.
 *
 * Usage:
 *   import { invoke, hasCommand, listCommands } from "@shared/services/ipc";
 *   const tasks = await invoke("db_list_tasks", { accountId: null });
 */

export {
  invoke,
  safeInvoke,
  hasCommand,
  listCommands,
  isTauriEnvironment,
  TauriUnavailableError,
  type InvokeOptions,
  type CommandName,
  type CommandParams,
  type CommandResult,
  TauriCommands,
} from "./invoke";

/**
 * Environment-safe Tauri event subscription (no-op outside a Tauri shell).
 * Lives in its own module so importing it never pulls in the invoke stack.
 */
export { safeListen } from "./safeListen";
