import { useSyncStore } from "@shared/stores/syncStore";
import { useThreadStore as useThreadsStore } from "@features/mail/stores/threadStore";
import { getEmailProvider } from "@features/mail/services/email/providerFactory";
import { enqueuePendingOperation } from "@features/settings/db/pendingOperations";
import { classifyError } from "@shared/utils/networkErrors";
import {
  updateThreadFlags,
  addThreadLabel as dbAddThreadLabel,
  removeThreadLabel as dbRemoveThreadLabel,
  deleteThread,
} from "@shared/services/db/db-invoke";
import { navigateToThread, getSelectedThreadId } from "@/router/navigate";

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type EmailAction =
  | { type: "archive"; threadId: string; messageIds: string[] }
  | { type: "trash"; threadId: string; messageIds: string[] }
  | { type: "permanentDelete"; threadId: string; messageIds: string[] }
  | {
      type: "markRead";
      threadId: string;
      messageIds: string[];
      read: boolean;
    }
  | {
      type: "star";
      threadId: string;
      messageIds: string[];
      starred: boolean;
    }
  | {
      type: "spam";
      threadId: string;
      messageIds: string[];
      isSpam: boolean;
    }
  | {
      type: "moveToFolder";
      threadId: string;
      messageIds: string[];
      folderPath: string;
    }
  | { type: "addLabel"; threadId: string; labelId: string }
  | { type: "removeLabel"; threadId: string; labelId: string }
  | {
      type: "sendMessage";
      rawBase64Url: string;
      threadId?: string;
    }
  | {
      type: "createDraft";
      rawBase64Url: string;
      threadId?: string;
    }
  | {
      type: "updateDraft";
      draftId: string;
      rawBase64Url: string;
      threadId?: string;
    }
  | { type: "deleteDraft"; draftId: string };

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean;
  queued?: boolean;
  configRequired?: boolean;
  error?: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Optimistic UI helpers
// ---------------------------------------------------------------------------

function getNextThreadId(currentId: string): string | null {
  // Only auto-advance if the removed thread is the one being viewed
  const selectedId = getSelectedThreadId();
  if (selectedId !== currentId) return null;
  const { threads } = useThreadsStore.getState();
  const idx = threads.findIndex((t) => t.id === currentId);
  if (idx === -1) return null;
  // Prefer next thread, fall back to previous
  const next = threads[idx + 1];
  if (next) return next.id;
  const prev = threads[idx - 1];
  if (prev) return prev.id;
  return null;
}

function applyOptimisticUpdate(action: EmailAction): void {
  const store = useThreadsStore.getState();
  switch (action.type) {
    case "archive":
    case "trash":
    case "spam":
    case "moveToFolder": {
      const nextId = getNextThreadId(action.threadId);
      // Stash the thread instead of plain removal so we can restore it if the
      // operation fails or is reverted before the next sync.
      store.stashThread(action.threadId);
      store.markThreadPending(action.threadId);
      if (nextId) {
        navigateToThread(nextId);
      }
      break;
    }
    case "permanentDelete": {
      // Permanent deletes are destructive; we still remove the thread but do
      // not stash. The next sync will be the authoritative source of truth.
      const nextId = getNextThreadId(action.threadId);
      store.removeThread(action.threadId);
      if (nextId) {
        navigateToThread(nextId);
      }
      break;
    }
    case "markRead":
      store.updateThread(action.threadId, { isRead: action.read });
      break;
    case "star":
      store.updateThread(action.threadId, { isStarred: action.starred });
      break;
    case "addLabel":
    case "removeLabel":
    case "sendMessage":
    case "createDraft":
    case "updateDraft":
    case "deleteDraft":
      // No universal optimistic update for these
      break;
  }
}

function revertOptimisticUpdate(action: EmailAction): void {
  const store = useThreadsStore.getState();
  switch (action.type) {
    case "markRead":
      store.updateThread(action.threadId, { isRead: !action.read });
      break;
    case "star":
      store.updateThread(action.threadId, { isStarred: !action.starred });
      break;
    case "archive":
    case "trash":
    case "spam":
    case "moveToFolder":
      // Restore the thread from the stash. The next sync will re-apply any
      // server-side changes, so this is safe.
      store.unstashThread(action.threadId);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Local DB updates (so offline reads reflect changes)
// ---------------------------------------------------------------------------

async function applyLocalDbUpdate(
  accountId: string,
  action: EmailAction,
): Promise<void> {
  switch (action.type) {
    case "markRead":
      await updateThreadFlags(accountId, action.threadId, action.read);
      // Notify other tabs/listeners (browser only). In non-DOM contexts
      // (Node test env, SSR) there is no `window`; skip silently.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("smemaster-sync-done"));
      }
      break;
    case "star":
      await updateThreadFlags(
        accountId,
        action.threadId,
        undefined,
        action.starred,
      );
      if (action.starred) {
        await dbAddThreadLabel(accountId, action.threadId, "STARRED");
      } else {
        await dbRemoveThreadLabel(accountId, action.threadId, "STARRED");
      }
      break;
    case "archive":
      await dbRemoveThreadLabel(accountId, action.threadId, "INBOX");
      break;
    case "trash":
      await dbRemoveThreadLabel(accountId, action.threadId, "INBOX");
      await dbAddThreadLabel(accountId, action.threadId, "TRASH");
      break;
    case "permanentDelete":
      await deleteThread(accountId, action.threadId);
      break;
    case "spam":
      if (action.isSpam) {
        await dbRemoveThreadLabel(accountId, action.threadId, "INBOX");
        await dbAddThreadLabel(accountId, action.threadId, "SPAM");
      } else {
        await dbRemoveThreadLabel(accountId, action.threadId, "SPAM");
        await dbAddThreadLabel(accountId, action.threadId, "INBOX");
      }
      break;
    case "addLabel":
      await dbAddThreadLabel(accountId, action.threadId, action.labelId);
      break;
    case "removeLabel":
      await dbRemoveThreadLabel(accountId, action.threadId, action.labelId);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

function getResourceId(action: EmailAction): string {
  if ("threadId" in action && action.threadId) return action.threadId;
  if ("draftId" in action) return action.draftId;
  return crypto.randomUUID();
}

function actionToParams(action: EmailAction): Record<string, unknown> {
  // Strip the type field — it's stored separately as operation_type
  const { type: _, ...rest } = action;
  return rest;
}

async function executeViaProvider(
  accountId: string,
  action: EmailAction,
): Promise<unknown> {
  const provider = await getEmailProvider(accountId);
  switch (action.type) {
    case "archive":
      return provider.archive(action.threadId, action.messageIds);
    case "trash":
      return provider.trash(action.threadId, action.messageIds);
    case "permanentDelete":
      return provider.permanentDelete(action.threadId, action.messageIds);
    case "markRead":
      return provider.markRead(
        action.threadId,
        action.messageIds,
        action.read,
      );
    case "star":
      return provider.star(
        action.threadId,
        action.messageIds,
        action.starred,
      );
    case "spam":
      return provider.spam(
        action.threadId,
        action.messageIds,
        action.isSpam,
      );
    case "moveToFolder":
      return provider.moveToFolder(
        action.threadId,
        action.messageIds,
        action.folderPath,
      );
    case "addLabel":
      return provider.addLabel(action.threadId, action.labelId);
    case "removeLabel":
      return provider.removeLabel(action.threadId, action.labelId);
    case "sendMessage":
      return provider.sendMessage(action.rawBase64Url, action.threadId);
    case "createDraft":
      return provider.createDraft(action.rawBase64Url, action.threadId);
    case "updateDraft":
      return provider.updateDraft(
        action.draftId,
        action.rawBase64Url,
        action.threadId,
      );
    case "deleteDraft":
      return provider.deleteDraft(action.draftId);
  }
}

export async function executeEmailAction(
  accountId: string,
  action: EmailAction,
): Promise<ActionResult> {
  // 1. Optimistic UI update
  applyOptimisticUpdate(action);

  // 2. Local DB update
  try {
    await applyLocalDbUpdate(accountId, action);
  } catch (err) {
    console.warn("Local DB update failed:", err);
    // A failed local DB update means the optimistic state is not reflected in
    // the database. Revert the UI so it stays consistent with the DB.
    revertOptimisticUpdate(action);
    return { success: false, error: "Local update failed" };
  }

  // Helper: threadId is only present on actions that affect a thread.
  const threadId = "threadId" in action ? action.threadId : undefined;

  // 3. If offline, queue and mark the thread as pending
  if (!useSyncStore.getState().isOnline) {
    if (threadId) {
      useThreadsStore.getState().markThreadPending(threadId);
    }
    await enqueuePendingOperation(
      accountId,
      action.type,
      getResourceId(action),
      actionToParams(action),
    );
    return { success: true, queued: true };
  }

  // 4. Try online execution
  try {
    const data = await executeViaProvider(accountId, action);
    // Server confirmed the action. The thread is no longer pending.
    if (threadId) {
      useThreadsStore.getState().unmarkThreadPending(threadId);
      // Remove any stashed copy so it doesn't reappear on the next sync.
      useThreadsStore.getState().stashedThreads.delete(threadId);
    }
    return { success: true, data };
  } catch (err) {
    const classified = classifyError(err);

    if (classified.isRetryable) {
      // Queue for retry; keep the thread pending so the UI reflects the
      // in-flight state.
      if (threadId) {
        useThreadsStore.getState().markThreadPending(threadId);
      }
      await enqueuePendingOperation(
        accountId,
        action.type,
        getResourceId(action),
        actionToParams(action),
      );
      return { success: true, queued: true };
    }

    if (classified.type === "config") {
      // Configuration error (e.g. OAuth not set up) — queue so it can be
      // processed once the user configures the account, and revert UI state.
      revertOptimisticUpdate(action);
      console.warn(`Email action ${action.type} deferred — missing provider config:`, err);
      await enqueuePendingOperation(
        accountId,
        action.type,
        getResourceId(action),
        actionToParams(action),
      );
      return { success: true, queued: true, configRequired: true };
    }

    // Permanent error — revert optimistic update
    revertOptimisticUpdate(action);
    console.error(`Email action ${action.type} failed permanently:`, err);
    return { success: false, error: classified.message };
  }
}

// ---------------------------------------------------------------------------
// Execute a queued operation (used by queue processor)
// ---------------------------------------------------------------------------

export async function executeQueuedAction(
  accountId: string,
  operationType: string,
  params: Record<string, unknown>,
): Promise<void> {
  const action = { type: operationType, ...params } as EmailAction;
  await executeViaProvider(accountId, action);
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

export function archiveThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "archive",
    threadId,
    messageIds,
  });
}

export function trashThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "trash",
    threadId,
    messageIds,
  });
}

export function permanentDeleteThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "permanentDelete",
    threadId,
    messageIds,
  });
}

export function markThreadRead(
  accountId: string,
  threadId: string,
  messageIds: string[],
  read: boolean,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "markRead",
    threadId,
    messageIds,
    read,
  });
}

export function starThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
  starred: boolean,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "star",
    threadId,
    messageIds,
    starred,
  });
}

export function spamThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
  isSpam: boolean,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "spam",
    threadId,
    messageIds,
    isSpam,
  });
}

export function moveThread(
  accountId: string,
  threadId: string,
  messageIds: string[],
  folderPath: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "moveToFolder",
    threadId,
    messageIds,
    folderPath,
  });
}

export function addThreadLabel(
  accountId: string,
  threadId: string,
  labelId: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "addLabel",
    threadId,
    labelId,
  });
}

export function removeThreadLabel(
  accountId: string,
  threadId: string,
  labelId: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "removeLabel",
    threadId,
    labelId,
  });
}

export async function sendEmail(
  accountId: string,
  rawBase64Url: string,
  threadId?: string,
): Promise<ActionResult> {
  const result = await executeEmailAction(accountId, {
    type: "sendMessage",
    rawBase64Url,
    threadId,
  });

  // Notify the UI to refresh (so sent message appears in Sent folder).
  // Guard for non-DOM contexts (Node test env, SSR) where `window` is absent.
  if (result.success && typeof window !== "undefined") {
    window.dispatchEvent(new Event("smemaster-sync-done"));
  }

  return result;
}

export function createDraft(
  accountId: string,
  rawBase64Url: string,
  threadId?: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "createDraft",
    rawBase64Url,
    threadId,
  });
}

export function updateDraft(
  accountId: string,
  draftId: string,
  rawBase64Url: string,
  threadId?: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, {
    type: "updateDraft",
    draftId,
    rawBase64Url,
    threadId,
  });
}

export function deleteDraft(
  accountId: string,
  draftId: string,
): Promise<ActionResult> {
  return executeEmailAction(accountId, { type: "deleteDraft", draftId });
}

