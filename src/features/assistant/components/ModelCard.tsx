/**
 * ModelCard — shared abstract component for displaying a model with a download action.
 *
 * Used by both the local model picker (catalog-driven) and the HF browser
 * (API-driven). The download callback is provided by the parent — this
 * component only renders the row and the progress state.
 *
 * @module
 */

import { Download, CheckCircle, Loader2, XCircle, HardDrive } from 'lucide-react';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { DownloadProgress } from './DownloadProgress';
import type { DownloaderProgressEvent } from '@shared/services/db/invoke/downloader';

export interface ModelCardProps {
  /** Unique model id */
  id: string;
  /** Display name */
  label: string;
  /** Short description / capability tag */
  description?: string;
  /** Total size in bytes (optional) */
  sizeBytes?: number;
  /** License tag */
  license?: string;
  /** Pipeline / task tag (HF) */
  pipelineTag?: string;
  /** Download progress event, if a job is active */
  progress: DownloaderProgressEvent | null;
  /** Status: idle | downloading | paused | completed | error */
  status?: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  /** Whether this model is currently selected */
  selected?: boolean;
  /** Error message */
  error?: string | null;
  /** Called when the user presses download / re-download */
  onDownload: () => void;
  /** Called when the user presses pause */
  onPause?: () => void;
  /** Called when the user presses resume */
  onResume?: () => void;
  /** Called when the user presses cancel */
  onCancel?: () => void;
  /** Called when the user selects this model */
  onSelect?: () => void;
  /** Hide the select radio button */
  hideSelect?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function ModelCard({
  id,
  label,
  description,
  sizeBytes,
  license,
  pipelineTag,
  progress,
  status = 'idle',
  selected,
  error,
  onDownload,
  onPause,
  onResume,
  onCancel,
  onSelect,
  hideSelect = false,
  className = '',
}: ModelCardProps) {
  const isActive = status === 'downloading' || status === 'paused';
  const isDone = status === 'completed';
  const isError = status === 'error';

  return (
    <div
      className={`p-3 rounded-xl border transition-colors ${
        selected
          ? 'border-accent bg-accent/5'
          : 'border-border-primary bg-bg-secondary hover:bg-bg-hover'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        {!hideSelect && (
          <button
            type="button"
            onClick={onSelect}
            className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              selected
                ? 'border-accent bg-accent'
                : 'border-border-primary hover:border-text-tertiary'
            }`}
            aria-label={`Select ${label}`}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-bg-primary" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium ${selected ? 'text-accent' : 'text-text-primary'}`}
            >
              {label}
            </span>
            {isDone && (
              <Badge variant="success" size="sm">
                <CheckCircle size={10} /> Downloaded
              </Badge>
            )}
            {isError && (
              <Badge variant="danger" size="sm">
                <XCircle size={10} /> Failed
              </Badge>
            )}
            {pipelineTag && (
              <Badge variant="info" size="sm">
                {pipelineTag}
              </Badge>
            )}
            {license && <span className="text-[10px] text-text-tertiary">{license}</span>}
          </div>

          {description && <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {sizeBytes != null && (
              <span className="text-[11px] text-text-tertiary">
                <HardDrive size={10} className="inline mr-0.5" />
                {sizeBytes < 1024 * 1024 * 1024
                  ? `${(sizeBytes / (1024 * 1024)).toFixed(0)} MB`
                  : `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`}
              </span>
            )}
          </div>

          {/* Download progress */}
          {isActive && (
            <DownloadProgress
              progress={progress}
              status={status}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              label={id}
            />
          )}
          {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
        </div>

        {/* Download button */}
        <Button
          size="sm"
          variant={isDone ? 'secondary' : 'primary'}
          onClick={onDownload}
          disabled={isActive}
          className="shrink-0"
        >
          {isActive ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              {status === 'paused' ? 'Paused' : 'Downloading…'}
            </>
          ) : isDone ? (
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
}
