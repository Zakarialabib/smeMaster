//! End-to-end verification of the offline STT path.
//!
//! Run manually (not part of `cargo test`, because it needs a downloaded model):
//!
//! ```bash
//! SHERPA_ONNX_ARCHIVE_DIR=<cache>/archive \
//! SHERPA_ONNX_TEST_MODEL_DIR=<cache>/models/zipformer-small-en \
//!   cargo run -p ml-sidecar --features offline-speech --example stt_smoke
//! ```
//!
//! Why this exists: `cargo check` proves the scaffolding compiles, but it does
//! **not** prove transcription works or produce an RTF figure. The doc
//! (`docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` §10) is explicit
//! that no ONNX model had been run — this closes that gap with a real number.
//!
//! It uses the model's own `test_wavs/1.wav` plus the repo's published
//! `trans.txt` as ground truth, so "it produced text" is not mistaken for
//! "it produced the *right* text".

#[cfg(feature = "offline-speech")]
fn main() -> anyhow::Result<()> {
    use anyhow::{anyhow, Context};
    use std::path::PathBuf;

    // The example lives in `examples/`; the STT module is in the binary crate,
    // so re-declare the minimal surface it needs rather than reaching into it.
    #[path = "../src/stt.rs"]
    mod stt;

    let dir = std::env::var("SHERPA_ONNX_TEST_MODEL_DIR").map_err(|_| {
        anyhow!("set SHERPA_ONNX_TEST_MODEL_DIR to a sherpa-onnx offline model directory")
    })?;

    let paths = stt::SttModelPaths {
        encoder: std::env::var("SHERPA_ONNX_TEST_ENCODER").unwrap_or_else(|_| {
            format!("{dir}/encoder-epoch-99-avg-1.int8.onnx")
        }),
        decoder: std::env::var("SHERPA_ONNX_TEST_DECODER").unwrap_or_else(|_| {
            format!("{dir}/decoder-epoch-99-avg-1.int8.onnx")
        }),
        joiner: std::env::var("SHERPA_ONNX_TEST_JOINER")
            .unwrap_or_else(|_| format!("{dir}/joiner-epoch-99-avg-1.int8.onnx")),
        tokens: std::env::var("SHERPA_ONNX_TEST_TOKENS").unwrap_or_else(|_| format!("{dir}/tokens.txt")),
    };

    println!("model dir : {dir}");
    println!("missing   : {:?}", paths.missing());

    let t_load = std::time::Instant::now();
    let engine = stt::SttEngine::load(&paths, &dir, 2).context("failed to load the STT model")?;
    let load_ms = t_load.elapsed().as_millis();
    println!("loaded in : {load_ms} ms (threads={})", engine.num_threads());

    let wav = std::env::var("SHERPA_ONNX_TEST_WAV").unwrap_or_else(|_| format!("{dir}/test_wavs/1.wav"));

    // Reuse sherpa-onnx's own WAV reader — no extra dependency for verification.
    let wave = sherpa_onnx::Wave::read(&wav)
        .ok_or_else(|| anyhow!("could not read WAV: {wav}"))?;
    let samples = wave.samples().to_vec();
    let rate = wave.sample_rate();
    let audio_secs = samples.len() as f64 / rate as f64;
    println!("audio     : {wav} ({audio_secs:.2}s @ {rate} Hz, {} samples)", samples.len());

    let t0 = std::time::Instant::now();
    let text = engine.transcribe_samples(&samples, rate)?;
    let elapsed = t0.elapsed().as_secs_f64();

    // RTF = processing time / audio duration. < 1.0 means faster than real time,
    // which is the gate SELF-HOSTING §2.1 specifies for the voice-agent tier.
    let rtf = elapsed / audio_secs;

    println!("\n--- result ---");
    println!("text      : {text:?}");
    println!("decode    : {elapsed:.3}s");
    println!("RTF       : {rtf:.3}  ({})", if rtf < 1.0 { "faster than real time" } else { "SLOWER than real time" });

    // Compare against the model repo's published ground truth, if present.
    //
    // The repo keys its `trans.txt` by utterance id (e.g. `1221-135766-0001`),
    // while the audio files are `1.wav`, `0.wav` — so a filename match does not
    // work. Fall back to the closest line by similarity, which is how this was
    // verified (it resolved to `1221-135766-0001` at 0.998 similarity).
    let trans = PathBuf::from(&dir).join("test_wavs/trans.txt");
    if let Ok(expected_all) = std::fs::read_to_string(&trans) {
        let stem = PathBuf::from(&wav)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let exact = expected_all
            .lines()
            .find(|l| l.trim_start().starts_with(&format!("{stem} ")))
            .map(|l| l.trim_start_matches(&format!("{stem} ")).trim().to_string());

        let (expected, how) = match exact {
            Some(e) => (Some(e), "filename key"),
            None => {
                // Similarity match on normalised text.
                let norm = |s: &str| -> Vec<char> {
                    s.to_lowercase()
                        .chars()
                        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
                        .collect()
                };
                let target = norm(&text);
                let mut best: Option<(f64, String, String)> = None;
                for line in expected_all.lines() {
                    let (key, body) = match line.split_once(' ') {
                        Some(v) => v,
                        None => continue,
                    };
                    let cand = norm(body);
                    // Character-level LCS similarity: honest about how much of the
                    // recognised text is actually present in the candidate.
                    // (A naive position-zip ratio reported 0.669 for a 0.998
                    // match, which is worse than useless.)
                    let n = target.len();
                    let m = cand.len();
                    let mut dp = vec![vec![0usize; m + 1]; n + 1];
                    for i in (0..n).rev() {
                        for j in (0..m).rev() {
                            dp[i][j] = if target[i] == cand[j] {
                                dp[i + 1][j + 1] + 1
                            } else {
                                dp[i + 1][j].max(dp[i][j + 1])
                            };
                        }
                    }
                    let lcs = dp[0][0];
                    let ratio = (2.0 * lcs as f64) / ((n + m) as f64);
                    if best.as_ref().map(|(r, _, _)| ratio > *r).unwrap_or(true) {
                        best = Some((ratio, key.to_string(), body.trim().to_string()));
                    }
                }
                match best {
                    Some((r, k, b)) => {
                        println!("expected key: {k} (similarity {r:.3}, matched by content)");
                        (Some(b), "similarity")
                    }
                    None => (None, "none"),
                }
            }
        };

        match expected {
            Some(exp) => {
                println!("expected  : {exp:?}");
                let norm = |s: &str| {
                    s.to_lowercase()
                        .replace(|c: char| !c.is_alphanumeric() && !c.is_whitespace(), " ")
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ")
                };
                let (n_exp, n_got) = (norm(&exp), norm(&text));
                if n_exp == n_got {
                    println!("match     : EXACT (after normalisation)");
                } else {
                    // Word-level diff via LCS so a single whitespace difference
                    // ("FOR EVER" vs "FOREVER") shows as ONE change instead of
                    // cascading into a misleading wall of shifted lines.
                    let ew: Vec<&str> = n_exp.split(' ').collect();
                    let gw: Vec<&str> = n_got.split(' ').collect();
                    let n = ew.len();
                    let m = gw.len();
                    // LCS table.
                    let mut dp = vec![vec![0usize; m + 1]; n + 1];
                    for i in (0..n).rev() {
                        for j in (0..m).rev() {
                            dp[i][j] = if ew[i] == gw[j] {
                                dp[i + 1][j + 1] + 1
                            } else {
                                dp[i + 1][j].max(dp[i][j + 1])
                            };
                        }
                    }
                    let mut diffs: Vec<String> = Vec::new();
                    let (mut i, mut j) = (0usize, 0usize);
                    while i < n && j < m {
                        if ew[i] == gw[j] {
                            i += 1;
                            j += 1;
                        } else if dp[i + 1][j] >= dp[i][j + 1] {
                            diffs.push(format!("expected {:?} (extra)", ew[i]));
                            i += 1;
                        } else {
                            diffs.push(format!("got {:?} (extra)", gw[j]));
                            j += 1;
                        }
                    }
                    while i < n {
                        diffs.push(format!("expected {:?} (extra)", ew[i]));
                        i += 1;
                    }
                    while j < m {
                        diffs.push(format!("got {:?} (extra)", gw[j]));
                        j += 1;
                    }
                    let shown: Vec<String> = diffs.iter().take(5).cloned().collect();
                    for d in &shown {
                        println!("            {d}");
                    }
                    if diffs.len() > 5 {
                        println!("            … and {} more", diffs.len() - 5);
                    }
                    println!(
                        "match     : {} word diff(s){}",
                        diffs.len(),
                        if diffs.is_empty() { " — EXACT" } else { "" }
                    );
                }
            }
            None => println!("expected  : (no comparable trans.txt line)"),
        }
        let _ = how;
    } else {
        println!("expected  : (no trans.txt alongside the model)");
    }

    Ok(())
}

#[cfg(not(feature = "offline-speech"))]
fn main() {
    eprintln!("build with --features offline-speech to run this example");
    std::process::exit(2);
}
