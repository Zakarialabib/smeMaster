/**
 * KnowledgeBaseSettings — RAG / knowledge-base management for the AI Settings tab.
 *
 * Frosted-glass cards covering: engine mode (Provider embeddings vs on-device BGE),
 * model management, indexing trigger, vector DB, and chunking. The two engine modes
 * render *contextual* UI — provider mode hides the local model download/folder noise,
 * BGE mode hides the provider/embedding notes.
 *
 * @module
 */

import { useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingGroup,
  SettingRow,
  ToggleRow,
  ButtonGroup,
} from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { Button } from "@shared/components/ui/Button";
import {
  useRagStore,
  type EmbeddingSource,
  type ModelStatus,
} from "@features/assistant/stores/ragStore";
import { getSetting } from "@features/settings/db/settings";
import { aiGetVectorDbPath, aiResetVectorDb } from "@shared/services/db/invoke/rag";
import {
  BTN_GLASS,
  BTN_GLASS_PRIMARY,
  TEXT_HINT,
  BADGE_BASE,
  BADGE_SUCCESS,
  BADGE_WARNING,
  BADGE_DANGER,
} from "@shared/styles/ui-tokens";
import { cn } from "@shared/utils/cn";
import {
  Download,
  RotateCcw,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  FolderOpen,
  Trash2,
  Cpu,
  Sparkles,
} from "lucide-react";
import { setSetting } from "@features/settings/db/settings";

// ── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ModelStatus }) {
  const dotClass =
    status === "loaded"
      ? BADGE_SUCCESS
      : status === "loading" || status === "downloading"
        ? BADGE_WARNING
        : status === "error"
          ? BADGE_DANGER
          : "bg-text-tertiary/30 text-text-tertiary";

  return (
    <span className={cn(BADGE_BASE, dotClass, "inline-flex items-center gap-1.5")}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "loaded" && "bg-success",
          (status === "loading" || status === "downloading") && "bg-warning animate-pulse",
          status === "error" && "bg-danger",
          status === "idle" && "bg-text-tertiary",
        )}
      />
      {status === "loaded" && "Loaded"}
      {status === "loading" && "Loading…"}
      {status === "downloading" && "Downloading…"}
      {status === "error" && "Error"}
      {status === "idle" && "Not loaded"}
    </span>
  );
}

// ── Indexing Progress ────────────────────────────────────────────────────────

function IndexingProgress({ status }: { status: string }) {
  if (status === "idle") return null;

  const isActive = status === "indexing";

  return (
    <div className="mt-3 space-y-1.5">
      <div className="h-1.5 rounded-full bg-white/10 dark:bg-white/5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-accent transition-all duration-500",
            isActive && "w-3/4 animate-pulse",
            status === "completed" && "w-full",
          )}
        />
      </div>
      <p className={cn(TEXT_HINT, "flex items-center gap-1.5")}>
        {isActive && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Indexing emails, attachments, and vault items…
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircle2 className="w-3 h-3 text-success" />
            Indexing completed
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-3 h-3 text-danger" />
            Indexing failed
          </>
        )}
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeBaseSettings() {
  const { t } = useTranslation();
  const {
    enabled,
    modelStatus,
    modelPath,
    tokenizerPath,
    modelError,
    embeddingSource,
    modelsDir,
    indexingStatus,
    lastIndexedAt,
    indexingError,
    embeddingTest,
    embeddingTesting,
    hydrate,
    setEnabled,
    setEmbeddingSource,
    fetchModelsDir,
    removeModel,
    downloadBgeModel,
    loadEmbeddingModel,
    indexAll,
    testEmbedding,
  } = useRagStore();
  // ── Vector DB + chunking (local UI state) ──
  const [kbPath, setKbPath] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = useState<number>(100);
  const [splitter, setSplitter] = useState<"paragraph" | "sentence" | "token">("paragraph");
  // ── Provider / embedding-model status (provider mode) ──
  const [aiProvider, setAiProvider] = useState<string>("claude");
  const [lmstudioEmbeddingModel, setLmstudioEmbeddingModel] = useState<string>("");

  useEffect(() => {
    hydrate();
    fetchModelsDir();
  }, [hydrate, fetchModelsDir]);
  useEffect(() => {
    (async () => {
      try {
        setKbPath(await aiGetVectorDbPath());
      } catch {
        /* app data dir unavailable */
      }
      const cs = await getSetting("rag_chunk_size");
      if (cs) setChunkSize(Number(cs) || 1000);
      const co = await getSetting("rag_chunk_overlap");
      if (co) setChunkOverlap(Number(co) || 100);
      const sp = await getSetting("rag_splitter");
      if (sp === "sentence" || sp === "token" || sp === "paragraph") setSplitter(sp);
      const provider = await getSetting("ai_provider");
      if (provider) setAiProvider(provider);
      const emb = await getSetting("lmstudio_embedding_model");
      setLmstudioEmbeddingModel(emb ?? "");
    })();
  }, []);

  // ── Engine mode derivation ──
  const isBgeMode = embeddingSource === "rust_bge";
  const isProviderMode = embeddingSource === "provider";
  const providerEmbedsReady = aiProvider === "lmstudio" && !!lmstudioEmbeddingModel.trim();

  const canIndex =
    indexingStatus === "indexing"
      ? false
      : isBgeMode
        ? modelStatus === "loaded"
        : isProviderMode
          ? providerEmbedsReady
          : providerEmbedsReady || modelStatus === "loaded";

  const showEmbeddingHint =
    !isBgeMode && !providerEmbedsReady;

  // ── Format relative time ──
  const formatTimeAgo = useCallback((isoString: string | null): string => {
    if (!isoString) return "Never";
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  const openModelsFolder = useCallback(async () => {
    if (!modelsDir) return;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`file:///${modelsDir.replace(/\\/g, "/")}`);
    } catch (err) {
      console.warn("[KnowledgeBaseSettings] failed to open models folder", err);
    }
  }, [modelsDir]);

  return (
    <>
      <SettingGroup
        title={t("settings.knowledgeBase")}
        description={t("settings.knowledgeBaseDescription")}
      >
        <ToggleRow
          label={t("settings.enableLocalRag")}
          description={t("settings.enableLocalRagDescription")}
          checked={enabled}
          onToggle={() => setEnabled(!enabled)}
        />
      </SettingGroup>

      {!enabled && (
        <p className="text-xs text-text-tertiary">
          {t("settings.knowledgeBaseDisabledHint")}
        </p>
      )}

      {/* ── Engine Mode Selector ── */}
      <SettingGroup
        title={t("settings.embeddingEngine")}
        description={t("settings.embeddingEngineDescription")}
      >
        <SettingRow label={t("settings.embeddingSource")} description={t("settings.embeddingSourceDescription")}>
          <ButtonGroup
            size="sm"
            value={(embeddingSource ?? "auto") as "auto" | "rust_bge" | "provider"}
            onChange={(v) =>
              setEmbeddingSource(v === "auto" ? null : (v as EmbeddingSource))
            }
            options={[
              { value: "auto", label: t("settings.engineAuto") },
              { value: "provider", label: t("settings.engineProvider") },
              { value: "rust_bge", label: t("settings.engineBge") },
            ]}
          />
        </SettingRow>
        <p className={cn(TEXT_HINT, "mt-1")}>
          {isProviderMode
            ? t("settings.engineProviderHint")
            : isBgeMode
              ? t("settings.engineBgeHint")
              : t("settings.engineAutoHint")}
        </p>
      </SettingGroup>

      {/* ── Provider embeddings status (provider / auto modes) ── */}
      {!isBgeMode && (
        <SettingGroup
          title={t("settings.providerEmbeddings")}
          description={t("settings.providerEmbeddingsDescription")}
        >
          {aiProvider !== "lmstudio" && (
            <p className={cn(TEXT_HINT, "flex items-start gap-1.5 text-warning")}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {t("settings.providerEmbeddingsRequiresLmstudio")}
            </p>
          )}
          {aiProvider === "lmstudio" && (
            <div className="space-y-2">
              <SettingRow label={t("settings.activeProvider")}>
                <span className="text-sm text-text-secondary">{t("settings.providerLmstudio")}</span>
              </SettingRow>
              <SettingRow label={t("settings.embeddingModel")}>
                <span className="text-sm text-text-secondary">
                  {lmstudioEmbeddingModel.trim() || t("settings.kbNotSet")}
                </span>
              </SettingRow>
              {lmstudioEmbeddingModel.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="glass"
                    size="sm"
                    className={BTN_GLASS}
                    onClick={() => void testEmbedding()}
                    disabled={embeddingTesting}
                  >
                    {embeddingTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                        {t("settings.testing")}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 me-1.5" />
                        {t("settings.testEmbedding")}
                      </>
                    )}
                  </Button>
                  {embeddingTest?.ok && (
                    <span className="text-xs text-success inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("settings.embeddingDims", { dims: embeddingTest.dims ?? 0 })}
                    </span>
                  )}
                  {embeddingTest && !embeddingTest.ok && (
                    <span className="text-xs text-danger inline-flex items-center gap-1" title={embeddingTest.error}>
                      <AlertCircle className="w-3 h-3" />
                      {t("settings.embeddingTestFailed")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </SettingGroup>
      )}

      {/* ── On-device BGE model management (BGE mode only) ── */}
      {isBgeMode && (
        <SettingGroup
          title={t("settings.embeddingModel")}
          description={t("settings.bgeModelDescription")}
        >
          <div className="space-y-2 mb-4">
            <SettingRow label={t("settings.modelStatus")}>
              <StatusDot status={modelStatus} />
            </SettingRow>
            {modelPath && (
              <div className="text-xs font-mono text-text-tertiary bg-white/5 dark:bg-white/5 px-2.5 py-1.5 rounded-md border border-border-primary truncate">
                {modelPath}
              </div>
            )}
            {tokenizerPath && (
              <div className="text-xs font-mono text-text-tertiary bg-white/5 dark:bg-white/5 px-2.5 py-1.5 rounded-md border border-border-primary truncate">
                {tokenizerPath}
              </div>
            )}
            {modelError && (
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {modelError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="glass"
              size="md"
              className={BTN_GLASS}
              onClick={downloadBgeModel}
              disabled={modelStatus === "downloading" || modelStatus === "loading"}
            >
              {modelStatus === "downloading" ? (
                <>
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                  {t("settings.downloading")}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 me-1.5" />
                  {t("settings.downloadBge")}
                </>
              )}
            </Button>
            <Button
              variant="glass"
              size="md"
              className={BTN_GLASS_PRIMARY}
              onClick={loadEmbeddingModel}
              disabled={
                !modelPath ||
                !tokenizerPath ||
                modelStatus === "loading" ||
                modelStatus === "downloading"
              }
            >
              {modelStatus === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                  {t("settings.loading")}
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4 me-1.5" />
                  {t("settings.loadModel")}
                </>
              )}
            </Button>
          </div>
        </SettingGroup>
      )}

      {/* ── Local Models Folder (BGE mode only) ── */}
      {isBgeMode && (
        <SettingGroup
          title={t("settings.localModelsFolder")}
          description={t("settings.localModelsFolderDescription")}
        >
          <SettingRow label={t("settings.kbLocation")}>
            <span className="text-xs font-mono text-text-tertiary max-w-[60%] truncate text-end">
              {modelsDir ?? t("settings.loading")}
            </span>
          </SettingRow>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="glass"
              size="sm"
              className={BTN_GLASS}
              onClick={openModelsFolder}
              disabled={!modelsDir}
            >
              <FolderOpen className="w-4 h-4 me-1.5" />
              {t("settings.openFolder")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={removeModel}
              disabled={!modelPath}
            >
              <Trash2 className="w-4 h-4 me-1.5" />
              {t("settings.removeModel")}
            </Button>
          </div>
        </SettingGroup>
      )}

      {/* ── Indexing Control ── */}
      <SettingGroup
        title={t("settings.knowledgeBaseIndexing")}
        description={t("settings.knowledgeBaseIndexingDescription")}
      >
        {indexingError && (
          <p className="text-xs text-danger flex items-center gap-1 mb-2">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {indexingError}
          </p>
        )}
        {showEmbeddingHint && (
          <p className="text-xs text-warning flex items-start gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {aiProvider === "lmstudio"
              ? t("settings.indexRequiresEmbeddingModel")
              : t("settings.indexRequiresLmstudio")}
          </p>
        )}
        <div className="space-y-2">
          <SettingRow label={t("settings.lastIndexed")}>
            <span className="text-sm text-text-secondary">
              {formatTimeAgo(lastIndexedAt)}
            </span>
          </SettingRow>

          <IndexingProgress status={indexingStatus} />

          <div className="pt-1">
            <Button
              variant="glass"
              size="md"
              className={BTN_GLASS_PRIMARY}
              onClick={indexAll}
              disabled={!canIndex}
            >
              {indexingStatus === "indexing" ? (
                <>
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                  {t("settings.indexing")}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 me-1.5" />
                  {t("settings.indexAllData")}
                </>
              )}
            </Button>
          </div>
          {lastIndexedAt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-text-tertiary hover:text-text-secondary"
              onClick={indexAll}
              disabled={indexingStatus === "indexing"}
            >
              <RotateCcw className="w-3 h-3 me-1" />
              {t("settings.reindex")}
            </Button>
          )}
        </div>
      </SettingGroup>

      {/* ── Vector Database ── */}
      <SettingGroup
        title={t("settings.vectorDatabase")}
        description={t("settings.vectorDatabaseDescription")}
      >
        <SettingRow label={t("settings.vectorEngine")}>
                <span className="text-sm text-text-secondary inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  LanceDB (on-device)
                </span>
              </SettingRow>
              <SettingRow label={t("settings.storageLocation")}>
                <span className="text-xs font-mono text-text-tertiary max-w-[60%] truncate text-end">
                  {kbPath ?? t("settings.kbLoading")}
                </span>
        </SettingRow>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={async () => {
              const ok = window.confirm(
                t("settings.clearIndexConfirm"),
              );
              if (!ok) return;
              try {
                await aiResetVectorDb();
              } catch (err) {
                console.error("[KnowledgeBaseSettings] reset failed", err);
              }
            }}
          >
            <Trash2 className="w-4 h-4 me-1.5" />
            {t("settings.clearIndex")}
          </Button>
        </div>
      </SettingGroup>

      {/* ── Text Splitter / Chunking ── */}
      <SettingGroup
        title={t("settings.textSplitter")}
        description={t("settings.textSplitterDescription")}
      >
        <SettingRow label={t("settings.splitter")}>
          <select
            value={splitter}
            onChange={async (e) => {
              const v = e.target.value;
              setSplitter(v as "paragraph" | "sentence" | "token");
              await setSetting("rag_splitter", v);
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="paragraph">{t("settings.splitterParagraph")}</option>
            <option value="sentence">{t("settings.splitterSentence")}</option>
            <option value="token">{t("settings.splitterToken")}</option>
          </select>
        </SettingRow>
        <SettingRow label={t("settings.chunkSize")}>
          <input
            type="number"
            min={100}
            step={100}
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            onBlur={async () => {
              await setSetting("rag_chunk_size", String(chunkSize));
            }}
            className="w-32 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
          />
        </SettingRow>
        <SettingRow label={t("settings.chunkOverlap")}>
          <input
            type="number"
            min={0}
            step={50}
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(Number(e.target.value))}
            onBlur={async () => {
              await setSetting("rag_chunk_overlap", String(chunkOverlap));
            }}
            className="w-32 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
          />
        </SettingRow>
      </SettingGroup>

      {/* ── Education ── */}
      <HelpCard
        collapsible
        items={[
          {
            type: "why",
            text: t("settings.kbHelpWhy"),
          },
          {
            type: "how",
            text: t("settings.kbHelpHow"),
          },
          {
            type: "when",
            text: t("settings.kbHelpWhen"),
          },
        ]}
      />
    </>
  );
}
