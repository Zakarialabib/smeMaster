//! End-to-end verification of the offline TTS path, including the
//! `espeak-ng-data` subset question.
//!
//! Run manually (needs a downloaded voice):
//!
//! ```bash
//! SHERPA_ONNX_ARCHIVE_DIR=<cache>/archive \
//! SHERPA_ONNX_TEST_TTS_DIR=<dir> \
//!   cargo run -p ml-sidecar --features offline-speech --example tts_smoke
//! ```
//!
//! Why this exists: the STT path was verified end-to-end (download -> prepare ->
//! load) but TTS was not, and TTS has a specific failure mode the catalog could
//! get wrong — `espeak-ng-data/`. The full directory is 355 files / 18 MB, most
//! of it voice styles and dictionaries for languages this app does not speak.
//! The catalog ships a 9-file SUBSET. A subset is exactly what failed before
//! ("Failed to set eSpeak-ng voice"), so it has to be proven, not assumed.
//!
//! This harness answers one question: does synthesis work from the shipped
//! subset? It writes a WAV so the result can be listened to.

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

    // Report exactly which files were picked — the naming is not uniform across
    // releases, and a silent wrong pick is the failure this guards against.
    println!("model     : {}", paths.model);
    println!("tokens    : {}", paths.tokens);
    println!("data_dir  : {}", paths.data_dir);

    // Count what espeak-ng-data actually contains, so a subset is visible.
    if let Ok(entries) = std::fs::read_dir(&paths.data_dir) {
        let n = entries.filter_map(|e| e.ok()).count();
        println!("espeak    : {n} entries in the data dir");
    }

    let t_load = std::time::Instant::now();
    let engine = tts::TtsEngine::load(&paths, &dir, 2).context("failed to load the TTS voice")?;
    println!(
        "loaded in : {} ms (rate={} Hz, speakers={})",
        t_load.elapsed().as_millis(),
        engine.sample_rate(),
        engine.num_speakers()
    );

    // French — the business-critical locale (DGI), and what the catalog ships.
    let text = std::env::var("SHERPA_ONNX_TEST_TTS_TEXT").unwrap_or_else(|_| {
        "Bonjour, ceci est un test de synthèse vocale hors ligne pour la facturation.".to_string()
    });

    let opts = tts::SynthOptions {
        speed: 1.0,
        speaker_id: 0,
    };

    let t0 = std::time::Instant::now();
    let audio = engine
        .synthesize(&text, &opts)
        .context("synthesis failed — if this says 'Failed to set eSpeak-ng voice', the espeak-ng-data subset is incomplete")?;
    let elapsed = t0.elapsed().as_secs_f64();

    let duration = audio.duration_secs();
    let rtf = if duration > 0.0 { elapsed / duration } else { 0.0 };
    let peak = audio.samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));

    println!("\n--- result ---");
    println!("text      : {text:?} ({} chars)", text.chars().count());
    println!("duration  : {duration:.2}s @ {} Hz", audio.sample_rate);
    println!("synth     : {elapsed:.3}s");
    println!("RTF       : {rtf:.3}");
    println!("peak      : {peak:.4}");

    if audio.samples.is_empty() {
        println!("\nVERDICT   : FAIL — no samples produced");
        std::process::exit(1);
    }
    if peak < 1e-4 {
        println!("\nVERDICT   : FAIL — audio is silent");
        std::process::exit(1);
    }

    let out = std::env::var("SHERPA_ONNX_TEST_TTS_OUT")
        .unwrap_or_else(|_| "tts_smoke_out.wav".to_string());
    if sherpa_onnx::write(&out, &audio.samples, audio.sample_rate) {
        println!("\nwrote     : {out}  <-- LISTEN TO THIS");
    } else {
        println!("\nwrote     : FAILED to write {out}");
    }

    println!("VERDICT   : PASS — the shipped espeak-ng-data subset synthesises.");
    println!("            Intelligibility is still a human judgement; listen to the WAV.");
    Ok(())
}

#[cfg(not(feature = "offline-speech"))]
fn main() {
    eprintln!("build with --features offline-speech to run this example");
    std::process::exit(2);
}
