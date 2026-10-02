//! End-to-end verification of the offline TTS path.
//!
//! Run manually (not part of `cargo test`, because it needs a downloaded voice):
//!
//! ```bash
//! SHERPA_ONNX_ARCHIVE_DIR=<cache>/archive \
//! SHERPA_ONNX_TEST_TTS_DIR=<cache>/models/vits-piper-fr_FR-siwis-medium \
//!   cargo run -p ml-sidecar --features offline-speech --example tts_smoke
//! ```
//!
//! Why this exists: `cargo check` proves the scaffolding compiles. It does not
//! prove synthesis produces intelligible audio, and it produces no RTF figure.
//! This does both, and writes a WAV so the output can actually be listened to.
//!
//! **It cannot verify intelligibility.** A smoke test can confirm the engine
//! returned non-silent audio at the expected rate and duration; whether the
//! French sounds right is a human judgement. That limit is stated rather than
//! papered over with a "PASS".

#[cfg(feature = "offline-speech")]
fn main() -> anyhow::Result<()> {
    use anyhow::{anyhow, Context};

    #[path = "../src/tts.rs"]
    mod tts;

    let dir = std::env::var("SHERPA_ONNX_TEST_TTS_DIR").map_err(|_| {
        anyhow!("set SHERPA_ONNX_TEST_TTS_DIR to a sherpa-onnx VITS/Piper voice directory")
    })?;

    let paths = tts::TtsModelPaths::in_dir(&dir);
    println!("voice dir : {dir}");
    println!("missing   : {:?}", paths.missing());

    let t_load = std::time::Instant::now();
    let engine = tts::TtsEngine::load(&paths, &dir, 2).context("failed to load the TTS voice")?;
    let load_ms = t_load.elapsed().as_millis();
    println!(
        "loaded in : {load_ms} ms (threads={}, sample_rate={} Hz, speakers={})",
        engine.num_threads(),
        engine.sample_rate(),
        engine.num_speakers()
    );
    println!("engine    : {}", engine.model_dir());

    // French first — it is the business-critical locale for this app (DGI).
    // The text is deliberately plain and invoice-adjacent.
    let text = std::env::var("SHERPA_ONNX_TEST_TTS_TEXT").unwrap_or_else(|_| {
        "Bonjour, ceci est un test de synthèse vocale hors ligne pour la facturation.".to_string()
    });

    let opts = tts::SynthOptions {
        speed: std::env::var("SHERPA_ONNX_TEST_TTS_SPEED")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1.0),
        speaker_id: 0,
    };

    let t0 = std::time::Instant::now();
    let audio = engine.synthesize(&text, &opts)?;
    let elapsed = t0.elapsed().as_secs_f64();

    let duration = audio.duration_secs();
    let rtf = if duration > 0.0 { elapsed / duration } else { 0.0 };

    // Silence check: a model that "succeeds" while emitting all-zeros is a
    // failure mode that a duration check alone would miss.
    let peak = audio.samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    let rms = if audio.samples.is_empty() {
        0.0
    } else {
        (audio.samples.iter().map(|s| (*s as f64).powi(2)).sum::<f64>() / audio.samples.len() as f64)
            .sqrt()
    };

    println!("\n--- result ---");
    println!("text      : {text:?} ({} chars)", text.chars().count());
    println!("samples   : {}", audio.samples.len());
    println!("rate      : {} Hz", audio.sample_rate);
    println!("duration  : {duration:.2}s");
    println!("synth     : {elapsed:.3}s");
    println!(
        "RTF       : {rtf:.3}  ({})",
        if rtf < 1.0 {
            "faster than real time"
        } else {
            "SLOWER than real time"
        }
    );
    println!("peak      : {peak:.4}");
    println!("rms       : {rms:.6}");

    // Character throughput is the number that matters for cost modelling:
    // how many characters per second of audio, and how fast we produce them.
    if duration > 0.0 {
        println!(
            "throughput: {:.0} chars/sec of audio; {:.0} chars/sec of compute",
            text.chars().count() as f64 / duration,
            text.chars().count() as f64 / elapsed
        );
    }

    if audio.samples.is_empty() {
        println!("\nVERDICT   : FAIL — no samples produced");
        std::process::exit(1);
    }
    if peak < 1e-4 {
        println!("\nVERDICT   : FAIL — audio is silent (peak {peak:.2e})");
        std::process::exit(1);
    }

    let out = std::env::var("SHERPA_ONNX_TEST_TTS_OUT")
        .unwrap_or_else(|_| "tts_smoke_out.wav".to_string());
    match sherpa_onnx::write(&out, &audio.samples, audio.sample_rate) {
        true => println!("\nwrote     : {out}  <-- LISTEN TO THIS"),
        false => println!("\nwrote     : FAILED to write {out}"),
    }

    println!(
        "VERDICT   : audio produced (non-silent, {duration:.2}s). \
         Intelligibility is NOT machine-verified — listen to the WAV."
    );
    Ok(())
}

#[cfg(not(feature = "offline-speech"))]
fn main() {
    eprintln!("build with --features offline-speech to run this example");
    std::process::exit(2);
}
