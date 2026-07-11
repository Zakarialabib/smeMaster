/**
 * ActionStatus — standardized loading/error/success state management.
 *
 * Provides a complete infrastructure for tracking async operation lifecycle:
 * - Zustand store with setStatus / clearStatus / clearCategory / setStatusWithAutoClear
 * - useActionStatus hook with reactive convenience booleans
 * - withActionStatus utility to wrap any async function
 * - EventBus bridge for automatic updates from backend events
 *
 * @example
 * ```ts
 * // Wrap an async function
 * const { execute } = withActionStatus(sendEmail, "send-abc", {
 *   onSuccess: () => toast("Sent!"),
 * });
 *
 * // In a component
 * function SendButton() {
 *   const { isLoading, isError, error } = useActionStatus("send-abc");
 *   return <ActionButton actionId="send-abc" />;
 * }
 * ```
 */

export { useActionStatusStore } from "./actionStatusStore";
export type {
  SetStatusOptions,
  SetStatusWithAutoClearOptions,
} from "./actionStatusStore";

export { useActionStatus } from "./useActionStatus";
export type { UseActionStatusReturn } from "./useActionStatus";

export { withActionStatus } from "./withActionStatus";
export type {
  WithActionStatusOptions,
  WithActionStatusReturn,
} from "./withActionStatus";

export { initActionStatusEventBridge } from "./eventBusBridge";

export type {
  ActionStatus,
  ActionStatusValue,
} from "./types";
