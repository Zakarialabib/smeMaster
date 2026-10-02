//! Offline speech-to-text via `sherpa-onnx`.
//!
//! Gated behind the `offline-speech` cargo feature. The crate's default
//! `static` feature builds onnxruntime from source (cmake + a C++ toolchain +
//! several GB), so it stays optional until proven on the target host — see
//! `docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` §10.
//!
//! ## Why sherpa-onnx and not candle whisper
//!
//! One engine for speech: sherpa-onnx bundles STT + TTS + VAD + diarization
//! behind one Rust binding, and TTS is 88% of the variable voice cost
//! (`docs/voice/dev/SELF-HOSTING.md` §2). Candle whisper gives STT only, so
//! choosing it would force a second engine later for TTS. Candle stays for
//! embeddings. See the engine decision in the doc above, §3.
//!
//! ## Model files
//!
//! sherpa-onnx takes **explicit file paths** (encoder/decoder/joiner/tokens),
//! not a repo id — unlike the BGE flow which resolves through `hf-hub`. The
//! caller is therefore responsible for having the files on disk; `load` only
//! validates that each path exists and reports which one is missing.

use anyhow::{anyhow, Result};
use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig, OfflineTransducerModelConfig};
use std::path::Path;

/// A loaded offline recognizer plus the model identity it was built from.
pub struct SttEngine {
    recognizer: OfflineRecognizer,
    /// Model directory this engine was loaded from (for `list_models` / status).
    model_dir: String,
    /// Thread count the recognizer was built with.
    num_threads: i32,
}

/// Explicit model paths for a transducer (zipformer) STT model.
///
/// Transducer models ship as four files. The offline (non-streaming) variants
/// are what batch transcription needs; streaming zipformers are for live calls
/// and are out of scope here.
pub struct SttModelPaths {
    pub encoder: String,
    pub decoder: String,
    pub joiner: String,
    pub tokens: String,
}

impl SttModelPaths {
    /// Build the conventional four paths inside a model directory.
    ///
    /// sherpa-onnx model releases use a stable naming convention; this is a
    /// convenience, not a guess — `load` still verifies every path exists.
    pub fn in_dir(dir: &str) -> Self {
        let join = |name: &str| Path::new(dir).join(name).to_string_lossy().to_string();
        Self {
            encoder: join("encoder.onnx"),
            decoder: join("decoder.onnx"),
            joiner: join("joiner.onnx"),
            tokens: join("tokens.txt"),
        }
    }

    /// Return every path that does not exist on disk.
    ///
    /// Checked up front so a missing file reports *which* file, rather than
    /// surfacing as an opaque onnxruntime load failure.
    pub fn missing(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if !Path::new(&self.encoder).exists() {
            missing.push("encoder");
        }
        if !Path::new(&self.decoder).exists() {
            missing.push("decoder");
        }
        if !Path::new(&self.joiner).exists() {
            missing.push("joiner");
        }
        if !Path::new(&self.tokens).exists() {
            missing.push("tokens");
        }
        missing
    }
}

impl SttEngine {
    /// Load a transducer model from explicit paths.
    ///
    /// `num_threads` follows the repo convention of leaving headroom: passing 0
    /// or a negative value lets sherpa-onnx pick, which on a busy host can
    /// starve the UI thread.
    pub fn load(paths: &SttModelPaths, model_dir: &str, num_threads: i32) -> Result<Self> {
        let missing = paths.missing();
        if !missing.is_empty() {
            return Err(anyhow!(
                "incomplete STT model in {model_dir}: missing {} (expected encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt)",
                missing.join(", ")
            ));
        }

        let config = OfflineRecognizerConfig {
            model_config: sherpa_onnx::OfflineModelConfig {
                transducer: OfflineTransducerModelConfig {
                    encoder: Some(paths.encoder.clone()),
                    decoder: Some(paths.decoder.clone()),
                    joiner: Some(paths.joiner.clone()),
                },
                tokens: Some(paths.tokens.clone()),
                model_type: "zipformer".to_string(),
                num_threads,
                debug: false,
                provider: Some("cpu".to_string()),
                ..Default::default()
            },
            ..Default::default()
        };

        let recognizer = OfflineRecognizer::create(&config)
            .ok_or_else(|| anyhow!("sherpa-onnx failed to create a recognizer for {model_dir}"))?;

        Ok(Self {
            recognizer,
            model_dir: model_dir.to_string(),
            num_threads,
        })
    }

    /// Transcribe 16 kHz mono f32 samples.
    ///
    /// Returns the recognised text. An empty string is a legitimate result
    /// (silence, or audio the model has nothing to say about) — it is **not**
    /// an error, and callers must not treat it as one.
    pub fn transcribe_samples(&self, samples: &[f32], sample_rate: i32) -> Result<String> {
        if samples.is_empty() {
            return Ok(String::new());
        }

        let stream = self.recognizer.create_stream();
        stream.accept_waveform(sample_rate, samples);
        self.recognizer.decode(&stream);

        let result = stream
            .get_result()
            .ok_or_else(|| anyhow!("sherpa-onnx returned no result for the decoded stream"))?;

        Ok(result.text.trim().to_string())
    }

    pub fn model_dir(&self) -> &str {
        &self.model_dir
    }

    pub fn num_threads(&self) -> i32 {
        self.num_threads
    }
}
