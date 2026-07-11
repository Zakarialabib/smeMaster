import { useEffect, useState } from "react";
import { ThreadView } from "./features/mail/components/ThreadView";
import { Composer } from "./features/mail/components/composer/Composer";
import { UndoSendToast } from "./features/mail/components/composer/UndoSendToast";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useWindowInit } from "@shared/hooks/useWindowInit";
import { getThreadById, getThreadLabelIds } from "./shared/services/db/threads";
import type { Thread } from "./features/mail/stores/threadStore";

export default function ThreadWindow() {
  const { loading: initLoading, error: initError } = useWindowInit({ skipClients: true });
  const [thread, setThread] = useState<Thread | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread");
    const accountId = params.get("account");

    if (!threadId || !accountId) {
      setFetchError("Missing thread or account parameter");
      setFetchDone(true);
      return;
    }

    async function fetchThread() {
      try {
        // Set active account to the thread's account (without persisting to settings)
        useAccountStore.setState({ activeAccountId: accountId! });

        const dbThread = await getThreadById(accountId!, threadId!);
        if (!dbThread) {
          setFetchError("Thread not found");
          setFetchDone(true);
          return;
        }

        const labelIds = await getThreadLabelIds(accountId!, threadId!);
        setThread({
          id: dbThread.id,
          accountId: dbThread.account_id,
          subject: dbThread.subject,
          snippet: dbThread.snippet,
          lastMessageAt: dbThread.last_message_at ?? 0,
          messageCount: dbThread.message_count,
          isRead: dbThread.is_read === 1,
          isStarred: dbThread.is_starred === 1,
          isPinned: dbThread.is_pinned === 1,
          isMuted: dbThread.is_muted === 1,
          hasAttachments: dbThread.has_attachments === 1,
          labelIds,
          fromName: dbThread.from_name,
          fromAddress: dbThread.from_address,
        });
      } catch (err) {
        console.error("Failed to initialize thread window:", err);
        setFetchError("Failed to load thread");
      }
      setFetchDone(true);
    }

    fetchThread();
  }, []);

  const loading = initLoading || !fetchDone;
  const displayError = initError ?? fetchError;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <span className="text-sm">Loading thread...</span>
      </div>
    );
  }

  if (displayError || !thread) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <span className="text-sm">{displayError ?? "Thread not found"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      <ThreadView thread={thread} />
      <Composer />
      <UndoSendToast />
    </div>
  );
}
