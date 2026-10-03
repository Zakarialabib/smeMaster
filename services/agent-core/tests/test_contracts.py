"""Contract tests: the ones that catch a console crash before a client does.

The standing rule on this repo is to assert the **summary line**, not the exit
code. A test that asserts a shape rather than a truthiness is what actually pins
the contract.

NOTE ON ENCODING: this file is deliberately **pure ASCII**. pytest's assertion
rewriter reads the test module with the locale codec (cp1252 on this Windows
host); a non-ASCII *literal* in an assert gets mangled and surfaces as a
NameError on a name that imported perfectly well - a genuinely baffling failure
that costs an hour. Assertions needing accented characters use `chr()` instead.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from agent_core.api import VERSION, app
from agent_core.contracts import (
    DISCLOSURE_FR,
    EMERGENCY_NUMBERS,
    Health,
    OpsSnapshot,
    SessionPurpose,
    SessionRequest,
)

client = TestClient(app, raise_server_exceptions=False)

MIDDOT = chr(0xB7)
GUIL_OPEN = chr(0xAB)
GUIL_CLOSE = chr(0xBB)


class TestHealthz:
    def test_returns_the_contract_shape(self) -> None:
        r = client.get("/healthz")
        assert r.status_code == 200
        # Exact keys: the console reads these by name, camelCase.
        assert set(r.json()) == {"ok", "version", "startedAt", "db", "providers"}

    def test_typed_as_health(self) -> None:
        assert Health.model_validate(client.get("/healthz").json()).ok is True

    def test_leaks_no_tenant_data(self) -> None:
        raw = client.get("/healthz").text.lower()
        for leak in ("tenant", "transcript", "provider_key", "phone", "e164"):
            assert leak not in raw, f"/healthz must not mention {leak!r}"

    def test_version_matches_package(self) -> None:
        from agent_core import __version__

        assert client.get("/healthz").json()["version"] == __version__ == VERSION


class TestSessionGuard:
    """`caller_override` is the field that could turn a test endpoint into a
    call-placement primitive. It is guarded in the contract, not in the UI."""

    def test_test_call_may_set_a_caller(self) -> None:
        s = SessionRequest(
            channel="voice", purpose=SessionPurpose.TEST_CALL, caller_override="+33612345678"
        )
        s.assert_caller_allowed()

    def test_live_call_may_not_set_a_caller(self) -> None:
        s = SessionRequest(
            channel="voice", purpose=SessionPurpose.LIVE, caller_override="+33612345678"
        )
        with pytest.raises(PermissionError):
            s.assert_caller_allowed()

    def test_live_call_without_a_caller_is_fine(self) -> None:
        SessionRequest(channel="voice", purpose=SessionPurpose.LIVE).assert_caller_allowed()

    @pytest.mark.parametrize(
        "bad", ["+33 6 12 34 56 78", "0033612345678", "33612345678", "+0", "+336123456789012345"]
    )
    def test_non_e164_is_rejected_at_parse(self, bad: str) -> None:
        with pytest.raises(ValueError):
            SessionRequest(channel="voice", purpose=SessionPurpose.TEST_CALL, caller_override=bad)


class TestOpsContract:
    def test_reachability_is_not_optional(self) -> None:
        """Omitting `reachable` is how "offline" starts rendering as "no calls"."""
        s = OpsSnapshot.model_validate(
            {
                "generatedAt": "2026-09-28T14:51:00Z",
                "since": "2026-09-28T08:00:00Z",
                "p1": [],
                "p2Grouped": {},
                "p3Count": 0,
                "callCount": 0,
                "containedPct": 0,
                "reachable": True,
                "lastSeenAt": "2026-09-28T14:51:00Z",
            }
        )
        assert s.reachable is True

    def test_missing_reachable_is_a_validation_error(self) -> None:
        with pytest.raises(ValueError):
            OpsSnapshot.model_validate(
                {
                    "generatedAt": "x",
                    "since": "x",
                    "p1": [],
                    "p2Grouped": {},
                    "p3Count": 0,
                    "callCount": 0,
                    "containedPct": 0,
                    "lastSeenAt": None,
                }
            )


class TestNoTenantId:
    def test_no_contract_carries_a_tenant_field(self) -> None:
        """Tenant identity comes from the token, server-side (ADR-001 D4a).

        If this test ever fails, a client could *set* its own tenant. That is a
        security regression, not a schema tidy-up.
        """

        from agent_core import contracts

        offenders: list[str] = []
        for name in dir(contracts):
            model_fields = getattr(getattr(contracts, name), "model_fields", None)
            if not model_fields:
                continue
            for field in model_fields:
                if "tenant" in field.lower():
                    offenders.append(f"{name}.{field}")
        assert offenders == [], f"tenant fields must not exist on client contracts: {offenders}"


class TestDisclosureAndEmergency:
    def test_disclosure_is_french_and_names_the_human_escape(self) -> None:
        # Bind to a local. The same asserts pass in plain Python but pytest's
        # rewriter on this host intermittently loses the module-global lookup and
        # reports a NameError on a name that imported fine. A local binding
        # removes the global lookup from the rewritten assert entirely.
        d = DISCLOSURE_FR
        assert "assistant IA" in d
        assert "agent" in d  # the deterministic escape hatch
        assert "transf" in d  # "transfere a un humain"
        assert chr(0xAB) in d  # opening guillemet
        assert chr(0xBB) in d  # closing guillemet

    def test_emergency_numbers_are_french_in_every_locale(self) -> None:
        """UX.md 16: emergency numbers are COPY, not locale. A French tenant shows
        15/17/112 even in the `ar` interface - locale-substituting them is a bug
        that a non-French-speaking reviewer will not catch."""
        n = EMERGENCY_NUMBERS
        assert n == f"15 {chr(0xB7)} 17 {chr(0xB7)} 112"
        assert n.startswith("15")


class TestErrorEnvelope:
    def test_unhandled_errors_still_return_the_envelope(self) -> None:
        @app.get("/_test/boom")
        async def _boom() -> None:
            raise RuntimeError("synthetic")

        r = client.get("/_test/boom")
        assert r.status_code == 500
        body = r.json()
        assert set(body) == {"error"}
        assert set(body["error"]) >= {"code", "message", "retryable", "at"}
        assert body["error"]["code"] == "internal_error"

    def test_cors_is_not_wildcard(self) -> None:
        r = client.get("/healthz", headers={"Origin": "https://evil.example"})
        # No allow-origin header => the browser blocks it. That is the point.
        assert r.headers.get("access-control-allow-origin") != "*"
