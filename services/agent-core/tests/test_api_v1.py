"""Endpoint tests (Phase B2).

These assert the console can be built against this server: the payload shapes
are the contract, and the console's TypeScript is typed against them. A change
here that renames a field is a console breaking change, so each test pins the
**exact key set**, not a truthiness.

Fixture data, real shapes. Nothing here proves telephony or a provider works;
it proves the console can be wired to a real HTTP surface today.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from agent_core.api import app
from agent_core.contracts import DISCLOSURE_FR

client = TestClient(app, raise_server_exceptions=False)


class TestSession:
    def test_test_call_creates_a_session(self) -> None:
        r = client.post(
            "/session",
            json={
                "channel": "voice",
                "purpose": "test_call",
                "locale": "fr",
                "callerOverride": "+33612345678",
            },
        )
        assert r.status_code == 201
        assert set(r.json()) == {"sessionId", "state", "openedAt", "wsUrl", "disclosure"}

    def test_live_session_cannot_set_a_caller(self) -> None:
        # The guard that keeps a test endpoint from being a call-placement
        # primitive. 403 + the documented error envelope, not a 500.
        r = client.post(
            "/session",
            json={
                "channel": "voice",
                "purpose": "live",
                "callerOverride": "+33612345678",
            },
        )
        assert r.status_code == 403
        body = r.json()
        assert body["error"]["code"] == "caller_override_not_allowed"
        assert body["error"]["retryable"] is False

    def test_live_session_without_a_caller_is_created(self) -> None:
        r = client.post("/session", json={"channel": "voice", "purpose": "live"})
        assert r.status_code == 201

    def test_session_never_echoes_a_tenant(self) -> None:
        r = client.post("/session", json={"channel": "whatsapp", "purpose": "live"})
        assert "tenant" not in r.text.lower()

    def test_disclosure_is_returned(self) -> None:
        r = client.post("/session", json={"channel": "voice", "purpose": "live"})
        assert r.json()["disclosure"] == DISCLOSURE_FR


class TestOpsSnapshot:
    def test_shape_is_exact(self) -> None:
        r = client.get("/ops/snapshot")
        assert r.status_code == 200
        assert set(r.json()) == {
            "generatedAt", "since", "p1", "p2Grouped", "p3Count",
            "callCount", "containedPct", "reachable", "lastSeenAt",
        }

    def test_reachable_is_always_present(self) -> None:
        # The console branches on this to render "cannot reach the agent" rather
        # than "no calls". Missing is worse than false.
        assert "reachable" in client.get("/ops/snapshot").json()

    def test_alerts_carry_provenance_and_a_decision(self) -> None:
        p1 = client.get("/ops/snapshot").json()["p1"]
        assert p1, "the fixture needs a P1 or the digest cannot be built"
        a = p1[0]
        assert a["severity"] == "P1"
        assert a["decision"], "an alert without a decision is a log line"
        assert a["thresholdIsProvisional"] is True
        assert set(a["evidence"]) == {"count", "firstAt", "lastAt", "blastRadius"}

    def test_p2_is_grouped_by_rule_not_by_time(self) -> None:
        grouped = client.get("/ops/snapshot").json()["p2Grouped"]
        assert grouped, "P2 must be grouped so 6 failures read as one problem"
        assert all(isinstance(v, list) for v in grouped.values())

    def test_dev_variant_adds_provider_health(self) -> None:
        body = client.get("/ops/snapshot/dev").json()
        health = body["providerHealth"]
        assert health
        assert set(health[0]) == {
            "provider", "role", "errorRate", "latencyP95Ms",
            "fallbackActive", "state",
        }


class TestDemoTurn:
    def test_emits_the_frames_the_console_consumes(self) -> None:
        frames = client.get("/session/01JTEST/demo-turn").json()
        kinds = [f["type"] for f in frames]
        assert kinds == ["state", "delta", "stages", "delta", "meta"]

    def test_delta_frames_carry_a_monotonic_seq(self) -> None:
        frames = client.get("/session/01JTEST/demo-turn").json()
        seqs = [f["seq"] for f in frames if f["type"] == "delta"]
        assert seqs == sorted(seqs), "the client dedups on (callId, turnId, seq)"

    def test_meta_reports_whether_the_chain_degraded(self) -> None:
        frames = client.get("/session/01JTEST/demo-turn").json()
        meta = next(f for f in frames if f["type"] == "meta")
        # Healthy fixture chain (alpha first) => no fallback. If this ever reports
        # True, alpha went down and the console should be showing a degradation.
        assert meta["fallbackActive"] is False
        assert meta["chainTier"] == "standard"

    def test_frames_are_camel_case(self) -> None:
        raw = client.get("/session/01JTEST/demo-turn").text
        assert "callId" in raw
        assert "call_id" not in raw


class TestProviderRegistryEndpoint:
    def test_lists_every_seam(self) -> None:
        body = client.get("/providers/registry").json()
        assert set(body["registered"]) == {"llm", "tts", "stt", "embedding"}

    def test_exposes_names_not_credentials(self) -> None:
        raw = client.get("/providers/registry").text.lower()
        for secret in ("api_key", "apikey", "secret", "token", "password"):
            assert secret not in raw


class TestWebsocket:
    def test_refuses_without_a_token(self) -> None:
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect), client.websocket_connect(
            "/ws/transcript"
        ) as ws:
            ws.receive_text()

    def test_ping_gets_pong(self) -> None:
        with client.websocket_connect(
            "/ws/transcript", headers={"Authorization": "Bearer dev"}
        ) as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            assert json.loads(ws.receive_text())["type"] == "pong"

    def test_any_other_frame_is_closed_not_ignored(self) -> None:
        # The client has exactly one legal frame. Anything else is refused with a
        # close code, so a would-be control cannot be mistaken for success.
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect), client.websocket_connect(
            "/ws/transcript", headers={"Authorization": "Bearer dev"}
        ) as ws:
            ws.send_text(json.dumps({"type": "transfer", "target": "+33612345678"}))
            ws.receive_text()

    def test_a_malformed_frame_is_closed(self) -> None:
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect), client.websocket_connect(
            "/ws/transcript", headers={"Authorization": "Bearer dev"}
        ) as ws:
            ws.send_text("not json at all")
            ws.receive_text()
