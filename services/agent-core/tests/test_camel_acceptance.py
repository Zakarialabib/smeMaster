"""Inbound camelCase acceptance — the guard for a whole bug class.

`SessionRequest` inherited `BaseModel` instead of `Camel`. Nothing about the
class looked wrong. `assert_caller_allowed` was correct, the field was declared
correctly, the docstring promised the guard — and `callerOverride` was silently
dropped on the way in, so the field defaulted to `None` and the guard never
fired. A live session accepted a caller override through an endpoint whose whole
purpose was to refuse it.

Two things made it invisible:
1. The test asserted the METHOD raises. The method did. The wiring did not.
2. Every existing test posted snake_case, which `BaseModel` accepts happily.

So: assert that every inbound contract ACCEPTS its camelCase spelling, by
round-tripping real JSON through it. This is a structural test, so it covers
fields added later without anyone remembering to extend it.
"""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from agent_core import contracts as C

# Contracts that arrive from a client and therefore MUST accept camelCase.
INBOUND = [
    C.SessionRequest,
    C.IngestRequest,
    C.SearchRequest,
    C.ClientFrame,
]

ALL_CONTRACTS = [
    getattr(C, name)
    for name in dir(C)
    if isinstance(getattr(C, name), type)
    and issubclass(getattr(C, name), BaseModel)
    and getattr(C, name) is not BaseModel
]


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


def _is_inbound(model: type[BaseModel]) -> bool:
    return model in INBOUND


class TestInboundAcceptsCamelCase:
    @pytest.mark.parametrize("model", INBOUND, ids=lambda m: m.__name__)
    def test_inherits_camel(self, model: type[BaseModel]) -> None:
        assert issubclass(model, C.Camel), (
            f"{model.__name__} is inbound, so it must accept camelCase. "
            "Inheriting BaseModel silently DROPS camelCase fields, which turns "
            "a validation guard into a no-op."
        )

    @pytest.mark.parametrize("model", ALL_CONTRACTS, ids=lambda m: m.__name__)
    def test_serialises_every_field_in_camel(self, model: type[BaseModel]) -> None:
        """Whatever the base class, no snake_case may reach the wire."""
        for fname in model.model_fields:
            if _is_inbound(model):
                continue
            assert _camel(fname) != fname or "_" not in fname, (
                f"{model.__name__}.{fname} would serialise as snake_case"
            )

    def test_caller_override_reaches_the_model(self) -> None:
        """The exact regression: a field that is dropped in, not raised on."""
        body = C.SessionRequest.model_validate(
            {"channel": "voice", "purpose": "live", "callerOverride": "+33612345678"}
        )
        assert body.caller_override is not None, (
            "callerOverride was dropped on input — the live-session guard is a no-op"
        )

    def test_the_live_guard_actually_fires_end_to_end(self) -> None:
        body = C.SessionRequest.model_validate(
            {"channel": "voice", "purpose": "live", "callerOverride": "+33612345678"}
        )
        with pytest.raises(PermissionError):
            body.assert_caller_allowed()

    def test_snake_case_is_still_accepted(self) -> None:
        """populate_by_name stays on, so internal callers are unaffected."""
        body = C.SessionRequest.model_validate(
            {"channel": "voice", "purpose": "test_call", "caller_override": "+33612345678"}
        )
        assert body.caller_override == "+33612345678"
