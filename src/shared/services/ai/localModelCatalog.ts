/**
 * Local model catalog — the selectable, downloadable on-device models.
 *
 * This is the single source of truth for "which local models can this app run,
 * and where do their files come from". It exists because the three on-device
 * engines have *different* file layouts and download shapes, and the UI needs
 * one uniform way to present them:
 *
 *   - `stt`       sherpa-onnx transducer: encoder/decoder/joiner `.onnx` + tokens
 *   - `tts`       sherpa-onnx VITS/Piper: model `.onnx` + tokens + espeak-ng-data/
 *   - `embedding` candle/HF: single `.safetensors` + tokenizer
 *   - `llm`       candle/HF causal LM: sharded weights + tokenizer
 *
 * Every entry carries the measured or documented facts we actually have. Where a
 * number is unmeasured it is omitted rather than guessed — see
 * `docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` §10 for the
 * measurements behind the RTF figures.
 *
 * @module
 */

import type { AiCapability } from '@shared/services/ai/capabilities';

/** Which on-device engine runs a model. */
export type LocalModelKind = 'stt' | 'tts' | 'embedding' | 'llm';

/**
 * How the files are obtained.
 *
 * `hf-files` downloads named files from a HuggingFace repo via the resumable
 * Rust downloader. `hf-snapshot` would pull a whole repo — not implemented yet,
 * so no catalog entry uses it (an entry that cannot be downloaded is worse than
 * an absent one).
 */
export type LocalModelSource = 'hf-files';

export interface LocalModelFile {
  /** Path inside the HF repo. */
  path: string;
  /** Destination filename inside the model directory (may differ from `path`). */
  dest: string;
  /** Bytes, when known. Used for the size total and progress estimates. */
  sizeBytes?: number;
  /** Required for the model to load. Optional files are skipped if absent. */
  required?: boolean;
}

export interface LocalModelEntry {
  /** Stable id — also the directory name under the models dir. */
  id: string;
  /** Human label. */
  label: string;
  kind: LocalModelKind;
  /** The capability this model satisfies (for registry cross-reference). */
  capability: AiCapability;
  /** HuggingFace repo id. */
  repoId: string;
  /** Where the files come from. */
  source: LocalModelSource;
  /** Files to fetch, with destination names the engine expects. */
  files: LocalModelFile[];
  /** Total download size in bytes (sum of `files[].sizeBytes`). */
  totalBytes: number;
  /** BCP-47-ish language tags the model handles. */
  languages: string[];
  /** Licence, as declared by the model publisher. */
  license: string;
  /**
   * Measured or published performance. Only present when we have a real number.
   * `rtf` is processing_time / audio_duration — below 1.0 is faster than real time.
   */
  measured?: { rtf?: number; accuracy?: string; note?: string };
  /** Anything a user must know before downloading. */
  caveat?: string;
}

// ── Catalog ────────────────────────────────────────────────────────────────

/**
 * The on-device models this app can actually run.
 *
 * Sizes are the published file sizes (checked against the HF API). They are used
 * for progress display, so an approximate value is acceptable but a wrong one is
 * not — each was read from the repo listing.
 */
export const LOCAL_MODELS: LocalModelEntry[] = [
  // ── STT (sherpa-onnx transducer) ─────────────────────────────────────────
  {
    id: 'zipformer-small-en',
    label: 'Zipformer Small — English',
    kind: 'stt',
    capability: 'stt',
    repoId: 'csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26',
    source: 'hf-files',
    files: [
      {
        path: 'encoder-epoch-99-avg-1.int8.onnx',
        dest: 'encoder-epoch-99-avg-1.int8.onnx',
        sizeBytes: 26_015_366,
        required: true,
      },
      {
        path: 'decoder-epoch-99-avg-1.int8.onnx',
        dest: 'decoder-epoch-99-avg-1.int8.onnx',
        sizeBytes: 1_307_236,
        required: true,
      },
      {
        path: 'joiner-epoch-99-avg-1.int8.onnx',
        dest: 'joiner-epoch-99-avg-1.int8.onnx',
        sizeBytes: 259_335,
        required: true,
      },
      { path: 'tokens.txt', dest: 'tokens.txt', sizeBytes: 5_048, required: true },
    ],
    totalBytes: 27_586_985,
    languages: ['en'],
    license: 'Apache-2.0',
    measured: { rtf: 0.033, accuracy: '0.998 similarity vs published transcript' },
    caveat:
      'Measured on a desktop CPU with 2 threads, batch latency. RTF will be worse on a loaded or mobile device.',
  },
  {
    id: 'nemo-canary-180m-flash',
    label: 'NeMo Canary 180M Flash — Multilingual',
    kind: 'stt',
    capability: 'stt',
    repoId: 'csukuangfj/sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr',
    source: 'hf-files',
    files: [
      { path: 'encoder.onnx', dest: 'encoder.onnx', sizeBytes: 461_500_000, required: true },
      { path: 'decoder.onnx', dest: 'decoder.onnx', sizeBytes: 295_100_000, required: true },
      { path: 'tokens.txt', dest: 'tokens.txt', required: true },
    ],
    totalBytes: 756_600_000,
    languages: ['en', 'es', 'de', 'fr'],
    license: 'CC-BY-4.0',
    caveat:
      'Large (~757 MB). Not yet measured end-to-end — the size is the trade-off for 4 languages.',
  },

  // ── TTS (sherpa-onnx VITS / Piper) ───────────────────────────────────────
  {
    id: 'piper-fr-siwis-medium',
    label: 'Piper Siwis — French (medium)',
    kind: 'tts',
    capability: 'tts',
    repoId: 'csukuangfj/vits-piper-fr_FR-siwis-medium',
    source: 'hf-files',
    files: [
      {
        path: 'fr_FR-siwis-medium.onnx',
        dest: 'fr_FR-siwis-medium.onnx',
        sizeBytes: 63_201_421,
        required: true,
      },
      { path: 'tokens.txt', dest: 'tokens.txt', sizeBytes: 921, required: true },
      // espeak-ng-data is 355 files. Only the ones Piper actually needs to
      // phonemise French are listed; the rest are voice-style definitions for
      // languages this app does not speak. The COMPLETE lang/<family>/<code>
      // voice definition is mandatory — a partial set fails at load with
      // "Failed to set eSpeak-ng voice" (found the hard way).
      {
        path: 'espeak-ng-data/phondata',
        dest: 'espeak-ng-data/phondata',
        sizeBytes: 550_424,
        required: true,
      },
      {
        path: 'espeak-ng-data/phonindex',
        dest: 'espeak-ng-data/phonindex',
        sizeBytes: 39_074,
        required: true,
      },
      {
        path: 'espeak-ng-data/phontab',
        dest: 'espeak-ng-data/phontab',
        sizeBytes: 55_796,
        required: true,
      },
      {
        path: 'espeak-ng-data/intonations',
        dest: 'espeak-ng-data/intonations',
        sizeBytes: 2_040,
        required: true,
      },
      {
        path: 'espeak-ng-data/fr_dict',
        dest: 'espeak-ng-data/fr_dict',
        sizeBytes: 63_727,
        required: true,
      },
      {
        path: 'espeak-ng-data/en_dict',
        dest: 'espeak-ng-data/en_dict',
        sizeBytes: 166_944,
        required: true,
      },
      {
        path: 'espeak-ng-data/lang/roa/fr',
        dest: 'espeak-ng-data/lang/roa/fr',
        sizeBytes: 79,
        required: true,
      },
    ],
    totalBytes: 64_080_426,
    languages: ['fr'],
    license: 'MIT',
    measured: {
      rtf: 0.573,
      note: 'A later run of the same voice measured 0.105 — plan with the conservative 0.573.',
    },
    caveat:
      'The "medium" voice is the slower tier. A "low" voice is faster but less natural — measure before live use.',
  },
  {
    id: 'piper-en-amy-low',
    label: 'Piper Amy — English (low)',
    kind: 'tts',
    capability: 'tts',
    repoId: 'csukuangfj/vits-piper-en_US-amy-low',
    source: 'hf-files',
    files: [
      {
        path: 'en_US-amy-low.onnx',
        dest: 'en_US-amy-low.onnx',
        sizeBytes: 63_100_000,
        required: true,
      },
      { path: 'tokens.txt', dest: 'tokens.txt', required: true },
      {
        path: 'espeak-ng-data/phondata',
        dest: 'espeak-ng-data/phondata',
        sizeBytes: 550_424,
        required: true,
      },
      {
        path: 'espeak-ng-data/phonindex',
        dest: 'espeak-ng-data/phonindex',
        sizeBytes: 39_074,
        required: true,
      },
      {
        path: 'espeak-ng-data/phontab',
        dest: 'espeak-ng-data/phontab',
        sizeBytes: 55_796,
        required: true,
      },
      {
        path: 'espeak-ng-data/intonations',
        dest: 'espeak-ng-data/intonations',
        sizeBytes: 2_040,
        required: true,
      },
      {
        path: 'espeak-ng-data/en_dict',
        dest: 'espeak-ng-data/en_dict',
        sizeBytes: 166_944,
        required: true,
      },
      { path: 'espeak-ng-data/lang/gmw/en', dest: 'espeak-ng-data/lang/gmw/en', required: true },
    ],
    totalBytes: 63_914_278,
    languages: ['en'],
    license: 'MIT',
    caveat: '"low" quality — faster but less natural than "medium". Not yet measured on this host.',
  },

  // ── Embeddings (candle / HF) ─────────────────────────────────────────────
  {
    id: 'bge-small-en-v1.5',
    label: 'BGE Small EN v1.5 — Embeddings',
    kind: 'embedding',
    capability: 'embedding',
    repoId: 'BAAI/bge-small-en-v1.5',
    source: 'hf-files',
    files: [
      {
        path: 'model.safetensors',
        dest: 'model.safetensors',
        sizeBytes: 133_466_112,
        required: true,
      },
      { path: 'tokenizer.json', dest: 'tokenizer.json', sizeBytes: 711_396, required: true },
      { path: 'config.json', dest: 'config.json', sizeBytes: 743, required: true },
      {
        path: 'tokenizer_config.json',
        dest: 'tokenizer_config.json',
        sizeBytes: 366,
        required: true,
      },
    ],
    totalBytes: 134_178_617,
    languages: ['en'],
    license: 'MIT',
    measured: { note: 'Already the default RAG embedding model in this app.' },
  },

  // ── LLM (candle / HF causal LM) ──────────────────────────────────────────
  {
    id: 'qwen2.5-0.5b-instruct',
    label: 'Qwen2.5 0.5B Instruct — Small LLM',
    kind: 'llm',
    capability: 'text',
    repoId: 'Qwen/Qwen2.5-0.5B-Instruct',
    source: 'hf-files',
    files: [
      {
        path: 'model.safetensors',
        dest: 'model.safetensors',
        sizeBytes: 494_032_784,
        required: true,
      },
      { path: 'tokenizer.json', dest: 'tokenizer.json', sizeBytes: 7_031_645, required: true },
      { path: 'config.json', dest: 'config.json', sizeBytes: 660, required: true },
      {
        path: 'generation_config.json',
        dest: 'generation_config.json',
        sizeBytes: 143,
        required: false,
      },
    ],
    totalBytes: 501_065_232,
    languages: ['en', 'zh'],
    license: 'Apache-2.0',
    caveat:
      'The sidecar’s text-generation path streams a "not available" progress until a causal LM is bound. Downloading the weights is not the same as it being wired up — treat this as staged, not working.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

export function getLocalModelsByKind(kind: LocalModelKind): LocalModelEntry[] {
  return LOCAL_MODELS.filter((m) => m.kind === kind);
}

export function getLocalModelById(id: string): LocalModelEntry | undefined {
  return LOCAL_MODELS.find((m) => m.id === id);
}

/** Human-readable size, e.g. "27.6 MB". */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  // 1 decimal for MB/GB, none for B/KB — a size like "550.4 KB" is noise.
  return `${value.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

/** Total size of a kind, for a section header. */
export function totalBytesForKind(kind: LocalModelKind): number {
  return getLocalModelsByKind(kind).reduce((sum, m) => sum + m.totalBytes, 0);
}

export const LOCAL_MODEL_KIND_LABELS: Record<LocalModelKind, string> = {
  llm: 'Text generation (LLM)',
  stt: 'Speech to text',
  tts: 'Text to speech',
  embedding: 'Embeddings (RAG)',
};

export const LOCAL_MODEL_KIND_DESCRIPTIONS: Record<LocalModelKind, string> = {
  llm: 'On-device chat completion. No API key, no network — text never leaves the machine.',
  stt: 'Transcribe audio locally. Runs on CPU; no cloud speech service.',
  tts: 'Speak text aloud locally. Ships a voice model plus its phoneme data.',
  embedding: 'Turn text into vectors for local RAG search over your mail and documents.',
};
