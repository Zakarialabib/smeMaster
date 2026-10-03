"""Self-hosted candidates, with the licence fact attached to each one.

Not implementations — a **catalogue**. Each entry records the HF-verified
licence so the choice cannot be made on latency alone, which is exactly the
mistake the Voxtral TTS episode was: 70 ms TTFB, purpose-built for call centres,
and unusable because the licence is CC-BY-NC-4.0.

Latency figures here are UNVERIFIED vendor/leaderboard claims and are marked as
such. Do not put them in a client document.
"""

from __future__ import annotations

from dataclasses import dataclass

from .licensing import assert_commercially_usable


@dataclass(frozen=True, slots=True)
class SelfHostedCandidate:
    seam: str
    model: str
    hf_repo: str
    declared_license: str | None
    languages: tuple[str, ...]
    #: UNVERIFIED. Leaderboard or vendor claim; not reproduced by us.
    latency_claim: str | None = None
    note: str = ""
    verified_on: str = "2026-09-28"

    def build(self) -> None:
        """Raise unless commercially usable. Called by the test, not at runtime."""
        assert_commercially_usable(self.model, self.declared_license)


# ── TTS ─────────────────────────────────────────────────────────────────────

TTS: tuple[SelfHostedCandidate, ...] = (
    SelfHostedCandidate(
        seam="tts",
        model="Chatterbox (ResembleAI)",
        hf_repo="ResembleAI/chatterbox",
        declared_license="MIT",
        languages=("fr", "en", "de", "es", "it", "nl", "pt"),
        latency_claim=None,
        note=(
            "v1 self-hosted default. 23 languages incl. fr, emotion control, "
            "ONNX-optimised. The fastest COMMERCIALLY usable open-weight FR option "
            "once Voxtral TTS is disqualified."
        ),
    ),
    SelfHostedCandidate(
        seam="tts",
        model="Kokoro-82M (hexgrad)",
        hf_repo="hexgrad/Kokoro-82M",
        declared_license="Apache-2.0",
        languages=("en",),
        note=(
            "Budget/offline tier. The card declares language:['en'] - the French "
            "voice is a SEPARATE per-language model file, so FR is not verified by "
            "the main card. Needs its own French check before being offered."
        ),
    ),
)

# ── STT ─────────────────────────────────────────────────────────────────────

STT: tuple[SelfHostedCandidate, ...] = (
    SelfHostedCandidate(
        seam="stt",
        model="whisper-large-v3 (openai)",
        hf_repo="openai/whisper-large-v3",
        declared_license="Apache-2.0",
        languages=("fr", "en"),
        note=(
            "The defensible default for a client SLA: official, Apache-2.0, widely "
            "deployed. Prefer this over a community fine-tune until we benchmark one."
        ),
    ),
    SelfHostedCandidate(
        seam="stt",
        model="whisper-large-v3-french (bofenghuang)",
        hf_repo="bofenghuang/whisper-large-v3-french",
        declared_license="MIT",
        languages=("fr",),
        note=(
            "THIRD-PARTY community fine-tune, not an OpenAI/Mistral release. ~1.2k "
            "downloads. Its WER figures are the author's, not independently "
            "reproduced. A CANDIDATE FOR OUR OWN BENCHMARK, not a decision."
        ),
    ),
)

#: Verified as REAL, and verified as NOT SHIPPABLE. Kept separate from both
#: TTS and REFUSED: these are good models that we specifically cannot use, which
#: is a different fact from "unverified", and worth keeping visible.
DISQUALIFIED: tuple[SelfHostedCandidate, ...] = (
    SelfHostedCandidate(
        seam="tts",
        model="Voxtral 4B TTS (mistralai)",
        hf_repo="mistralai/Voxtral-4B-TTS-2603",
        declared_license="CC-BY-NC-4.0",
        languages=("fr", "en", "es", "pt", "it", "nl", "de"),
        latency_claim="70ms TTFB (unverified)",
        note=(
            "DISQUALIFIED - non-commercial. Listed deliberately, with its licence, "
            "so the rejection is on the record and nobody re-litigates it from the "
            "latency number. Note: Voxtral ASR models (Mini-3B, Small-24B) are "
            "Apache-2.0 - those are a DIFFERENT thing and are not disqualified."
        ),
    ),
)

#: Declared but NOT cleared - kept for the record, never for shipping.
REFUSED: tuple[SelfHostedCandidate, ...] = (
    SelfHostedCandidate(
        seam="tts",
        model="XTTS v2 (coqui)",
        hf_repo="coqui/XTTS-v2",
        declared_license="CPML",
        languages=("fr", "en"),
        note="Coqui Public Model License, non-commercial. Research only.",
    ),
    SelfHostedCandidate(
        seam="tts",
        model="Qwen3-TTS-Flash",
        hf_repo="Qwen/Qwen3-TTS-Flash",
        declared_license=None,
        languages=(),
        note="No licence declared on the card. Unknown is a no.",
    ),
    SelfHostedCandidate(
        seam="tts",
        model="Parler-TTS mini-v1",
        hf_repo="parler-tts/mini-multilingual-v1",
        declared_license=None,
        languages=("fr", "de", "es", "it", "nl", "pt", "pl"),
        note="No licence declared on the card, despite being listed as Apache-2.0 elsewhere.",
    ),
    SelfHostedCandidate(
        seam="stt",
        model="silero-vad",
        hf_repo="snakers4/silero-vad",
        declared_license=None,
        languages=(),
        note=(
            "VAD sits in the real-time path. The HF card declares NO licence even "
            "though an MIT grant is widely assumed. Needs a real answer before any "
            "self-hosted deployment."
        ),
    ),
)

#: CLEARED models only. A disqualified model must never be reachable from here.
ALL: tuple[SelfHostedCandidate, ...] = TTS + STT
BY_SEAM: dict[str, tuple[SelfHostedCandidate, ...]] = {
    "tts": TTS,
    "stt": STT,
}
