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
  hasCommand,
  listCommands,
  type InvokeOptions,
  type CommandName,
  type CommandParams,
  type CommandResult,
  TauriCommands,
} from "./invoke";
