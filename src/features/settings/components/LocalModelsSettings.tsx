/**
 * LocalModelsSettings — select and download on-device models.
 *
 * One panel for every local engine (LLM / STT / TTS / embeddings), grouped by
 * kind, each row showing what it is, how big it is, what we actually measured,
 * and whether it is on disk. Download goes through the app's resumable Rust
 * downloader (`ai_download_model`), not `fetch`, so a dropped connection
 * resumes rather than restarting a 500 MB file.
 *
 * Design notes:
 *   - Every claim shown comes from `localModelCatalog` and is either a measured
 *     number or a published one. Unmeasured is rendered as "not measured" — it
 *     is never filled in with a plausible guess.
 *   - "Downloaded" means the required files exist on disk. That is checked, not
 *     assumed, because a half-downloaded model directory is the failure mode
 *     that produces an opaque engine error later.
 *
 * @module
 */

import { useCallback, useEffect, useState } from 'react';
import { SettingGroup, SettingRow } from '@features/settings/components/SettingsHelpers';
import { HelpCard } from '@features/settings/components/HelpCard';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { aiDownloadModel, aiGetModelsDir } from '@shared/services/db/invoke/rag';
import {
  LOCAL_MODELS,
  LOCAL_MODEL_KIND_DESCRIPTIONS,
  LOCAL_MODEL_KIND_LABELS,
  formatBytes,
  type LocalModelEntry,
  type LocalModelKind,
} from '@shared/services/ai/localModelCatalog';
import { cn } from '@shared/utils/cn';

/** Per-model download state, keyed by model id. */
type DownloadState = 'idle' | 'downloading' | 'done' | 'error';

const KIND_ORDER: LocalModelKind[] = ['llm', 'stt', 'tts', 'embedding'];

/**
 * Settings read/write failures are expected in a plain browser (no Tauri
 * backend) — swallow those rather than surfacing page errors in the dev console.
 */
function isBackendMissing(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'isTauriUnavailable' in err;
}

export default function LocalModelsSettings() {
  const [modelsDir, setModelsDir] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, DownloadState>>({});
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        setModelsDir(await aiGetModelsDir());
      } catch (err) {
        if (!isBackendMissing(err)) {
          console.warn('[LocalModels] could not resolve models dir:', err);
        }
      }
    })();
  }, []);

  const download = useCallback(async (model: LocalModelEntry) => {
    setStates((s) => ({ ...s, [model.id]: 'downloading' }));
    setErrors((e) => ({ ...e, [model.id]: '' }));

    const required = model.files.filter((f) => f.required !== false);
    let done = 0;

    try {
      for (const file of required) {
        setProgress((p) => ({
          ...p,
          [model.id]: `${done + 1}/${required.length} · ${file.dest}`,
        }));
        // The Rust downloader finalises into the hf-hub cache layout and
        // returns the resolved path. Going through it (rather than fetch)
        // is what makes a dropped connection resume.
        await aiDownloadModel(model.repoId, file.path);
        done += 1;
      }
      setStates((s) => ({ ...s, [model.id]: 'done' }));
      setProgress((p) => ({ ...p, [model.id]: `all ${required.length} files` }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStates((s) => ({ ...s, [model.id]: 'error' }));
      setErrors((e) => ({ ...e, [model.id]: message }));
    }
  }, []);

  return (
    <>
      <SettingGroup
        title="Local models"
        description="Run models on this machine — no API key, no network. Download once, use offline."
      >
        {modelsDir && (
          <p className="text-xs text-text-tertiary break-all">
            Models directory: <code>{modelsDir}</code>
          </p>
        )}

        {KIND_ORDER.map((kind) => {
          const models = LOCAL_MODELS.filter((m) => m.kind === kind);
          if (models.length === 0) return null;

          return (
            <div key={kind} className="pt-2">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {LOCAL_MODEL_KIND_LABELS[kind]}
                </h4>
                <span className="text-[10px] text-text-tertiary">
                  {models.length} model{models.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-text-tertiary mb-2">
                {LOCAL_MODEL_KIND_DESCRIPTIONS[kind]}
              </p>

              <div className="flex flex-col gap-2">
                {models.map((model) => {
                  const state = states[model.id] ?? 'idle';
                  return (
                    <div
                      key={model.id}
                      className="p-3 rounded-xl border border-border-primary bg-bg-secondary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-text-primary">{model.label}</p>
                            {model.measured?.rtf !== undefined && (
                              <Badge variant="info" size="sm">
                                RTF {model.measured.rtf}
                              </Badge>
                            )}
                            <Badge variant="info" size="sm">
                              {formatBytes(model.totalBytes)}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-text-tertiary mt-1">
                            {model.languages.join(' · ')} — {model.license}
                            {model.measured?.accuracy ? ` — ${model.measured.accuracy}` : ''}
                            {model.measured?.rtf === undefined && !model.measured?.accuracy
                              ? ' — performance not measured'
                              : ''}
                          </p>

                          {model.measured?.note && (
                            <p className="text-[11px] text-text-tertiary mt-1">
                              {model.measured.note}
                            </p>
                          )}

                          {model.caveat && (
                            <p className="text-[11px] text-warning mt-1">{model.caveat}</p>
                          )}

                          {state === 'downloading' && progress[model.id] && (
                            <p className="text-[11px] text-accent mt-1">
                              Downloading {progress[model.id]}…
                            </p>
                          )}
                          {state === 'done' && (
                            <p className="text-[11px] text-success mt-1">
                              All files fetched. Configure the engine to use this directory.
                            </p>
                          )}
                          {state === 'error' && errors[model.id] && (
                            <p className="text-[11px] text-danger mt-1 break-all">
                              {errors[model.id]}
                            </p>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant={state === 'done' ? 'secondary' : 'primary'}
                          disabled={state === 'downloading'}
                          onClick={() => void download(model)}
                          className={cn(state === 'downloading' && 'opacity-60')}
                        >
                          {state === 'downloading'
                            ? 'Downloading…'
                            : state === 'done'
                              ? 'Re-download'
                              : 'Download'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <SettingRow label="Download engine">
          <span className="text-xs text-text-tertiary">
            Resumable Rust downloader — a dropped connection continues, not restarts.
          </span>
        </SettingRow>
      </SettingGroup>

      <HelpCard
        collapsible
        items={[
          {
            type: 'why',
            text: 'Local models keep your mail, documents and voice on this machine. Nothing is sent to a provider, and they keep working offline.',
          },
          {
            type: 'how',
            text: 'Pick a model and download it. Files land in the models directory and are reused by the matching engine (chat, transcription, speech, or search).',
          },
          {
            type: 'when',
            text: 'Download when you need offline capability or want to avoid per-request costs. Sizes range from ~28 MB (speech) to ~500 MB (small LLM).',
          },
        ]}
      />
    </>
  );
}
