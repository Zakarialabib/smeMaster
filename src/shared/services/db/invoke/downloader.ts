/**
 * Resumable downloader Tauri command wrappers.
 *
 * The backend streams live progress over the `downloader:progress` event
 * (see `ragStore.downloadProgress`); these commands manage job lifecycle
 * and provide rehydration after a reload.
 *
 * @module
 */

import { invokeCommand } from './command';

// ── Types (mirror `DownloadJobProgress` / `CreateDownloadJob`) ──────────────

/** Job lifecycle — matches Rust `JobStatus` (snake_case on the wire). */
export type DownloaderJobStatus =
  'queued' | 'probing' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Job category — matches Rust `JobCategory`. */
export type DownloaderJobCategory = 'ai_model' | 'generic';

/** Progress snapshot returned by commands and `downloader:progress` events. */
export interface DownloaderJobProgress {
  jobId: string;
  url: string;
  fileName: string;
  destinationPath: string;
  category: DownloaderJobCategory;
  status: DownloaderJobStatus;
  totalBytes: number;
  downloadedBytes: number;
  transferRateBytesPerSec: number;
  etaSeconds: number | null;
  progressPercentage: number;
  activeConnections: number;
  priority: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload of the `downloader:progress` Tauri event. */
export interface DownloaderProgressEvent extends DownloaderJobProgress {
  /** Present on boot-recovery pings only (no job attached). */
  bootRecovery?: boolean;
}

/** HuggingFace metadata carried in `DownloadJobOptions` (camelCase). */
export interface DownloaderJobOptions {
  authBearerToken?: string;
  hfRepoId?: string;
  hfFilename?: string;
  hfRevision?: string;
  hfCommitHash?: string;
}

export interface CreateDownloadJobPayload {
  url: string;
  destinationPath: string;
  category: DownloaderJobCategory;
  expectedSha256?: string | null;
  priority?: number;
  maxConnections?: number;
  options?: DownloaderJobOptions;
}

// ── Commands ────────────────────────────────────────────────────────────────

/**
 * Enqueue a download. Fire-and-forget: progress arrives via the
 * `downloader:progress` event; poll `downloaderGetJob` as fallback.
 */
export async function downloaderCreateJob(
  payload: CreateDownloadJobPayload,
): Promise<DownloaderJobProgress> {
  return invokeCommand<DownloaderJobProgress>('downloader_create_job', { payload });
}

/** Latest snapshot of a single job. */
export async function downloaderGetJob(jobId: string): Promise<DownloaderJobProgress> {
  return invokeCommand<DownloaderJobProgress>('downloader_get_job', { jobId });
}

/**
 * List jobs, newest first, filtered by category and/or status.
 * Use on mount to rehydrate in-flight downloads after a reload.
 */
export async function downloaderListJobs(
  category?: DownloaderJobCategory,
  status?: DownloaderJobStatus,
): Promise<DownloaderJobProgress[]> {
  return invokeCommand<DownloaderJobProgress[]>('downloader_list_jobs', { category, status });
}

/**
 * Flip a job to `paused`. In-flight streams abort at the next flush
 * boundary (≤512KB) without losing downloaded bytes.
 */
export async function downloaderPauseJob(jobId: string): Promise<void> {
  return invokeCommand<void>('downloader_pause_job', { jobId });
}

/** Resume a paused/failed job — chunk offsets + ETag validation make it a true resume. */
export async function downloaderResumeJob(jobId: string): Promise<void> {
  return invokeCommand<void>('downloader_resume_job', { jobId });
}

/** Cancel a job; optionally delete its partial `.part` files. */
export async function downloaderCancelJob(
  jobId: string,
  deletePartialFiles?: boolean,
): Promise<void> {
  return invokeCommand<void>('downloader_cancel_job', { jobId, deletePartialFiles });
}

/** Remove finished (completed/failed/cancelled) job rows. */
export async function downloaderClearFinished(): Promise<number> {
  return invokeCommand<number>('downloader_clear_finished');
}
