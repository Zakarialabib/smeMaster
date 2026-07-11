import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, RefreshCw, Wand2, Loader2, Check, X } from "lucide-react";
import { isAiAvailable } from "@shared/services/ai/providerManager";
import { generateSmartReplies, polishDraft } from "@shared/services/ai/aiService";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { CenteredLoader } from "@shared/components/ui/CenteredLoader";
import { useRefreshableAiCache } from "@features/mail/hooks/useRefreshableAiCache";
import type { DbMessage } from "@shared/services/db/messages";

interface SmartReplySuggestionsProps {
  threadId: string;
  accountId: string;
  messages: DbMessage[];
  noReply?: boolean;
  onApplyPolish?: (text: string) => void;
}

export function SmartReplySuggestions({ threadId, accountId, messages, noReply, onApplyPolish }: SmartReplySuggestionsProps) {
  const [polishMode, setPolishMode] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [polishedText, setPolishedText] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [available, setAvailable] = useState(false);
  const checkedRef = useRef(false);
  const openComposer = useComposerStore((s) => s.openComposer);
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    isAiAvailable().then(setAvailable);
  }, []);

  const {
    data: replies,
    loading,
    loadingRef,
    error,
    load,
    refresh,
  } = useRefreshableAiCache<string[]>({
    accountId,
    threadId,
    cacheType: "smart_replies",
    fetcher: (a, t) => generateSmartReplies(t, a, messages),
  });

  // Preserve the original console.error behavior for smart-reply errors.
  useEffect(() => {
    if (error) console.error("Failed to generate smart replies:", error);
  }, [error]);

  // Auto-load when available.
  useEffect(() => {
    if (!available || messages.length === 0 || replies !== null || loadingRef.current) return;
    load();
  }, [available, messages.length, replies, loadingRef, load]);

  const handleReplyClick = useCallback((replyText: string) => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const replyTo = lastMessage.reply_to ?? lastMessage.from_address;
    openComposer({
      mode: "reply",
      to: replyTo ? [replyTo] : [],
      subject: `Re: ${lastMessage.subject ?? ""}`,
      bodyHtml: `<p>${replyText}</p>`,
      threadId: lastMessage.thread_id,
      inReplyToMessageId: lastMessage.id,
    });
  }, [messages, openComposer]);

  const handlePolish = useCallback(async () => {
    if (!draftText.trim() || polishing) return;
    setPolishing(true);
    setPolishedText("");
    try {
      const result = await polishDraft(draftText);
      setPolishedText(result);
    } catch (err) {
      console.error("Failed to polish draft:", err);
      setPolishedText("Failed to polish. Please try again.");
    } finally {
      setPolishing(false);
    }
  }, [draftText, polishing]);

  if (isAiLocked) return null;
  if (!available || messages.length === 0 || noReply) return null;

  return (
    <div className="mx-4 my-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-accent shrink-0" />
        <span className="text-xs font-medium text-accent flex-1">Quick Replies</span>
        <button
          onClick={() => { setPolishMode(true); setPolishedText(""); setDraftText(""); }}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors"
          title="Polish Reply"
        >
          <Wand2 size={12} />
        </button>
        <button
          onClick={refresh}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors"
          title="Refresh suggestions"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {polishMode ? (
        <div className="space-y-2">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Paste your draft reply here..."
            rows={4}
            className="w-full text-xs text-text-primary bg-bg-primary border border-border-primary rounded-md p-2 resize-none focus:outline-none focus:border-accent/40 placeholder:text-text-tertiary"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handlePolish}
              disabled={!draftText.trim() || polishing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {polishing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Wand2 size={12} />
              )}
              {polishing ? "Polishing..." : "Polish"}
            </button>
            <button
              onClick={() => { setPolishMode(false); setPolishedText(""); setDraftText(""); }}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
          {polishedText && (
            <div className="p-2 rounded-md bg-bg-primary border border-border-primary">
              <p className="text-xs text-text-primary whitespace-pre-wrap">{polishedText}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => {
                    onApplyPolish?.(polishedText);
                    setPolishMode(false);
                    setPolishedText("");
                    setDraftText("");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
                >
                  <Check size={12} />
                  Apply
                </button>
                <button
                  onClick={() => { setPolishedText(""); setDraftText(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:text-text-primary transition-colors"
                >
                  <X size={12} />
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {loading && !replies && (
            <CenteredLoader size="sm" inline label="Generating suggestions..." />
          )}
          {replies && (
            <div className="flex flex-wrap gap-2">
              {replies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleReplyClick(reply)}
                  className="px-3 py-1.5 text-xs text-text-primary bg-bg-primary border border-border-primary rounded-full hover:bg-bg-hover hover:border-accent/40 transition-colors max-w-[280px] truncate"
                  title={reply}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
