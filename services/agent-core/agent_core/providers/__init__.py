"""Provider seams: LLM, TTS, STT, embedding.

Importing this package registers every implementation. That is deliberate, and it
is the reason swapping is a config change: registration happens in exactly one
place (`fixtures.py` today, `live.py` when the keys exist), and nothing else in
the codebase may construct a provider directly. If something does, the swap test
in `tests/test_swap.py` stops meaning anything.
"""

from __future__ import annotations

from .base import REGISTRY, ProviderConfig, ProviderUnavailable, Seam
from .chain import ChainExhausted, ChainResult, run_chain
from .fixtures import register_fixtures

register_fixtures()

__all__ = [
    "REGISTRY",
    "ChainExhausted",
    "ChainResult",
    "ProviderConfig",
    "ProviderUnavailable",
    "Seam",
    "run_chain",
]
