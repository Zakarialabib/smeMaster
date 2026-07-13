import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Send, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { generateWithAi } from "./aiMock-free";
import { useCampaignComposerStore } from "../../../stores/campaignComposerStore";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

export interface AIPanelProps {
  /** Called when the user clicks a generated subject-line chip. */
  onApplySubject?: (subject: string) => void;
  /** Called with the generated body text so the integrator can insert blocks. */
  onInsertBody?: (text: string) => void;
  /** Called when the user wants to pick an image from the Vault. */
  onPickImage?: () => void;
  /** Optional source text (e.g. the currently selected block) used by
   *  Rewrite / Change tone / Translate quick actions. */
  context?: string;
}

const SUBJECT_SYSTEM =
  "You are an expert email marketing copywriter. Generate exactly 3 concise, " +
  "compelling email subject lines based on the description. Return each subject " +
  "on its own line, with no numbering, bullets, quotes, or extra commentary.";

const BODY_SYSTEM =
  "You are an expert email copywriter. Write a clear, engaging email body for a " +
  "marketing campaign. Use plain paragraphs separated by single newlines. Do not " +
  "include a subject line, greeting, or signature.";

const REWRITE_SYSTEM =
  "You are an expert editor. Rewrite the following email text to improve clarity " +
  "and engagement while preserving its original meaning. Return only the rewritten text.";

const TONE_SYSTEM =
  "You are an expert copywriter. Rewrite the following email text in the requested " +
  "tone, preserving its meaning. Return only the rewritten text.";

const TRANSLATE_SYSTEM =
  "You are a professional translator. Translate the following email text into the " +
  "requested language. Return only the translated text.";

function parseSubjects(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\d\s\.\-\*\)]+/, "").replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function AIPanel({ onApplySubject, onInsertBody, onPickImage, context }: AIPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [pendingSubjects, setPendingSubjects] = useState<string[]>([]);
  const [pendingBody, setPendingBody] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { isAiAvailable } = await import("@shared/services/ai/providerManager");
        const ok = await isAiAvailable();
        if (alive) setAiAvailable(ok);
      } catch {
        if (alive) setAiAvailable(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pendingSubjects, pendingBody, loading]);

  const pushAssistant = (content: string) =>
    setMessages((m) => [...m, { role: "assistant", content }]);

  const runAi = async (system: string, user: string) => {
    if (loading) return;
    setLoading(true);
    setPendingSubjects([]);
    setPendingBody("");
    try {
      const res = await generateWithAi(system, user);
      pushAssistant(res);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushAssistant(`⚠️ ${msg}`);
      return "";
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    await runAi(
      "You are an email marketing copilot. Help the user draft and refine campaign content.",
      text,
    );
  };

  const handleGenerateSubjects = () => {
    const topic = input.trim() || "(no description provided — invent a plausible campaign)";
    setMessages((m) => [...m, { role: "user", content: `Generate subjects: ${topic}` }]);
    void runAi(SUBJECT_SYSTEM, topic).then((res) => {
      if (res) setPendingSubjects(parseSubjects(res));
    });
  };

  const handleWriteBody = () => {
    const desc = input.trim() || "(no description provided — invent a plausible campaign body)";
    setMessages((m) => [...m, { role: "user", content: `Write body: ${desc}` }]);
    void runAi(BODY_SYSTEM, desc).then((res) => {
      if (res) setPendingBody(res);
    });
  };

  const getSourceText = (): string => {
    const fromContext = context?.trim();
    if (fromContext) return fromContext;
    const fromInput = input.trim();
    if (fromInput) return fromInput;
    return "";
  };

  const handleRewrite = () => {
    const src = getSourceText();
    if (!src) return;
    setMessages((m) => [...m, { role: "user", content: "Rewrite this text" }]);
    void runAi(REWRITE_SYSTEM, src).then((res) => {
      if (res) setPendingBody(res);
    });
  };

  const handleChangeTone = () => {
    const src = getSourceText();
    if (!src) return;
    const tone = input.trim() || "professional and friendly";
    setMessages((m) => [...m, { role: "user", content: `Change tone to: ${tone}` }]);
    void runAi(`${TONE_SYSTEM} Requested tone: ${tone}.`, src).then((res) => {
      if (res) setPendingBody(res);
    });
  };

  const handleTranslate = () => {
    const src = getSourceText();
    if (!src) return;
    const lang = input.trim() || "English";
    setMessages((m) => [...m, { role: "user", content: `Translate to: ${lang}` }]);
    void runAi(`${TRANSLATE_SYSTEM} Target language: ${lang}.`, src).then((res) => {
      if (res) setPendingBody(res);
    });
  };

  const insertBodyAsBlocks = (text: string) => {
    const paragraphs = text
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const store = useCampaignComposerStore.getState();
    let afterIndex = store.blocks.length - 1;
    for (const p of paragraphs) {
      store.addBlock("paragraph", afterIndex);
      const newId = useCampaignComposerStore.getState().selectedBlockId;
      if (newId) {
        useCampaignComposerStore.getState().updateBlock(newId, { content: p });
      }
      afterIndex += 1;
    }
  };

  const handleInsertBody = () => {
    if (!pendingBody) return;
    if (onInsertBody) {
      onInsertBody(pendingBody);
    } else {
      insertBodyAsBlocks(pendingBody);
    }
    setPendingBody("");
  };

  // ── No AI provider configured: show CTA instead of the composer ──
  if (aiAvailable === false) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border-primary bg-bg-primary">
        <div className="flex items-center gap-2 border-b border-border-primary px-4 py-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">{t("campaign.editor.aiPowered")}</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={Sparkles}
            title={t("campaign.editor.aiNoProvider")}
            subtitle={t("campaign.editor.aiPowered")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border-primary bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">{t("campaign.editor.aiPowered")}</h2>
        </div>
        {onPickImage && (
          <Button
            variant="ghost"
            size="xs"
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            onClick={onPickImage}
          >
            {t("campaign.editor.insertImage")}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-text-tertiary">{t("campaign.editor.aiPowered")}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "border border-border-primary bg-bg-secondary text-text-primary"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-tertiary">
              …
            </div>
          </div>
        )}

        {/* Subject chips */}
        {pendingSubjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">{t("campaign.editor.subject")}</p>
            <div className="flex flex-wrap gap-2">
              {pendingSubjects.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onApplySubject?.(s)}
                  className="rounded-xl border border-border-primary bg-bg-secondary px-3 py-1.5 text-xs text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Insert body */}
        {pendingBody && (
          <div className="space-y-2">
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border-primary bg-bg-secondary p-3 text-sm text-text-primary">
              {pendingBody}
            </div>
            <Button variant="primary" size="sm" onClick={handleInsertBody} icon={<Plus className="h-3.5 w-3.5" />}>
              {t("campaign.editor.insertBlocks")}
            </Button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 border-t border-border-primary px-4 py-2">
        <Button variant="secondary" size="xs" onClick={handleGenerateSubjects} disabled={loading}>
          {t("campaign.editor.generateSubjects")}
        </Button>
        <Button variant="secondary" size="xs" onClick={handleWriteBody} disabled={loading}>
          {t("campaign.editor.writeBody")}
        </Button>
        <Button variant="ghost" size="xs" onClick={handleRewrite} disabled={loading}>
          {t("campaign.editor.rewrite")}
        </Button>
        <Button variant="ghost" size="xs" onClick={handleChangeTone} disabled={loading}>
          {t("campaign.editor.changeTone")}
        </Button>
        <Button variant="ghost" size="xs" onClick={handleTranslate} disabled={loading}>
          {t("campaign.editor.translate")}
        </Button>
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-border-primary p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendChat();
            }
          }}
          rows={2}
          placeholder={t("campaign.editor.aiPowered")}
          className="flex-1 resize-none rounded-xl border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button
          variant="primary"
          size="md"
          iconOnly
          onClick={sendChat}
          disabled={loading || !input.trim()}
          aria-label={t("campaign.editor.apply")}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default AIPanel;
