"""Deterministic fixture providers — two per seam.

**Two, not one.** The Gate 1 exit criterion is that a *second* implementation
swaps in by a config value alone. One implementation cannot demonstrate that, so
each seam gets an `alpha` and a `beta` that are behaviourally distinguishable
(their `name` and their response prefix) and otherwise identical in shape.

These are NOT stubs. They are real implementations of the traits with no network
call, so the whole chain, the fallback logic and the console can be exercised
before a single API key exists. `providers/live.py` holds the real HTTP clients.

Nothing here ever ships to production. The point is that everything ABOVE them —
the orchestrator, the fallback chain, metering, the console — is provider-agnostic
and can be proven so on a laptop.
"""

from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator, Sequence

from ..contracts import VoiceLocale
from .base import (
    REGISTRY,
    ChatMessage,
    EmbeddingProvider,
    EmbeddingResult,
    LLMProvider,
    LLMUsage,
    ProviderFactory,
    ProviderUnavailable,
    Seam,
    SpeechRequest,
    SpeechSession,
    STTProvider,
    TranscriptResult,
    TTSProvider,
)


def _digest(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


# ── LLM ─────────────────────────────────────────────────────────────────────


class _FixtureLLM(LLMProvider):
    def __init__(self, name: str, *, unavailable: bool = False) -> None:
        self.name = name
        self._unavailable = unavailable

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        max_tokens: int = 256,
        temperature: float = 0.3,
    ) -> tuple[str, LLMUsage]:
        if self._unavailable:
            raise ProviderUnavailable(
                f"{self.name} is configured unavailable", provider=self.name, retryable=True
            )
        last = next((m.content for m in reversed(messages) if m.role == "user"), "")
        text = f"[{self.name}] {last[:64]}"
        return text, LLMUsage(
            prompt_tokens=sum(len(m.content) // 4 for m in messages),
            completion_tokens=len(text) // 4,
        )

    def stream(
        self, messages: Sequence[ChatMessage], *, max_tokens: int = 256
    ) -> AsyncIterator[str]:
        return self._stream(messages, max_tokens=max_tokens)

    async def _stream(
        self, messages: Sequence[ChatMessage], *, max_tokens: int = 256
    ) -> AsyncIterator[str]:
        text, _ = await self.complete(messages, max_tokens=max_tokens)
        for word in text.split(" "):
            yield word + " "
            await _yield_control()


async def _yield_control() -> None:
    """A real await point, so a streamed chain is actually interleavable."""
    import asyncio

    await asyncio.sleep(0)


# ── TTS ─────────────────────────────────────────────────────────────────────


class _FixtureTTS(TTSProvider):
    def __init__(self, name: str, *, unavailable: bool = False) -> None:
        self.name = name
        self._unavailable = unavailable

    async def synthesize(self, req: SpeechRequest) -> bytes:
        if self._unavailable:
            raise ProviderUnavailable(
                f"{self.name} is configured unavailable", provider=self.name
            )
        # A short, deterministic PCM-ish blob keyed by the text: long enough to
        # tell two providers apart in a log, short enough to keep tests fast.
        seed = int(_digest(self.name, req.text, req.voice)[:8], 16)
        return bytes(64 + seed % 64) + f"{self.name}:{req.locale}".encode()

    def stream(self, req: SpeechRequest) -> AsyncIterator[bytes]:
        return self._stream(req)

    async def _stream(self, req: SpeechRequest) -> AsyncIterator[bytes]:
        blob = await self.synthesize(req)
        for i in range(0, len(blob), 16):
            yield blob[i : i + 16]
            await _yield_control()


# ── STT ─────────────────────────────────────────────────────────────────────


class _FixtureSession(SpeechSession):
    def __init__(self, provider: _FixtureSTT, locale: VoiceLocale) -> None:
        self._p = provider
        self._locale = locale
        self._buf = bytearray()

    def push(self, pcm: bytes) -> None:
        self._buf.extend(pcm)

    def events(self) -> AsyncIterator[TranscriptResult]:
        # A plain `def` returning an async generator. Declaring it `async def` with
        # a `yield` makes it an async-generator FUNCTION, whose call returns an
        # iterator (not a coroutine) - and mypy then rejects the AsyncIterator
        # return type. `transcribe` is async, so the await lives in the inner
        # generator where it belongs.
        return self._events()

    async def _events(self) -> AsyncIterator[TranscriptResult]:
        if self._buf:
            audio, self._buf = bytes(self._buf), bytearray()
            yield await self._p.transcribe(audio, locale=self._locale)

    async def close(self) -> None:
        self._buf.clear()


class _FixtureSTT(STTProvider):
    def __init__(self, name: str, *, unavailable: bool = False) -> None:
        self.name = name
        self._unavailable = unavailable

    async def transcribe(
        self, audio: bytes, *, locale: VoiceLocale, hotwords: Sequence[str] = ()
    ) -> TranscriptResult:
        if self._unavailable:
            raise ProviderUnavailable(
                f"{self.name} is configured unavailable", provider=self.name
            )
        h = _digest(self.name, locale, str(len(audio)), ",".join(sorted(hotwords)))[:8]
        return TranscriptResult(
            text=f"{self.name}[{locale}]:{h}",
            is_final=True,
            locale=locale,
            confidence=0.87,
        )

    def stream(self, locale: VoiceLocale, *, hotwords: Sequence[str] = ()) -> SpeechSession:
        return _FixtureSession(self, locale)


# ── Embedding ───────────────────────────────────────────────────────────────


class _FixtureEmbedding(EmbeddingProvider):
    def __init__(self, name: str, dims: int, *, unavailable: bool = False) -> None:
        self.name = name
        self._dims = dims
        self._unavailable = unavailable

    @property
    def dims(self) -> int:
        return self._dims

    async def embed(self, texts: Sequence[str]) -> list[EmbeddingResult]:
        if self._unavailable:
            raise ProviderUnavailable(
                f"{self.name} is configured unavailable", provider=self.name
            )
        out = []
        for t in texts:
            h = _digest(self.name, t)
            usable = min(len(h), self._dims * 2)
            vec = tuple(int(h[i : i + 2], 16) / 255.0 for i in range(0, usable, 2))
            if len(vec) < self._dims:  # pad deterministically if the digest is short
                vec = vec + tuple(0.0 for _ in range(self._dims - len(vec)))
            out.append(EmbeddingResult(vector=vec[: self._dims], dims=self._dims, model=self.name))
        return out


# ── Registration ────────────────────────────────────────────────────────────
#
# The ONLY place a concrete provider class is chosen. `alpha`/`beta` per seam, plus
# `down` variants so a fallback chain can be exercised for real.
#
# Factories take **options as keyword arguments**, matching `ProviderRegistry.create`.

def register_fixtures() -> None:
    def llm(n: str) -> ProviderFactory:
        return lambda **o: _FixtureLLM(n, **o)

    def tts(n: str) -> ProviderFactory:
        return lambda **o: _FixtureTTS(n, **o)

    def stt(n: str) -> ProviderFactory:
        return lambda **o: _FixtureSTT(n, **o)

    def embed(n: str, dims: int) -> ProviderFactory:
        return lambda **o: _FixtureEmbedding(n, dims, **o)

    def down(factory: ProviderFactory) -> ProviderFactory:
        """A provider that always raises ProviderUnavailable.

        How the chain's degradation path is exercised for real, rather than
        asserted about. A *fixture*, not a third implementation, so
        `test_seam_has_at_least_two_live_implementations` does not count it.
        """

        def make(**o: object) -> object:
            return factory(unavailable=True, **o)

        return make

    REGISTRY.register(Seam.LLM, "alpha", llm("alpha"))
    REGISTRY.register(Seam.LLM, "beta", llm("beta"))
    REGISTRY.register(Seam.LLM, "down", down(lambda **o: _FixtureLLM("down", **o)))

    REGISTRY.register(Seam.TTS, "alpha", tts("alpha"))
    REGISTRY.register(Seam.TTS, "beta", tts("beta"))
    REGISTRY.register(Seam.TTS, "down", down(lambda **o: _FixtureTTS("down", **o)))

    REGISTRY.register(Seam.STT, "alpha", stt("alpha"))
    REGISTRY.register(Seam.STT, "beta", stt("beta"))
    REGISTRY.register(Seam.STT, "down", down(lambda **o: _FixtureSTT("down", **o)))

    # 1024 is the SERVER space (bge-m3 / arctic-l-v2.0). The desktop's local
    # 384-d space is a different space and must never be merged with it
    # (RAG-FORK.md). A second dim makes a space mismatch testable.
    REGISTRY.register(Seam.EMBEDDING, "alpha", embed("alpha", 1024))
    REGISTRY.register(Seam.EMBEDDING, "beta", embed("beta", 1024))
    REGISTRY.register(Seam.EMBEDDING, "small", embed("small", 384))
    REGISTRY.register(
        Seam.EMBEDDING, "down", down(lambda **o: _FixtureEmbedding("down", 1024, **o))
    )
