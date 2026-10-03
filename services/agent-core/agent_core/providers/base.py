"""The four provider seams.

**This module is the reversibility guarantee.** There are exactly four seams — LLM,
TTS, STT, embedding — and each is an abstract base class whose second
implementation must swap in by a **config value alone**, with no code change. That
property is the Gate 1 exit criterion, and `tests/test_swap.py` is the proof.

Two shapes that come from the sherpa-onnx React Native wrapper and are worth
having regardless of runtime (see `FRONTEND.md` §3): an engine facade, a
capability view, and a config object that names the backend rather than a build
flag. What is **not** taken is the dependency, the field names, or the transport.

Why a capability view at all: "supported" is a property of *this host*, not of
the project. A plain VPS reports `execution_providers == ["cpu"]` and no GPU. The
console must be able to say "offline model not installed on this device" instead
of failing at capture time — that is the difference between a settings screen and
a support ticket.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal, cast

from ..contracts import VoiceLocale

# ── Shared vocabulary ───────────────────────────────────────────────────────


class Seam(StrEnum):
    """The four seams. Adding a fifth is an architecture decision, not a patch."""

    LLM = "llm"
    TTS = "tts"
    STT = "stt"
    EMBEDDING = "embedding"


#: A provider factory: options as kwargs in, a provider instance out. A class
#: satisfies it; so does a lambda. Annotating registrations as `type` is wrong.
ProviderFactory = Callable[..., "object"]


class ProviderUnavailable(RuntimeError):
    """A provider cannot serve right now.

    Carries `provider` and `retryable` because the fallback chain branches on them
    and the console shows a degraded provider by name. A bare exception here
    produces a silent failover, which is the one behaviour `BACKEND.md` §8 lists
    under "Never".
    """

    def __init__(self, message: str, *, provider: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class Capabilities:
    """What THIS host can actually do. Per-host, not per-project."""

    stt: bool
    tts: bool
    embedding: bool
    llm: bool
    #: Compute backends available for the local tier. A plain VPS: ``("cpu",)``.
    execution_providers: tuple[str, ...] = ("cpu",)
    #: Model id -> version, for the ones actually installed.
    models_installed: dict[str, str] = field(default_factory=dict)
    #: False when the local tier is gated on an unmeasured RTF (SELF-HOSTING.md).
    local_tier_enabled: bool = False
    local_tier_blocked_reason: str | None = None

    def describe_gap(self) -> str | None:
        """A short, honest reason a capability is missing — for the settings screen."""
        if self.local_tier_enabled:
            return None
        if self.local_tier_blocked_reason:
            return self.local_tier_blocked_reason
        if not self.models_installed:
            return "No local speech models are installed on this host."
        return None


@dataclass(frozen=True, slots=True)
class ProviderConfig:
    """Per-seam config. **Every field here is a swap axis** — a value, never a branch."""

    #: Seam -> ordered provider names. The first is primary; the rest are fallbacks.
    chain: dict[Seam, tuple[str, ...]] = field(default_factory=dict)
    #: Provider name -> its own settings. Keeps vendor detail out of the chain.
    options: dict[str, dict[str, str]] = field(default_factory=dict)

    def chain_for(self, seam: Seam) -> tuple[str, ...]:
        return self.chain.get(seam, ())

    def options_for(self, provider: str) -> dict[str, str]:
        """The whole settings dict for one provider, as a constructor kwargs bag.

        A provider factory takes its own settings as keyword arguments, so a
        factory for one setting is a one-liner: `lambda o: Foo(model=o["model"])`.
        """
        return dict(self.options.get(provider, {}))

    def option(self, provider: str, key: str, default: str | None = None) -> str | None:
        return self.options.get(provider, {}).get(key, default)


# ── LLM ─────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class LLMUsage:
    prompt_tokens: int
    completion_tokens: int

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class LLMProvider(ABC):
    """The brain. Text in, text out, streaming.

    Note what this does NOT do: it does not see audio. Verified against the
    OpenRouter catalogue on 2026-09-28 — 458 models, ~41 accept audio input, and
    only 4 produce audio output. OpenRouter is the brain, never the voice.
    """

    name: str

    @abstractmethod
    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        max_tokens: int = 256,
        temperature: float = 0.3,
    ) -> tuple[str, LLMUsage]: ...

    @abstractmethod
    def stream(
        self,
        messages: Sequence[ChatMessage],
        *,
        max_tokens: int = 256,
    ) -> AsyncIterator[str]:
        """Async generator — declared WITHOUT `async def`.

        A method containing `yield` inside `async def` is an async-generator
        FUNCTION: calling it returns an iterator, not a coroutine, and mypy
        rejects the AsyncIterator return type. Every streaming method here and in
        the implementations follows this shape.
        """
        ...  # pragma: no cover - abstract


# ── TTS ─────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SpeechRequest:
    text: str
    locale: VoiceLocale
    #: Provider-specific voice id, e.g. "siwis-medium". Config, never a constant.
    voice: str
    #: Carrier media is mu-law 8 kHz; the cloud path resamples up. Keeping the
    #: target explicit stops a 16 kHz stream being fed to an 8 kHz transport.
    sample_rate_hz: Literal[8000, 16000] = 16000
    format: Literal["pcm", "mp3", "opus"] = "pcm"


class TTSProvider(ABC):
    """Voice out. The dominant variable cost and the dominant latency source."""

    name: str

    @abstractmethod
    async def synthesize(self, req: SpeechRequest) -> bytes: ...

    @abstractmethod
    def stream(self, req: SpeechRequest) -> AsyncIterator[bytes]:
        """Async generator — see `LLMProvider.stream` for why there is no `async`."""
        ...  # pragma: no cover - abstract


# ── STT ─────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class TranscriptResult:
    text: str
    #: True once the provider considers the utterance finished. A partial is what
    #: makes a live transcript feel live.
    is_final: bool
    locale: VoiceLocale | None = None
    confidence: float | None = None


class STTProvider(ABC):
    """Voice in. Streaming, because a batch STT cannot drive a live turn loop."""

    name: str

    @abstractmethod
    async def transcribe(
        self,
        audio: bytes,
        *,
        locale: VoiceLocale,
        hotwords: Sequence[str] = (),
    ) -> TranscriptResult: ...

    @abstractmethod
    def stream(self, locale: VoiceLocale, *, hotwords: Sequence[str] = ()) -> SpeechSession: ...


class SpeechSession(ABC):
    """One streaming recognition session: push audio, receive partials."""

    @abstractmethod
    def push(self, pcm: bytes) -> None: ...

    @abstractmethod
    def events(self) -> AsyncIterator[TranscriptResult]:
        """Async generator: declare WITHOUT `async def`, or the returned value is
        a coroutine wrapping an iterator and every `async for` breaks."""
        ...  # pragma: no cover - abstract

    @abstractmethod
    async def close(self) -> None: ...


# ── Embedding ───────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class EmbeddingResult:
    vector: tuple[float, ...]
    #: Reported so a client can detect a space mismatch. It is CONFIG, never a
    #: constant in code (ADR-001 D2) — a hard-coded 384 is a latent runtime
    #: failure, not a compile error.
    dims: int
    model: str


class EmbeddingProvider(ABC):
    """Text to vector. Self-hosted so the client's KB never leaves the EU."""

    name: str

    @property
    @abstractmethod
    def dims(self) -> int:
        """Dimension of the space this provider produces."""

    @abstractmethod
    async def embed(self, texts: Sequence[str]) -> list[EmbeddingResult]: ...


# ── Registry ────────────────────────────────────────────────────────────────

ProviderT = LLMProvider | TTSProvider | STTProvider | EmbeddingProvider


class ProviderRegistry:
    """Name -> instance. The ONLY place a concrete provider class is chosen.

    Registration happens at import time in `providers/__init__.py`. Nothing else
    in the codebase may construct a provider directly: if it does, the swap test
    stops meaning anything.
    """

    def __init__(self) -> None:
        # Seam -> provider name -> factory. (The reverse nesting is an easy slip
        # and fails at the first create(), not at construction.)
        #
        # A "factory" is any callable taking options as kwargs and returning a
        # provider instance — a class works, a lambda works. Annotating it as
        # `type` is wrong and mypy catches every registration.
        self._factories: dict[Seam, dict[str, ProviderFactory]] = {seam: {} for seam in Seam}

    def register(self, seam: Seam, name: str, factory: ProviderFactory) -> None:
        self._factories[seam][name] = factory

    def names(self, seam: Seam) -> tuple[str, ...]:
        return tuple(self._factories[seam])

    def create(self, seam: Seam, name: str, config: ProviderConfig) -> ProviderT:
        try:
            factory = self._factories[seam][name]
        except KeyError:
            known = ", ".join(self.names(seam)) or "(none registered)"
            raise KeyError(
                f"no {seam.value} provider named {name!r}; registered: {known}"
            ) from None
        # The factory is typed as returning `object` because it is genuinely
        # untyped (a lambda over four different classes). The seam is what makes
        # the result correct, and every registration is checked at runtime by
        # `test_every_seam_yields_its_own_trait` — so this cast is backed by a
        # test, not by hope.
        return cast("ProviderT", factory(**config.options_for(name)))

    def chain(self, seam: Seam, config: ProviderConfig) -> list[ProviderT]:
        """Every provider in the chain, in order. The last one is the floor."""
        return [self.create(seam, n, config) for n in config.chain_for(seam)]


REGISTRY = ProviderRegistry()
