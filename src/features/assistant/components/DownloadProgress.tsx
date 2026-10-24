/**
 * DownloadProgress — shared progress bar with pause/resume/cancel.
 *
 * Reusable across all download surfaces (model downloads,
 * sync downloads, etc.). Accepts a DownloaderProgressEvent
 * or manual progress state.
 *
 * @module
 */

import { type DownloaderProgressEvent } from '@shared/services/db/invoke/downloader';
import { cn } from '@shared/utils/cn';

export interface DownloadProgressProps {
  /** Live progress from the downloader, or manual override */
  progress: DownloaderProgressEvent | null;
  /** Current status when no live progress event is available */
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  /** Called when the user presses pause */
  onPause?: () => void;
  /** Called when the user presses resume */
  onResume?: () => void;
  /** Called when the user presses cancel */
  onCancel?: () => void;
  /** Optional label shown above the bar */
  label?: string;
  /** Hide the pause/resume/cancel buttons */
  hideControls?: boolean;
}

export function DownloadProgress({
  progress,
  status,
  onPause,
  onResume,
  onCancel,
  label,
  hideControls = false,
}: DownloadProgressProps) {
  const pct = progress?.progressPercentage ?? 0;
  const isActive = status === 'downloading' || status === 'paused';
  const isDone = status === 'completed';
  const isError = status === 'error';

  return (
    <div className="w-full space-y-2">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">{label}</span>
          <span className="text-text-tertiary">{pct}%</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-bg-hover overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isDone ? 'bg-success' : isError ? 'bg-danger' : 'bg-accent',
          )}
          style={{ width: `${isDone ? 100 : pct}%` }}
        />
      </div>

      {/* Controls */}
      {!hideControls && isActive && (
        <div className="flex items-center gap-2">
          {status === 'downloading' && onPause && (
            <button
              type="button"
              onClick={onPause}
              className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2"
            >
              Pause
            </button>
          )}
          {status === 'paused' && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2"
            >
              Resume
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-danger hover:underline underline-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
