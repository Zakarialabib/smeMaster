/**
 * LocalRagSettings — Local AI RAG management section for the AI Settings tab.
 *
 * Frosted Glass design with frosted-surface cards, glass buttons, and
 * backdrop blur. Covers: feature toggle, model download/load, indexing
 * trigger, and status indicators.
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
import { useRagStore, type EmbeddingSource } from "@features/assistant/stores/ragStore";
import { getSetting, setSetting } from "@features/settings/db/settings";
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
} from "lucide-react";

// ── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "idle" | "downloading" | "loading" | "loaded" | "error" }) {
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

export default function LocalRagSettings() {
  const { t: _t } = useTranslation();
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
    hydrate,
    setEnabled,
    setEmbeddingSource,
    fetchModelsDir,
    removeModel,
    downloadBgeModel,
    loadEmbeddingModel,
    indexAll,
  } = useRagStore();

  // ── Vector DB + chunking (local UI state) ──
  const [kbPath, setKbPath] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = useState<number>(100);
  const [splitter, setSplitter] = useState<"paragraph" | "sentence" | "token">("paragraph");

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
    })();
  }, []);

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
      console.warn("[LocalRagSettings] failed to open models folder", err);
    }
  }, [modelsDir]);

  // Don't render if RAG is disabled
  if (!enabled) return null;

  return (
    <>
      <SettingGroup
        title="Local RAG"
        description="Local embedding engine + vector search over your emails, attachments, and vault items. All processing stays on your device."
      >
        <ToggleRow
          label="Enable Local RAG"
          description="Allow local semantic search and AI knowledge assistant"
          checked={enabled}
          onToggle={() => setEnabled(!enabled)}
        />
      </SettingGroup>

      {/* ── Model Management ── */}
      <SettingGroup
        title="Embedding Model"
        description="Download and load the BGE-small-en-v1.5 embedding model locally"
      >
        {/* Embedding source selector */}
        <SettingRow label="Embedding Source" description="Where query embeddings are generated">
          <ButtonGroup
            size="sm"
            value={(embeddingSource ?? "auto") as "auto" | "rust_bge" | "provider"}
            onChange={(v) =>
              setEmbeddingSource(v === "auto" ? null : (v as EmbeddingSource))
            }
            options={[
              { value: "auto", label: "Auto" },
              { value: "rust_bge", label: "Local BGE-small" },
              { value: "provider", label: "AI Provider" },
            ]}
          />
        </SettingRow>
        <p className={cn(TEXT_HINT, "mt-1")}>
          {embeddingSource === "provider"
            ? "Uses your AI provider's embeddings API (e.g. LM Studio at http://localhost:1234/v1). Configure it as a Custom provider in the AI settings above."
            : embeddingSource === "rust_bge"
            ? "Uses the on-device BGE-small model. Download and load it below, then index your data."
            : "Automatically uses provider embeddings when available, otherwise falls back to the local BGE-small model."}
        </p>

        {/* Model paths */}
        <div className="space-y-2 mb-4">
          <SettingRow label="Model Status">
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
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {modelError}
            </p>
          )}

          {indexingError && (
            <p className="text-xs text-danger flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {indexingError}
            </p>
          )}
        </div>

        {/* Action buttons */}
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
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1.5" />
                Download BGE-Small
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
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4 mr-1.5" />
                Load Model
              </>
            )}
          </Button>
        </div>
      </SettingGroup>

      {/* ── Local Models Folder ── */}
      <SettingGroup
        title="Local Models Folder"
        description="Downloaded embedding models are stored here so they don't clutter the shared HF cache."
      >
        <SettingRow label="Location">
          <span className="text-xs font-mono text-text-tertiary max-w-[60%] truncate text-right">
            {modelsDir ?? "Loading…"}
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
            <FolderOpen className="w-4 h-4 mr-1.5" />
            Open folder
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={removeModel}
            disabled={!modelPath}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Remove model
          </Button>
        </div>

        {modelError && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {modelError}
          </p>
        )}
      </SettingGroup>

      {/* ── Indexing Control ── */}
      <SettingGroup
        title="Knowledge Base Indexing"
        description="Index your emails, attachments, and vault documents for semantic search"
      >
        <div className="space-y-2">
          <SettingRow label="Last Indexed">
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
              disabled={indexingStatus === "indexing" || modelStatus !== "loaded"}
            >
              {indexingStatus === "indexing" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Indexing…
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-1.5" />
                  Index All Data
                </>
              )}
            </Button>
          </div>

          {/* Re-index hint */}
          {lastIndexedAt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-text-tertiary hover:text-text-secondary"
              onClick={indexAll}
              disabled={indexingStatus === "indexing"}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Re-index
            </Button>
          )}
        </div>
      </SettingGroup>


      {/* ── Vector Database ── */}
      <SettingGroup
        title="Vector Database"
        description="LanceDB stores embedding vectors locally for semantic search. No external service required."
      >
        <SettingRow label="Engine">
          <span className="text-sm text-text-secondary">LanceDB (on-device)</span>
        </SettingRow>
        <SettingRow label="Storage Location">
          <span className="text-xs font-mono text-text-tertiary max-w-[60%] truncate text-right">
            {kbPath ?? "Loading…"}
          </span>
        </SettingRow>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={async () => {
              const ok = window.confirm(
                "Clear the entire knowledge base? This removes all indexed vectors. Re-index to rebuild.",
              );
              if (!ok) return;
              try {
                await aiResetVectorDb();
              } catch (err) {
                console.error("[LocalRagSettings] reset failed", err);
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear index
          </Button>
        </div>
      </SettingGroup>

      {/* ── Text Splitter / Chunking ── */}
      <SettingGroup
        title="Text Splitter & Chunking"
        description="How documents are split before embedding. Applies on the next index."
      >
        <SettingRow label="Splitter">
          <select
            value={splitter}
            onChange={async (e) => {
              const v = e.target.value;
              setSplitter(v as "paragraph" | "sentence" | "token");
              await setSetting("rag_splitter", v);
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="paragraph">Paragraph</option>
            <option value="sentence">Sentence</option>
            <option value="token">Token</option>
          </select>
        </SettingRow>
        <SettingRow label="Chunk Size (chars)">
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
        <SettingRow label="Chunk Overlap (chars)">
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
            text: "Local RAG keeps your data on-device. Embeddings can be generated locally using the BGE-small model (no API keys needed, no data leaves your machine) or via your AI provider's embeddings API (LM Studio, Ollama, OpenAI-compatible) for higher accuracy without downloading a model.",
          },
          {
            type: "how",
            text: "Choose your embedding source in the settings above — local BGE-small model or provider API. Download the model (if using local), then index your data into LanceDB. The AI Assistant page, thread summaries, and smart replies all use RAG context when enabled.",
          },
          {
            type: "when",
            text: "Perfect for offline-first usage, sensitive data that cannot leave your device, or when you want semantic search without cloud API costs. Provider embeddings are ideal if you already have an AI provider configured and want better accuracy.",
          },
        ]}
      />
    </>
  );
}
