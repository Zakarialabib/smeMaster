import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { Wand2, Sparkles, ArrowDown, Briefcase } from "lucide-react";
import { isAiAvailable } from "@shared/services/ai/providerManager";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";
import {
  composeFromPrompt,
  generateReply,
  transformText,
  type TransformType,
} from "@shared/services/ai/aiService";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { fetchRagContext } from "@shared/services/ai/ragContext";

interface AiAssistPanelProps {
  editor: Editor | null;
  isReplyMode: boolean;
  threadMessages?: string[];
}

export function AiAssistPanel({ editor, isReplyMode, threadMessages }: AiAssistPanelProps) {
  const { t } = useTranslation();
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const setBodyHtml = useComposerStore((s) => s.setBodyHtml);

  // Check availability on mount
  useEffect(() => {
    isAiAvailable().then(setAvailable);
  }, []);

  if (available === null) return null;
  if (!available) return null;
  if (isAiLocked) {
    return (
      <div className="p-4 border border-border-primary rounded-lg bg-bg-secondary/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Sparkles size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">AI Assistant</p>
            <p className="text-xs text-text-tertiary">Upgrade to Pro to unlock AI-powered writing assistance</p>
          </div>
        </div>
        <UpgradeBadge variant="pro-only" size="sm" />
      </div>
    );
  }

  const applyToEditor = (html: string) => {
    if (!editor) return;
    editor.chain().focus().setContent(html).run();
    setBodyHtml(editor.getHTML());
  };

  const handleCompose = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Enrich with RAG context from knowledge base
      const ragContext = await fetchRagContext(prompt.trim());
      const enrichedPrompt = ragContext
        ? `${prompt.trim()}\n\nRelevant context from your data:\n${ragContext.slice(0, 2000)}`
        : prompt.trim();
      const result = await composeFromPrompt(enrichedPrompt);
      applyToEditor(result);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t('composer.aiGenerationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReply = async () => {
    if (loading || !threadMessages?.length) return;
    setLoading(true);
    setError(null);
    try {
      // Build a RAG query from thread subject + key terms
      const ragQuery = threadMessages[0]?.slice(0, 200) ?? "";
      const ragContext = await fetchRagContext(ragQuery);
      const instructions = prompt.trim()
        ? `${prompt.trim()}${ragContext ? `\n\nRelevant context from your data:\n${ragContext.slice(0, 2000)}` : ""}`
        : ragContext
          ? `Use relevant context from your knowledge base:\n${ragContext.slice(0, 2000)}`
          : undefined;

      const result = await generateReply(threadMessages, instructions);
      applyToEditor(result);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t('composer.aiGenerationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleTransform = async (type: TransformType) => {
    if (!editor || loading) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    setLoading(true);
    setError(null);
    try {
      const result = await transformText(html, type);
      applyToEditor(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('composer.aiTransformFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-3 py-2 border-b border-border-secondary bg-accent/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} className="text-accent" />
        <span className="text-xs font-medium text-accent">{t('composer.aiAssist')}</span>
      </div>

      {/* Prompt input */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isReplyMode) handleGenerateReply();
              else handleCompose();
            }
          }}
          placeholder={isReplyMode ? t('composer.instructionsForReply') : t('composer.describeWhatToWrite')}
          className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
          disabled={loading}
        />
        {isReplyMode ? (
          <button
            onClick={handleGenerateReply}
            disabled={loading || !threadMessages?.length}
            className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? "..." : t('composer.generateReply')}
          </button>
        ) : (
          <button
            onClick={handleCompose}
            disabled={loading || !prompt.trim()}
            className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? "..." : t('composer.generate')}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-text-tertiary mr-1">{t('composer.transform')}</span>
        <QuickAction
          icon={<Wand2 size={11} />}
          label={t('composer.improve')}
          onClick={() => handleTransform("improve")}
          disabled={loading}
        />
        <QuickAction
          icon={<ArrowDown size={11} />}
          label={t('composer.shorter')}
          onClick={() => handleTransform("shorten")}
          disabled={loading}
        />
        <QuickAction
          icon={<Briefcase size={11} />}
          label={t('composer.formal')}
          onClick={() => handleTransform("formalize")}
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-xs text-danger mt-1">{error}</p>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded border border-border-primary transition-colors disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
