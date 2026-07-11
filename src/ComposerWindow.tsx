import { useEffect, useState } from "react";
import { Composer } from "./features/mail/components/composer/Composer";
import { UndoSendToast } from "./features/mail/components/composer/UndoSendToast";
import { useComposerStore } from "./features/mail/stores/composerStore";
import { useWindowInit } from "@shared/hooks/useWindowInit";
import type { ComposerMode } from "./features/mail/stores/composerStore";

export default function ComposerWindow() {
  const { loading: initLoading, error: initError } = useWindowInit();
  const [composerReady, setComposerReady] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    async function initComposer() {
      try {
        // Parse composer state from URL params
        const mode = (params.get("mode") as ComposerMode) ?? "new";
        const to = params.get("to")?.split(",").filter(Boolean) ?? [];
        const cc = params.get("cc")?.split(",").filter(Boolean) ?? [];
        const bcc = params.get("bcc")?.split(",").filter(Boolean) ?? [];
        const subject = params.get("subject") ?? "";
        const threadId = params.get("threadId") ?? null;
        const inReplyToMessageId = params.get("inReplyToMessageId") ?? null;
        const draftId = params.get("draftId") ?? null;
        const fromEmail = params.get("fromEmail");

        // Decode base64 body
        let bodyHtml = "";
        const bodyParam = params.get("body");
        if (bodyParam) {
          try {
            bodyHtml = decodeURIComponent(escape(atob(bodyParam)));
          } catch {
            bodyHtml = "";
          }
        }

        // Open composer with parsed state
        useComposerStore.getState().openComposer({
          mode,
          to,
          cc,
          bcc,
          subject,
          bodyHtml,
          threadId,
          inReplyToMessageId,
          draftId,
        });

        // Set fromEmail and force fullpage mode
        if (fromEmail) {
          useComposerStore.getState().setFromEmail(fromEmail);
        }
        useComposerStore.getState().setViewMode("fullpage");
      } catch (err) {
        console.error("Failed to initialize composer window:", err);
        setComposerError("Failed to load composer");
      }
      setComposerReady(true);
    }

    initComposer();
  }, []);

  const loading = initLoading || !composerReady;
  const displayError = initError ?? composerError;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <span className="text-sm">Loading composer...</span>
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <span className="text-sm">{displayError}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      <Composer />
      <UndoSendToast />
    </div>
  );
}
