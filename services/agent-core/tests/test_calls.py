"""Tests for the call log, transcript, and alert endpoints (batch step 3).

Covers the read models over the real schema: calls list/detail, turns with
provenance, alerts. Empty results must be distinguishable from unreachable —
`reachable` is on every list response for exactly that reason.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from agent_core.contracts import AlertListResponse, CallDetail, CallListResponse
from agent_core.storage import CallStore, apply_migrations

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture()
def migrations_dir() -> Path:
    return Path(__file__).parent.parent / "migrations"


@pytest.fixture()
def seeded(db_path: Path, migrations_dir: Path) -> Path:
    """Apply migrations, seed one tenant + two calls + turns + an alert."""
    apply_migrations(db_path, migrations_dir)
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO tenants (id, name) VALUES (?, ?)",
        ("11111111-1111-1111-1111-111111111111", "Test SME"),
    )
    conn.execute(
        """INSERT INTO calls
           (id, tenant_id, channel, state, started_at, closed_at, caller_e164,
            caller_masked, purpose, outcome, contained, flagged, cost_eur,
            shadow_mode, spam_score, summary_sent, scope_version,
            containment_reason, summary)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "01JCALL0000000000000001",
            "11111111-1111-1111-1111-111111111111",
            "voice", "closed", "2026-10-03T09:00:00+00:00",
            "2026-10-03T09:02:30+00:00", "+33612345678", "+336****5678",
            "live", "contained", 1, "pricing", 0.042, 0, 0.12, 1, 3,
            "faq_hit", "Demande de tarif, repondue depuis la doc.",
        ),
    )
    conn.execute(
        """INSERT INTO calls
           (id, tenant_id, channel, state, started_at, closed_at, caller_e164,
            caller_masked, purpose, outcome, contained, shadow_mode, summary_sent)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "01JCALL0000000000000002",
            "11111111-1111-1111-1111-111111111111",
            "whatsapp", "closed", "2026-10-03T10:00:00+00:00",
            "2026-10-03T10:00:45+00:00", "+33698765432", "+336****5432",
            "test_call", "transferred", 0, 1, 0,
        ),
    )
    conn.execute(
        """INSERT INTO turns (call_id, idx, role, text, final, stt_ms, llm_ms, at)
           VALUES (?,?,?,?,?,?,?,?)""",
        ("01JCALL0000000000000001", 0, "caller", "Bonjour, vos tarifs ?", 1, 340, None,
         "2026-10-03T09:00:05+00:00"),
    )
    conn.execute(
        """INSERT INTO turns (call_id, idx, role, text, final, llm_ms, tts_ms,
                              provenance, emotion_tag, at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            "01JCALL0000000000000001", 1, "agent",
            "Nos tarifs commencent a 49 euros.", 1, 260, 140,
            '{"scopeVersion": 3, "chunks": [{"id": "k1", "score": 0.91}]}',
            "neutral", "2026-10-03T09:00:07+00:00",
        ),
    )
    conn.execute(
        """INSERT INTO alerts
           (id, tenant_id, severity, rule, one_liner, decision, evidence,
            call_ids, threshold_is_provisional, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            "a_01", "11111111-1111-1111-1111-111111111111", "P1",
            "transfer_failed",
            "Transfer failures — 6 in 20 min, target unreachable since 14:32 →",
            "Take 3 of these back yourself",
            '{"count":6,"firstAt":"14:32","lastAt":"14:51","blastRadius":"this tenant"}',
            '["01JCALL0000000000000002"]', 1, "2026-10-03T14:51:00+00:00",
        ),
    )
    conn.commit()
    conn.close()
    return db_path


@pytest.fixture()
def client(seeded: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("AGENT_CORE_DB_PATH", str(seeded))
    import importlib

    import agent_core.api as api_mod

    importlib.reload(api_mod)
    with TestClient(api_mod.app) as c:
        yield c


# ── Migration tests ───────────────────────────────────────────────────────────


class TestMigration0006:
    def test_applies(self, db_path: Path, migrations_dir: Path) -> None:
        applied = apply_migrations(db_path, migrations_dir)
        assert "0006_turns_alerts.sql" in applied

    def test_creates_turns_and_alerts(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        conn = sqlite3.connect(db_path)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        conn.close()
        assert "turns" in tables
        assert "alerts" in tables

    def test_calls_gains_the_new_columns(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        conn = sqlite3.connect(db_path)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(calls)").fetchall()}
        conn.close()
        for col in (
            "flagged", "cost_eur", "shadow_mode", "spam_score", "spam_reasons",
            "summary_sent", "scope_version", "containment_reason",
        ):
            assert col in cols, f"calls.{col} missing"

    def test_no_audio_column_in_turns(self, db_path: Path, migrations_dir: Path) -> None:
        """The rule that must not be quietly broken (CALL-FLOW §2)."""
        apply_migrations(db_path, migrations_dir)
        conn = sqlite3.connect(db_path)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(turns)").fetchall()}
        conn.close()
        for banned in ("audio_url", "audio_blob", "recording_url", "audio_path"):
            assert banned not in cols


# ── CallStore tests ───────────────────────────────────────────────────────────


class TestCallStore:
    def test_list_calls_newest_first(self, seeded: Path) -> None:
        store = CallStore(seeded)
        items, total = store.list_calls()
        assert total == 2
        assert items[0]["id"] == "01JCALL0000000000000002"  # 10:00 > 09:00

    def test_list_calls_paginates(self, seeded: Path) -> None:
        store = CallStore(seeded)
        items, total = store.list_calls(limit=1, offset=0)
        assert len(items) == 1
        assert total == 2

    def test_call_duration_computed(self, seeded: Path) -> None:
        store = CallStore(seeded)
        call = store.get_call("01JCALL0000000000000001")
        assert call is not None
        assert call["durationSec"] == 150

    def test_call_masked_number(self, seeded: Path) -> None:
        store = CallStore(seeded)
        call = store.get_call("01JCALL0000000000000001")
        assert call is not None
        assert call["callerMasked"] == "+336****5678"

    def test_call_shadow_mode(self, seeded: Path) -> None:
        store = CallStore(seeded)
        call = store.get_call("01JCALL0000000000000002")
        assert call is not None
        assert call["shadowMode"] is True

    def test_get_turns_ordered(self, seeded: Path) -> None:
        store = CallStore(seeded)
        turns = store.get_turns("01JCALL0000000000000001")
        assert len(turns) == 2
        assert turns[0]["idx"] == 0
        assert turns[0]["role"] == "caller"

    def test_turn_provenance_parsed(self, seeded: Path) -> None:
        store = CallStore(seeded)
        turns = store.get_turns("01JCALL0000000000000001")
        agent_turn = turns[1]
        assert agent_turn["provenance"] is not None
        assert agent_turn["provenance"]["scopeVersion"] == 3

    def test_list_alerts(self, seeded: Path) -> None:
        store = CallStore(seeded)
        items, total = store.list_alerts()
        assert total == 1
        assert items[0]["id"] == "a_01"
        assert items[0]["callIds"] == ["01JCALL0000000000000002"]

    def test_list_alerts_filters_severity(self, seeded: Path) -> None:
        store = CallStore(seeded)
        items, total = store.list_alerts(severity="P1")
        assert total == 1
        items2, total2 = store.list_alerts(severity="P2")
        assert total2 == 0

    def test_missing_call_returns_none(self, seeded: Path) -> None:
        store = CallStore(seeded)
        assert store.get_call("nonexistent") is None


# ── HTTP contract tests ───────────────────────────────────────────────────────


class TestGetCalls:
    def test_returns_200(self, client: TestClient) -> None:
        assert client.get("/calls").status_code == 200

    def test_shape(self, client: TestClient) -> None:
        body = client.get("/calls").json()
        assert set(body) == {"items", "total", "reachable"}
        assert body["total"] == 2
        assert body["reachable"] is True

    def test_item_keys(self, client: TestClient) -> None:
        body = client.get("/calls").json()
        item = body["items"][0]
        for key in (
            "id", "channel", "outcome", "state", "startedAt", "durationSec",
            "callerMasked", "flagged", "costEur", "containment",
        ):
            assert key in item, f"{key} missing"

    def test_camel_case(self, client: TestClient) -> None:
        body = client.get("/calls").json()
        item = body["items"][0]
        assert "callerMasked" in item
        assert "caller_masked" not in item

    def test_no_unmasked_number(self, client: TestClient) -> None:
        """The full E.164 must never appear in the list payload."""
        raw = client.get("/calls").text
        assert "+33612345678" not in raw
        assert "+33698765432" not in raw

    def test_matches_contract(self, client: TestClient) -> None:
        CallListResponse.model_validate(client.get("/calls").json())

    def test_limit_param(self, client: TestClient) -> None:
        body = client.get("/calls?limit=1").json()
        assert len(body["items"]) == 1
        assert body["total"] == 2


class TestGetCallDetail:
    def test_returns_200(self, client: TestClient) -> None:
        assert client.get("/calls/01JCALL0000000000000001").status_code == 200

    def test_includes_turns(self, client: TestClient) -> None:
        body = client.get("/calls/01JCALL0000000000000001").json()
        assert len(body["turns"]) == 2
        assert body["turns"][0]["role"] == "caller"

    def test_turn_provenance(self, client: TestClient) -> None:
        body = client.get("/calls/01JCALL0000000000000001").json()
        assert body["turns"][1]["provenance"]["scopeVersion"] == 3

    def test_containment_reason(self, client: TestClient) -> None:
        body = client.get("/calls/01JCALL0000000000000001").json()
        assert body["containmentReason"] == "faq_hit"

    def test_404_on_missing(self, client: TestClient) -> None:
        resp = client.get("/calls/nope")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "call_not_found"

    def test_matches_contract(self, client: TestClient) -> None:
        CallDetail.model_validate(client.get("/calls/01JCALL0000000000000001").json())


class TestGetAlerts:
    def test_returns_200(self, client: TestClient) -> None:
        assert client.get("/alerts").status_code == 200

    def test_shape(self, client: TestClient) -> None:
        body = client.get("/alerts").json()
        assert set(body) == {"items", "total", "reachable"}
        assert body["total"] == 1

    def test_alert_keys(self, client: TestClient) -> None:
        item = client.get("/alerts").json()["items"][0]
        for key in ("id", "severity", "rule", "oneLiner", "decision", "evidence", "callIds"):
            assert key in item, f"{key} missing"

    def test_severity_filter(self, client: TestClient) -> None:
        assert client.get("/alerts?severity=P1").json()["total"] == 1
        assert client.get("/alerts?severity=P2").json()["total"] == 0

    def test_matches_contract(self, client: TestClient) -> None:
        AlertListResponse.model_validate(client.get("/alerts").json())


class TestNoWriteRoutes:
    """Calls are created by channels, not by a client.

    A client that could create a call could fabricate a contained call, which
    is the pilot's headline metric.
    """

    def test_no_post_calls(self, client: TestClient) -> None:
        assert client.post("/calls", json={}).status_code == 405

    def test_no_delete_calls(self, client: TestClient) -> None:
        assert client.delete("/calls/01JCALL0000000000000001").status_code == 405


# ── Empty-state tests ─────────────────────────────────────────────────────────


class TestEmptyState:
    @pytest.fixture()
    def empty_client(
        self, db_path: Path, migrations_dir: Path, monkeypatch: pytest.MonkeyPatch
    ) -> TestClient:
        apply_migrations(db_path, migrations_dir)
        monkeypatch.setenv("AGENT_CORE_DB_PATH", str(db_path))
        import importlib

        import agent_core.api as api_mod

        importlib.reload(api_mod)
        with TestClient(api_mod.app) as c:
            yield c

    def test_empty_calls_is_reachable(self, empty_client: TestClient) -> None:
        """An empty list and an unreachable server must not look the same."""
        body = empty_client.get("/calls").json()
        assert body["items"] == []
        assert body["total"] == 0
        assert body["reachable"] is True

    def test_empty_alerts_is_reachable(self, empty_client: TestClient) -> None:
        body = empty_client.get("/alerts").json()
        assert body["items"] == []
        assert body["reachable"] is True
