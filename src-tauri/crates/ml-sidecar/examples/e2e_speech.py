"""
End-to-end verification of the ml-sidecar JSON-RPC speech methods.

Why this exists: the Rust `stt_smoke`/`tts_smoke` examples call the engine API
directly, and the TS layer is type-checked, but NEITHER proves the JSON-RPC
dispatch in `main.rs` actually routes `load_stt_model` / `transcribe` /
`load_tts_voice` / `synthesize` correctly. This drives the real sidecar binary
over stdin/stdout the same way the Tauri app does.

Usage:
    python e2e_speech.py <path-to-ml-sidecar.exe>
"""

import json
import subprocess
import sys
import time
import wave
from pathlib import Path

CACHE = Path(r"C:/Users/user/AppData/Local/hermes/cache/sherpa")
STT_DIR = CACHE / "models/zipformer-small-en"
TTS_DIR = CACHE / "models/vits-piper-fr_FR-siwis-medium"


def run_session(exe: str, requests: list[dict], timeout: float = 300.0) -> tuple[list[dict], str]:
    """Start the sidecar, send one JSON-RPC request per line, collect responses."""
    proc = subprocess.Popen(
        [exe],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        bufsize=1,
    )
    responses: list[dict] = []
    try:
        for req in requests:
            proc.stdin.write(json.dumps(req) + "\n")
            proc.stdin.flush()
            line = proc.stdout.readline()
            if not line:
                break
            responses.append(json.loads(line))
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        try:
            stderr = proc.stderr.read()
        except Exception:
            stderr = ""
        proc.wait(timeout=timeout)
    return responses, stderr


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: e2e_speech.py <ml-sidecar.exe>")
        return 2
    exe = sys.argv[1]

    if not Path(exe).exists():
        print(f"FAIL: sidecar binary not found: {exe}")
        return 1

    print(f"sidecar : {exe}")
    print(f"stt dir : {STT_DIR}  (exists={STT_DIR.exists()})")
    print(f"tts dir : {TTS_DIR}  (exists={TTS_DIR.exists()})")

    failures: list[str] = []

    # ── 1. ping: is the binary alive and speaking JSON-RPC? ────────────────
    resp, _ = run_session(exe, [{"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}}])
    if not resp or "result" not in resp[0]:
        failures.append(f"ping failed: {resp}")
    else:
        print(f"\n[1] ping          -> ok ({resp[0]['result']})")

    # ── 2. STT: load model, transcribe the model's own test WAV ────────────
    wav_path = STT_DIR / "test_wavs/1.wav"
    samples: list[float] = []
    sample_rate = 16000
    if wav_path.exists():
        with wave.open(str(wav_path), "rb") as w:
            sample_rate = w.getframerate()
            raw = w.readframes(w.getnframes())
            import struct

            vals = struct.unpack(f"<{len(raw) // 2}h", raw)
            samples = [v / 32768.0 for v in vals]

    reqs = [
        {
            "jsonrpc": "2.0",
            "id": 10,
            "method": "load_stt_model",
            "params": {"model_dir": str(STT_DIR), "num_threads": 2},
        },
        {
            "jsonrpc": "2.0",
            "id": 11,
            "method": "transcribe",
            "params": {"samples": samples, "sample_rate": sample_rate},
        },
        {"jsonrpc": "2.0", "id": 12, "method": "list_models", "params": {}},
        {"jsonrpc": "2.0", "id": 13, "method": "unload_stt_model", "params": {}},
    ]
    resp, stderr = run_session(exe, reqs)
    by_id = {r.get("id"): r for r in resp}

    # load
    r10 = by_id.get(10, {})
    if "result" in r10:
        res = r10["result"]
        print(f"[2] load_stt_model-> ok (load_ms={res.get('load_ms')}, threads={res.get('num_threads')})")
    else:
        failures.append(f"load_stt_model failed: {r10}")

    # transcribe
    r11 = by_id.get(11, {})
    text = ""
    if "result" in r11:
        res = r11["result"]
        text = res.get("text", "")
        print(f"[3] transcribe    -> {res.get('transcribe_ms')} ms, {res.get('samples')} samples")
        print(f"                     text={text[:90]!r}")
        if not text:
            failures.append("transcribe returned empty text for known speech audio")
    else:
        failures.append(f"transcribe failed: {r11}")

    # list_models must show stt loaded
    r12 = by_id.get(12, {})
    if "result" in r12:
        kinds = {m.get("kind"): m.get("loaded") for m in r12["result"].get("models", [])}
        print(f"[4] list_models   -> {kinds}")
        if not kinds.get("stt"):
            failures.append("list_models did not report stt as loaded")
    else:
        failures.append(f"list_models failed: {r12}")

    # unload
    r13 = by_id.get(13, {})
    if "result" not in r13:
        failures.append(f"unload_stt_model failed: {r13}")
    else:
        print(f"[5] unload_stt    -> ok")

    # ── 3. TTS: load voice, synthesize French, write a WAV ────────────────
    tts_text = "Bonjour, ceci est un test de synthèse vocale hors ligne pour la facturation."
    reqs = [
        {
            "jsonrpc": "2.0",
            "id": 20,
            "method": "load_tts_voice",
            "params": {"model_dir": str(TTS_DIR), "num_threads": 2},
        },
        {
            "jsonrpc": "2.0",
            "id": 21,
            "method": "synthesize",
            "params": {"text": tts_text, "speed": 1.0, "speaker_id": 0},
        },
        {"jsonrpc": "2.0", "id": 22, "method": "list_models", "params": {}},
    ]
    resp, stderr = run_session(exe, reqs)
    by_id = {r.get("id"): r for r in resp}

    r20 = by_id.get(20, {})
    if "result" in r20:
        res = r20["result"]
        print(
            f"\n[6] load_tts_voice-> ok (load_ms={res.get('load_ms')}, "
            f"rate={res.get('sample_rate')}, speakers={res.get('num_speakers')})"
        )
    else:
        failures.append(f"load_tts_voice failed: {r20}")

    r21 = by_id.get(21, {})
    if "result" in r21:
        res = r21["result"]
        out_samples = res.get("samples", [])
        rate = res.get("sample_rate", 22050)
        print(f"[7] synthesize    -> {res.get('synth_ms')} ms, RTF={res.get('rtf'):.3f}")
        print(f"                     {res.get('duration_secs'):.2f}s @ {rate} Hz, {len(out_samples)} samples")
        if not out_samples:
            failures.append("synthesize returned no samples")
        else:
            peak = max(abs(s) for s in out_samples)
            if peak < 1e-4:
                failures.append(f"synthesize returned silent audio (peak={peak:.2e})")
            else:
                # Write it out so a human can listen.
                out_path = CACHE / "e2e_tts_out.wav"
                import struct

                pcm = b"".join(
                    struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in out_samples
                )
                with wave.open(str(out_path), "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(rate)
                    w.writeframes(pcm)
                print(f"                     peak={peak:.4f}  wrote {out_path}")
    else:
        failures.append(f"synthesize failed: {r21}")

    r22 = by_id.get(22, {})
    if "result" in r22:
        kinds = {m.get("kind"): m.get("loaded") for m in r22["result"].get("models", [])}
        print(f"[8] list_models   -> {kinds}")

    # ── verdict ───────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    if failures:
        print(f"FAIL — {len(failures)} problem(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("PASS — JSON-RPC dispatch verified for STT and TTS")
    print("  load_stt_model / transcribe / load_tts_voice / synthesize all route correctly")
    print("  Audio was non-silent. Intelligibility is still a human judgement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
