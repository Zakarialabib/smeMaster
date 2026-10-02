//! Offline text-to-speech via `sherpa-onnx` (VITS / Piper voices).
//!
//! Gated behind the same `offline-speech` cargo feature as [`crate::stt`] —
//! one engine, one feature, one dependency. See that module's header for the
//! build/archive caveats (`SHERPA_ONNX_ARCHIVE_DIR`).
//!
//! ## Why TTS matters more than STT here
//!
//! TTS is **88% of the variable voice cost** (`docs/voice/dev/SELF-HOSTING.md`
//! §2). STT is the cheap half. Making TTS local is therefore the larger win,
//! and it is the half that candle-whisper could not have delivered at all.
//!
//! ## Model files
//!
//! VITS/Piper models ship as `model.onnx` + `tokens.txt` + `espeak-ng-data/`
//! (the `data_dir`). Some voices add a `lexicon.txt` and a `dict/` directory
//! for Chinese. As with STT, sherpa-onnx takes **explicit paths**, not a repo
//! id, so `load` validates what it can and names what is missing.
//!
//! ## Japanese
//!
//! There is **no `vits-piper-ja_JP` voice** in the sherpa-onnx ecosystem
//! (verified against the HF registry, doc §3.2.1). Japanese TTS needs a
//! different engine or a cloud provider; `load` will simply fail for a missing
//! model, which is the honest outcome.

use anyhow::{anyhow, Result};
use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsModelConfig, OfflineTtsVitsModelConfig,
};
use std::path::Path;

/// A loaded offline TTS engine plus the voice identity it was built from.
pub struct TtsEngine {
    tts: OfflineTts,
    /// Model directory this engine was loaded from (for status / `list_models`).
    model_dir: String,
    /// Output sample rate reported by the model (e.g. 22050 for most Piper voices).
    sample_rate: i32,
    /// Built-in speaker count. Piper voices are single-speaker (1); multi-speaker
    /// VITS models expose more and are selected per-request via `sid`.
    num_speakers: i32,
    num_threads: i32,
}

/// Explicit model paths for a VITS / Piper voice.
pub struct TtsModelPaths {
    /// `model.onnx` — the acoustic model.
    pub model: String,
    /// `tokens.txt` — the phoneme/token table.
    pub tokens: String,
    /// `espeak-ng-data/` — required by Piper voices for phonemisation.
    pub data_dir: String,
    /// Optional `lexicon.txt` (some voices).
    pub lexicon: Option<String>,
    /// Optional `dict/` directory (Chinese voices).
    pub dict_dir: Option<String>,
}

impl TtsModelPaths {
    /// Build the conventional paths inside a model directory.
    ///
    /// Convenience only — `load` still verifies each required path exists, so a
    /// wrong guess surfaces as a named missing file rather than a crash.
    pub fn in_dir(dir: &str) -> Self {
        let join = |name: &str| Path::new(dir).join(name).to_string_lossy().to_string();
        let lexicon = join("lexicon.txt");
        let dict_dir = join("dict");
        Self {
            model: join("model.onnx"),
            tokens: join("tokens.txt"),
            data_dir: join("espeak-ng-data"),
            lexicon: Path::new(&lexicon).exists().then_some(lexicon),
            dict_dir: Path::new(&dict_dir).is_dir().then_some(dict_dir),
        }
    }

    /// Return every **required** path that does not exist on disk.
    ///
    /// `lexicon` and `dict_dir` are optional and deliberately excluded — their
    /// absence is normal for most voices.
    pub fn missing(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if !Path::new(&self.model).exists() {
            missing.push("model");
        }
        if !Path::new(&self.tokens).exists() {
            missing.push("tokens");
        }
        if !Path::new(&self.data_dir).is_dir() {
            missing.push("data_dir");
        }
        missing
    }
}

/// Per-request synthesis options.
#[derive(Debug, Clone)]
pub struct SynthOptions {
    /// Speaking rate. 1.0 is the model's natural pace; >1 is faster.
    pub speed: f32,
    /// Speaker id for multi-speaker models. Ignored by single-speaker voices.
    pub speaker_id: i32,
}

impl Default for SynthOptions {
    fn default() -> Self {
        Self {
            speed: 1.0,
            speaker_id: 0,
        }
    }
}

/// Synthesised audio: mono f32 samples plus their sample rate.
pub struct SynthAudio {
    pub samples: Vec<f32>,
    pub sample_rate: i32,
}

impl SynthAudio {
    /// Duration in seconds.
    pub fn duration_secs(&self) -> f64 {
        if self.sample_rate <= 0 {
            return 0.0;
        }
        self.samples.len() as f64 / self.sample_rate as f64
    }
}

impl TtsEngine {
    /// Load a VITS/Piper voice from explicit paths.
    pub fn load(paths: &TtsModelPaths, model_dir: &str, num_threads: i32) -> Result<Self> {
        let missing = paths.missing();
        if !missing.is_empty() {
            return Err(anyhow!(
                "incomplete TTS voice in {model_dir}: missing {} (expected model.onnx, tokens.txt, espeak-ng-data/)",
                missing.join(", ")
            ));
        }

        let config = OfflineTtsConfig {
            model: OfflineTtsModelConfig {
                vits: OfflineTtsVitsModelConfig {
                    model: Some(paths.model.clone()),
                    tokens: Some(paths.tokens.clone()),
                    data_dir: Some(paths.data_dir.clone()),
                    lexicon: paths.lexicon.clone(),
                    dict_dir: paths.dict_dir.clone(),
                    // Defaults (0.667 / 0.8 / 1.0) are the values the Piper
                    // voices were trained with; overriding them degrades output.
                    ..Default::default()
                },
                num_threads,
                debug: false,
                provider: Some("cpu".to_string()),
                ..Default::default()
            },
            ..Default::default()
        };

        let tts = OfflineTts::create(&config)
            .ok_or_else(|| anyhow!("sherpa-onnx failed to create a TTS engine for {model_dir}"))?;

        let sample_rate = tts.sample_rate();
        let num_speakers = tts.num_speakers();

        Ok(Self {
            tts,
            model_dir: model_dir.to_string(),
            sample_rate,
            num_speakers,
            num_threads,
        })
    }

    /// Synthesise `text` into mono f32 samples.
    ///
    /// Empty/whitespace input returns empty audio rather than erroring — the
    /// caller asked for nothing, and that is not a failure.
    pub fn synthesize(&self, text: &str, opts: &SynthOptions) -> Result<SynthAudio> {
        if text.trim().is_empty() {
            return Ok(SynthAudio {
                samples: Vec::new(),
                sample_rate: self.sample_rate,
            });
        }

        let gen_config = GenerationConfig {
            speed: opts.speed,
            // Clamp: a model with 1 speaker reports sid 0; asking for sid 7
            // would be a caller bug, and sherpa-onnx's behaviour is undefined.
            sid: if self.num_speakers > 1 {
                opts.speaker_id.clamp(0, self.num_speakers - 1)
            } else {
                0
            },
            ..Default::default()
        };

        // No progress callback: batch synthesis, we want the finished buffer.
        let audio: Option<sherpa_onnx::GeneratedAudio> =
            self.tts.generate_with_config(text, &gen_config, None::<fn(&[f32], f32) -> bool>);

        let audio = audio.ok_or_else(|| anyhow!("sherpa-onnx returned no audio for the given text"))?;

        Ok(SynthAudio {
            samples: audio.samples().to_vec(),
            sample_rate: audio.sample_rate(),
        })
    }

    pub fn model_dir(&self) -> &str {
        &self.model_dir
    }

    pub fn sample_rate(&self) -> i32 {
        self.sample_rate
    }

    pub fn num_speakers(&self) -> i32 {
        self.num_speakers
    }

    pub fn num_threads(&self) -> i32 {
        self.num_threads
    }
}
