/**
 * ModelPicker — LM Studio-style selectable model list for local models.
 *
 * Groups models by kind (LLM, STT, TTS, Embedding), shows download
 * status, progress, and lets the user pick one active model.
 * Persists the selection to settings.
 *
 * @module
 */

import { useState, useCallback } from 'react';
import { HardDrive, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getLocalModelsByKind,
  getLocalModelById,
  formatBytes,
  LOCAL_MODEL_KIND_LABELS,
  LOCAL_MODEL_KIND_DESCRIPTIONS,
  type LocalModelKind,
  type LocalModelEntry,
} from '@shared/services/ai/localModelCatalog';
import { downloaderCreateJob } from '@shared/services/db/invoke/downloader';
import { setSetting } from '@features/settings/db/settings';
import { ModelCard } from './ModelCard';
import type { DownloaderProgressEvent } from '@shared/services/db/invoke/downloader';

const KIND_ORDER: LocalModelKind[] = ['llm', 'embedding', 'stt', 'tts'];

interface ModelPickerState {
  selectedModel: string | null;
  downloading: string | null;
  downloadProgress: Record<string, DownloaderProgressEvent>;
  downloadStatus: Record<string, 'idle' | 'downloading' | 'paused' | 'completed' | 'error'>;
  downloadError: Record<string, string | null>;
  expandedKinds: Record<LocalModelKind, boolean>;
}

export function ModelPicker() {
  const [state, setState] = useState<ModelPickerState>({
    selectedModel: null,
    downloading: null,
    downloadProgress: {},
    downloadStatus: {},
    downloadError: {},
    expandedKinds: { llm: true, embedding: false, stt: false, tts: false },
  });

  const toggleKind = useCallback((kind: LocalModelKind) => {
    setState((prev) => ({
      ...prev,
      expandedKinds: { ...prev.expandedKinds, [kind]: !prev.expandedKinds[kind] },
    }));
  }, []);

  const handleDownload = useCallback(async (model: LocalModelEntry) => {
    setState((prev) => ({
      ...prev,
      downloading: model.id,
      downloadStatus: { ...prev.downloadStatus, [model.id]: 'downloading' },
      downloadError: { ...prev.downloadError, [model.id]: null },
    }));
    try {
      const mainFile =
        model.files.find((f) => f.required && f.path.endsWith('.safetensors')) ?? model.files[0];
      if (!mainFile) {
        throw new Error('No downloadable file found');
      }
      await downloaderCreateJob({
        url: `https://huggingface.co/${model.repoId}/resolve/main/${mainFile.path}`,
        destinationPath: `models/${model.id}/${mainFile.dest}`,
        category: 'ai_model',
        options: {
          hfRepoId: model.repoId,
          hfFilename: mainFile.path,
        },
      });
      setState((prev) => ({
        ...prev,
        downloading: null,
        downloadStatus: { ...prev.downloadStatus, [model.id]: 'completed' },
      }));
      // Persist selection
      await setSetting('local_model_id', model.id);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        downloading: null,
        downloadStatus: { ...prev.downloadStatus, [model.id]: 'error' },
        downloadError: {
          ...prev.downloadError,
          [model.id]: err instanceof Error ? err.message : 'Download failed',
        },
      }));
    }
  }, []);

  const handleSelect = useCallback(async (modelId: string) => {
    setState((prev) => ({ ...prev, selectedModel: modelId }));
    await setSetting('local_model_id', modelId);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-tertiary">
        On-device models you can download and run locally. No API key needed — text never leaves the
        machine.
      </p>

      {KIND_ORDER.map((kind) => {
        const models = getLocalModelsByKind(kind);
        const expanded = state.expandedKinds[kind];
        const kindLabel = LOCAL_MODEL_KIND_LABELS[kind];
        const kindDesc = LOCAL_MODEL_KIND_DESCRIPTIONS[kind];
        const totalSize = models.reduce((s, m) => s + m.totalBytes, 0);

        return (
          <div
            key={kind}
            className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden"
          >
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleKind(kind)}
              className="w-full flex items-center gap-3 p-3 hover:bg-bg-hover transition-colors text-left"
            >
              {expanded ? (
                <ChevronDown size={14} className="text-text-tertiary shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-text-tertiary shrink-0" />
              )}
              <HardDrive size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{kindLabel}</p>
                <p className="text-[11px] text-text-tertiary">{kindDesc}</p>
              </div>
              <span className="text-[11px] text-text-tertiary shrink-0">
                {models.length} model{models.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
              </span>
            </button>

            {/* Expanded model list */}
            {expanded && (
              <div className="px-3 pb-3 space-y-2">
                {models.map((model) => {
                  const isSelected = state.selectedModel === model.id;
                  const status = state.downloadStatus[model.id] ?? 'idle';
                  const progress = state.downloadProgress[model.id] ?? null;
                  const error = state.downloadError[model.id] ?? null;

                  return (
                    <ModelCard
                      key={model.id}
                      id={model.id}
                      label={model.label}
                      description={model.caveat}
                      sizeBytes={model.totalBytes}
                      license={model.license}
                      pipelineTag={model.kind === 'llm' ? 'text-generation' : undefined}
                      progress={progress}
                      status={status}
                      selected={isSelected}
                      error={error}
                      onDownload={() => void handleDownload(model)}
                      onSelect={() => void handleSelect(model.id)}
                      hideSelect={false}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Selected model summary */}
      {state.selectedModel && (
        <div className="p-3 rounded-xl border border-accent/30 bg-accent/5">
          <p className="text-xs font-medium text-accent">Selected model</p>
          <p className="text-sm text-text-primary mt-0.5">
            {getLocalModelById(state.selectedModel)?.label ?? state.selectedModel}
          </p>
        </div>
      )}
    </div>
  );
}
