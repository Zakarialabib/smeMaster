import { invokeCommand } from "@shared/services/db/invoke/command";

/**
 * Emit an EmailReceived event to the Rust EventBus.
 * Called after new messages are successfully stored from IMAP sync.
 */
export async function emitEmailReceived(
  accountId: string,
  messageId: string,
  fromAddress: string,
  date: number,
): Promise<void> {
  return invokeCommand<void>("emit_domain_event", {
    event: {
      kind: "email:received",
      account_id: accountId,
      message_id: messageId,
      from_address: fromAddress,
      date,
    },
  });
}

/**
 * Emit a ContactUpdated event to the Rust EventBus.
 * Called after a contact is successfully updated.
 */
export async function emitContactUpdated(contactId: string): Promise<void> {
  return invokeCommand<void>("emit_domain_event", {
    event: {
      kind: "contact:updated",
      contact_id: contactId,
    },
  });
}

/**
 * Emit a TaskCompleted event to the Rust EventBus.
 * Called after a task is successfully completed.
 */
export async function emitTaskCompleted(taskId: string): Promise<void> {
  return invokeCommand<void>("emit_domain_event", {
    event: {
      kind: "task:completed",
      task_id: taskId,
    },
  });
}