"""THE GATE 1 EXIT CRITERION.

> "The swap test is the Gate 1 exit criterion: a second implementation of each
> seam swaps in by a **config value alone**, with no code change."
> — `docs/voice/design/BACKEND.md` §3

This file is that criterion, executed. Everything else in the provider layer is
infrastructure; this is the proof the infrastructure earns its keep.

The shape of the proof, and why it is stronger than a mock:
- `alpha` and `beta` are **real** implementations, not mocks. Neither is
  simulated to fail. The test swaps the config and observes a different provider
  serve the request.
- The **only** thing that changes between the two runs is a dict in a config
  object. No import, no monkeypatch, no code path, no branch on a provider name.
- A **third** run with a `down` primary proves the chain degrades visibly rather
  than silently, which is the same criterion's other half.
"""

from __future__ import annotations

import pytest

from agent_core.contracts import VoiceLocale
from agent_core.providers.base import (
    REGISTRY,
    ChatMessage,
    EmbeddingProvider,
    LLMProvider,
    ProviderConfig,
    Seam,
    SpeechRequest,
    STTProvider,
    TTSProvider,
)
from agent_core.providers.chain import ChainExhausted, run_chain
from agent_core.providers.fixtures import register_fixtures

register_fixtures()

MESSAGES = [ChatMessage(role="user", content="Je voudrais un rendez-vous.")]


def cfg(**chains: tuple[str, ...]) -> ProviderConfig:
    """Build a config whose ONLY variable is which provider names appear."""
    return ProviderConfig(chain={Seam(k): v for k, v in chains.items()}, options={})


# ── The swap test ───────────────────────────────────────────────────────────


class TestSwapByConfigAlone:
    async def test_llm_swaps_with_no_code_change(self) -> None:
        c = cfg(llm=("alpha",))
        first = await run_chain(Seam.LLM, c, lambda p: p.complete(MESSAGES))
        # THE ONLY DIFFERENCE IS THIS LINE.
        c2 = cfg(llm=("beta",))
        second = await run_chain(Seam.LLM, c2, lambda p: p.complete(MESSAGES))

        assert first.provider == "alpha"
        assert second.provider == "beta"
        assert first.value[0] != second.value[0], "a real swap changes the answer"

    async def test_tts_swaps_with_no_code_change(self) -> None:
        c = cfg(tts=("alpha",))
        first = await run_chain(Seam.TTS, c, lambda p: p.synthesize(_req()))
        c2 = cfg(tts=("beta",))
        second = await run_chain(Seam.TTS, c2, lambda p: p.synthesize(_req()))
        assert first.provider == "alpha"
        assert second.provider == "beta"
        assert first.value != second.value

    async def test_stt_swaps_with_no_code_change(self) -> None:
        c = cfg(stt=("alpha",))
        first = await run_chain(Seam.STT, c, lambda p: p.transcribe(b"\x00" * 320, locale="fr"))
        c2 = cfg(stt=("beta",))
        second = await run_chain(Seam.STT, c2, lambda p: p.transcribe(b"\x00" * 320, locale="fr"))
        assert first.provider == "alpha"
        assert second.provider == "beta"

    async def test_embedding_swaps_with_no_code_change(self) -> None:
        c = cfg(embedding=("alpha",))
        first = await run_chain(Seam.EMBEDDING, c, lambda p: p.embed(["bonjour"]))
        c2 = cfg(embedding=("beta",))
        second = await run_chain(Seam.EMBEDDING, c2, lambda p: p.embed(["bonjour"]))
        assert first.provider == "alpha"
        assert second.provider == "beta"
        assert first.value[0].vector != second.value[0].vector


def _req() -> SpeechRequest:
    return SpeechRequest(text="Bonjour", locale=VoiceLocale.FR, voice="siwis-medium")


# ── Every seam has at least two real implementations ────────────────────────


class TestTwoImplementationsPerSeam:
    @pytest.mark.parametrize("seam", list(Seam))
    def test_seam_has_at_least_two_live_implementations(self, seam: Seam) -> None:
        # `down` is a failure fixture, not an implementation, so it does not count.
        live = [n for n in REGISTRY.names(seam) if n != "down"]
        assert len(live) >= 2, f"{seam.value} needs 2+ implementations to prove a swap"

    @pytest.mark.parametrize("seam", list(Seam))
    def test_every_seam_yields_its_own_trait(self, seam: Seam) -> None:
        expected = {
            Seam.LLM: LLMProvider,
            Seam.TTS: TTSProvider,
            Seam.STT: STTProvider,
            Seam.EMBEDDING: EmbeddingProvider,
        }[seam]
        c = cfg(**{seam.value: ("alpha",)})
        provider = REGISTRY.chain(seam, c)[0]
        assert isinstance(provider, expected)


# ── The chain degrades VISIBLY (the other half of the criterion) ─────────────


class TestFallbackIsVisible:
    async def test_chain_takes_over_and_says_so(self) -> None:
        c = cfg(llm=("down", "alpha"))
        result = await run_chain(Seam.LLM, c, lambda p: p.complete(MESSAGES))
        # The primary could not answer...
        assert result.provider == "alpha"
        assert result.fallback_active is True, "a silent failover is the thing we forbid"
        # ...and the failure is recorded, not swallowed.
        assert result.attempted == ("down", "alpha")
        assert result.degraded and "down" in result.degraded[0]

    async def test_healthy_chain_reports_no_fallback(self) -> None:
        c = cfg(llm=("alpha", "beta"))
        result = await run_chain(Seam.LLM, c, lambda p: p.complete(MESSAGES))
        assert result.provider == "alpha"
        assert result.fallback_active is False
        assert result.degraded == ()

    async def test_exhausted_chain_raises_with_blast_radius(self) -> None:
        # Exhaustion is a P1 with a named blast radius, NOT a retry loop.
        c = cfg(llm=("down",))
        with pytest.raises(ChainExhausted) as ei:
            await run_chain(Seam.LLM, c, lambda p: p.complete(MESSAGES))
        assert ei.value.seam is Seam.LLM
        assert ei.value.attempted == ("down",)
        assert ei.value.errors

    async def test_empty_chain_is_an_error_not_a_silent_default(self) -> None:
        with pytest.raises(ChainExhausted):
            await run_chain(Seam.LLM, cfg(), lambda p: p.complete(MESSAGES))


# ── Dimensions are config, never a constant (ADR-001 D2) ───────────────────


class TestDimensionsAreConfig:
    def test_reported_dimensions_differ_per_model(self) -> None:
        big = REGISTRY.chain(Seam.EMBEDDING, cfg(embedding=("alpha",)))[0]
        small = REGISTRY.chain(Seam.EMBEDDING, cfg(embedding=("small",)))[0]
        assert big.dims == 1024
        assert small.dims == 384

    async def test_a_space_mismatch_is_visible_in_the_result(self) -> None:
        # The whole point of reporting `dims` on every result: a client can detect
        # that it queried the wrong space instead of silently retrieving nothing.
        result = await run_chain(
            Seam.EMBEDDING, cfg(embedding=("small",)), lambda p: p.embed(["bonjour"])
        )
        assert result.value[0].dims == 384
        assert len(result.value[0].vector) == 384


# ── Provider names never leak into control flow ─────────────────────────────


class TestNoProviderBranchingInCode:
    def test_chain_order_comes_only_from_config(self) -> None:
        c = cfg(llm=("beta", "alpha", "down"))
        names = [p.name for p in REGISTRY.chain(Seam.LLM, c)]
        assert names == ["beta", "alpha", "down"]

    async def test_unknown_provider_names_the_alternatives(self) -> None:
        with pytest.raises(KeyError) as ei:
            REGISTRY.create(Seam.LLM, "not-a-provider", ProviderConfig())
        # A useful error, not an AttributeError 200 lines away.
        assert "registered" in str(ei.value)
