/**
 * HfModelBrowser — search and browse HuggingFace models.
 *
 * Lets the user search the HF Hub, filter by task, and see model metadata
 * (downloads, likes, license, tags). Download is handled by the existing
 * Rust downloader via `downloaderCreateJob` with HF options.
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import {
  searchHfModels,
  formatHfCount,
  getPipelineLabel,
  type HfModel,
} from '@shared/services/ai/hfApi';
import { downloaderCreateJob } from '@shared/services/db/invoke/downloader';

const PIPELINE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'text-generation', label: 'Text Generation' },
  { value: 'automatic-speech-recognition', label: 'Speech Recognition' },
  { value: 'text-to-speech', label: 'Text-to-Speech' },
  { value: 'feature-extraction', label: 'Embeddings' },
  { value: 'image-text-to-text', label: 'Vision' },
];

export function HfModelBrowser() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [models, setModels] = useState<HfModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchHfModels({
        search: query || undefined,
        filter: filter || undefined,
        sort: 'downloads',
        direction: '-1',
        limit: 20,
      });
      setModels(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    void search();
  }, [search]);

  const handleDownload = async (model: HfModel) => {
    setDownloading(model.id);
    try {
      // Use the Rust downloader with HF options
      // The downloader will resolve the HF URL and download the model files
      const mainFile = model.siblings.find(
        (f) =>
          f.rfilename.endsWith('.safetensors') ||
          f.rfilename.endsWith('.onnx') ||
          f.rfilename.endsWith('.gguf'),
      );

      if (!mainFile) {
        setError('No downloadable file found for this model');
        return;
      }

      await downloaderCreateJob({
        url: `https://huggingface.co/${model.id}/resolve/main/${mainFile.rfilename}`,
        destinationPath: `models/${model.id}/${mainFile.rfilename}`,
        category: 'ai_model',
        options: {
          hfRepoId: model.id,
          hfFilename: mainFile.rfilename,
        },
      });

      setDownloaded((prev) => new Set(prev).add(model.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Search HuggingFace models…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-primary bg-bg-secondary text-text-primary text-sm placeholder:text-text-tertiary"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="glass-select text-text-primary text-sm px-3 py-2 rounded-lg border border-border-primary"
        >
          {PIPELINE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Button variant="primary" size="md" onClick={search} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg border border-danger/30 bg-danger/5 text-sm text-danger">
          {error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-sm text-text-tertiary text-center py-8">Loading models…</div>
      ) : models.length === 0 ? (
        <div className="text-sm text-text-tertiary text-center py-8">No models found</div>
      ) : (
        <div className="space-y-2">
          {models.map((model) => {
            const isDownloaded = downloaded.has(model.id);
            const isDownloading = downloading === model.id;
            return (
              <div
                key={model.id}
                className="p-3 rounded-xl border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://huggingface.co/${model.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-text-primary hover:text-accent transition-colors"
                      >
                        {model.id}
                      </a>
                      <ExternalLink size={12} className="text-text-tertiary" />
                      {isDownloaded && (
                        <Badge variant="success" size="sm">
                          <CheckCircle size={10} />
                          Downloaded
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {model.pipeline_tag && (
                        <Badge variant="info" size="sm">
                          {getPipelineLabel(model.pipeline_tag)}
                        </Badge>
                      )}
                      <span className="text-[11px] text-text-tertiary">
                        {formatHfCount(model.downloads)} downloads · {formatHfCount(model.likes)}{' '}
                        likes
                      </span>
                      {model.license && (
                        <span className="text-[11px] text-text-tertiary">{model.license}</span>
                      )}
                    </div>
                    {model.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {model.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isDownloaded ? 'secondary' : 'primary'}
                    onClick={() => void handleDownload(model)}
                    disabled={isDownloading}
                    className="shrink-0"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Downloading…
                      </>
                    ) : isDownloaded ? (
                      'Re-download'
                    ) : (
                      <>
                        <Download size={12} />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
