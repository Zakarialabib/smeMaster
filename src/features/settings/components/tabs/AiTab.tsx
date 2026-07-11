import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getSetting, setSetting, getSecureSetting, setSecureSetting } from "@features/settings/db/settings";
import { PROVIDER_MODELS } from "@shared/services/ai/types";
import { TextField } from "@shared/components/ui/TextField";
import { Button } from "@shared/components/ui/Button";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup, SettingRow, ToggleRow, ButtonGroup } from "@features/settings/components/SettingsHelpers";
import BundleSettings from "../BundleSettings";
import LocalRagSettings from "../LocalRagSettings";
import VoiceSettings from "../VoiceSettings";

export default function AiTab() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const [aiProvider, setAiProvider] = useState<"claude" | "openai" | "gemini" | "ollama" | "copilot" | "custom">("claude");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [copilotApiKey, setCopilotApiKey] = useState("");
  const [ollamaServerUrl, setOllamaServerUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [customBaseUrl, setCustomBaseUrl] = useState("https://api.openai.com/v1");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customModel, setCustomModel] = useState("gpt-4o-mini");
  const [claudeModel, setClaudeModel] = useState("claude-haiku-4-5-20251001");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-preview-05-20");
  const [copilotModel, setCopilotModel] = useState("openai/gpt-4o-mini");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiLanguage, setAiLanguage] = useState("auto");
  const [aiAutoCategorize, setAiAutoCategorize] = useState(true);
  const [aiAutoSummarize, setAiAutoSummarize] = useState(true);
  const [aiKeySaved, setAiKeySaved] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<"success" | "fail" | null>(null);
  const [customTestError, setCustomTestError] = useState<string | null>(null);
  const [aiAutoDraftEnabled, setAiAutoDraftEnabled] = useState(true);
  const [aiWritingStyleEnabled, setAiWritingStyleEnabled] = useState(true);
  const [aiSmartRepliesEnabled, setAiSmartRepliesEnabled] = useState(true);
  const [aiAskInboxEnabled, setAiAskInboxEnabled] = useState(true);
  const [styleAnalyzing, setStyleAnalyzing] = useState(false);
  const [styleAnalyzeDone, setStyleAnalyzeDone] = useState(false);
  const [autoArchiveCategories, setAutoArchiveCategories] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    async function load() {
      const provider = await getSetting("ai_provider");
      if (provider === "openai" || provider === "gemini" || provider === "ollama" || provider === "copilot") setAiProvider(provider);
      const ollamaUrl = await getSetting("ollama_server_url");
      if (ollamaUrl) setOllamaServerUrl(ollamaUrl);
      const ollamaModelVal = await getSetting("ollama_model");
      if (ollamaModelVal) setOllamaModel(ollamaModelVal);
      const customBaseUrlVal = await getSetting("custom_base_url");
      if (customBaseUrlVal) setCustomBaseUrl(customBaseUrlVal);
      const customApiKeyVal = await getSecureSetting("custom_api_key");
      if (customApiKeyVal) setCustomApiKey(customApiKeyVal);
      const customModelVal = await getSetting("custom_model");
      if (customModelVal) setCustomModel(customModelVal);
      const claudeModelVal = await getSetting("claude_model");
      if (claudeModelVal) setClaudeModel(claudeModelVal);
      const openaiModelVal = await getSetting("openai_model");
      if (openaiModelVal) setOpenaiModel(openaiModelVal);
      const geminiModelVal = await getSetting("gemini_model");
      if (geminiModelVal) setGeminiModel(geminiModelVal);
      const aiKey = await getSecureSetting("claude_api_key");
      setClaudeApiKey(aiKey ?? "");
      const oaiKey = await getSecureSetting("openai_api_key");
      setOpenaiApiKey(oaiKey ?? "");
      const gemKey = await getSecureSetting("gemini_api_key");
      setGeminiApiKey(gemKey ?? "");
      const copKey = await getSecureSetting("copilot_api_key");
      setCopilotApiKey(copKey ?? "");
      const copilotModelVal = await getSetting("copilot_model");
      if (copilotModelVal) setCopilotModel(copilotModelVal);
      const aiEn = await getSetting("ai_enabled");
      setAiEnabled(aiEn !== "false");
      const aiLang = await getSetting("ai_language");
      if (aiLang) setAiLanguage(aiLang);
      const aiCat = await getSetting("ai_auto_categorize");
      setAiAutoCategorize(aiCat !== "false");
      const aiSum = await getSetting("ai_auto_summarize");
      setAiAutoSummarize(aiSum !== "false");
      const aiDraft = await getSetting("ai_auto_draft_enabled");
      setAiAutoDraftEnabled(aiDraft !== "false");
      const aiStyle = await getSetting("ai_writing_style_enabled");
      setAiWritingStyleEnabled(aiStyle !== "false");
      const aiSmartReplies = await getSetting("ai_smart_replies_enabled");
      setAiSmartRepliesEnabled(aiSmartReplies !== "false");
      const aiAskInbox = await getSetting("ai_ask_inbox_enabled");
      setAiAskInboxEnabled(aiAskInbox !== "false");

      const autoArchive = await getSetting("auto_archive_categories");
      if (autoArchive) {
        setAutoArchiveCategories(new Set(autoArchive.split(",").map((s) => s.trim()).filter(Boolean)));
      }
    }
    load();
  }, []);

  function isValidUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  return (
    <>
      <SettingGroup title={t('settings.provider')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.providerDescription')}
        </p>
        <SettingRow label={t('settings.aiProvider')}>
          <select
            value={aiProvider}
            onChange={async (e) => {
              const val = e.target.value as "claude" | "openai" | "gemini" | "ollama" | "copilot" | "custom";
              setAiProvider(val);
              setAiTestResult(null);
              await setSetting("ai_provider", val);
              const { clearProviderClients } = await import("@shared/services/ai/providerManager");
              clearProviderClients();
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="claude">{t('settings.providerClaude')}</option>
            <option value="openai">{t('settings.providerOpenai')}</option>
            <option value="gemini">{t('settings.providerGemini')}</option>
            <option value="ollama">{t('settings.providerOllama')}</option>
            <option value="copilot">{t('settings.providerCopilot')}</option>
            <option value="custom">{t('settings.customProvider')}</option>
          </select>
        </SettingRow>
        <p className="text-xs text-text-tertiary">
          {aiProvider === "claude" && t('settings.usesModel', { model: PROVIDER_MODELS.claude.find((m) => m.id === claudeModel)?.label ?? claudeModel })}
          {aiProvider === "openai" && t('settings.usesModel', { model: PROVIDER_MODELS.openai.find((m) => m.id === openaiModel)?.label ?? openaiModel })}
          {aiProvider === "gemini" && t('settings.usesModel', { model: PROVIDER_MODELS.gemini.find((m) => m.id === geminiModel)?.label ?? geminiModel })}
          {aiProvider === "ollama" && t('settings.providerOllamaDescription')}
          {aiProvider === "copilot" && t('settings.usesModelCopilot', { model: PROVIDER_MODELS.copilot.find((m) => m.id === copilotModel)?.label ?? copilotModel })}
          {aiProvider === "custom" && t('settings.providerCustomDescription')}
        </p>
      </SettingGroup>

      {/* Education: AI Provider Privacy */}
      <HelpCard
        items={[
          { type: "why", text: "AI features save time by drafting replies, summarizing threads, categorizing emails, and learning your writing style â€” so you focus on what matters." },
          { type: "how", text: "Your email content is processed by the chosen AI provider. Claude, OpenAI, Gemini, and Copilot are cloud services; Ollama runs fully offline on your machine." },
          { type: "when", text: "Enable AI for high-volume inboxes where quick drafts, smart replies, and auto-categorization provide the most value." },
        ]}
      />

      {aiProvider === "ollama" ? (
        <SettingGroup title={t('settings.localServer')}>
          <div className="space-y-3">
            <TextField
              label={t('settings.serverUrl')}
              size="md"
              value={ollamaServerUrl}
              onChange={(e) => setOllamaServerUrl(e.target.value)}
              placeholder={t('settings.ollamaUrlPlaceholder')}
            />
            <TextField
              label={t('settings.modelName')}
              size="md"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder={t('settings.ollamaModelPlaceholder')}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  const trimmedUrl = ollamaServerUrl.trim();
                  if (!isValidUrl(trimmedUrl)) return;
                  await setSetting("ollama_server_url", trimmedUrl);
                  await setSetting("ollama_model", ollamaModel.trim());
                  const { clearProviderClients } = await import("@shared/services/ai/providerManager");
                  clearProviderClients();
                  setAiKeySaved(true);
                  setTimeout(() => setAiKeySaved(false), 2000);
                }}
                disabled={!ollamaServerUrl.trim() || !ollamaModel.trim() || !!(ollamaServerUrl.trim() && !isValidUrl(ollamaServerUrl.trim()))}
              >
                {aiKeySaved ? t('common.saved') : t("common.save")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={async () => {
                  const trimmedUrl = ollamaServerUrl.trim();
                  if (!isValidUrl(trimmedUrl)) {
                    setAiTestResult("fail");
                    return;
                  }
                  setAiTesting(true);
                  setAiTestResult(null);
                  try {
                    const { testConnection } = await import("@shared/services/ai/aiService");
                    const ok = await testConnection();
                    setAiTestResult(ok ? "success" : "fail");
                  } catch {
                    setAiTestResult("fail");
                  } finally {
                    setAiTesting(false);
                  }
                }}
                disabled={!ollamaServerUrl.trim() || !ollamaModel.trim() || aiTesting}
                className="bg-bg-tertiary text-text-primary border border-border-primary"
              >
                {aiTesting ? t('settings.testing') : t("account.testConnection")}
              </Button>
              {aiTestResult === "success" && (
                <span className="text-xs text-success">{t('settings.connected')}</span>
              )}
              {aiTestResult === "fail" && (
                <span className="text-xs text-danger">{t('settings.connectionFailed')}</span>
              )}
            </div>
          </div>
        </SettingGroup>
      ) : aiProvider === "custom" ? (
        <SettingGroup title={t('settings.customProvider')}>
          <div className="space-y-3">
            <TextField
              label={t('settings.customBaseUrl')}
              size="md"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder={t('settings.customBaseUrlPlaceholder')}
            />
            <TextField
              label={t('settings.apiKey')}
              size="md"
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder={t('settings.customApiKeyPlaceholder')}
            />
            <TextField
              label={t('settings.model')}
              size="md"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder={t('settings.customModelPlaceholder')}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  const trimmedUrl = customBaseUrl.trim();
                  if (!isValidUrl(trimmedUrl)) return;
                  await setSetting("custom_base_url", trimmedUrl);
                  await setSecureSetting("custom_api_key", customApiKey.trim());
                  await setSetting("custom_model", customModel.trim());
                  const { clearProviderClients } = await import("@shared/services/ai/providerManager");
                  clearProviderClients();
                  setAiKeySaved(true);
                  setTimeout(() => setAiKeySaved(false), 2000);
                }}
                disabled={!customBaseUrl.trim() || !customApiKey.trim() || !customModel.trim() || !!(customBaseUrl.trim() && !isValidUrl(customBaseUrl.trim()))}
              >
                {aiKeySaved ? t('common.saved') : t("common.save")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={async () => {
                  const trimmedUrl = customBaseUrl.trim();
                  if (!isValidUrl(trimmedUrl)) {
                    setAiTestResult("fail");
                    return;
                  }
                  setAiTesting(true);
                  setAiTestResult(null);
                  setCustomTestError(null);
                  try {
                    const { testConnection } = await import("@shared/services/ai/aiService");
                    const ok = await testConnection();
                    setAiTestResult(ok ? "success" : "fail");
                    if (!ok) setCustomTestError(t('settings.connectionFailedCheckParams'));
                  } catch (err) {
                    setAiTestResult("fail");
                    setCustomTestError(err instanceof Error ? err.message : t('settings.connectionFailed'));
                  } finally {
                    setAiTesting(false);
                  }
                }}
                disabled={!customBaseUrl.trim() || !customApiKey.trim() || !customModel.trim() || aiTesting}
                className="bg-bg-tertiary text-text-primary border border-border-primary"
              >
                {aiTesting ? t('settings.testing') : t("account.testConnection")}
              </Button>
              {aiTestResult === "success" && (
                <span className="text-xs text-success">{t('settings.connected')}</span>
              )}
              {aiTestResult === "fail" && (
                <span className="text-xs text-danger">{t('settings.connectionFailed')}</span>
              )}
            </div>
            {customTestError && (
              <p className="text-xs text-danger mt-1">{customTestError}</p>
            )}
          </div>
        </SettingGroup>
      ) : (
        <SettingGroup title={t('settings.apiKey')}>
          <div className="space-y-3">
            <TextField
              label={
                aiProvider === "claude" ? t('settings.anthropicApiKey')
                : aiProvider === "openai" ? t('settings.openaiApiKey')
                : aiProvider === "copilot" ? t('settings.githubPat')
                : t('settings.googleAiApiKey')
              }
              size="md"
              type="password"
              value={
                aiProvider === "claude" ? claudeApiKey
                : aiProvider === "openai" ? openaiApiKey
                : aiProvider === "copilot" ? copilotApiKey
                : geminiApiKey
              }
              onChange={(e) => {
                if (aiProvider === "claude") setClaudeApiKey(e.target.value);
                else if (aiProvider === "openai") setOpenaiApiKey(e.target.value);
                else if (aiProvider === "copilot") setCopilotApiKey(e.target.value);
                else setGeminiApiKey(e.target.value);
              }}
              placeholder={
                aiProvider === "claude" ? t('settings.claudeKeyPlaceholder')
                : aiProvider === "openai" ? t('settings.customApiKeyPlaceholder')
                : aiProvider === "copilot" ? t('settings.copilotKeyPlaceholder')
                : t('settings.geminiKeyPlaceholder')
              }
            />
            <SettingRow label={t('settings.model')}>
              <select
                value={
                  aiProvider === "claude" ? claudeModel
                  : aiProvider === "openai" ? openaiModel
                  : aiProvider === "copilot" ? copilotModel
                  : geminiModel
                }
                onChange={async (e) => {
                  const val = e.target.value;
                  const modelSettingMap = {
                    claude: "claude_model",
                    openai: "openai_model",
                    gemini: "gemini_model",
                    copilot: "copilot_model",
                  } as const;
                  if (aiProvider === "claude") setClaudeModel(val);
                  else if (aiProvider === "openai") setOpenaiModel(val);
                  else if (aiProvider === "copilot") setCopilotModel(val);
                  else setGeminiModel(val);
                  await setSetting(modelSettingMap[aiProvider], val);
                  const { clearProviderClients } = await import("@shared/services/ai/providerManager");
                  clearProviderClients();
                }}
                className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
              >
                {PROVIDER_MODELS[aiProvider].map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </SettingRow>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  const keySettingMap = {
                    claude: "claude_api_key",
                    openai: "openai_api_key",
                    gemini: "gemini_api_key",
                    copilot: "copilot_api_key",
                  } as const;
                  const keyValue =
                    aiProvider === "claude" ? claudeApiKey.trim()
                    : aiProvider === "openai" ? openaiApiKey.trim()
                    : aiProvider === "copilot" ? copilotApiKey.trim()
                    : geminiApiKey.trim();
                  if (keyValue) {
                    await setSecureSetting(keySettingMap[aiProvider], keyValue);
                    const { clearProviderClients } = await import("@shared/services/ai/providerManager");
                    clearProviderClients();
                  }
                  setAiKeySaved(true);
                  setTimeout(() => setAiKeySaved(false), 2000);
                }}
                disabled={
                  !(aiProvider === "claude" ? claudeApiKey.trim()
                  : aiProvider === "openai" ? openaiApiKey.trim()
                  : aiProvider === "copilot" ? copilotApiKey.trim()
                  : geminiApiKey.trim())
                }
              >
                {aiKeySaved ? t('common.saved') : t('settings.saveKey')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={async () => {
                  setAiTesting(true);
                  setAiTestResult(null);
                  try {
                    const { testConnection } = await import("@shared/services/ai/aiService");
                    const ok = await testConnection();
                    setAiTestResult(ok ? "success" : "fail");
                  } catch {
                    setAiTestResult("fail");
                  } finally {
                    setAiTesting(false);
                  }
                }}
                disabled={
                  !(aiProvider === "claude" ? claudeApiKey.trim()
                  : aiProvider === "openai" ? openaiApiKey.trim()
                  : aiProvider === "copilot" ? copilotApiKey.trim()
                  : geminiApiKey.trim()) || aiTesting
                }
                className="bg-bg-tertiary text-text-primary border border-border-primary"
              >
                {aiTesting ? t('settings.testing') : t("account.testConnection")}
              </Button>
              {aiTestResult === "success" && (
                <span className="text-xs text-success">{t('settings.connected')}</span>
              )}
              {aiTestResult === "fail" && (
                <span className="text-xs text-danger">{t('settings.connectionFailed')}</span>
              )}
            </div>
          </div>
        </SettingGroup>
      )}

      <SettingGroup title={t('settings.features')}>
        <ToggleRow
          label={t('settings.enableAiFeatures')}
          description={t('settings.enableAiFeaturesDescription')}
          checked={aiEnabled}
          onToggle={async () => {
            const newVal = !aiEnabled;
            setAiEnabled(newVal);
            await setSetting("ai_enabled", newVal ? "true" : "false");
          }}
        />
        <ToggleRow
          label={t('settings.autoCategorize')}
          description={t('settings.autoCategorizeDescription')}
          checked={aiAutoCategorize}
          onToggle={async () => {
            const newVal = !aiAutoCategorize;
            setAiAutoCategorize(newVal);
            await setSetting("ai_auto_categorize", newVal ? "true" : "false");
          }}
        />
        <ToggleRow
          label={t('settings.autoSummarize')}
          description={t('settings.autoSummarizeDescription')}
          checked={aiAutoSummarize}
          onToggle={async () => {
            const newVal = !aiAutoSummarize;
            setAiAutoSummarize(newVal);
            await setSetting("ai_auto_summarize", newVal ? "true" : "false");
          }}
        />
        <ToggleRow
          label={t('settings.smartReplies')}
          description={t('settings.smartRepliesDescription')}
          checked={aiSmartRepliesEnabled}
          onToggle={async () => {
            const newVal = !aiSmartRepliesEnabled;
            setAiSmartRepliesEnabled(newVal);
            await setSetting("ai_smart_replies_enabled", newVal ? "true" : "false");
          }}
        />
        <ToggleRow
          label={t('settings.askInbox')}
          description={t('settings.askInboxDescription')}
          checked={aiAskInboxEnabled}
          onToggle={async () => {
            const newVal = !aiAskInboxEnabled;
            setAiAskInboxEnabled(newVal);
            await setSetting("ai_ask_inbox_enabled", newVal ? "true" : "false");
          }}
        />
        <SettingRow label={t('settings.aiLanguage')}>
          <ButtonGroup
            value={aiLanguage}
            onChange={async (val) => {
              setAiLanguage(val);
              await setSetting("ai_language", val);
            }}
            options={[
              { value: "auto", label: t('settings.aiLanguageAuto') },
              { value: "en", label: t('settings.aiLanguageEn') },
              { value: "fr", label: t('settings.aiLanguageFr') },
              { value: "ar", label: t('settings.aiLanguageAr') },
            ]}
          />
        </SettingRow>
        <HelpCard
          collapsible
          items={[
            { type: "why", text: "AI features save time by drafting replies, summarizing threads, categorizing emails, and learning your writing style — so you focus on what matters." },
            { type: "how", text: "Each feature uses the configured AI provider. Auto-categorize sorts inbox into categories. Summarize creates thread digests. Smart replies suggest quick responses." },
            { type: "when", text: "Enable all features for maximum productivity. Toggle individual features on/off if you prefer manual control over certain aspects." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.autoDraftReplies')}>
        <ToggleRow
          label={t('settings.autoDraftReplies')}
          description={t('settings.autoDraftRepliesDescription')}
          checked={aiAutoDraftEnabled}
          onToggle={async () => {
            const newVal = !aiAutoDraftEnabled;
            setAiAutoDraftEnabled(newVal);
            await setSetting("ai_auto_draft_enabled", newVal ? "true" : "false");
          }}
        />
        <ToggleRow
          label={t('settings.learnWritingStyle')}
          description={t('settings.learnWritingStyleDescription')}
          checked={aiWritingStyleEnabled}
          onToggle={async () => {
            const newVal = !aiWritingStyleEnabled;
            setAiWritingStyleEnabled(newVal);
            await setSetting("ai_writing_style_enabled", newVal ? "true" : "false");
          }}
        />
        {aiWritingStyleEnabled && (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-secondary">{t('settings.writingStyleProfile')}</span>
              <p className="text-xs text-text-tertiary mt-0.5">
                {t('settings.writingStyleProfileDescription')}
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={async () => {
                setStyleAnalyzing(true);
                setStyleAnalyzeDone(false);
                try {
                  const activeId = accounts.find((a) => a.isActive)?.id;
                  if (activeId) {
                    const { refreshWritingStyle } = await import("@shared/services/ai/writingStyleService");
                    await refreshWritingStyle(activeId);
                    setStyleAnalyzeDone(true);
                    setTimeout(() => setStyleAnalyzeDone(false), 3000);
                  }
                } catch (err) {
                  console.error("Style analysis failed:", err);
                } finally {
                  setStyleAnalyzing(false);
                }
              }}
              disabled={styleAnalyzing}
              className="bg-bg-tertiary text-text-primary border border-border-primary"
            >
              {styleAnalyzing ? t('common.analyzing') : styleAnalyzeDone ? t('settings.done') : t('settings.reanalyze')}
            </Button>
          </div>
        )}
      </SettingGroup>

      <SettingGroup title={t('settings.categories')}>
        <p className="text-xs text-text-tertiary mb-1">
          {t('settings.categoriesDescription')}
        </p>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.categoriesAutoArchiveDescription')}
        </p>
        {(["Updates", "Promotions", "Social", "Newsletters"] as const).map((cat) => (
          <ToggleRow
            key={cat}
            label={t('settings.autoArchive', { cat })}
            description={t('settings.skipInbox', { cat: cat.toLowerCase() })}
            checked={autoArchiveCategories.has(cat)}
            onToggle={async () => {
              const next = new Set(autoArchiveCategories);
              if (next.has(cat)) next.delete(cat);
              else next.add(cat);
              setAutoArchiveCategories(next);
              await setSetting("auto_archive_categories", [...next].join(","));
            }}
          />
        ))}
      </SettingGroup>

      <SettingGroup title={t('settings.bundleDelivery')}>
        <p className="text-xs text-text-tertiary mb-3">
          {t('settings.bundleDeliveryDescription')}
        </p>
        <HelpCard
          items={[
            { type: "why", text: "Bundle delivery groups AI-generated messages (summaries, drafts, suggestions) into digest batches rather than delivering them in real-time." },
            { type: "how", text: "Configure how often bundles are delivered and what types of AI content are included. Bundles are delivered as regular emails to your inbox." },
            { type: "when", text: "Best for users who want periodic AI assistance without real-time interruptions â€” ideal for daily digests or batch processing." },
          ]}
        />
        <BundleSettings />
      </SettingGroup>

      {/* ── Local RAG Section ── */}
      <LocalRagSettings />

      {/* ── Voice & Speech Section ── */}
      <VoiceSettings />
    </>
  );
}

