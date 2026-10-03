"""The fallback chain — the piece where a silent failover would otherwise happen.

`BACKEND.md` §8 is explicit: when the primary errors, chain to the next provider
and **record** that it happened. Never fail over silently. An operator who cannot
see that the premium tier quietly became the budget tier will discover it on an
invoice.

So the chain returns a result that says which provider actually answered. That
one field is the whole design: it turns "it works" into "it works, and I know
what it is costing me".
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, TypeVar

from .base import (
    REGISTRY,
    LLMProvider,
    ProviderConfig,
    ProviderUnavailable,
    Seam,
)

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class ChainResult[T]:
    """A chain outcome that cannot lie about which provider served it."""

    value: T
    provider: str
    #: Every provider tried, in order, including the one that succeeded.
    attempted: tuple[str, ...]
    #: True when the first choice did NOT answer. The console shows this as
    #: "chain took over" — it is the difference between a healthy system and a
    #: quietly degraded one.
    fallback_active: bool
    #: Non-fatal errors from providers that were tried and failed.
    degraded: tuple[str, ...] = field(default_factory=tuple)


class ChainExhausted(RuntimeError):
    """Every provider in the chain failed. This is a P1, not a retry loop."""

    def __init__(self, seam: Seam, attempted: Sequence[str], errors: Sequence[str]) -> None:
        detail = "; ".join(errors)
        super().__init__(
            f"{seam.value} chain exhausted after {len(attempted)}: {detail}"
        )
        self.seam = seam
        self.attempted = tuple(attempted)
        self.errors = tuple(errors)


async def run_chain[T](
    seam: Seam,
    config: ProviderConfig,
    call: Any,
    *,
    chain: Sequence[Any] | None = None,
) -> ChainResult[T]:
    """Run `call(provider)` against each provider in order until one answers.

    `call` receives a provider instance and returns the value to carry. A provider
    that raises `ProviderUnavailable` is skipped and the next one is tried; any
    other exception propagates, because an unexpected error is a bug we do not
    want to paper over with a silent retry against a different vendor.
    """
    providers = list(chain) if chain is not None else REGISTRY.chain(seam, config)
    if not providers:
        raise ChainExhausted(seam, (), ["no providers configured for this seam"])

    attempted: list[str] = []
    degraded: list[str] = []

    for provider in providers:
        name = getattr(provider, "name", type(provider).__name__)
        attempted.append(name)
        try:
            value = await call(provider)
        except ProviderUnavailable as exc:
            degraded.append(f"{name}: {exc}")
            continue
        return ChainResult(
            value=value,
            provider=name,
            attempted=tuple(attempted),
            fallback_active=len(attempted) > 1,
            degraded=tuple(degraded),
        )

    raise ChainExhausted(seam, attempted, degraded)


def llm_chain(config: ProviderConfig) -> list[LLMProvider]:
    """Typed convenience so callers do not re-annotate the untyped chain."""
    return [p for p in REGISTRY.chain(Seam.LLM, config) if isinstance(p, LLMProvider)]
