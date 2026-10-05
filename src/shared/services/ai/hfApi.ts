/**
 * HuggingFace Hub API client — read-only model browsing and search.
 *
 * This is a thin wrapper around the HF Hub REST API. It lets the UI search,
 * filter, and list models without any Rust changes — the downloader already
 * handles HF repos.
 *
 * API docs: https://huggingface.co/docs/hub/api
 *
 * @module
 */

const HF_API_BASE = 'https://huggingface.co/api';

/** A model from the HF Hub API. */
export interface HfModel {
  id: string;
  name: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag: string;
  library_name: string;
  license: string;
  createdAt: string;
  lastModified: string;
  siblings: { rfilename: string }[];
}

/** Search parameters for the HF API. */
export interface HfSearchParams {
  search?: string;
  author?: string;
  filter?: string;
  sort?: string;
  direction?: string;
  limit?: number;
  full?: boolean;
  config?: boolean;
}

/** Fetch models from the HF Hub API. */
export async function searchHfModels(params: HfSearchParams = {}): Promise<HfModel[]> {
  const url = new URL(`${HF_API_BASE}/models`);
  if (params.search) url.searchParams.set('search', params.search);
  if (params.author) url.searchParams.set('author', params.author);
  if (params.filter) url.searchParams.set('filter', params.filter);
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.direction) url.searchParams.set('direction', params.direction);
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.full) url.searchParams.set('full', 'true');
  if (params.config) url.searchParams.set('config', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HF API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<HfModel[]>;
}

/** Get a single model by id. */
export async function getHfModel(modelId: string): Promise<HfModel> {
  const res = await fetch(`${HF_API_BASE}/models/${modelId}`);
  if (!res.ok) {
    throw new Error(`HF API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<HfModel>;
}

/** Get the file tree for a model repo. */
export async function getHfModelFiles(modelId: string): Promise<{ path: string; size?: number }[]> {
  const res = await fetch(`${HF_API_BASE}/models/${modelId}/tree/main`);
  if (!res.ok) {
    throw new Error(`HF API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { path: string; size?: number; type: string }[];
  return data.filter((f) => f.type === 'file').map((f) => ({ path: f.path, size: f.size }));
}

/** Format a large number for display. */
export function formatHfCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Get the pipeline tag label. */
export function getPipelineLabel(tag: string): string {
  const labels: Record<string, string> = {
    'text-generation': 'Text Generation',
    'text2text-generation': 'Text-to-Text',
    'automatic-speech-recognition': 'Speech Recognition',
    'text-to-speech': 'Text-to-Speech',
    'feature-extraction': 'Feature Extraction',
    'sentence-similarity': 'Sentence Similarity',
    'image-text-to-text': 'Vision Language',
    'text-classification': 'Classification',
    'token-classification': 'Token Classification',
    'question-answering': 'QA',
    'fill-mask': 'Fill Mask',
    summarization: 'Summarization',
    translation: 'Translation',
    'zero-shot-classification': 'Zero-Shot',
    'image-classification': 'Image Classification',
    'object-detection': 'Object Detection',
    'image-segmentation': 'Image Segmentation',
    'text-to-image': 'Text-to-Image',
    'image-to-text': 'Image-to-Text',
    'image-to-image': 'Image-to-Image',
    'audio-to-audio': 'Audio-to-Audio',
    'audio-classification': 'Audio Classification',
    'voice-activity-detection': 'VAD',
    'tabular-classification': 'Tabular Classification',
    'tabular-regression': 'Tabular Regression',
    'reinforcement-learning': 'RL',
    robotics: 'Robotics',
  };
  return labels[tag] ?? tag;
}
